"""
Curriculum Registry Service.

Provides structured CBSE/ICSE syllabus data for curriculum-grounded
question generation. Data is queried from the database curriculum tables.

Board -> Class -> Subject -> Chapter -> {topics, learning_outcomes, textbook_ref, question_patterns}
"""

from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.curriculum import (
    Board, Curriculum, CurriculumSubject, CurriculumChapter,
    CurriculumTopic, LearningOutcome, QuestionPattern,
)


class CurriculumRegistry:
    """
    DB-backed registry of structured syllabus data for Indian school boards.

    All methods are async and accept a db: AsyncSession parameter.
    """

    async def get_boards(self, db: AsyncSession) -> list[str]:
        """Return all board codes."""
        result = await db.execute(select(Board.code).order_by(Board.code))
        return [row[0] for row in result.all()]

    async def get_classes(self, db: AsyncSession, board: str) -> list[int]:
        """Return available class grades for a board."""
        result = await db.execute(
            select(CurriculumSubject.class_grade)
            .join(Curriculum)
            .join(Board)
            .where(Board.code == board, Curriculum.is_active == True)
            .distinct()
            .order_by(CurriculumSubject.class_grade)
        )
        return [row[0] for row in result.all()]

    async def get_subjects(
        self, db: AsyncSession, board: str, class_grade: int
    ) -> list[str]:
        """Return available subjects for a board and class."""
        result = await db.execute(
            select(CurriculumSubject.name)
            .join(Curriculum)
            .join(Board)
            .where(
                Board.code == board,
                CurriculumSubject.class_grade == class_grade,
                Curriculum.is_active == True,
            )
            .order_by(CurriculumSubject.name)
        )
        return [row[0] for row in result.all()]

    async def get_chapters(
        self, db: AsyncSession, board: str, class_grade: int, subject: str
    ) -> list[dict]:
        """Return chapter summaries for a board/class/subject."""
        result = await db.execute(
            select(CurriculumChapter)
            .join(CurriculumSubject)
            .join(Curriculum)
            .join(Board)
            .where(
                Board.code == board,
                CurriculumSubject.class_grade == class_grade,
                CurriculumSubject.name == subject,
                Curriculum.is_active == True,
            )
            .options(selectinload(CurriculumChapter.topics))
            .order_by(CurriculumChapter.number)
        )
        chapters = result.scalars().all()
        return [
            {
                "name": ch.name,
                "textbook_ref": ch.textbook_reference or "",
                "topic_count": len(ch.topics),
            }
            for ch in chapters
        ]

    async def get_chapter_detail(
        self,
        db: AsyncSession,
        board: str,
        class_grade: int,
        subject: str,
        chapter: str,
    ) -> Optional[dict]:
        """Return full chapter detail including topics, outcomes, and patterns."""
        result = await db.execute(
            select(CurriculumChapter)
            .join(CurriculumSubject)
            .join(Curriculum)
            .join(Board)
            .where(
                Board.code == board,
                CurriculumSubject.class_grade == class_grade,
                CurriculumSubject.name == subject,
                func.lower(CurriculumChapter.name) == chapter.lower(),
                Curriculum.is_active == True,
            )
            .options(
                selectinload(CurriculumChapter.topics)
                .selectinload(CurriculumTopic.learning_outcomes),
                selectinload(CurriculumChapter.question_patterns),
            )
        )
        ch = result.scalars().first()
        if ch is None:
            return None

        topics = [t.name for t in ch.topics]
        learning_outcomes = []
        for t in ch.topics:
            for lo in t.learning_outcomes:
                learning_outcomes.append(lo.description)

        # Build suggested distribution from question patterns
        suggested_distribution = {"easy": 25, "medium": 50, "hard": 25}

        return {
            "name": ch.name,
            "textbook_ref": ch.textbook_reference or "",
            "topics": topics,
            "learning_outcomes": learning_outcomes,
            "question_pattern_notes": ch.question_pattern_notes or "",
            "suggested_distribution": suggested_distribution,
        }

    async def get_curriculum(
        self,
        db: AsyncSession,
        board: Optional[str] = None,
        class_grade: Optional[int] = None,
        subject: Optional[str] = None,
        chapter: Optional[str] = None,
    ) -> dict:
        """
        Cascading curriculum lookup.

        Returns the appropriate level of detail based on which params are provided.
        """
        if chapter and subject and class_grade and board:
            detail = await self.get_chapter_detail(
                db, board, class_grade, subject, chapter
            )
            if detail:
                return {"type": "chapter_detail", "data": detail}
            return {"type": "chapter_detail", "data": None}

        if subject and class_grade and board:
            chapters = await self.get_chapters(db, board, class_grade, subject)
            return {"type": "chapters", "data": chapters}

        if class_grade and board:
            subjects = await self.get_subjects(db, board, class_grade)
            return {"type": "subjects", "data": subjects}

        if board:
            classes = await self.get_classes(db, board)
            return {"type": "classes", "data": classes}

        boards = await self.get_boards(db)
        return {"type": "boards", "data": boards}
