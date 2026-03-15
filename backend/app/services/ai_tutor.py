"""
AI Tutor & Hint Service.

Provides progressive hints during practice exams, explains evaluation results,
and offers conversational educational chat constrained to the subject context.
"""

import logging
from typing import AsyncIterator, Optional

from pydantic import BaseModel, Field

from .ai_service import ai_service

logger = logging.getLogger(__name__)


TUTOR_SYSTEM = (
    "You are a friendly, patient tutor for Indian school board exams (CBSE/ICSE). "
    "You guide students to understand concepts rather than giving direct answers. "
    "Use simple language appropriate for the student's class level. "
    "Be encouraging and supportive."
)


class HintResponse(BaseModel):
    hint: str
    hint_level: int = Field(ge=1, le=3, description="1=vague, 2=moderate, 3=specific")
    marks_penalty_pct: float = Field(
        ge=0, le=100,
        description="Percentage of marks deducted for this hint",
    )


class ExplanationResponse(BaseModel):
    explanation: str
    key_concept: str
    common_mistake: str
    study_tip: str


HINT_LEVELS = {
    1: "Give a vague, general hint that nudges the student in the right direction. Do NOT reveal the answer or specific steps. Just hint at the approach or concept area.",
    2: "Give a moderate hint that identifies the specific concept, formula, or approach needed. Do NOT give the actual answer but make the path clearer.",
    3: "Give a specific, detailed hint that walks through the first step or provides a key part of the solution. Stop short of giving the complete answer.",
}

HINT_PENALTIES = {1: 10.0, 2: 20.0, 3: 33.0}


async def get_hint(
    question_text: str,
    question_type: str,
    topic: str,
    subject: str,
    board: str,
    class_grade: int,
    marks: float,
    hint_number: int,
    model_answer: Optional[str] = None,
) -> Optional[HintResponse]:
    """
    Generate a progressive hint for a question during a practice exam.

    hint_number: 1-based count of hints already requested (determines specificity).
    Returns HintResponse or None if AI is unavailable.
    """
    hint_level = min(hint_number, 3)
    level_instruction = HINT_LEVELS[hint_level]

    prompt = f"""A Class {class_grade} {board} {subject} student needs a hint for this question:

**Question ({question_type.replace('_', ' ')}, {marks} marks):**
{question_text}

**Topic:** {topic}

{f'**Reference Answer (DO NOT reveal this):** {model_answer}' if model_answer else ''}

**Hint Level:** {hint_level}/3
{level_instruction}

The student has asked for hint #{hint_number}. Provide an appropriate hint."""

    result = await ai_service.generate_structured_fast(
        prompt,
        HintResponse,
        system=TUTOR_SYSTEM,
        temperature=0.5,
    )

    if result is None:
        return None

    # Ensure the penalty matches our defined levels
    result.hint_level = hint_level
    result.marks_penalty_pct = HINT_PENALTIES[hint_level]

    return result


async def explain_answer(
    question_text: str,
    question_type: str,
    topic: str,
    subject: str,
    board: str,
    class_grade: int,
    student_answer: Optional[str],
    model_answer: Optional[str],
    marks_obtained: float,
    marks_possible: float,
    feedback: Optional[str],
) -> Optional[ExplanationResponse]:
    """
    Explain why a student's answer was scored the way it was and teach the concept.

    Returns ExplanationResponse or None if AI is unavailable.
    """
    prompt = f"""A Class {class_grade} {board} {subject} student wants to understand their score.

**Question ({question_type.replace('_', ' ')}):**
{question_text}

**Topic:** {topic}

**Student's Answer:**
{student_answer or '(No answer provided)'}

**Model Answer:**
{model_answer or '(Not available)'}

**Score:** {marks_obtained}/{marks_possible}

**Evaluator Feedback:**
{feedback or '(No feedback available)'}

Explain to the student:
1. Why they received this score (what was right, what was wrong/missing)
2. The key concept being tested
3. A common mistake students make on this type of question
4. A specific study tip to improve on this topic"""

    return await ai_service.generate_structured(
        prompt,
        ExplanationResponse,
        system=TUTOR_SYSTEM,
        temperature=0.5,
    )


async def chat(
    message: str,
    subject: str,
    board: str,
    class_grade: int,
    conversation_history: Optional[list[dict]] = None,
) -> AsyncIterator[str]:
    """
    Open-ended educational chat about a topic, constrained to the subject/board context.

    Streams the response as text chunks for SSE.
    """
    system = (
        f"{TUTOR_SYSTEM}\n\n"
        f"Context: You are helping a Class {class_grade} {board} student with {subject}. "
        f"Stay focused on {subject} topics relevant to the {board} Class {class_grade} syllabus. "
        f"If asked about unrelated topics, gently redirect to {subject}."
    )

    # Build the prompt with conversation history
    prompt_parts = []
    if conversation_history:
        for entry in conversation_history[-10:]:  # Last 10 messages for context
            role = entry.get("role", "user")
            content = entry.get("content", "")
            if role == "user":
                prompt_parts.append(f"Student: {content}")
            else:
                prompt_parts.append(f"Tutor: {content}")

    prompt_parts.append(f"Student: {message}")
    prompt_parts.append("Tutor:")

    full_prompt = "\n\n".join(prompt_parts)

    async for chunk in ai_service.stream_response(
        full_prompt,
        system=system,
        model=None,  # Uses standard model for quality
        temperature=0.7,
    ):
        yield chunk
