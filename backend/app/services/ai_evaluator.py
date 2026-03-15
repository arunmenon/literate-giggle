"""
AI-Powered Answer Evaluator using Claude API.

Provides intelligent evaluation for subjective answers (short, long, case study)
that goes beyond keyword matching - understanding context, reasoning quality,
and providing pedagogically useful feedback.
"""

import json
from typing import Optional

from ..core.config import settings
from ..models.exam import Question, StudentAnswer, QuestionType


# Prompt template for answer evaluation
EVALUATION_PROMPT = """You are an expert {board} {subject} teacher evaluating a Class {class_grade} student's answer.

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
Evaluate the student's answer and provide:

1. **marks_obtained** (out of {marks}): Award marks fairly based on:
   - Accuracy of content and concepts
   - Completeness of the answer
   - Use of proper terminology and keywords
   - Logical flow and clarity of explanation
   - For numerical: correctness of steps and final answer
   - For diagrams: mention of key labels and structure

2. **feedback**: 2-3 sentences explaining the score. Be encouraging but honest.

3. **keywords_found**: List of key concepts the student correctly included.

4. **keywords_missing**: List of important concepts the student missed.

5. **improvement_hint**: Specific, actionable advice for improvement (1-2 sentences).

6. **rubric_scores**: Score each criterion (out of 4):
   - content_accuracy: How factually correct is the answer?
   - completeness: Does it cover all required points?
   - terminology: Use of correct subject-specific terms?
   - presentation: Clarity, structure, and logical flow?

Respond ONLY with valid JSON in this exact format:
{{
  "marks_obtained": <number>,
  "feedback": "<string>",
  "keywords_found": ["<string>", ...],
  "keywords_missing": ["<string>", ...],
  "improvement_hint": "<string>",
  "rubric_scores": {{
    "content_accuracy": <0-4>,
    "completeness": <0-4>,
    "terminology": <0-4>,
    "presentation": <0-4>
  }}
}}"""


async def evaluate_with_ai(
    question: Question,
    answer: StudentAnswer,
    board: str = "CBSE",
    subject: str = "Mathematics",
    class_grade: int = 10,
) -> Optional[dict]:
    """
    Evaluate a student's answer using Claude API.

    Returns evaluation dict or None if API is unavailable.
    """
    if not settings.ANTHROPIC_API_KEY:
        return None

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

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        result_text = response.content[0].text.strip()

        # Parse JSON from response (handle markdown code blocks)
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        result_text = result_text.strip()

        result = json.loads(result_text)

        # Validate and cap marks
        marks_obtained = min(float(result.get("marks_obtained", 0)), question.marks)
        marks_obtained = max(marks_obtained, 0)

        return {
            "marks_obtained": round(marks_obtained, 1),
            "marks_possible": question.marks,
            "feedback": result.get("feedback", ""),
            "keywords_found": result.get("keywords_found", []),
            "keywords_missing": result.get("keywords_missing", []),
            "improvement_hint": result.get("improvement_hint", ""),
            "rubric_scores": result.get("rubric_scores", {}),
        }

    except ImportError:
        # anthropic package not installed
        return None
    except json.JSONDecodeError:
        # Failed to parse AI response - fall back to rule-based
        return None
    except Exception:
        # Any API error - fall back to rule-based
        return None


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

    Returns recommendations string or None if API unavailable.
    """
    if not settings.ANTHROPIC_API_KEY:
        return None

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

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        return response.content[0].text.strip()

    except Exception:
        return None
