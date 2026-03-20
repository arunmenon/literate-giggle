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
    owner_name: Optional[str] = None
    class_count: int = 0
    primary_subject: Optional[str] = None
    color: str = "#3B82F6"


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
    join_code: str
    join_code_active: bool
    student_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# ── Join Class (student self-enrollment) ──

class JoinClassRequest(BaseModel):
    join_code: str


class JoinClassResponse(BaseModel):
    class_id: int
    class_name: str
    workspace_id: int
    workspace_name: str
    message: str


class CopyRosterRequest(BaseModel):
    source_class_id: int


class CopyRosterResponse(BaseModel):
    copied: int
    skipped: int
    total: int


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


# ── Bulk Enrollment ──

class BulkEnrollRequest(BaseModel):
    emails: list[str]
    skip_unregistered: bool = False


class BulkEnrollResponse(BaseModel):
    enrolled: list[str]
    already_enrolled: list[str]
    not_found: list[str]
    errors: list[str]


# ── CSV/Excel Import ──

class ImportResponse(BaseModel):
    total_rows: int
    enrolled: int
    skipped: int
    errors: list[str]


# ── Invite Link ──

class InviteLinkRequest(BaseModel):
    expires_in_hours: int = 72


class InviteLinkResponse(BaseModel):
    invite_url: str
    expires_at: datetime


# ── Paginated Enrollment ──

class PaginatedEnrollmentResponse(BaseModel):
    students: list[EnrollmentResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


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
