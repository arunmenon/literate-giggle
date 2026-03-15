"""Exam-related schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ── Question Bank ──


class QuestionBankCreate(BaseModel):
    name: str
    board: str
    class_grade: int
    subject: str
    chapter: Optional[str] = None
    description: Optional[str] = None


class QuestionBankResponse(BaseModel):
    id: int
    name: str
    board: str
    class_grade: int
    subject: str
    chapter: Optional[str]
    question_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# ── Question ──


class QuestionCreate(BaseModel):
    bank_id: int
    question_type: str
    question_text: str
    marks: float
    difficulty: str = "medium"
    blooms_level: str = "understand"
    topic: str
    subtopic: Optional[str] = None
    model_answer: Optional[str] = None
    answer_keywords: Optional[list[str]] = None
    mcq_options: Optional[dict] = None
    correct_option: Optional[str] = None
    marking_scheme: Optional[list[dict]] = None
    source: Optional[str] = None


class QuestionResponse(BaseModel):
    id: int
    bank_id: int
    question_type: str
    question_text: str
    marks: float
    difficulty: str
    blooms_level: str
    topic: str
    subtopic: Optional[str]
    model_answer: Optional[str] = None
    mcq_options: Optional[dict] = None
    source: Optional[str]
    times_used: int
    avg_score_pct: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionFilter(BaseModel):
    board: Optional[str] = None
    class_grade: Optional[int] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    question_type: Optional[str] = None
    difficulty: Optional[str] = None
    blooms_level: Optional[str] = None


# ── Question Paper ──


class PaperQuestionAdd(BaseModel):
    question_id: int
    section: Optional[str] = None
    order: int
    marks_override: Optional[float] = None
    is_compulsory: bool = True
    choice_group: Optional[str] = None


class QuestionPaperCreate(BaseModel):
    title: str
    board: str
    class_grade: int
    subject: str
    academic_year: Optional[str] = None
    exam_type: Optional[str] = None
    total_marks: float
    duration_minutes: int
    instructions: Optional[str] = None
    sections: Optional[list[dict]] = None
    questions: list[PaperQuestionAdd] = []


class QuestionPaperResponse(BaseModel):
    id: int
    title: str
    board: str
    class_grade: int
    subject: str
    exam_type: Optional[str]
    total_marks: float
    duration_minutes: int
    status: str
    sections: Optional[list[dict]]
    question_count: int = 0
    created_at: datetime
    published_at: Optional[datetime]
    starts_at: Optional[datetime]
    ends_at: Optional[datetime]

    class Config:
        from_attributes = True


class QuestionPaperDetail(QuestionPaperResponse):
    instructions: Optional[str]
    questions: list[dict] = []


class PaperStatusUpdate(BaseModel):
    status: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


# ── Exam Session ──


class StartExamRequest(BaseModel):
    paper_id: int
    is_practice: bool = False


class SubmitAnswerRequest(BaseModel):
    paper_question_id: int
    answer_text: Optional[str] = None
    selected_option: Optional[str] = None


class AutoSaveRequest(BaseModel):
    answers: list[SubmitAnswerRequest]
    time_spent_seconds: int


class ExamSessionResponse(BaseModel):
    id: int
    paper_id: int
    status: str
    started_at: Optional[datetime]
    submitted_at: Optional[datetime]
    time_spent_seconds: int
    is_practice: bool
    total_score: Optional[float]
    percentage: Optional[float]
    grade: Optional[str]

    class Config:
        from_attributes = True


class ExamSessionDetail(ExamSessionResponse):
    paper: QuestionPaperResponse
    answers: list[dict] = []
