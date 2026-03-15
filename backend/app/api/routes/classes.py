"""Class management, enrollment, and exam assignment routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...models.user import User, StudentProfile, UserRole
from ...models.exam import QuestionPaper
from ...models.workspace import ClassGroup, Enrollment, ExamAssignment
from ...schemas.workspace import (
    ClassGroupCreate, ClassGroupResponse,
    EnrollStudentRequest, EnrollmentResponse,
    ExamAssignmentCreate, ExamAssignmentResponse,
)
from ..deps import get_current_user, require_teacher_or_admin, get_current_workspace

router = APIRouter(prefix="/classes", tags=["Class Management"])


@router.post("", response_model=ClassGroupResponse, status_code=201)
async def create_class(
    data: ClassGroupCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Create a class in the active workspace."""
    ws_id = get_current_workspace(user)
    if not ws_id:
        raise HTTPException(status_code=400, detail="No active workspace")

    class_group = ClassGroup(
        workspace_id=ws_id,
        name=data.name,
        grade=data.grade,
        section=data.section,
        subject=data.subject,
        academic_year=data.academic_year,
        teacher_id=user.id,
    )
    db.add(class_group)
    await db.flush()

    return ClassGroupResponse(
        id=class_group.id,
        workspace_id=class_group.workspace_id,
        name=class_group.name,
        grade=class_group.grade,
        section=class_group.section,
        subject=class_group.subject,
        academic_year=class_group.academic_year,
        teacher_id=class_group.teacher_id,
        student_count=0,
        created_at=class_group.created_at,
    )


@router.get("", response_model=list[ClassGroupResponse])
async def list_classes(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List classes in the active workspace."""
    ws_id = get_current_workspace(user)
    if not ws_id:
        return []

    query = select(ClassGroup).where(ClassGroup.workspace_id == ws_id)
    # Teachers see only their own classes unless they're admin/owner
    ws_role = getattr(user, "_workspace_role", None)
    if user.role == UserRole.TEACHER and ws_role not in ("owner", "admin"):
        query = query.where(ClassGroup.teacher_id == user.id)

    result = await db.execute(query.order_by(ClassGroup.created_at.desc()))
    classes = result.scalars().all()

    responses = []
    for cls in classes:
        count_result = await db.execute(
            select(func.count(Enrollment.id)).where(
                Enrollment.class_id == cls.id,
                Enrollment.is_active == True,
            )
        )
        count = count_result.scalar()
        responses.append(
            ClassGroupResponse(
                id=cls.id,
                workspace_id=cls.workspace_id,
                name=cls.name,
                grade=cls.grade,
                section=cls.section,
                subject=cls.subject,
                academic_year=cls.academic_year,
                teacher_id=cls.teacher_id,
                student_count=count,
                created_at=cls.created_at,
            )
        )
    return responses


@router.get("/{class_id}/students", response_model=list[EnrollmentResponse])
async def list_class_students(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """List enrolled students for a class."""
    result = await db.execute(
        select(Enrollment, StudentProfile, User)
        .join(StudentProfile, Enrollment.student_id == StudentProfile.id)
        .join(User, StudentProfile.user_id == User.id)
        .where(Enrollment.class_id == class_id)
    )
    rows = result.all()
    return [
        EnrollmentResponse(
            id=enrollment.id,
            class_id=enrollment.class_id,
            student_id=enrollment.student_id,
            student_name=u.full_name,
            student_email=u.email,
            enrolled_at=enrollment.enrolled_at,
            is_active=enrollment.is_active,
        )
        for enrollment, profile, u in rows
    ]


@router.post("/{class_id}/enroll", response_model=EnrollmentResponse, status_code=201)
async def enroll_student(
    class_id: int,
    data: EnrollStudentRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Enroll a student in a class by user_id or email."""
    class_group = await db.get(ClassGroup, class_id)
    if not class_group:
        raise HTTPException(status_code=404, detail="Class not found")

    # Find student by user_id or email
    if data.student_user_id:
        student_user_result = await db.execute(
            select(User).where(User.id == data.student_user_id)
        )
        student_user = student_user_result.scalar_one_or_none()
    elif data.email:
        student_user_result = await db.execute(
            select(User).where(User.email == data.email)
        )
        student_user = student_user_result.scalar_one_or_none()
    else:
        raise HTTPException(status_code=400, detail="Provide student_user_id or email")

    if not student_user:
        raise HTTPException(status_code=404, detail="Student user not found")

    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == student_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=400, detail="User is not a student")

    # Check if already enrolled
    existing = await db.execute(
        select(Enrollment).where(
            Enrollment.class_id == class_id,
            Enrollment.student_id == profile.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Student already enrolled")

    enrollment = Enrollment(
        class_id=class_id,
        student_id=profile.id,
    )
    db.add(enrollment)
    await db.flush()

    return EnrollmentResponse(
        id=enrollment.id,
        class_id=enrollment.class_id,
        student_id=enrollment.student_id,
        student_name=student_user.full_name,
        student_email=student_user.email,
        enrolled_at=enrollment.enrolled_at,
        is_active=enrollment.is_active,
    )


@router.delete("/{class_id}/enroll/{student_id}", status_code=204)
async def remove_student(
    class_id: int,
    student_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Remove a student from a class (soft delete)."""
    result = await db.execute(
        select(Enrollment).where(
            Enrollment.class_id == class_id,
            Enrollment.student_id == student_id,
        )
    )
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    enrollment.is_active = False
    await db.flush()


@router.post("/{class_id}/assign-exam", response_model=ExamAssignmentResponse, status_code=201)
async def assign_exam(
    class_id: int,
    data: ExamAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Assign a paper to a class with optional schedule."""
    class_group = await db.get(ClassGroup, class_id)
    if not class_group:
        raise HTTPException(status_code=404, detail="Class not found")

    paper = await db.get(QuestionPaper, data.paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    assignment = ExamAssignment(
        paper_id=data.paper_id,
        class_id=class_id,
        assigned_by=user.id,
        status=data.status,
        label=data.label,
        start_at=data.start_at,
        end_at=data.end_at,
        is_practice=data.is_practice,
    )
    db.add(assignment)
    await db.flush()

    return ExamAssignmentResponse(
        id=assignment.id,
        paper_id=assignment.paper_id,
        paper_title=paper.title,
        class_id=assignment.class_id,
        class_name=class_group.name,
        assigned_by=assignment.assigned_by,
        status=assignment.status,
        label=assignment.label,
        start_at=assignment.start_at,
        end_at=assignment.end_at,
        is_practice=assignment.is_practice,
        created_at=assignment.created_at,
    )


@router.get("/{class_id}/assignments", response_model=list[ExamAssignmentResponse])
async def list_assignments(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List exam assignments for a class."""
    result = await db.execute(
        select(ExamAssignment, QuestionPaper, ClassGroup)
        .join(QuestionPaper, ExamAssignment.paper_id == QuestionPaper.id)
        .join(ClassGroup, ExamAssignment.class_id == ClassGroup.id)
        .where(ExamAssignment.class_id == class_id)
        .order_by(ExamAssignment.created_at.desc())
    )
    rows = result.all()
    return [
        ExamAssignmentResponse(
            id=assignment.id,
            paper_id=assignment.paper_id,
            paper_title=paper.title,
            class_id=assignment.class_id,
            class_name=cls.name,
            assigned_by=assignment.assigned_by,
            status=assignment.status,
            label=assignment.label,
            start_at=assignment.start_at,
            end_at=assignment.end_at,
            is_practice=assignment.is_practice,
            created_at=assignment.created_at,
        )
        for assignment, paper, cls in rows
    ]
