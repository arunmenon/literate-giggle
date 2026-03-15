"""User and profile models."""

import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, DateTime, Enum, ForeignKey, Boolean, Text,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


class UserRole(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.STUDENT)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    # Tracks which workspace the user is currently operating in (NOT membership FK)
    active_workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)

    student_profile = relationship("StudentProfile", back_populates="user", uselist=False)
    teacher_profile = relationship("TeacherProfile", back_populates="user", uselist=False)
    active_workspace = relationship("Workspace", foreign_keys=[active_workspace_id])


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    board = Column(String(50), nullable=False)  # CBSE, ICSE, State Board
    class_grade = Column(Integer, nullable=False)  # 7-12
    school_name = Column(String(255))
    section = Column(String(10))
    roll_number = Column(String(50))
    academic_year = Column(String(20), default="2025-26")
    parent_email = Column(String(255))

    user = relationship("User", back_populates="student_profile")
    exam_sessions = relationship("ExamSession", back_populates="student")
    learning_plans = relationship("LearningPlan", back_populates="student")
    topic_masteries = relationship("TopicMastery", back_populates="student")


class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    board = Column(String(50), nullable=False)
    subjects = Column(Text)  # JSON list of subjects
    classes = Column(Text)  # JSON list of class grades
    institution = Column(String(255))
    employee_id = Column(String(50))
    ai_assistance_level = Column(String(20), default="guided")  # "auto", "guided", "expert"

    user = relationship("User", back_populates="teacher_profile")
