"""
AI Paper Assembler Service.

Assembles balanced exam papers from existing question bank questions
and generates new questions to fill gaps. Ensures coverage across
topics, difficulty levels, and Bloom's taxonomy levels.
"""

import logging
from collections import defaultdict
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.exam import (
    Question, QuestionBank, QuestionType, DifficultyLevel, BloomsTaxonomy,
)
from ..models.curriculum import (
    Board, Curriculum, CurriculumSubject, CurriculumChapter,
)
from .question_generator import generate_questions
from .curriculum_registry import CurriculumRegistry
from .syllabus_researcher import research_chapter

logger = logging.getLogger(__name__)

_registry = CurriculumRegistry()


async def _get_chapter_weightages(
    db: AsyncSession,
    board: str,
    class_grade: int,
    subject: str,
) -> Optional[dict[str, int]]:
    """Query chapter marks_weightage from curriculum tables."""
    try:
        result = await db.execute(
            select(CurriculumChapter.name, CurriculumChapter.marks_weightage)
            .join(CurriculumSubject, CurriculumChapter.subject_id == CurriculumSubject.id)
            .join(Curriculum, CurriculumSubject.curriculum_id == Curriculum.id)
            .join(Board, Curriculum.board_id == Board.id)
            .where(
                Board.code == board,
                CurriculumSubject.class_grade == class_grade,
                CurriculumSubject.name == subject,
                Curriculum.is_active == True,
            )
        )
        rows = result.all()
        if not rows:
            return None
        weightages = {}
        for name, weightage in rows:
            if weightage:
                weightages[name] = weightage
        return weightages if weightages else None
    except Exception:
        return None


async def assemble_paper(
    db: AsyncSession,
    board: str,
    class_grade: int,
    subject: str,
    chapters: list[str],
    total_marks: float,
    duration_minutes: int,
    sections: list[dict],
    question_type_distribution: Optional[dict[str, int]] = None,
    title: Optional[str] = None,
    exam_type: Optional[str] = None,
) -> dict:
    """
    Assemble a balanced exam paper from bank questions + generated fill.

    Steps:
    1. Query existing bank for matching approved questions
    2. Score and select questions for balance
    3. Identify gaps in coverage
    4. Generate new questions to fill gaps
    5. Assemble into sections with ordering
    6. Return paper with coverage analysis

    Returns a dict matching PaperAssemblyResult schema.
    """
    # 1. Query existing questions from the bank
    query = (
        select(Question)
        .join(QuestionBank)
        .where(
            QuestionBank.board == board,
            QuestionBank.class_grade == class_grade,
            QuestionBank.subject == subject,
            Question.is_active == True,
        )
    )
    result = await db.execute(query)
    bank_questions = list(result.scalars().all())

    # Filter to matching chapters (case-insensitive topic match)
    chapter_set = {ch.lower() for ch in chapters}
    matching_questions = []
    for q in bank_questions:
        topic_lower = (q.topic or "").lower()
        for ch in chapter_set:
            if ch in topic_lower or topic_lower in ch:
                matching_questions.append(q)
                break

    # 2. Determine target distribution
    section_configs = sections
    target_marks_per_section = {}
    for sec in section_configs:
        target_marks_per_section[sec["name"]] = sec["marks"]

    # Build default question type distribution if not provided
    if not question_type_distribution:
        question_type_distribution = _default_distribution(total_marks)

    # 3. Select questions from bank for each section
    selected_questions = []
    used_ids = set()
    marks_remaining = total_marks

    # Sort matching questions by quality (times_used, avg_score_pct)
    matching_questions.sort(
        key=lambda q: (q.avg_score_pct or 50, q.times_used or 0),
        reverse=True,
    )

    for sec in section_configs:
        sec_marks = sec["marks"]
        sec_name = sec["name"]
        sec_types = sec.get("question_types", None)
        sec_questions = []

        for q in matching_questions:
            if q.id in used_ids:
                continue
            if sec_types and q.question_type.value not in sec_types:
                continue
            if q.marks <= sec_marks:
                sec_questions.append({
                    "question_id": q.id,
                    "question_text": q.question_text,
                    "question_type": q.question_type.value,
                    "marks": q.marks,
                    "difficulty": q.difficulty.value if q.difficulty else "medium",
                    "blooms_level": q.blooms_level.value if q.blooms_level else "understand",
                    "topic": q.topic,
                    "section": sec_name,
                    "source": "bank",
                    "bank_question_id": q.id,
                })
                used_ids.add(q.id)
                sec_marks -= q.marks
                if sec_marks <= 0:
                    break

        selected_questions.extend(sec_questions)
        marks_remaining = total_marks - sum(
            sq["marks"] for sq in selected_questions
        )

    # 4. Identify gaps and generate fill questions
    gaps_filled = 0
    if marks_remaining > 0:
        # Determine which topics are underrepresented
        covered_topics = {sq["topic"] for sq in selected_questions}
        uncovered_chapters = [
            ch for ch in chapters if ch.lower() not in {t.lower() for t in covered_topics}
        ]

        # Generate questions to fill gaps
        fill_chapters = uncovered_chapters if uncovered_chapters else chapters
        for fill_chapter in fill_chapters:
            if marks_remaining <= 0:
                break

            # Research the chapter for grounded generation
            research = await research_chapter(
                board=board,
                class_grade=class_grade,
                subject=subject,
                chapter=fill_chapter,
            )
            research_context = None
            if research:
                research_context = research.get("generation_brief", "")

            # Determine how many questions to generate
            fill_count = max(1, int(marks_remaining / 3))  # Rough estimate
            fill_count = min(fill_count, 5)  # Cap at 5 per chapter

            generated = await generate_questions(
                topic=fill_chapter,
                subject=subject,
                board=board,
                class_grade=class_grade,
                chapter=fill_chapter,
                count=fill_count,
                research_context=research_context,
            )

            if generated:
                for gq in generated:
                    if marks_remaining <= 0:
                        break
                    if gq["marks"] <= marks_remaining:
                        # Assign to least-filled section
                        target_section = _find_section_with_room(
                            section_configs, selected_questions
                        )
                        selected_questions.append({
                            "question_text": gq["question_text"],
                            "question_type": gq["question_type"],
                            "marks": gq["marks"],
                            "difficulty": gq["difficulty"],
                            "blooms_level": gq["blooms_level"],
                            "topic": gq["topic"],
                            "section": target_section,
                            "source": "generated",
                            "model_answer": gq.get("model_answer", ""),
                            "answer_keywords": gq.get("answer_keywords", []),
                            "mcq_options": gq.get("mcq_options"),
                            "correct_option": gq.get("correct_option"),
                        })
                        marks_remaining -= gq["marks"]
                        gaps_filled += 1

    # 5. Order questions within sections
    order = 1
    for sq in selected_questions:
        sq["order"] = order
        order += 1

    # 6. Build coverage analysis (with targets)
    # Query chapter weightages from DB curriculum tables
    chapter_weightages = await _get_chapter_weightages(db, board, class_grade, subject)

    coverage = _build_coverage_analysis(
        selected_questions, chapters,
        board=board, total_marks=total_marks,
        chapter_weightages=chapter_weightages,
    )

    # Build paper metadata
    paper_title = title or f"{board} Class {class_grade} {subject} - {exam_type or 'Exam'}"
    instructions = _generate_instructions(board, sections, total_marks, duration_minutes)

    from_bank = sum(1 for sq in selected_questions if sq.get("source") == "bank")

    return {
        "paper": {
            "title": paper_title,
            "board": board,
            "class_grade": class_grade,
            "subject": subject,
            "total_marks": total_marks,
            "duration_minutes": duration_minutes,
            "exam_type": exam_type,
            "sections": section_configs,
            "instructions": instructions,
        },
        "questions": selected_questions,
        "coverage_analysis": coverage,
        "gaps_filled": gaps_filled,
        "total_questions": len(selected_questions),
        "from_bank": from_bank,
    }


