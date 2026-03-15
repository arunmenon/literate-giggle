"""Workspace, class, enrollment, and exam assignment schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ── Workspace ──

class WorkspaceCreate(BaseModel):
    name: str
    type: str = "personal"  # "personal" or "school"


class WorkspaceResponse(BaseModel):
    id: int
    name: str
    type: str
    invite_code: str
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class WorkspaceMemberResponse(BaseModel):
    id: int
    workspace_id: int
    user_id: int
    role: str
    full_name: str
    email: str
    joined_at: datetime


class WorkspaceSummary(BaseModel):
    id: int
    name: str
    type: str
    role: str  # user's role in this workspace


class JoinWorkspaceRequest(BaseModel):
    invite_code: str


class SwitchWorkspaceRequest(BaseModel):
    workspace_id: int


# ── Class Group ──

class ClassGroupCreate(BaseModel):
    name: str
    grade: int
    section: Optional[str] = None
    subject: Optional[str] = None
    academic_year: Optional[str] = None


class ClassGroupResponse(BaseModel):
    id: int
    workspace_id: int
    name: str
    grade: int
    section: Optional[str]
    subject: Optional[str]
    academic_year: Optional[str]
    teacher_id: Optional[int]
    student_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# ── Enrollment ──

class EnrollStudentRequest(BaseModel):
    student_user_id: Optional[int] = None
    email: Optional[str] = None


class EnrollmentResponse(BaseModel):
    id: int
    class_id: int
    student_id: int
    student_name: str
    student_email: str
    enrolled_at: datetime
    is_active: bool


# ── Exam Assignment ──

class ExamAssignmentCreate(BaseModel):
    paper_id: int
    status: str = "active"
    label: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_practice: bool = False


class ExamAssignmentResponse(BaseModel):
    id: int
    paper_id: int
    paper_title: str
    class_id: int
    class_name: str
    assigned_by: int
    status: str
    label: Optional[str]
    start_at: Optional[datetime]
    end_at: Optional[datetime]
    is_practice: bool
    created_at: datetime
