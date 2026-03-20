"""
CurriculumContext Service.

Assembles existing curriculum DB data into a structured context bundle
for AI question generation. All 5 existing layers (structure, outcomes,
textbook refs, question patterns, marks weightage) are read from the DB.
Prerequisites are stubbed. Performance is aggregated from TopicMastery.
"""

import logging
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.curriculum import (
    Board, Curriculum, CurriculumSubject, CurriculumChapter,
    CurriculumTopic, LearningOutcome, QuestionPattern,
)
from ..models.learning import TopicMastery

logger = logging.getLogger(__name__)


# ── Sub-models ──


class TopicContext(BaseModel):
    name: str
    description: Optional[str] = None


class OutcomeContext(BaseModel):
    code: Optional[str] = None
    description: str
    bloom_level: Optional[str] = None


class PatternContext(BaseModel):
    question_type: str
    typical_marks: int
    frequency: Optional[str] = None
    example_question: Optional[str] = None


class PrerequisiteStub(BaseModel):
    chapter_id: int
    chapter_name: str
    relationship: str


class PerformanceSummary(BaseModel):
    avg_score: float
    total_attempts: int
    weak_topics: list[str] = []
    trend: Optional[str] = None  # "improving", "declining", "stable"


class EmpiricalDifficulty(BaseModel):
    question_id: int
    assigned_difficulty: str
    empirical_difficulty: str
    empirical_score: float
    sample_size: int
    mismatch: bool


# ── Main context bundle ──


class CurriculumContext(BaseModel):
    """Structured context bundle for AI question generation."""

    # Layer 1: Structure
    board: str
    curriculum_id: int
    subject: str
    class_grade: int
    chapter_id: int
    chapter_name: str
    chapter_number: int
    topics: list[TopicContext] = []

    # Layer 2: Learning Outcomes
    learning_outcomes: list[OutcomeContext] = []

    # Layer 3: Textbook References
    textbook_name: Optional[str] = None
    textbook_reference: Optional[str] = None

    # Layer 4: Question Patterns
    question_pattern_notes: Optional[str] = None
    question_patterns: list[PatternContext] = []

    # Layer 5: Marks Weightage
    marks_weightage: Optional[int] = None

    # Layer 6: Prerequisite Graph (stub)
    prerequisites: list[PrerequisiteStub] = []

    # Layer 7: Performance Aggregation
    performance_summary: Optional[PerformanceSummary] = None

    # Layer 8: Empirical Difficulty (populated by Phase 4 integration)
    empirical_difficulty: Optional[dict[int, EmpiricalDifficulty]] = None

    def to_prompt_section(self) -> str:
        """Serialize context to a structured prompt section for AI generation."""
        lines = [
            "**Curriculum Context:**",
            f"Board: {self.board} | Class: {self.class_grade} | Subject: {self.subject}",
            f"Chapter {self.chapter_number}: {self.chapter_name}",
        ]

        if self.textbook_reference:
            lines.append(f"Textbook: {self.textbook_reference}")
        if self.textbook_name:
            lines.append(f"Textbook Name: {self.textbook_name}")

        if self.topics:
            topic_strs = [
                f"  - {t.name}" + (f": {t.description}" if t.description else "")
                for t in self.topics
            ]
            lines.append(f"\nTopics:\n" + "\n".join(topic_strs))

        if self.learning_outcomes:
            outcome_strs = []
            for lo in self.learning_outcomes:
                parts = [f"  - {lo.description}"]
                if lo.bloom_level:
                    parts.append(f"[{lo.bloom_level}]")
                if lo.code:
                    parts.append(f"({lo.code})")
                outcome_strs.append(" ".join(parts))
            lines.append(f"\nLearning Outcomes:\n" + "\n".join(outcome_strs))

        if self.question_pattern_notes:
            lines.append(f"\nQuestion Patterns (Board Notes): {self.question_pattern_notes}")

        if self.question_patterns:
            pattern_strs = [
                f"  - {p.question_type}: {p.typical_marks} marks"
                + (f", freq={p.frequency}" if p.frequency else "")
                for p in self.question_patterns
            ]
            lines.append(f"\nExpected Question Patterns:\n" + "\n".join(pattern_strs))

        if self.marks_weightage is not None:
            lines.append(f"\nMarks Weightage: {self.marks_weightage}")

        if self.performance_summary:
            ps = self.performance_summary
            lines.append(
                f"\nPerformance Data: avg score {ps.avg_score:.1f}%, "
                f"{ps.total_attempts} attempts, trend={ps.trend or 'unknown'}"
            )
            if ps.weak_topics:
                lines.append(f"  Weak areas: {', '.join(ps.weak_topics)}")

        if self.empirical_difficulty:
            mismatches = [
                ed for ed in self.empirical_difficulty.values() if ed.mismatch
            ]
            if mismatches:
                lines.append("\nDifficulty Calibration Alerts:")
                for ed in mismatches:
                    lines.append(
                        f"  - Q#{ed.question_id}: marked {ed.assigned_difficulty}, "
                        f"actual {ed.empirical_difficulty} "
                        f"(avg score {ed.empirical_score:.0%}, n={ed.sample_size})"
                    )

        return "\n".join(lines)