def _default_distribution(total_marks: float) -> dict[str, int]:
    """Generate a default question type distribution based on total marks."""
    if total_marks <= 25:
        return {"mcq": 5, "short_answer": 3, "very_short": 2}
    elif total_marks <= 50:
        return {"mcq": 8, "short_answer": 5, "long_answer": 2, "very_short": 3}
    else:
        return {
            "mcq": 10,
            "short_answer": 6,
            "long_answer": 3,
            "very_short": 4,
            "numerical": 2,
        }


def _find_section_with_room(
    section_configs: list[dict],
    selected_questions: list[dict],
) -> str:
    """Find the section with the most remaining marks capacity."""
    section_used = defaultdict(float)
    for sq in selected_questions:
        section_used[sq.get("section", "")] += sq["marks"]

    best_section = section_configs[0]["name"]
    best_room = 0
    for sec in section_configs:
        room = sec["marks"] - section_used.get(sec["name"], 0)
        if room > best_room:
            best_room = room
            best_section = sec["name"]

    return best_section


def _build_coverage_analysis(
    questions: list[dict],
    chapters: list[str],
    board: str = "",
    total_marks: float = 0,
    chapter_weightages: Optional[dict[str, int]] = None,
) -> dict:
    """Build coverage analysis for the assembled paper, including targets."""
    topic_counts: dict[str, int] = defaultdict(int)
    blooms_counts: dict[str, int] = defaultdict(int)
    difficulty_counts: dict[str, int] = defaultdict(int)
    chapter_counts: dict[str, int] = defaultdict(int)

    for q in questions:
        topic_counts[q.get("topic", "Unknown")] += 1
        blooms_counts[q.get("blooms_level", "understand")] += 1
        difficulty_counts[q.get("difficulty", "medium")] += 1
        # Map topic to chapter
        topic_lower = (q.get("topic", "")).lower()
        for ch in chapters:
            if ch.lower() in topic_lower or topic_lower in ch.lower():
                chapter_counts[ch] += 1
                break
        else:
            chapter_counts[q.get("topic", "Other")] += 1

    total = len(questions) or 1
    topic_coverage = {
        topic: round(count / total * 100, 1)
        for topic, count in topic_counts.items()
    }

    # Compute chapter targets from weightages
    chapter_targets = _compute_chapter_targets(
        chapters, chapter_counts, chapter_weightages, total,
    )

    # Compute Bloom's targets based on board
    blooms_targets = _compute_blooms_targets(board, blooms_counts, total)

    return {
        "topic_coverage": topic_coverage,
        "blooms_distribution": dict(blooms_counts),
        "difficulty_distribution": dict(difficulty_counts),
        "chapter_distribution": dict(chapter_counts),
        "chapter_targets": chapter_targets,
        "blooms_targets": blooms_targets,
    }


