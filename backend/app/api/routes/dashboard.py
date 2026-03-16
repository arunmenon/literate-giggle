"""Dashboard routes for students and teachers with action-oriented responses."""

from datetime import datetime, timezone, timedelta
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from ...core.database import get_db
from ...models.user import User, StudentProfile, UserRole
from ...models.exam import ExamSession, QuestionPaper, ExamSessionStatus
from ...models.evaluation import Evaluation
from ...models.learning import LearningPlan, TopicMastery
from ...models.workspace import ExamAssignment, Enrollment, ClassGroup
from ...schemas.user import StudentDashboard
from ..deps import get_current_user, get_current_student, require_teacher_or_admin, get_current_workspace

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/student")
async def student_dashboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    student: StudentProfile = Depends(get_current_student),
):
    """Get student dashboard with stats and action-oriented data."""
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

    # Upcoming exams from ExamAssignment
    now = datetime.now(timezone.utc)
    upcoming_result = await db.execute(
        select(ExamAssignment, QuestionPaper, ClassGroup)
        .join(QuestionPaper, ExamAssignment.paper_id == QuestionPaper.id)
        .join(ClassGroup, ExamAssignment.class_id == ClassGroup.id)
        .join(Enrollment, ExamAssignment.class_id == Enrollment.class_id)
        .where(
            Enrollment.student_id == student.id,
            Enrollment.is_active == True,
            ExamAssignment.status == "active",
            or_(
                ExamAssignment.end_at.is_(None),
                ExamAssignment.end_at >= now,
            ),
        )
        .order_by(ExamAssignment.start_at.asc())
        .limit(5)
    )
    upcoming_rows = upcoming_result.all()
    upcoming_exams = [
        {
            "assignment_id": assignment.id,
            "paper_id": assignment.paper_id,
            "paper_title": paper.title,
            "class_name": cls.name,
            "subject": paper.subject,
            "total_marks": paper.total_marks,
            "duration_minutes": paper.duration_minutes,
            "start_at": assignment.start_at.isoformat() if assignment.start_at else None,
            "end_at": assignment.end_at.isoformat() if assignment.end_at else None,
            "is_practice": assignment.is_practice,
            "label": assignment.label,
        }
        for assignment, paper, cls in upcoming_rows
    ]

    # Weekly progress
    week_ago = now - timedelta(days=7)
    current_week_result = await db.execute(
        select(func.avg(ExamSession.percentage)).where(
            ExamSession.student_id == student.id,
            ExamSession.percentage.isnot(None),
            ExamSession.submitted_at >= week_ago,
        )
    )
    current_avg = current_week_result.scalar()

    two_weeks_ago = now - timedelta(days=14)
    prev_week_result = await db.execute(
        select(func.avg(ExamSession.percentage)).where(
            ExamSession.student_id == student.id,
            ExamSession.percentage.isnot(None),
            ExamSession.submitted_at >= two_weeks_ago,
            ExamSession.submitted_at < week_ago,
        )
    )
    prev_avg = prev_week_result.scalar()

    weekly_progress = None
    if current_avg is not None and prev_avg is not None and prev_avg > 0:
        weekly_progress = round(current_avg - prev_avg, 1)

    # Recommended action
    recommended_action = None
    if weaknesses:
        recommended_action = f"Study {weaknesses[0]} (your weakest topic)"
    elif upcoming_exams:
        recommended_action = f"Prepare for {upcoming_exams[0]['paper_title']}"
    elif not total_exams:
        recommended_action = "Join a classroom to get started with exams"

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "profile": {
            "id": student.id,
            "board": student.board,
            "class_grade": student.class_grade,
            "school_name": student.school_name,
            "section": student.section,
            "academic_year": student.academic_year,
        },
        "total_exams_taken": total_exams,
        "average_score": round(avg_score, 1) if avg_score else None,
        "recent_scores": recent_scores,
        "strengths": strengths[:5],
        "weaknesses": weaknesses[:5],
        "active_learning_plans": active_plans,
        "upcoming_exams": upcoming_exams,
        "recommended_action": recommended_action,
        "weekly_progress": weekly_progress,
    }


@router.get("/teacher/stats")
async def teacher_stats(
    board: Optional[str] = None,
    class_grade: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Get teacher dashboard statistics with action-oriented data."""
    ws_id = get_current_workspace(user)

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

    # Pending reviews (submitted but not evaluated exam sessions)
    pending_query = (
        select(func.count(ExamSession.id))
        .join(QuestionPaper, ExamSession.paper_id == QuestionPaper.id)
        .where(
            QuestionPaper.created_by == user.id,
            ExamSession.status == ExamSessionStatus.SUBMITTED,
        )
    )
    pending_reviews = (await db.execute(pending_query)).scalar()

    # Classes with student count -- single grouped query to avoid N+1
    classes_data = []
    if ws_id:
        enrollment_counts = (
            select(
                Enrollment.class_id,
                func.count(Enrollment.id).label("student_count"),
            )
            .where(Enrollment.is_active == True)
            .group_by(Enrollment.class_id)
            .subquery()
        )
        classes_result = await db.execute(
            select(
                ClassGroup,
                func.coalesce(enrollment_counts.c.student_count, 0).label("student_count"),
            )
            .outerjoin(enrollment_counts, ClassGroup.id == enrollment_counts.c.class_id)
            .where(
                ClassGroup.workspace_id == ws_id,
                ClassGroup.teacher_id == user.id,
            )
        )

        for cls, student_count in classes_result.all():
            classes_data.append({
                "id": cls.id,
                "name": cls.name,
                "grade": cls.grade,
                "section": cls.section,
                "subject": cls.subject,
                "student_count": student_count,
            })

    # Upcoming assignments
    now = datetime.now(timezone.utc)
    upcoming_assignments = []
    if ws_id:
        upcoming_result = await db.execute(
            select(ExamAssignment, QuestionPaper, ClassGroup)
            .join(QuestionPaper, ExamAssignment.paper_id == QuestionPaper.id)
            .join(ClassGroup, ExamAssignment.class_id == ClassGroup.id)
            .where(
                ExamAssignment.assigned_by == user.id,
                ExamAssignment.status == "active",
                or_(
                    ExamAssignment.end_at.is_(None),
                    ExamAssignment.end_at >= now,
                ),
            )
            .order_by(ExamAssignment.start_at.asc())
            .limit(5)
        )
        for assignment, paper, cls in upcoming_result.all():
            upcoming_assignments.append({
                "assignment_id": assignment.id,
                "paper_title": paper.title,
                "class_name": cls.name,
                "status": assignment.status,
                "start_at": assignment.start_at.isoformat() if assignment.start_at else None,
                "end_at": assignment.end_at.isoformat() if assignment.end_at else None,
            })

    # Class alerts (placeholder -- topics where average dropped)
    class_alerts = []

    return {
        "papers_created": paper_count,
        "total_exam_sessions": session_count,
        "average_student_score": round(avg_score, 1) if avg_score else None,
        "pending_reviews": pending_reviews,
        "classes": classes_data,
        "upcoming_assignments": upcoming_assignments,
        "class_alerts": class_alerts,
    }
