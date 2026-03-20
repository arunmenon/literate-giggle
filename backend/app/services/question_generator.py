"""
AI Question Generation Service.

Generates exam questions with model answers, keywords, marking schemes,
and MCQ distractors using the unified AI service layer.
"""

import json
import logging
import re
from typing import Optional

from pydantic import BaseModel, Field

from ..core.config import settings
from .ai_service import ai_service
from .curriculum_context import CurriculumContext

logger = logging.getLogger(__name__)


GENERATION_SYSTEM = (
    "You are an expert question paper setter for Indian school board exams (CBSE/ICSE). "
    "You create high-quality exam questions that test various cognitive levels according to "
    "Bloom's taxonomy. Your questions are clear, precise, and appropriate for the specified "
    "class level. You always provide comprehensive model answers and marking schemes.\n\n"
    "When writing math notation:\n"
    "- Use Unicode symbols for simple cases: degree sign (\u00b0), angle (\u2220), pi (\u03c0), "
    "multiplication (\u00d7), division (\u00f7), plus-minus (\u00b1), infinity (\u221e), "
    "subscripts/superscripts where supported\n"
    "- Use LaTeX notation (with \\\\( ... \\\\) delimiters for inline math) for complex "
    "expressions: fractions, square roots, summations, integrals, matrices, multi-level "
    "superscripts/subscripts\n"
    "- Never use raw LaTeX commands without delimiters"
)

BOARD_SYSTEM_PROMPTS_FALLBACK = {
    "CBSE": (
        "Generate competency-based questions per the latest CBSE board exam pattern. "
        "Include application and analysis-level questions alongside knowledge-based ones. "
        "Reference NCERT textbook. Follow the current year's question paper format. "
        "Include case-study style questions where appropriate."
    ),
    "ICSE": (
        "Generate questions following the latest ICSE pattern with structured and unstructured formats. "
        "Include internal choice options where appropriate. Reference Selina/Concise textbook. "
        "Questions should follow the Section A (compulsory) and Section B (choice) pattern."
    ),
}

# NOTE: These are fallbacks only. The preferred path is to use question_pattern_notes
# from the CurriculumChapter in the taxonomy DB, which is updated per academic year
# without requiring code changes. The fallbacks are used when no taxonomy data exists.

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


BLOOMS_VERBS = {
    "remember": ["define", "list", "name", "identify", "recall", "state", "label"],
    "understand": ["describe", "explain", "summarize", "interpret", "classify", "compare"],
    "apply": ["solve", "calculate", "use", "demonstrate", "apply", "compute"],
    "analyze": ["analyze", "differentiate", "examine", "compare", "contrast", "distinguish"],
    "evaluate": ["evaluate", "justify", "assess", "critique", "judge", "argue"],
    "create": ["design", "create", "construct", "develop", "formulate", "propose"],
}

# Question types that typically map to certain Bloom's levels
_TYPE_BLOOMS_AFFINITY = {
    "mcq": {"remember", "understand"},
    "true_false": {"remember", "understand"},
    "fill_in_blank": {"remember"},
    "very_short": {"remember", "understand"},
    "short_answer": {"understand", "apply"},
    "numerical": {"apply", "analyze"},
    "long_answer": {"analyze", "evaluate"},
    "case_study": {"analyze", "evaluate", "create"},
    "diagram": {"understand", "apply"},
    "match_following": {"remember", "understand"},
}


def _compute_blooms_confidence(question_text: str, assigned_level: str) -> float:
    """
    Compute a heuristic confidence score (0.0-1.0) for a Bloom's level assignment.

    Uses verb-matching and question-type affinity. No AI calls.
    """
    if not question_text or not assigned_level:
        return 0.5

    assigned_lower = assigned_level.lower().strip()
    text_lower = question_text.lower()

    # Extract words from the question text
    words = set(re.findall(r'\b[a-z]+\b', text_lower))

    # Score based on verb presence
    verb_score = 0.0
    assigned_verbs = set(BLOOMS_VERBS.get(assigned_lower, []))
    if assigned_verbs:
        matched_verbs = words & assigned_verbs
        if matched_verbs:
            verb_score = min(1.0, len(matched_verbs) / 2.0)  # 2 verb matches = full score

    # Check for verb matches in OTHER levels (penalty for cross-level verbs)
    cross_level_matches = 0
    for level, verbs in BLOOMS_VERBS.items():
        if level != assigned_lower:
            cross_level_matches += len(words & set(verbs))

    cross_penalty = min(0.3, cross_level_matches * 0.05)

    # Combine: base + verb_score - cross_penalty
    # Base confidence of 0.5 (AI assigned it, so some trust)
    confidence = 0.5 + (verb_score * 0.4) - cross_penalty
    return max(0.1, min(0.95, confidence))


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
    curriculum_context: Optional[CurriculumContext] = None,
) -> Optional[list[dict]]:
    """
    Generate exam questions using AI.

    Returns a list of generated question dicts, or None if AI is unavailable.
    When curriculum_context is provided, it is serialized as a structured prompt
    section BEFORE research_context (both are included).
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

    # Inject curriculum context first (structured data), then research context (narrative)
    context_sections = []
    if curriculum_context:
        context_sections.append(curriculum_context.to_prompt_section())
    if research_context:
        context_sections.append(f"**Research Context:**\n{research_context}")

    if context_sections:
        prompt = "\n\n".join(context_sections) + "\n\n" + prompt

    if teacher_notes:
        prompt = f"{prompt}\n\n**Teacher Notes:**\n{teacher_notes}"

    # Build board-specific system prompt
    # Prefer question_pattern_notes from curriculum_context or research_context
    # over hardcoded fallbacks
    system = GENERATION_SYSTEM
    if not curriculum_context and not research_context:
        # No taxonomy data available -- use generic fallback (no hardcoded years)
        board_extra = BOARD_SYSTEM_PROMPTS_FALLBACK.get(board, "")
        if board_extra:
            system = f"{system}\n\n{board_extra}"
    # When curriculum_context or research_context is provided, they already
    # contain the taxonomy's data with the current year's pattern

    result = await ai_service.generate_structured(
        prompt,
        GeneratedQuestionSet,
        system=system,
        temperature=0.7,
        use_cache=False,  # Always generate fresh questions
    )

    if result is None:
        return None

    # Track what context was used for generation
    generation_context_info = {}
    if curriculum_context:
        generation_context_info["curriculum_context"] = True
        generation_context_info["chapter_id"] = curriculum_context.chapter_id
        generation_context_info["board"] = curriculum_context.board
    if research_context:
        generation_context_info["research_context"] = True

    questions = []
    for generated_question in result.questions:
        # Compute Bloom's confidence heuristic
        blooms_confidence = _compute_blooms_confidence(
            generated_question.question_text,
            generated_question.blooms_level,
        )

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
            "blooms_confidence": blooms_confidence,
            "generation_context": json.dumps(generation_context_info) if generation_context_info else None,
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
        elif curriculum_context:
            question_dict["chapter_id"] = curriculum_context.chapter_id

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
    curriculum_context: Optional[CurriculumContext] = None,
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
    context_parts = []
    if curriculum_context:
        context_parts.append(curriculum_context.to_prompt_section())
    if research_context:
        context_parts.append(f"**Research Context:**\n{research_context}")
    research_section = "\n\n".join(context_parts)

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
    board_extra = BOARD_SYSTEM_PROMPTS_FALLBACK.get(board, "")
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

    blooms_confidence = _compute_blooms_confidence(q.question_text, q.blooms_level)

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
        "blooms_confidence": blooms_confidence,
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
