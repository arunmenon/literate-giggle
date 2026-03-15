"""Curriculum hierarchy models for board-specific syllabus data."""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Boolean, Text, JSON,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


class Board(Base):
    """Education board (CBSE, ICSE, State Board)."""
    __tablename__ = "boards"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False)  # "CBSE", "ICSE"
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    curricula = relationship("Curriculum", back_populates="board")


class Curriculum(Base):
    """Versioned curriculum for a board and academic year."""
    __tablename__ = "curricula"

    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    academic_year = Column(String(10), nullable=False)  # "2025-26"
    is_active = Column(Boolean, default=True)

    board = relationship("Board", back_populates="curricula")
    subjects = relationship("CurriculumSubject", back_populates="curriculum")


class CurriculumSubject(Base):
    """Subject within a curriculum (e.g. Mathematics for Class 10)."""
    __tablename__ = "curriculum_subjects"

    id = Column(Integer, primary_key=True, index=True)
    curriculum_id = Column(Integer, ForeignKey("curricula.id"), nullable=False)
    code = Column(String(20), nullable=False)  # "MATH", "SCI"
    name = Column(String(100), nullable=False)
    class_grade = Column(Integer, nullable=False)
    textbook_name = Column(String(200), nullable=True)
    total_marks = Column(Integer, nullable=True)

    curriculum = relationship("Curriculum", back_populates="subjects")
    chapters = relationship("CurriculumChapter", back_populates="subject")


class CurriculumChapter(Base):
    """Chapter within a subject."""
    __tablename__ = "curriculum_chapters"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("curriculum_subjects.id"), nullable=False)
    number = Column(Integer, nullable=False)
    name = Column(String(200), nullable=False)
    textbook_reference = Column(String(200), nullable=True)
    marks_weightage = Column(Integer, nullable=True)
    question_pattern_notes = Column(Text, nullable=True)

    subject = relationship("CurriculumSubject", back_populates="chapters")
    topics = relationship("CurriculumTopic", back_populates="chapter")
    question_patterns = relationship("QuestionPattern", back_populates="chapter")
    uploaded_documents = relationship("UploadedDocument", back_populates="chapter")


class CurriculumTopic(Base):
    """Topic within a chapter."""
    __tablename__ = "curriculum_topics"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("curriculum_chapters.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    chapter = relationship("CurriculumChapter", back_populates="topics")
    learning_outcomes = relationship("LearningOutcome", back_populates="topic")


class LearningOutcome(Base):
    """Learning outcome linked to a topic."""
    __tablename__ = "learning_outcomes"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("curriculum_topics.id"), nullable=False)
    code = Column(String(20), nullable=True)  # "LO-M10-02-03"
    description = Column(Text, nullable=False)
    bloom_level = Column(String(20), nullable=True)
    competency_type = Column(String(30), nullable=True)

    topic = relationship("CurriculumTopic", back_populates="learning_outcomes")


class QuestionPattern(Base):
    """Board exam question pattern for a chapter."""
    __tablename__ = "question_patterns"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("curriculum_chapters.id"), nullable=False)
    question_type = Column(String(30), nullable=False)
    typical_marks = Column(Integer, nullable=False)
    frequency = Column(String(20), nullable=True)  # "high" / "medium" / "low"
    pattern_notes = Column(Text, nullable=True)
    example_question = Column(Text, nullable=True)
    source_year = Column(String(10), nullable=True)

    chapter = relationship("CurriculumChapter", back_populates="question_patterns")


class UploadedDocument(Base):
    """Teacher-uploaded PDF (textbook, past paper, reference material)."""
    __tablename__ = "uploaded_documents"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    chapter_id = Column(Integer, ForeignKey("curriculum_chapters.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    content_type = Column(String(30), nullable=False)  # "textbook" / "past_paper" / "reference"
    extracted_text = Column(Text, nullable=True)
    extracted_questions = Column(JSON, nullable=True)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    chapter = relationship("CurriculumChapter", back_populates="uploaded_documents")
