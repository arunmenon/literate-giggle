"""
AI Question Generation Service.

Generates exam questions with model answers, keywords, marking schemes,
and MCQ distractors using the unified AI service layer.
"""

import logging
from typing import Optional

from pydantic import BaseModel, Field

from ..core.config import settings
from .ai_service import ai_service

logger = logging.getLogger(__name__)


GENERATION_SYSTEM = (
    "You are an expert question paper setter for Indian school board exams (CBSE/ICSE). "
    "You create high-quality exam questions that test various cognitive levels according to "
    "Bloom's taxonomy. Your questions are clear, precise, and appropriate for the specified "
    "class level. You always provide comprehensive model answers and marking schemes."
)

BOARD_SYSTEM_PROMPTS = {
    "CBSE": (
        "Generate competency-based questions per CBSE 2023+ pattern. "
        "Include application and analysis-level questions alongside knowledge-based ones. "
        "Reference NCERT textbook. 40% of questions should be application-level. "
        "Include case-study style questions where appropriate."
    ),
    "ICSE": (
        "Generate questions following ICSE pattern with structured and unstructured formats. "
        "Include internal choice options where appropriate. Reference Selina/Concise textbook. "
        "Questions should follow the Section A (compulsory) and Section B (choice) pattern."
    ),
}

GENERATION_PROMPT = """Generate {count} {question_type} question(s) for:

**Subject:** {subject}
**Board:** {board}
**Class:** {class_grade}
**Topic:** {topic}
**Chapter:** {chapter}
**Difficulty:** {difficulty}

Requirements:
- Questions should be appropriate for Class {class_grade} {board} board exams
- Each question must have a clear, unambiguous model answer
- Include answer keywords for evaluation
- Assign appropriate Bloom's taxonomy level
- For MCQ: provide 4 options (a, b, c, d) with plausible distractors
- For numerical: include step-by-step marking scheme
- Marks should be appropriate for the question type and difficulty
{additional_instructions}"""


class MCQOptions(BaseModel):
    a: str
    b: str
    c: str
    d: str


class MarkingSchemeStep(BaseModel):
    step: str
    marks: float
    keywords: list[str] = []


class GeneratedQuestion(BaseModel):
    question_text: str
    question_type: str
    marks: float
    difficulty: str
    blooms_level: str
    topic: str
    subtopic: Optional[str] = None
    model_answer: str
    answer_keywords: list[str] = []
    mcq_options: Optional[MCQOptions] = None
    correct_option: Optional[str] = None
    marking_scheme: Optional[list[MarkingSchemeStep]] = None


class GeneratedQuestionSet(BaseModel):
    questions: list[GeneratedQuestion]


QUESTION_TYPE_INSTRUCTIONS = {
    "mcq": "Each MCQ must have exactly 4 options (a, b, c, d) with one correct answer. Distractors should be plausible but clearly wrong.",
    "short_answer": "Short answers should be 2-3 sentences. Marks: 2-3.",
    "long_answer": "Long answers should require 150-200 words. Marks: 5-8.",
    "very_short": "Very short answers should be 1 sentence or a single word/phrase. Marks: 1.",
    "fill_in_blank": "Provide the sentence with a blank and the correct answer. Marks: 1.",
    "true_false": "Provide a statement that is clearly true or false. Correct option should be 'True' or 'False'. Marks: 1.",
    "numerical": "Include step-by-step marking scheme with marks for each step. Marks: 3-5.",
    "case_study": "Provide a case/passage followed by 3-4 sub-questions. Total marks: 8-10.",
    "match_following": "Provide two columns of 4-5 items each to match. Marks: 2-4.",
    "diagram": "Describe what diagram to draw and key labels. Marks: 3-5.",
}


