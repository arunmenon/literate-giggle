"""
AI-Powered Answer Evaluator using the unified AI Service Layer.

Provides intelligent evaluation for subjective answers (short, long, case study)
that goes beyond keyword matching - understanding context, reasoning quality,
and providing pedagogically useful feedback.
"""

import json
import logging
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
