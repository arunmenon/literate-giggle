"""Learning plan and mastery tracking models."""

import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, DateTime, Enum, ForeignKey, Text, Float, JSON, Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


class MasteryLevel(str, enum.Enum):
    NOT_STARTED = "not_started"
    BEGINNER = "beginner"
    DEVELOPING = "developing"
    PROFICIENT = "proficient"
    MASTERED = "mastered"


class ObjectiveStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class LearningPlan(Base):
    """Personalized learning plan generated from evaluation results."""

    __tablename__ = "learning_plans"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    board = Column(String(50), nullable=False)
    class_grade = Column(Integer, nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    # Plan details
    focus_areas = Column(JSON)  # Weak topics to focus on
    target_score = Column(Float)  # Target percentage
    current_score = Column(Float)  # Current average percentage
    estimated_hours = Column(Float)  # Estimated study hours needed
    # Schedule
    start_date = Column(DateTime)
    target_date = Column(DateTime)
    # Progress
    progress_pct = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    student = relationship("StudentProfile", back_populates="learning_plans")
    objectives = relationship("LearningObjective", back_populates="plan", cascade="all, delete-orphan")


class LearningObjective(Base):
    """Individual learning objective within a plan."""

    __tablename__ = "learning_objectives"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("learning_plans.id"), nullable=False)
    topic = Column(String(255), nullable=False)
    subtopic = Column(String(255))
    description = Column(Text, nullable=False)
    priority = Column(Integer, default=1)  # 1 = highest
    status = Column(Enum(ObjectiveStatus), default=ObjectiveStatus.PENDING)
    # Resources
    resources = Column(JSON)
    # [{"type": "video", "title": "...", "url": "..."}, {"type": "practice", ...}]
    practice_question_ids = Column(JSON)  # Linked practice questions
    # Progress
    target_mastery = Column(Enum(MasteryLevel), default=MasteryLevel.PROFICIENT)
    current_mastery = Column(Enum(MasteryLevel), default=MasteryLevel.NOT_STARTED)
    attempts = Column(Integer, default=0)
    best_score_pct = Column(Float)
    completed_at = Column(DateTime)
    order = Column(Integer, default=0)

    plan = relationship("LearningPlan", back_populates="objectives")


class TopicMastery(Base):
    """Tracks student mastery across topics over time."""

    __tablename__ = "topic_masteries"
    __table_args__ = (UniqueConstraint("student_id", "subject", "topic", name="uq_topic_mastery"),)

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.id"), nullable=False)
    subject = Column(String(100), nullable=False, index=True)
    topic = Column(String(255), nullable=False, index=True)
    subtopic = Column(String(255))
    board = Column(String(50), nullable=False)
    class_grade = Column(Integer, nullable=False)
    # Taxonomy FK (nullable for gradual migration)
    chapter_id = Column(Integer, ForeignKey("curriculum_chapters.id"), nullable=True, index=True)
    # Mastery tracking
    mastery_level = Column(Enum(MasteryLevel), default=MasteryLevel.NOT_STARTED)
    score_history = Column(JSON)  # [{"date": "...", "score": 75, "exam": "..."}]
    total_attempts = Column(Integer, default=0)
    avg_score_pct = Column(Float, default=0.0)
    last_score_pct = Column(Float)
    # Trend
    trend = Column(String(20))  # "improving", "declining", "stable"
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    student = relationship("StudentProfile", back_populates="topic_masteries")


class VoiceTutorSession(Base):
    """Voice-based AI tutoring session. Stores text transcript only (no audio -- DPDP)."""

    __tablename__ = "voice_tutor_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    topic = Column(String(255), nullable=True)
    transcript = Column(JSON, default=list)
    # Example: [{"role": "student", "text": "...", "timestamp": "..."}, {"role": "tutor", "text": "...", "timestamp": "..."}]
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ended_at = Column(DateTime, nullable=True)

    user = relationship("User")
