"""Evaluation and scoring models."""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Text, Float, JSON, Boolean,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


class RubricTemplate(Base):
    """Reusable rubric templates for consistent evaluation."""

    __tablename__ = "rubric_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    board = Column(String(50), nullable=False)
    subject = Column(String(100), nullable=False)
    question_type = Column(String(50), nullable=False)
    # Rubric criteria
    criteria = Column(JSON, nullable=False)
    # Example: [
    #   {"name": "Content Accuracy", "weight": 40, "levels": [
    #     {"score": 4, "description": "Fully accurate with examples"},
    #     {"score": 3, "description": "Mostly accurate"},
    #     {"score": 2, "description": "Partially accurate"},
    #     {"score": 1, "description": "Mostly inaccurate"},
    #     {"score": 0, "description": "Incorrect or no answer"}
    #   ]},
    #   {"name": "Presentation", "weight": 20, ...},
    #   {"name": "Keywords & Terminology", "weight": 20, ...},
    #   {"name": "Diagram/Formula", "weight": 20, ...}
    # ]
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Evaluation(Base):
    """Overall evaluation of a student's exam session."""

    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id"), unique=True, nullable=False)
    total_marks_obtained = Column(Float, nullable=False)
    total_marks_possible = Column(Float, nullable=False)
    percentage = Column(Float, nullable=False)
    grade = Column(String(5))
    # Analytics
    topic_scores = Column(JSON)
    # {"Algebra": {"obtained": 12, "total": 15}, "Geometry": {...}}
    blooms_scores = Column(JSON)
    # {"remember": 90, "understand": 75, "apply": 60, ...}  (percentages)
    difficulty_scores = Column(JSON)
    # {"easy": 95, "medium": 70, "hard": 40}
    strengths = Column(JSON)  # List of strong topics
    weaknesses = Column(JSON)  # List of weak topics
    recommendations = Column(Text)  # AI-generated study recommendations
    # Evaluation metadata
    evaluated_by = Column(String(50))  # "ai", "teacher", "hybrid"
    evaluated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime)
    is_final = Column(Boolean, default=False)

    session = relationship("ExamSession", back_populates="evaluation")
    question_evaluations = relationship("QuestionEvaluation", back_populates="evaluation")


class QuestionEvaluation(Base):
    """Per-question evaluation with detailed feedback."""

    __tablename__ = "question_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), nullable=False)
    student_answer_id = Column(
        Integer, ForeignKey("student_answers.id"), unique=True, nullable=False
    )
    marks_obtained = Column(Float, nullable=False)
    marks_possible = Column(Float, nullable=False)
    # Detailed feedback
    feedback = Column(Text)  # Explanation of scoring
    rubric_scores = Column(JSON)  # Per-criterion scores
    keywords_found = Column(JSON)  # Which expected keywords were present
    keywords_missing = Column(JSON)  # Which expected keywords were absent
    step_scores = Column(JSON)  # Step-wise marks for numerical/long answers
    # Improvement hints
    improvement_hint = Column(Text)
    model_answer_comparison = Column(Text)  # How student's answer differs from ideal

    evaluation = relationship("Evaluation", back_populates="question_evaluations")
    student_answer = relationship("StudentAnswer", back_populates="question_evaluation")
