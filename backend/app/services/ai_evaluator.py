"""
AI-Powered Answer Evaluator using the unified AI Service Layer.

Provides intelligent evaluation for subjective answers (short, long, case study)
that goes beyond keyword matching - understanding context, reasoning quality,
and providing pedagogically useful feedback.

Also includes vision-based diagram evaluation for student-drawn diagrams.
"""

import base64
import json
import logging
import os
from typing import Optional

from pydantic import BaseModel, Field

from ..models.exam import Question, StudentAnswer, QuestionType
from .ai_service import ai_service

logger = logging.getLogger(__name__)


EVALUATION_SYSTEM = (
    "You are an expert exam evaluator for Indian school board exams (CBSE/ICSE). "
    "You evaluate student answers fairly, providing detailed feedback that helps "
    "students learn. Be encouraging but honest."
)

EVALUATION_PROMPT = """Evaluate this Class {class_grade} {board} {subject} student's answer.

## Question
Type: {question_type}
Topic: {topic}
Marks: {marks}

{question_text}

## Model Answer (Reference)
{model_answer}

## Expected Keywords/Concepts
{keywords}

## Student's Answer
{student_answer}

## Your Task
Award marks fairly based on:
- Accuracy of content and concepts
- Completeness of the answer
- Use of proper terminology and keywords
- Logical flow and clarity of explanation
- For numerical: correctness of steps and final answer
- For diagrams: mention of key labels and structure"""


class RubricScores(BaseModel):
    content_accuracy: int = Field(ge=0, le=4)
    completeness: int = Field(ge=0, le=4)
    terminology: int = Field(ge=0, le=4)
    presentation: int = Field(ge=0, le=4)


class AIEvaluationResult(BaseModel):
    marks_obtained: float
    feedback: str
    keywords_found: list[str] = []
    keywords_missing: list[str] = []
    improvement_hint: str = ""
    rubric_scores: RubricScores
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)


async def evaluate_with_ai(
    question: Question,
    answer: StudentAnswer,
    board: str = "CBSE",
    subject: str = "Mathematics",
    class_grade: int = 10,
) -> Optional[dict]:
    """
    Evaluate a student's answer using the unified AI service.

    Returns evaluation dict or None if AI is unavailable.
    """
    if not answer.answer_text:
        return {
            "marks_obtained": 0.0,
            "marks_possible": question.marks,
            "feedback": "No answer provided.",
            "keywords_found": [],
            "keywords_missing": list(question.answer_keywords or []),
            "improvement_hint": "Please attempt the question.",
            "rubric_scores": {
                "content_accuracy": 0,
                "completeness": 0,
                "terminology": 0,
                "presentation": 0,
            },
            "confidence": 1.0,
            "evaluation_method": "ai",
        }

    # Only use AI for subjective questions
    if question.question_type in (
        QuestionType.MCQ, QuestionType.TRUE_FALSE, QuestionType.FILL_IN_BLANK
    ):
        return None  # Fall back to rule-based for objective questions

    prompt = EVALUATION_PROMPT.format(
        board=board,
        subject=subject,
        class_grade=class_grade,
        question_type=question.question_type.value.replace("_", " "),
        topic=question.topic,
        marks=question.marks,
        question_text=question.question_text,
        model_answer=question.model_answer or "Not provided",
        keywords=", ".join(question.answer_keywords) if question.answer_keywords else "Not specified",
        student_answer=answer.answer_text,
    )

    result = await ai_service.generate_structured(
        prompt,
        AIEvaluationResult,
        system=EVALUATION_SYSTEM,
        temperature=0.2,
        use_cache=False,  # Evaluations should always be fresh
    )

    if result is None:
        return None

    # Validate and cap marks
    marks_obtained = min(float(result.marks_obtained), question.marks)
    marks_obtained = max(marks_obtained, 0)

    return {
        "marks_obtained": round(marks_obtained, 1),
        "marks_possible": question.marks,
        "feedback": result.feedback,
        "keywords_found": result.keywords_found,
        "keywords_missing": result.keywords_missing,
        "improvement_hint": result.improvement_hint,
        "rubric_scores": result.rubric_scores.model_dump(),
        "confidence": result.confidence,
        "evaluation_method": "ai",
    }


