"""Exam lifecycle models: Question Bank, Papers, Sessions, Answers."""

import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, DateTime, Enum, ForeignKey, Boolean, Text,
    Float, JSON,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


class QuestionType(str, enum.Enum):
    MCQ = "mcq"
    SHORT_ANSWER = "short_answer"
    LONG_ANSWER = "long_answer"
    VERY_SHORT = "very_short"
    FILL_IN_BLANK = "fill_in_blank"
    TRUE_FALSE = "true_false"
    MATCH_FOLLOWING = "match_following"
    DIAGRAM = "diagram"
    NUMERICAL = "numerical"
    CASE_STUDY = "case_study"


class DifficultyLevel(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class BloomsTaxonomy(str, enum.Enum):
    REMEMBER = "remember"
    UNDERSTAND = "understand"
    APPLY = "apply"
    ANALYZE = "analyze"
    EVALUATE = "evaluate"
    CREATE = "create"


class PaperStatus(str, enum.Enum):
    DRAFT = "draft"
    REVIEW = "review"
    PUBLISHED = "published"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ExamSessionStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    AUTO_SUBMITTED = "auto_submitted"
    EVALUATED = "evaluated"
    REVIEWED = "reviewed"


# ── Question Bank ──


class QuestionBank(Base):
    __tablename__ = "question_banks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    board = Column(String(50), nullable=False, index=True)
    class_grade = Column(Integer, nullable=False, index=True)
    subject = Column(String(100), nullable=False, index=True)
    chapter = Column(String(255))
    description = Column(Text)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    questions = relationship("Question", back_populates="bank", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    bank_id = Column(Integer, ForeignKey("question_banks.id"), nullable=False)
    question_type = Column(Enum(QuestionType), nullable=False)
    question_text = Column(Text, nullable=False)
    question_image_url = Column(String(500))  # For diagram-based questions
    marks = Column(Float, nullable=False)
    difficulty = Column(Enum(DifficultyLevel), default=DifficultyLevel.MEDIUM)
    blooms_level = Column(Enum(BloomsTaxonomy), default=BloomsTaxonomy.UNDERSTAND)
    topic = Column(String(255), nullable=False, index=True)
    subtopic = Column(String(255))
    # Expected answer / rubric
    model_answer = Column(Text)  # Ideal answer
    answer_keywords = Column(JSON)  # Key points for evaluation
    mcq_options = Column(JSON)  # For MCQ: {"a": "...", "b": "...", ...}
    correct_option = Column(String(10))  # For MCQ
    marking_scheme = Column(JSON)  # Step-wise marking: [{"step": "...", "marks": 1}, ...]
    # Metadata
    source = Column(String(255))  # "CBSE 2024 Board", "NCERT Ch5", etc.
    is_active = Column(Boolean, default=True)
    times_used = Column(Integer, default=0)
    avg_score_pct = Column(Float)  # Average score when this question is attempted
    # Taxonomy FK (nullable for gradual migration)
    chapter_id = Column(Integer, ForeignKey("curriculum_chapters.id"), nullable=True, index=True)
    # Provenance (AI generation tracking)
    original_ai_text = Column(Text, nullable=True)  # Original text before teacher edits
    teacher_edited = Column(Boolean, default=False)  # Whether teacher modified AI output
    quality_rating = Column(Integer, nullable=True)  # 1-5 star rating from teacher
    generation_context = Column(Text, nullable=True)  # JSON: research context used for generation
    # Bloom's confidence (Phase 3)
    blooms_confidence = Column(Float, nullable=True)  # 0.0-1.0 confidence in blooms_level assignment
    blooms_teacher_confirmed = Column(Boolean, default=False)  # True when teacher confirms/changes blooms
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    bank = relationship("QuestionBank", back_populates="questions")
    chapter = relationship("CurriculumChapter", foreign_keys=[chapter_id])
    paper_questions = relationship("PaperQuestion", back_populates="question")


# ── Question Paper ──


class QuestionPaper(Base):
    __tablename__ = "question_papers"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    board = Column(String(50), nullable=False, index=True)
    class_grade = Column(Integer, nullable=False, index=True)
    subject = Column(String(100), nullable=False, index=True)
    academic_year = Column(String(20))
    exam_type = Column(String(100))  # Unit Test, Mid-term, Final, Practice
    total_marks = Column(Float, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    instructions = Column(Text)
    status = Column(Enum(PaperStatus), default=PaperStatus.DRAFT)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)
    # Paper structure
    sections = Column(JSON)  # [{"name": "Section A", "instructions": "...", "marks": 20}]
    # Lifecycle
    created_by = Column(Integer, ForeignKey("users.id"))
    published_at = Column(DateTime)
    starts_at = Column(DateTime)  # When exam window opens
    ends_at = Column(DateTime)  # When exam window closes
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    paper_questions = relationship(
        "PaperQuestion", back_populates="paper", order_by="PaperQuestion.order",
        cascade="all, delete-orphan",
    )
    exam_sessions = relationship("ExamSession", back_populates="paper")


class PaperQuestion(Base):
    """Links questions to papers with ordering and section info."""

    __tablename__ = "paper_questions"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("question_papers.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    section = Column(String(50))  # "Section A", "Section B"
    order = Column(Integer, nullable=False)
    marks_override = Column(Float)  # Override question's default marks if needed
    is_compulsory = Column(Boolean, default=True)
    choice_group = Column(String(50))  # Group questions for internal choice

    paper = relationship("QuestionPaper", back_populates="paper_questions")
    question = relationship("Question", back_populates="paper_questions")


# ── Exam Session (Simulation) ──


class ExamSession(Base):
    """A student's attempt at a question paper."""

    __tablename__ = "exam_sessions"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("question_papers.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("student_profiles.id"), nullable=False)
    status = Column(Enum(ExamSessionStatus), default=ExamSessionStatus.NOT_STARTED)
    started_at = Column(DateTime)
    submitted_at = Column(DateTime)
    time_spent_seconds = Column(Integer, default=0)
    # Proctoring / integrity
    tab_switches = Column(Integer, default=0)
    is_practice = Column(Boolean, default=False)
    # Results (populated after evaluation)
    total_score = Column(Float)
    percentage = Column(Float)
    grade = Column(String(5))
    rank = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    paper = relationship("QuestionPaper", back_populates="exam_sessions")
    student = relationship("StudentProfile", back_populates="exam_sessions")
    answers = relationship("StudentAnswer", back_populates="session", cascade="all, delete-orphan")
    evaluation = relationship("Evaluation", back_populates="session", uselist=False)


class StudentAnswer(Base):
    """Individual answer submitted by student for each question."""

    __tablename__ = "student_answers"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id"), nullable=False)
    paper_question_id = Column(Integer, ForeignKey("paper_questions.id"), nullable=False)
    answer_text = Column(Text)
    answer_image_url = Column(String(500))  # For handwritten / diagram answers
    canvas_state = Column(JSON, nullable=True)  # Excalidraw JSON for diagram answer resumability
    selected_option = Column(String(10))  # For MCQ
    time_spent_seconds = Column(Integer, default=0)
    is_flagged = Column(Boolean, default=False)  # Student flagged for review
    hint_count = Column(Integer, default=0)  # Number of hints requested
    hints_used = Column(JSON)  # List of hint texts provided
    auto_saved_at = Column(DateTime)
    submitted_at = Column(DateTime)

    session = relationship("ExamSession", back_populates="answers")
    paper_question = relationship("PaperQuestion")
    question_evaluation = relationship(
        "QuestionEvaluation", back_populates="student_answer", uselist=False
    )
