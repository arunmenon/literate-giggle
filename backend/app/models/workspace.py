"""Workspace, membership, class, enrollment, and exam assignment models."""

import secrets
import string
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Boolean, JSON, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


def generate_invite_code() -> str:
    """Generate a random 6-digit uppercase alphanumeric invite code."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(20), nullable=False, default="personal")  # "personal" or "school"
    invite_code = Column(String(6), unique=True, nullable=False, default=generate_invite_code)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    settings = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", foreign_keys=[owner_id])
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    classes = relationship("ClassGroup", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    """Many-to-many: users can belong to multiple workspaces."""
    __tablename__ = "workspace_members"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),)

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False, default="student")  # "owner", "admin", "teacher", "student"
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User")


class ClassGroup(Base):
    __tablename__ = "class_groups"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    name = Column(String(255), nullable=False)  # e.g. "Class 10-A"
    grade = Column(Integer, nullable=False)
    section = Column(String(50))
    subject = Column(String(100))
    academic_year = Column(String(20))
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Join code fields for student self-enrollment
    join_code = Column(String(8), unique=True, nullable=False, default=generate_invite_code)
    join_code_active = Column(Boolean, default=True)
    invite_link_token = Column(String(64), unique=True, nullable=True)
    link_expires_at = Column(DateTime, nullable=True)
    max_students = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    workspace = relationship("Workspace", back_populates="classes")
    teacher = relationship("User", foreign_keys=[teacher_id])
    enrollments = relationship("Enrollment", back_populates="class_group", cascade="all, delete-orphan")
    assignments = relationship("ExamAssignment", back_populates="class_group", cascade="all, delete-orphan")


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("class_id", "student_id", name="uq_class_enrollment"),)

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("class_groups.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("student_profiles.id"), nullable=False)
    enrolled_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)

    class_group = relationship("ClassGroup", back_populates="enrollments")
    student = relationship("StudentProfile")


class ExamAssignment(Base):
    """Links a paper to a class with scheduling. No unique constraint on paper+class (allows retakes)."""
    __tablename__ = "exam_assignments"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("question_papers.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("class_groups.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="active")  # "draft", "active", "closed"
    label = Column(String(100), nullable=True)  # e.g. "Retake", "Supplementary"
    start_at = Column(DateTime, nullable=True)  # null = available immediately
    end_at = Column(DateTime, nullable=True)  # null = no end date
    is_practice = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    paper = relationship("QuestionPaper")
    class_group = relationship("ClassGroup", back_populates="assignments")
    assigner = relationship("User", foreign_keys=[assigned_by])
