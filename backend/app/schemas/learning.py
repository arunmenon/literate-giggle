"""Learning plan schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class GeneratePlanRequest(BaseModel):
    student_id: int
    subject: str
    board: str
    class_grade: int
    target_score: Optional[float] = 90.0
    target_date: Optional[datetime] = None


class LearningObjectiveResponse(BaseModel):
    id: int
    topic: str
    subtopic: Optional[str]
    description: str
    priority: int
    status: str
    resources: Optional[list[dict]]
    target_mastery: str
    current_mastery: str
    attempts: int
    best_score_pct: Optional[float]
    order: int

    class Config:
        from_attributes = True


class LearningPlanResponse(BaseModel):
    id: int
    subject: str
    board: str
    class_grade: int
    title: str
    description: Optional[str]
    focus_areas: Optional[list[str]]
    target_score: Optional[float]
    current_score: Optional[float]
    estimated_hours: Optional[float]
    progress_pct: float
    is_active: bool
    objectives: list[LearningObjectiveResponse] = []
    start_date: Optional[datetime]
    target_date: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class TopicMasteryResponse(BaseModel):
    id: int
    subject: str
    topic: str
    subtopic: Optional[str]
    mastery_level: str
    avg_score_pct: float
    last_score_pct: Optional[float]
    total_attempts: int
    trend: Optional[str]

    class Config:
        from_attributes = True


class UpdateObjectiveStatus(BaseModel):
    status: str
    score_pct: Optional[float] = None


class StudentProgressSummary(BaseModel):
    subject: str
    overall_mastery: str
    topics: list[TopicMasteryResponse]
    active_plans: list[LearningPlanResponse]
    score_trend: list[dict]  # [{"date": "...", "score": 75}]
