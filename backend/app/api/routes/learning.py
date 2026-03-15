"""Learning plan routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...core.database import get_db
from ...models.user import User, UserRole, StudentProfile
from ...models.learning import (
    LearningPlan, LearningObjective, TopicMastery,
    ObjectiveStatus, MasteryLevel,
)
from ...schemas.learning import (
    GeneratePlanRequest, LearningPlanResponse, LearningObjectiveResponse,
    TopicMasteryResponse, UpdateObjectiveStatus, StudentProgressSummary,
)
from ...services.learning_plan_generator import (
    generate_learning_plan, get_mastery_from_score,
    get_topics_due_for_review, generate_practice_set,
)
from ..deps import get_current_user, get_current_student

router = APIRouter(prefix="/learning", tags=["Learning Plans"])


@router.post("/plans/generate", response_model=LearningPlanResponse, status_code=201)
async def create_learning_plan(
    data: GeneratePlanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate a personalized learning plan based on evaluation history."""
    # IDOR check: validate student_id matches current user (or user is teacher)
    if user.role == UserRole.STUDENT:
        student_result = await db.execute(
            select(StudentProfile).where(
                StudentProfile.user_id == user.id,
                StudentProfile.id == data.student_id,
            )
        )
        if not student_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Access denied")

    plan = await generate_learning_plan(
        db=db,
        student_id=data.student_id,
        subject=data.subject,
        board=data.board,
        class_grade=data.class_grade,
        target_score=data.target_score,
        target_date=data.target_date,
    )

    # Reload with objectives
    result = await db.execute(
        select(LearningPlan)
        .options(selectinload(LearningPlan.objectives))
        .where(LearningPlan.id == plan.id)
    )
    plan = result.scalar_one()

    return _plan_to_response(plan)


@router.get("/plans", response_model=list[LearningPlanResponse])
async def list_learning_plans(
    db: AsyncSession = Depends(get_db),
    student: StudentProfile = Depends(get_current_student),
):
    """List all learning plans for the current student."""
    result = await db.execute(
        select(LearningPlan)
        .options(selectinload(LearningPlan.objectives))
        .where(LearningPlan.student_id == student.id)
        .order_by(LearningPlan.created_at.desc())
    )
    plans = result.scalars().all()
    return [_plan_to_response(p) for p in plans]


@router.get("/plans/{plan_id}", response_model=LearningPlanResponse)
async def get_learning_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a learning plan with objectives (ownership-checked)."""
    result = await db.execute(
        select(LearningPlan)
        .options(selectinload(LearningPlan.objectives))
        .where(LearningPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # IDOR check: plan must belong to current student (or user is teacher)
    if user.role == UserRole.STUDENT:
        student_result = await db.execute(
            select(StudentProfile).where(
                StudentProfile.user_id == user.id,
                StudentProfile.id == plan.student_id,
            )
        )
        if not student_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied")

    return _plan_to_response(plan)


@router.patch("/objectives/{objective_id}", response_model=LearningObjectiveResponse)
async def update_objective(
    objective_id: int,
    data: UpdateObjectiveStatus,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a learning objective's status and progress (ownership-checked)."""
    objective = await db.get(LearningObjective, objective_id)
    if not objective:
        raise HTTPException(status_code=404, detail="Objective not found")

    # IDOR check: objective's plan must belong to current student
    if user.role == UserRole.STUDENT:
        plan = await db.get(LearningPlan, objective.plan_id)
        if plan:
            student_result = await db.execute(
                select(StudentProfile).where(
                    StudentProfile.user_id == user.id,
                    StudentProfile.id == plan.student_id,
                )
            )
            if not student_result.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="Access denied")

    objective.status = ObjectiveStatus(data.status)
    objective.attempts += 1

    if data.score_pct is not None:
        if objective.best_score_pct is None or data.score_pct > objective.best_score_pct:
            objective.best_score_pct = data.score_pct
        objective.current_mastery = get_mastery_from_score(data.score_pct)

    await db.flush()

    # Update plan progress
    plan = await db.get(LearningPlan, objective.plan_id)
    if plan:
        result = await db.execute(
            select(LearningObjective).where(LearningObjective.plan_id == plan.id)
        )
        objectives = result.scalars().all()
        completed = sum(1 for o in objectives if o.status == ObjectiveStatus.COMPLETED)
        plan.progress_pct = round(completed / len(objectives) * 100, 1) if objectives else 0
        await db.flush()

    return _objective_to_response(objective)


