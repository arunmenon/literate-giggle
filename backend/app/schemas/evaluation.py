"""Evaluation schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class RubricTemplateCreate(BaseModel):
    name: str
    board: str
    subject: str
    question_type: str
    criteria: list[dict]


class RubricTemplateResponse(BaseModel):
    id: int
    name: str
    board: str
    subject: str
    question_type: str
    criteria: list[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class EvaluateSessionRequest(BaseModel):
    session_id: int
    method: str = "ai"  # "ai" (default), "rubric", "hybrid"


class QuestionEvaluationResponse(BaseModel):
    id: int
    question_text: str
    question_type: str
    marks_obtained: float
    marks_possible: float
    student_answer: Optional[str]
    model_answer: Optional[str]
    feedback: Optional[str]
    keywords_found: Optional[list[str]]
    keywords_missing: Optional[list[str]]
    improvement_hint: Optional[str]
    confidence: Optional[float] = None
    evaluation_method: Optional[str] = None


class EvaluationResponse(BaseModel):
    id: int
    session_id: int
    total_marks_obtained: float
    total_marks_possible: float
    percentage: float
    grade: Optional[str]
    topic_scores: Optional[dict]
    blooms_scores: Optional[dict]
    difficulty_scores: Optional[dict]
    strengths: Optional[list[str]]
    weaknesses: Optional[list[str]]
    recommendations: Optional[str]
    evaluated_by: Optional[str]
    evaluated_at: datetime
    is_final: bool
    question_evaluations: list[QuestionEvaluationResponse] = []

    class Config:
        from_attributes = True


class EvaluationSummary(BaseModel):
    total_students: int
    average_score: float
    highest_score: float
    lowest_score: float
    pass_rate: float
    topic_analysis: dict
    difficulty_analysis: dict
    grade_distribution: dict