async def generate_ai_recommendations(
    topic_scores: dict,
    blooms_scores: dict,
    difficulty_scores: dict,
    subject: str,
    board: str,
    class_grade: int,
) -> Optional[str]:
    """
    Generate AI-powered study recommendations from evaluation analytics.

    Returns recommendations string or None if AI is unavailable.
    """
    prompt = f"""You are an expert {board} {subject} teacher for Class {class_grade}.

Based on this student's exam performance, provide personalized study recommendations:

## Topic-wise Performance
{json.dumps(topic_scores, indent=2)}

## Bloom's Taxonomy Performance (percentage)
{json.dumps(blooms_scores, indent=2)}

## Difficulty-level Performance (percentage)
{json.dumps(difficulty_scores, indent=2)}

Provide:
1. Analysis of strengths and areas needing improvement (2-3 sentences)
2. Specific study plan with 3-5 actionable steps
3. Recommended focus topics with suggested study approach
4. Motivational note

Keep the response concise (under 200 words), practical, and encouraging.
Use simple language suitable for a Class {class_grade} student."""

    return await ai_service.generate(
        prompt,
        system=EVALUATION_SYSTEM,
        max_tokens=512,
        temperature=0.7,
    )


# ── Vision-Based Diagram Evaluation ──


DIAGRAM_EVAL_SYSTEM = (
    "You are an expert exam evaluator for Indian school board exams (CBSE/ICSE). "
    "You evaluate student-drawn diagrams by analyzing the image alongside the question context. "
    "Be fair, encouraging, and provide specific feedback on what was done well and what needs improvement."
)

DIAGRAM_EVAL_PROMPT = """Evaluate this Class {class_grade} {board} {subject} student's diagram answer.

## Question
{question_text}

## Model Answer / Expected Diagram Description
{model_answer}

## Expected Labels/Keywords
{keywords}

## Marks Available
{marks}

## Evaluation Criteria
Score each criterion from 0.0 to 1.0:

1. **labels_correct**: Are all required parts/points/components labeled correctly? Check spelling and placement.
2. **structure_accurate**: Is the overall structure/shape/layout of the diagram correct?
3. **completeness**: Are all required elements present? (1.0 = all present, 0.0 = nothing drawn)
4. **proportions_reasonable**: Are relative sizes, angles, and distances reasonable for this diagram type?
5. **neatness**: Is the diagram clear, readable, and well-organized?

Also provide:
- **feedback**: 2-3 sentences of specific, constructive feedback
- **marks_awarded**: Total marks to award (0 to {marks}), based on weighted criteria"""


class DiagramEvaluationResult(BaseModel):
    """Structured result from AI diagram evaluation."""
    labels_correct: float = Field(ge=0.0, le=1.0)
    structure_accurate: float = Field(ge=0.0, le=1.0)
    completeness: float = Field(ge=0.0, le=1.0)
    proportions_reasonable: float = Field(ge=0.0, le=1.0)
    neatness: float = Field(ge=0.0, le=1.0)
    feedback: str
    marks_awarded: float