@router.get("/mastery", response_model=list[TopicMasteryResponse])
async def get_topic_mastery(
    subject: str = None,
    db: AsyncSession = Depends(get_db),
    student: StudentProfile = Depends(get_current_student),
):
    """Get topic mastery levels for the current student."""
    query = select(TopicMastery).where(TopicMastery.student_id == student.id)
    if subject:
        query = query.where(TopicMastery.subject == subject)

    result = await db.execute(query.order_by(TopicMastery.subject, TopicMastery.topic))
    masteries = result.scalars().all()
    return [_mastery_to_response(m) for m in masteries]


@router.get("/progress/{subject}", response_model=StudentProgressSummary)
async def get_progress_summary(
    subject: str,
    db: AsyncSession = Depends(get_db),
    student: StudentProfile = Depends(get_current_student),
):
    """Get comprehensive progress summary for a subject."""
    # Topic mastery
    mastery_result = await db.execute(
        select(TopicMastery).where(
            TopicMastery.student_id == student.id,
            TopicMastery.subject == subject,
        )
    )
    masteries = mastery_result.scalars().all()

    # Active plans
    plan_result = await db.execute(
        select(LearningPlan)
        .options(selectinload(LearningPlan.objectives))
        .where(
            LearningPlan.student_id == student.id,
            LearningPlan.subject == subject,
            LearningPlan.is_active == True,
        )
    )
    plans = plan_result.scalars().all()

    # Overall mastery
    if masteries:
        avg_score = sum(m.avg_score_pct for m in masteries) / len(masteries)
        overall = get_mastery_from_score(avg_score).value
    else:
        overall = "not_started"

    # Score trend from mastery history
    score_trend = []
    for m in masteries:
        if m.score_history:
            for entry in m.score_history:
                score_trend.append({
                    "date": entry["date"],
                    "score": entry["score"],
                    "topic": m.topic,
                })
    score_trend.sort(key=lambda x: x["date"])

    return StudentProgressSummary(
        subject=subject,
        overall_mastery=overall,
        topics=[_mastery_to_response(m) for m in masteries],
        active_plans=[_plan_to_response(p) for p in plans],
        score_trend=score_trend[-20:],  # Last 20 data points
    )


@router.get("/next-review", response_model=list[dict])
async def get_next_review_topics(
    subject: str = None,
    db: AsyncSession = Depends(get_db),
    student: StudentProfile = Depends(get_current_student),
):
    """Get topics due for review today based on spaced repetition scheduling."""
    return await get_topics_due_for_review(db, student.id, subject)


@router.post("/practice-set", response_model=list[dict])
async def generate_practice_set_endpoint(
    subject: str = None,
    topic: str = None,
    count: int = 10,
    db: AsyncSession = Depends(get_db),
    student: StudentProfile = Depends(get_current_student),
):
    """Generate a targeted practice quiz from weak topics."""
    return await generate_practice_set(db, student.id, subject, topic, count)


def _plan_to_response(plan: LearningPlan) -> LearningPlanResponse:
    return LearningPlanResponse(
        id=plan.id,
        subject=plan.subject,
        board=plan.board,
        class_grade=plan.class_grade,
        title=plan.title,
        description=plan.description,
        focus_areas=plan.focus_areas,
        target_score=plan.target_score,
        current_score=plan.current_score,
        estimated_hours=plan.estimated_hours,
        progress_pct=plan.progress_pct,
        is_active=plan.is_active,
        objectives=[_objective_to_response(o) for o in (plan.objectives or [])],
        start_date=plan.start_date,
        target_date=plan.target_date,
        created_at=plan.created_at,
    )


def _objective_to_response(obj: LearningObjective) -> LearningObjectiveResponse:
    return LearningObjectiveResponse(
        id=obj.id,
        topic=obj.topic,
        subtopic=obj.subtopic,
        description=obj.description,
        priority=obj.priority,
        status=obj.status.value,
        resources=obj.resources,
        target_mastery=obj.target_mastery.value,
        current_mastery=obj.current_mastery.value,
        attempts=obj.attempts,
        best_score_pct=obj.best_score_pct,
        order=obj.order,
    )


def _mastery_to_response(m: TopicMastery) -> TopicMasteryResponse:
    return TopicMasteryResponse(
        id=m.id,
        subject=m.subject,
        topic=m.topic,
        subtopic=m.subtopic,
        mastery_level=m.mastery_level.value,
        avg_score_pct=m.avg_score_pct,
        last_score_pct=m.last_score_pct,
        total_attempts=m.total_attempts,
        trend=m.trend,
    )
