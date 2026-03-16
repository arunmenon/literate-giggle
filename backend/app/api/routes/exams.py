"""Exam session routes (Simulation) with workspace scoping."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...core.database import get_db
from ...models.user import User, UserRole, StudentProfile
from ...models.exam import (
    QuestionPaper, PaperQuestion, ExamSession, StudentAnswer,
    PaperStatus, ExamSessionStatus,
)
from ...models.workspace import ExamAssignment, Enrollment, ClassGroup
from ...schemas.exam import (
    StartExamRequest, SubmitAnswerRequest, AutoSaveRequest,
    ExamSessionResponse, ExamSessionDetail,
)
from ..deps import get_current_user, get_current_student, get_current_workspace

router = APIRouter(prefix="/exams", tags=["Exam Sessions (Simulation)"])


@router.post("/start", response_model=ExamSessionResponse, status_code=201)
async def start_exam(
    data: StartExamRequest,
    db: AsyncSession = Depends(get_db),
    student: StudentProfile = Depends(get_current_student),
):
    """Start a new exam session for the student. Validates paper is assigned to student's class."""
    paper = await db.get(QuestionPaper, data.paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Allow practice exams on published papers; formal exams need active status
    if not data.is_practice and paper.status != PaperStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Paper is not active for exams")
    if data.is_practice and paper.status not in (
        PaperStatus.PUBLISHED, PaperStatus.ACTIVE
    ):
        raise HTTPException(status_code=400, detail="Paper is not available for practice")

    # Validate paper is assigned to a class the student is enrolled in
    now = datetime.now(timezone.utc)
    assignment_query = (
        select(ExamAssignment)
        .join(Enrollment, ExamAssignment.class_id == Enrollment.class_id)
        .where(
            ExamAssignment.paper_id == data.paper_id,
            Enrollment.student_id == student.id,
            Enrollment.is_active == True,
            ExamAssignment.status == "active",
        )
    )
    assignment_result = await db.execute(assignment_query)
    assignment = assignment_result.scalars().first()
    if not assignment:
        raise HTTPException(status_code=403, detail="This exam is not assigned to your class")

    # Check schedule constraints
    if assignment.start_at and now < assignment.start_at:
        raise HTTPException(status_code=400, detail="This exam has not started yet")
    if assignment.end_at and now > assignment.end_at:
        raise HTTPException(status_code=400, detail="This exam window has closed")

    # Check for existing active session
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.paper_id == data.paper_id,
            ExamSession.student_id == student.id,
            ExamSession.status == ExamSessionStatus.IN_PROGRESS,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    session = ExamSession(
        paper_id=data.paper_id,
        student_id=student.id,
        status=ExamSessionStatus.IN_PROGRESS,
        started_at=datetime.now(timezone.utc),
        is_practice=data.is_practice,
    )
    db.add(session)
    await db.flush()
    return session


@router.post("/{session_id}/save", status_code=200)
async def auto_save_answers(
    session_id: int,
    data: AutoSaveRequest,
    db: AsyncSession = Depends(get_db),
    student: StudentProfile = Depends(get_current_student),
):
    """Auto-save answers during exam."""
    session = await db.get(ExamSession, session_id)
    if not session or session.student_id != student.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != ExamSessionStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Session is not in progress")

    session.time_spent_seconds = data.time_spent_seconds

    for ans_data in data.answers:
        # Upsert answer
        result = await db.execute(
            select(StudentAnswer).where(
                StudentAnswer.session_id == session_id,
                StudentAnswer.paper_question_id == ans_data.paper_question_id,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.answer_text = ans_data.answer_text
            existing.selected_option = ans_data.selected_option
            existing.auto_saved_at = datetime.now(timezone.utc)
        else:
            answer = StudentAnswer(
                session_id=session_id,
                paper_question_id=ans_data.paper_question_id,
                answer_text=ans_data.answer_text,
                selected_option=ans_data.selected_option,
                auto_saved_at=datetime.now(timezone.utc),
            )
            db.add(answer)

    await db.flush()
    return {"message": "Answers saved", "time_spent": data.time_spent_seconds}


@router.post("/{session_id}/submit", response_model=ExamSessionResponse)
async def submit_exam(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    student: StudentProfile = Depends(get_current_student),
):
    """Submit exam for evaluation."""
    session = await db.get(ExamSession, session_id)
    if not session or session.student_id != student.id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != ExamSessionStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Session is not in progress")

    session.status = ExamSessionStatus.SUBMITTED
    session.submitted_at = datetime.now(timezone.utc)
    await db.flush()
    return session


@router.post("/{session_id}/flag/{paper_question_id}")
async def flag_question(
    session_id: int,
    paper_question_id: int,
    db: AsyncSession = Depends(get_db),
    student: StudentProfile = Depends(get_current_student),
):
    """Flag/unflag a question for review (ownership-checked)."""
    # IDOR check: verify session belongs to current student
    session = await db.get(ExamSession, session_id)
    if not session or session.student_id != student.id:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(StudentAnswer).where(
            StudentAnswer.session_id == session_id,
            StudentAnswer.paper_question_id == paper_question_id,
        )
    )
    answer = result.scalar_one_or_none()
    if not answer:
        answer = StudentAnswer(
            session_id=session_id,
            paper_question_id=paper_question_id,
            is_flagged=True,
        )
        db.add(answer)
    else:
        answer.is_flagged = not answer.is_flagged
    await db.flush()
    return {"flagged": answer.is_flagged}


@router.get("/{session_id}", response_model=ExamSessionDetail)
async def get_exam_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get exam session details with answers (ownership-checked)."""
    result = await db.execute(
        select(ExamSession)
        .options(
            selectinload(ExamSession.answers),
            selectinload(ExamSession.paper),
        )
        .where(ExamSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # IDOR check: verify ownership
    student_result = await db.execute(
        select(StudentProfile).where(
            StudentProfile.user_id == user.id,
            StudentProfile.id == session.student_id,
        )
    )
    is_owner = student_result.scalar_one_or_none() is not None

    is_teacher_in_workspace = False
    if not is_owner and user.role in (UserRole.TEACHER, UserRole.ADMIN):
        paper = session.paper
        if paper and paper.workspace_id:
            ws_id = get_current_workspace(user)
            if ws_id and ws_id == paper.workspace_id:
                is_teacher_in_workspace = True

    if not is_owner and not is_teacher_in_workspace:
        raise HTTPException(status_code=403, detail="Access denied")

    answers_data = [
        {
            "id": a.id,
            "paper_question_id": a.paper_question_id,
            "answer_text": a.answer_text,
            "selected_option": a.selected_option,
            "is_flagged": a.is_flagged,
            "time_spent_seconds": a.time_spent_seconds,
        }
        for a in session.answers
    ]

    paper = session.paper
    paper_resp = {
        "id": paper.id,
        "title": paper.title,
        "board": paper.board,
        "class_grade": paper.class_grade,
        "subject": paper.subject,
        "exam_type": paper.exam_type,
        "total_marks": paper.total_marks,
        "duration_minutes": paper.duration_minutes,
        "status": paper.status.value,
        "sections": paper.sections,
        "question_count": 0,
        "created_at": paper.created_at,
        "published_at": paper.published_at,
        "starts_at": paper.starts_at,
        "ends_at": paper.ends_at,
    }

    return ExamSessionDetail(
        id=session.id,
        paper_id=session.paper_id,
        status=session.status.value,
        started_at=session.started_at,
        submitted_at=session.submitted_at,
        time_spent_seconds=session.time_spent_seconds,
        is_practice=session.is_practice,
        total_score=session.total_score,
        percentage=session.percentage,
        grade=session.grade,
        paper=paper_resp,
        answers=answers_data,
    )


@router.get("", response_model=list[ExamSessionResponse])
async def list_my_exams(
    db: AsyncSession = Depends(get_db),
    student: StudentProfile = Depends(get_current_student),
):
    """List all exam sessions for the current student."""
    result = await db.execute(
        select(ExamSession)
        .where(ExamSession.student_id == student.id)
        .order_by(ExamSession.created_at.desc())
    )
    return result.scalars().all()