async def generate_questions(
    topic: str,
    subject: str,
    board: str,
    class_grade: int,
    difficulty: str = "medium",
    question_type: str = "short_answer",
    count: int = 5,
    chapter: Optional[str] = None,
    chapter_id: Optional[int] = None,
    research_context: Optional[str] = None,
    teacher_notes: Optional[str] = None,
) -> Optional[list[dict]]:
    """
    Generate exam questions using AI.

    Returns a list of generated question dicts, or None if AI is unavailable.
    When research_context is provided, it is injected into the prompt for
    curriculum-grounded generation.
    """
    additional_instructions = QUESTION_TYPE_INSTRUCTIONS.get(question_type, "")

    prompt = GENERATION_PROMPT.format(
        count=count,
        question_type=question_type.replace("_", " "),
        subject=subject,
        board=board,
        class_grade=class_grade,
        topic=topic,
        chapter=chapter or topic,
        difficulty=difficulty,
        additional_instructions=additional_instructions,
    )

    # Inject research context between system and user prompt
    if research_context:
        prompt = f"**Research Context:**\n{research_context}\n\n{prompt}"

    if teacher_notes:
        prompt = f"{prompt}\n\n**Teacher Notes:**\n{teacher_notes}"

    # Build board-specific system prompt
    system = GENERATION_SYSTEM
    board_extra = BOARD_SYSTEM_PROMPTS.get(board, "")
    if board_extra:
        system = f"{system}\n\n{board_extra}"

    result = await ai_service.generate_structured(
        prompt,
        GeneratedQuestionSet,
        system=system,
        temperature=0.7,
        use_cache=False,  # Always generate fresh questions
    )

    if result is None:
        return None

    questions = []
    for generated_question in result.questions:
        question_dict = {
            "question_text": generated_question.question_text,
            "question_type": question_type,  # Use the requested type consistently
            "marks": generated_question.marks,
            "difficulty": difficulty,
            "blooms_level": generated_question.blooms_level,
            "topic": topic,
            "subtopic": generated_question.subtopic,
            "model_answer": generated_question.model_answer,
            "answer_keywords": generated_question.answer_keywords,
            "source": f"AI Generated - {board} Class {class_grade}",
        }

        if question_type == "mcq" and generated_question.mcq_options:
            question_dict["mcq_options"] = generated_question.mcq_options.model_dump()
            question_dict["correct_option"] = generated_question.correct_option

        if generated_question.marking_scheme:
            question_dict["marking_scheme"] = [
                step.model_dump() for step in generated_question.marking_scheme
            ]

        if chapter_id is not None:
            question_dict["chapter_id"] = chapter_id

        questions.append(question_dict)

    return questions


async def generate_bulk_questions(
    subject: str,
    board: str,
    class_grade: int,
    chapter: str,
    question_distribution: dict[str, int],
) -> Optional[list[dict]]:
    """
    Generate a full set of questions for a chapter with specified type distribution.

    question_distribution: {"mcq": 5, "short_answer": 3, "long_answer": 2, ...}
    Returns a combined list of all generated questions, or None if AI is unavailable.
    """
    all_questions = []

    for question_type, count in question_distribution.items():
        if count <= 0:
            continue

        questions = await generate_questions(
            topic=chapter,
            subject=subject,
            board=board,
            class_grade=class_grade,
            question_type=question_type,
            count=count,
            chapter=chapter,
        )

        if questions:
            all_questions.extend(questions)

    return all_questions if all_questions else None


REGENERATION_PROMPT = """Improve this exam question based on teacher feedback.

**Original Question:**
{original_text}

**Original Model Answer:**
{original_answer}

**Question Type:** {question_type}
**Subject:** {subject}
**Board:** {board}
**Class:** {class_grade}
**Chapter:** {chapter}

**Teacher Feedback:**
{feedback}

{research_section}

Generate an improved version of this question incorporating the teacher's feedback.
Keep the same question type, marks, and difficulty level unless the feedback
specifically requests changes to these."""


async def regenerate_question(
    original_question: dict,
    feedback: str,
    research_context: Optional[str] = None,
    board: str = "CBSE",
    class_grade: int = 10,
    subject: str = "",
    chapter: str = "",
    chapter_id: Optional[int] = None,
) -> Optional[dict]:
    """
    Regenerate a single question incorporating teacher feedback.

    Returns a single question dict, or None if AI is unavailable.
    """
    research_section = ""
    if research_context:
        research_section = f"**Research Context:**\n{research_context}"

    prompt = REGENERATION_PROMPT.format(
        original_text=original_question.get("question_text", ""),
        original_answer=original_question.get("model_answer", ""),
        question_type=original_question.get("question_type", "short_answer"),
        subject=subject,
        board=board,
        class_grade=class_grade,
        chapter=chapter,
        feedback=feedback,
        research_section=research_section,
    )

    system = GENERATION_SYSTEM
    board_extra = BOARD_SYSTEM_PROMPTS.get(board, "")
    if board_extra:
        system = f"{system}\n\n{board_extra}"

    result = await ai_service.generate_structured(
        prompt,
        GeneratedQuestionSet,
        system=system,
        temperature=0.7,
        use_cache=False,
    )

    if result is None or not result.questions:
        return None

    q = result.questions[0]
    question_type = original_question.get("question_type", "short_answer")
    question_dict = {
        "question_text": q.question_text,
        "question_type": question_type,
        "marks": q.marks,
        "difficulty": original_question.get("difficulty", "medium"),
        "blooms_level": q.blooms_level,
        "topic": original_question.get("topic", chapter),
        "subtopic": q.subtopic,
        "model_answer": q.model_answer,
        "answer_keywords": q.answer_keywords,
        "source": f"AI Regenerated - {board} Class {class_grade}",
    }

    if question_type == "mcq" and q.mcq_options:
        question_dict["mcq_options"] = q.mcq_options.model_dump()
        question_dict["correct_option"] = q.correct_option

    if q.marking_scheme:
        question_dict["marking_scheme"] = [
            step.model_dump() for step in q.marking_scheme
        ]

    # Preserve chapter_id from original or use provided
    resolved_chapter_id = chapter_id or original_question.get("chapter_id")
    if resolved_chapter_id is not None:
        question_dict["chapter_id"] = resolved_chapter_id

    return question_dict
