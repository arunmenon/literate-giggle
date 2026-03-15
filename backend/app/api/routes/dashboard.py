"""Dashboard routes for students and teachers."""

from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from ...core.database import get_db
from ...models.user import User, StudentProfile, UserRole
from ...models.exam import ExamSession, QuestionPaper
from ...models.evaluation import Evaluation
from ...models.learning import LearningPlan, TopicMastery
from ...schemas.user import StudentDashboard
from ..deps import get_current_user, get_current_student, require_teacher_or_admin

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/student", response_model=StudentDashboard)
async def student_dashboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    student: StudentProfile = Depends(get_current_student),
):
    """Get student dashboard with stats."""
    # Total exams
    exam_count_result = await db.execute(
        select(func.count(ExamSession.id)).where(
            ExamSession.student_id == student.id
        )
    )
    total_exams = exam_count_result.scalar()

    # Average score
    avg_result = await db.execute(
        select(func.avg(ExamSession.percentage)).where(
            ExamSession.student_id == student.id,
            ExamSession.percentage.isnot(None),
        )
    )
    avg_score = avg_result.scalar()

    # Recent scores
    recent_result = await db.execute(
        select(ExamSession, QuestionPaper)
        .join(QuestionPaper, ExamSession.paper_id == QuestionPaper.id)
        .where(
            ExamSession.student_id == student.id,
            ExamSession.percentage.isnot(None),
        )
        .order_by(ExamSession.submitted_at.desc())
        .limit(10)
    )
    recent_rows = recent_result.all()
    recent_scores = [
        {
            "exam": paper.title,
            "subject": paper.subject,
            "score": session.percentage,
            "grade": session.grade,
            "date": session.submitted_at.isoformat() if session.submitted_at else None,
        }
        for session, paper in recent_rows
    ]

    # Strengths and weaknesses from topic mastery
    mastery_result = await db.execute(
        select(TopicMastery).where(TopicMastery.student_id == student.id)
    )
    masteries = mastery_result.scalars().all()
    strengths = [m.topic for m in masteries if m.avg_score_pct >= 70]
    weaknesses = [m.topic for m in masteries if m.avg_score_pct < 50]

    # Active learning plans
    plan_count_result = await db.execute(
        select(func.count(LearningPlan.id)).where(
            LearningPlan.student_id == student.id,
            LearningPlan.is_active == True,
        )
    )
    active_plans = plan_count_result.scalar()

    return StudentDashboard(
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_active": user.is_active,
            "created_at": user.created_at,
        },
        profile={
            "id": student.id,
            "board": student.board,
            "class_grade": student.class_grade,
            "school_name": student.school_name,
            "section": student.section,
            "academic_year": student.academic_year,
        },
        total_exams_taken=total_exams,
        average_score=round(avg_score, 1) if avg_score else None,
        recent_scores=recent_scores,
        strengths=strengths[:5],
        weaknesses=weaknesses[:5],
        active_learning_plans=active_plans,
    )


@router.get("/teacher/stats")
async def teacher_stats(
    board: Optional[str] = None,
    class_grade: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Get teacher dashboard statistics."""
    # Papers created
    paper_query = select(func.count(QuestionPaper.id)).where(
        QuestionPaper.created_by == user.id
    )
    paper_count = (await db.execute(paper_query)).scalar()

    # Total sessions on their papers
    session_query = (
        select(func.count(ExamSession.id))
        .join(QuestionPaper, ExamSession.paper_id == QuestionPaper.id)
        .where(QuestionPaper.created_by == user.id)
    )
    session_count = (await db.execute(session_query)).scalar()

    # Average scores on their papers
    avg_query = (
        select(func.avg(ExamSession.percentage))
        .join(QuestionPaper, ExamSession.paper_id == QuestionPaper.id)
        .where(
            QuestionPaper.created_by == user.id,
            ExamSession.percentage.isnot(None),
        )
    )
    avg_score = (await db.execute(avg_query)).scalar()

    return {
        "papers_created": paper_count,
        "total_exam_sessions": session_count,
        "average_student_score": round(avg_score, 1) if avg_score else None,
    }