def _compute_chapter_targets(
    chapters: list[str],
    chapter_counts: dict[str, int],
    chapter_weightages: Optional[dict[str, int]],
    total_questions: int,
) -> list[dict]:
    """Compute target vs actual question counts per chapter."""
    if not chapter_weightages:
        # Equal distribution when no weightage data
        target_per_chapter = max(1, total_questions // max(len(chapters), 1))
        return [
            {
                "chapter_name": ch,
                "actual": chapter_counts.get(ch, 0),
                "target": target_per_chapter,
                "status": _rag_status(chapter_counts.get(ch, 0), target_per_chapter),
            }
            for ch in chapters
        ]

    total_weightage = sum(chapter_weightages.values()) or 1
    result = []
    for ch in chapters:
        weightage = chapter_weightages.get(ch, 0)
        target = max(1, round(total_questions * weightage / total_weightage)) if weightage > 0 else 0
        actual = chapter_counts.get(ch, 0)
        result.append({
            "chapter_name": ch,
            "actual": actual,
            "target": target,
            "status": _rag_status(actual, target),
        })
    return result


def _compute_blooms_targets(
    board: str,
    blooms_counts: dict[str, int],
    total_questions: int,
) -> list[dict]:
    """
    Compute Bloom's taxonomy target distribution based on board.

    CBSE: 50% Apply/Analyze/Evaluate, 30% Understand/Apply, 20% Remember
    ICSE: 40% Apply/Analyze, 40% Understand, 20% Remember
    Default: equal split across levels present
    """
    if board.upper() == "CBSE":
        level_targets = {
            "remember": 0.20,
            "understand": 0.15,
            "apply": 0.25,
            "analyze": 0.20,
            "evaluate": 0.10,
            "create": 0.10,
        }
    elif board.upper() == "ICSE":
        level_targets = {
            "remember": 0.20,
            "understand": 0.40,
            "apply": 0.20,
            "analyze": 0.20,
            "evaluate": 0.00,
            "create": 0.00,
        }
    else:
        # Equal distribution across standard Bloom's levels
        level_targets = {
            "remember": 1 / 6,
            "understand": 1 / 6,
            "apply": 1 / 6,
            "analyze": 1 / 6,
            "evaluate": 1 / 6,
            "create": 1 / 6,
        }

    # Only include levels that have targets > 0 or have actual questions
    all_levels = set(level_targets.keys()) | set(blooms_counts.keys())
    result = []
    for level in sorted(all_levels):
        target_pct = level_targets.get(level, 0)
        target = round(total_questions * target_pct)
        actual = blooms_counts.get(level, 0)
        if target > 0 or actual > 0:
            result.append({
                "level": level,
                "actual": actual,
                "target": target,
                "status": _rag_status(actual, target),
            })
    return result


def _rag_status(actual: int, target: int) -> str:
    """Compute RAG status for a target."""
    if target <= 0:
        return "green" if actual > 0 else "empty"
    if actual == 0:
        return "empty"
    ratio = actual / target
    if ratio >= 0.8:
        return "green"
    if ratio >= 0.5:
        return "amber"
    return "red"


def _generate_instructions(
    board: str,
    sections: list[dict],
    total_marks: float,
    duration_minutes: int,
) -> str:
    """Generate paper instructions based on board and structure."""
    lines = [
        f"Time: {duration_minutes} minutes",
        f"Maximum Marks: {int(total_marks)}",
        "",
        "General Instructions:",
    ]

    if board == "CBSE":
        lines.extend([
            "1. All questions are compulsory.",
            "2. Internal choice is provided in some questions.",
            "3. Draw neat and labeled diagrams wherever required.",
            "4. Use of calculator is not permitted.",
        ])
    elif board == "ICSE":
        lines.extend([
            "1. Attempt all questions from Section A.",
            "2. Attempt any four questions from Section B.",
            "3. Working must be shown clearly.",
            "4. Mathematical tables and graph paper are provided.",
        ])
    else:
        lines.extend([
            "1. All questions are compulsory unless stated otherwise.",
            "2. Show all working steps.",
            "3. Draw neat diagrams where required.",
        ])

    lines.append("")
    for sec in sections:
        sec_instructions = sec.get("instructions", "")
        lines.append(
            f"{sec['name']} ({int(sec['marks'])} marks)"
            + (f" - {sec_instructions}" if sec_instructions else "")
        )

    return "\n".join(lines)