async def evaluate_diagram_answer(
    question: Question,
    answer: StudentAnswer,
    board: str = "CBSE",
    subject: str = "Science",
    class_grade: int = 10,
) -> Optional[dict]:
    """
    Evaluate a student's diagram answer using GPT vision (multimodal).

    Sends the question context + student's diagram image to the model.
    Returns evaluation dict or None if vision evaluation fails.
    """
    if not answer.answer_image_url:
        return None

    if not ai_service.is_available:
        return None

    # Read the student's answer image from the filesystem
    uploads_base = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "uploads",
    )
    # answer_image_url is like /api/uploads/questions/xxx.png -- extract relative path
    relative_path = answer.answer_image_url.replace("/api/uploads/", "")
    image_path = os.path.join(uploads_base, relative_path)

    if not os.path.exists(image_path):
        logger.warning("Answer image not found at %s", image_path)
        return None

    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()
    except OSError as e:
        logger.error("Failed to read answer image: %s", e)
        return None

    img_b64 = base64.b64encode(image_bytes).decode("utf-8")

    # Determine MIME type from extension
    ext = os.path.splitext(image_path)[1].lower()
    mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml"}
    mime_type = mime_map.get(ext, "image/png")

    prompt_text = DIAGRAM_EVAL_PROMPT.format(
        class_grade=class_grade,
        board=board,
        subject=subject,
        question_text=question.question_text,
        model_answer=question.model_answer or "Not provided",
        keywords=", ".join(question.answer_keywords) if question.answer_keywords else "Not specified",
        marks=question.marks,
    )

    # Build multimodal message for the OpenAI client
    schema_json = json.dumps(DiagramEvaluationResult.model_json_schema(), indent=2)
    full_prompt = (
        f"{prompt_text}\n\n"
        f"Respond ONLY with valid JSON matching this schema:\n"
        f"```json\n{schema_json}\n```\n"
        f"Do not include any text outside the JSON."
    )

    try:
        if not ai_service._ensure_client():
            return None

        messages = [
            {"role": "system", "content": DIAGRAM_EVAL_SYSTEM},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": full_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{img_b64}",
                            "detail": "high",
                        },
                    },
                ],
            },
        ]

        # Also include the reference diagram if the question has one
        if question.question_image_url:
            ref_relative = question.question_image_url.replace("/api/uploads/", "")
            ref_path = os.path.join(uploads_base, ref_relative)
            if os.path.exists(ref_path):
                with open(ref_path, "rb") as f:
                    ref_bytes = f.read()
                ref_b64 = base64.b64encode(ref_bytes).decode("utf-8")
                ref_ext = os.path.splitext(ref_path)[1].lower()
                ref_mime = mime_map.get(ref_ext, "image/png")
                messages[1]["content"].insert(
                    1,
                    {
                        "type": "text",
                        "text": "Reference diagram (correct answer) for comparison:",
                    },
                )
                messages[1]["content"].insert(
                    2,
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{ref_mime};base64,{ref_b64}",
                            "detail": "high",
                        },
                    },
                )

        from ..core.config import settings

        response = await ai_service._client.chat.completions.create(
            model=settings.AI_MODEL_STANDARD,
            messages=messages,
            max_completion_tokens=1024,
        )

        raw_text = response.choices[0].message.content
        if not raw_text:
            return None

        # Parse structured response
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(
                line for line in lines if not line.strip().startswith("```")
            )

        parsed = json.loads(cleaned)
        result = DiagramEvaluationResult.model_validate(parsed)

        # Cap marks
        marks_awarded = min(float(result.marks_awarded), question.marks)
        marks_awarded = max(marks_awarded, 0.0)

        return {
            "marks_obtained": round(marks_awarded, 1),
            "marks_possible": question.marks,
            "feedback": result.feedback,
            "keywords_found": [],
            "keywords_missing": [],
            "improvement_hint": "",
            "rubric_scores": {
                "labels_correct": result.labels_correct,
                "structure_accurate": result.structure_accurate,
                "completeness": result.completeness,
                "proportions_reasonable": result.proportions_reasonable,
                "neatness": result.neatness,
            },
            "confidence": 0.85,
            "evaluation_method": "ai_vision",
        }

    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse diagram evaluation response: %s", e)
        return None
    except Exception as e:
        logger.error("Diagram evaluation failed: %s", e)
        return None
