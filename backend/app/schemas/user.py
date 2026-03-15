"""User schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "student"


class StudentProfileCreate(BaseModel):
    board: str
    class_grade: int
    school_name: Optional[str] = None
    section: Optional[str] = None
    roll_number: Optional[str] = None
    parent_email: Optional[EmailStr] = None


class TeacherProfileCreate(BaseModel):
    board: str
    subjects: list[str]
    classes: list[int]
    institution: Optional[str] = None
    employee_id: Optional[str] = None


class UserRegister(BaseModel):
    user: UserCreate
    student_profile: Optional[StudentProfileCreate] = None
    teacher_profile: Optional[TeacherProfileCreate] = None
    invite_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    full_name: str
    workspace_id: Optional[int] = None
    workspace_role: Optional[str] = None
    workspace_name: Optional[str] = None
    workspace_type: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StudentProfileResponse(BaseModel):
    id: int
    board: str
    class_grade: int
    school_name: Optional[str]
    section: Optional[str]
    academic_year: str

    class Config:
        from_attributes = True


class StudentDashboard(BaseModel):
    user: UserResponse
    profile: StudentProfileResponse
    total_exams_taken: int
    average_score: Optional[float]
    recent_scores: list[dict]
    strengths: list[str]
    weaknesses: list[str]
    active_learning_plans: int