async def build_curriculum_context(
    db: AsyncSession,
    board: str,
    class_grade: int,
    subject: str,
    chapter_name: str,
    student_ids: Optional[list[int]] = None,
) -> Optional[CurriculumContext]:
    """
    Build a CurriculumContext bundle from existing DB data.

    Queries Board > Curriculum (is_active) > CurriculumSubject > CurriculumChapter
    > CurriculumTopic > LearningOutcome, plus QuestionPattern and TopicMastery.

    Returns None if no matching curriculum data exists.
    """
    # Find the chapter through the curriculum hierarchy
    chapter_query = (
        select(
            CurriculumChapter,
            CurriculumSubject,
            Curriculum,
            Board,
        )
        .join(CurriculumSubject, CurriculumChapter.subject_id == CurriculumSubject.id)
        .join(Curriculum, CurriculumSubject.curriculum_id == Curriculum.id)
        .join(Board, Curriculum.board_id == Board.id)
        .where(
            Board.code == board,
            CurriculumSubject.class_grade == class_grade,
            CurriculumSubject.name == subject,
            Curriculum.is_active == True,
            CurriculumChapter.name == chapter_name,
        )
    )
    result = await db.execute(chapter_query)
    row = result.first()

    if not row:
        logger.debug(
            "No curriculum context found for board=%s, grade=%d, subject=%s, chapter=%s",
            board, class_grade, subject, chapter_name,
        )
        return None

    chapter, curriculum_subject, curriculum, board_obj = row

    # Layer 1: Topics
    topics_result = await db.execute(
        select(CurriculumTopic).where(CurriculumTopic.chapter_id == chapter.id)
    )
    topics = topics_result.scalars().all()

    # Layer 2: Learning outcomes (through topics)
    topic_ids = [t.id for t in topics]
    learning_outcomes = []
    if topic_ids:
        outcomes_result = await db.execute(
            select(LearningOutcome).where(LearningOutcome.topic_id.in_(topic_ids))
        )
        learning_outcomes = outcomes_result.scalars().all()

    # Layer 4: Question patterns
    patterns_result = await db.execute(
        select(QuestionPattern).where(QuestionPattern.chapter_id == chapter.id)
    )
    patterns = patterns_result.scalars().all()

    # Layer 7: Performance aggregation (if student_ids provided)
    performance_summary = None
    if student_ids:
        performance_summary = await _aggregate_performance(
            db, chapter.id, student_ids
        )

    return CurriculumContext(
        # Layer 1: Structure
        board=board_obj.code,
        curriculum_id=curriculum.id,
        subject=curriculum_subject.name,
        class_grade=curriculum_subject.class_grade,
        chapter_id=chapter.id,
        chapter_name=chapter.name,
        chapter_number=chapter.number,
        topics=[
            TopicContext(name=t.name, description=t.description)
            for t in topics
        ],
        # Layer 2: Learning Outcomes
        learning_outcomes=[
            OutcomeContext(
                code=lo.code,
                description=lo.description,
                bloom_level=lo.bloom_level,
            )
            for lo in learning_outcomes
        ],
        # Layer 3: Textbook References
        textbook_name=curriculum_subject.textbook_name,
        textbook_reference=chapter.textbook_reference,
        # Layer 4: Question Patterns
        question_pattern_notes=chapter.question_pattern_notes,
        question_patterns=[
            PatternContext(
                question_type=p.question_type,
                typical_marks=p.typical_marks,
                frequency=p.frequency,
                example_question=p.example_question,
            )
            for p in patterns
        ],
        # Layer 5: Marks Weightage
        marks_weightage=chapter.marks_weightage,
        # Layer 6: Prerequisites (stub -- TODO: populate from prerequisite graph model)
        prerequisites=[],
        # Layer 7: Performance
        performance_summary=performance_summary,
        # Layer 8: Empirical difficulty (populated later by Phase 4 integration)
        empirical_difficulty=None,
    )


async def _aggregate_performance(
    db: AsyncSession,
    chapter_id: int,
    student_ids: list[int],
) -> Optional[PerformanceSummary]:
    """Aggregate TopicMastery data for a chapter and set of students."""
    mastery_query = (
        select(TopicMastery)
        .where(
            TopicMastery.chapter_id == chapter_id,
            TopicMastery.student_id.in_(student_ids),
        )
    )
    result = await db.execute(mastery_query)
    masteries = result.scalars().all()

    if not masteries:
        return None

    total_attempts = sum(m.total_attempts or 0 for m in masteries)
    scores = [m.avg_score_pct for m in masteries if m.avg_score_pct is not None]
    avg_score = sum(scores) / len(scores) if scores else 0.0

    # Identify weak topics (below 50% average)
    weak_topics = [
        m.topic for m in masteries
        if m.avg_score_pct is not None and m.avg_score_pct < 50.0
    ]

    # Determine overall trend from individual trends
    trends = [m.trend for m in masteries if m.trend]
    trend = None
    if trends:
        from collections import Counter
        trend_counts = Counter(trends)
        trend = trend_counts.most_common(1)[0][0]

    return PerformanceSummary(
        avg_score=avg_score,
        total_attempts=total_attempts,
        weak_topics=weak_topics,
        trend=trend,
    )
