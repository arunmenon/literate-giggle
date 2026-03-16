"""Question Paper management routes (Curation + Lifecycle)."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional

from ...core.database import get_db
from ...models.user import User
from ...models.exam import QuestionPaper, PaperQuestion, Question, PaperStatus
from ...schemas.exam import (
    QuestionPaperCreate, QuestionPaperResponse, QuestionPaperDetail,
    PaperQuestionAdd, PaperStatusUpdate,
    PaperAssemblyRequest, PaperAssemblyResult,
)
from ..deps import get_current_user, require_teacher_or_admin, get_current_workspace

router = APIRouter(prefix="/papers", tags=["Question Papers (Curation)"])


@router.post("", response_model=QuestionPaperResponse, status_code=201)
async def create_paper(
    data: QuestionPaperCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Create a new question paper with questions. Auto-sets workspace_id from JWT."""
    paper = QuestionPaper(
        title=data.title,
        board=data.board,
        class_grade=data.class_grade,
        subject=data.subject,
        academic_year=data.academic_year,
        exam_type=data.exam_type,
        total_marks=data.total_marks,
        duration_minutes=data.duration_minutes,
        instructions=data.instructions,
        sections=data.sections,
        created_by=user.id,
        status=PaperStatus.DRAFT,
        workspace_id=get_current_workspace(user),
    )
    db.add(paper)
    await db.flush()

    # Add questions to paper
    for q_data in data.questions:
        question = await db.get(Question, q_data.question_id)
        if not question:
            raise HTTPException(
                status_code=404,
                detail=f"Question {q_data.question_id} not found",
            )
        pq = PaperQuestion(
            paper_id=paper.id,
            question_id=q_data.question_id,
            section=q_data.section,
            order=q_data.order,
            marks_override=q_data.marks_override,
            is_compulsory=q_data.is_compulsory,
            choice_group=q_data.choice_group,
        )
        db.add(pq)

    await db.flush()

    return QuestionPaperResponse(
        id=paper.id,
        title=paper.title,
        board=paper.board,
        class_grade=paper.class_grade,
        subject=paper.subject,
        exam_type=paper.exam_type,
        total_marks=paper.total_marks,
        duration_minutes=paper.duration_minutes,
        status=paper.status.value,
        sections=paper.sections,
        question_count=len(data.questions),
        created_at=paper.created_at,
        published_at=paper.published_at,
        starts_at=paper.starts_at,
        ends_at=paper.ends_at,
    )


@router.get("", response_model=list[QuestionPaperResponse])
async def list_papers(
    board: Optional[str] = None,
    class_grade: Optional[int] = None,
    subject: Optional[str] = None,
    status: Optional[str] = None,
    exam_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List question papers with filters, scoped to workspace."""
    ws_id = get_current_workspace(user)
    query = select(QuestionPaper)

    # Workspace scoping
    if ws_id:
        query = query.where(
            or_(
                QuestionPaper.workspace_id == ws_id,
                and_(
                    QuestionPaper.workspace_id.is_(None),
                    QuestionPaper.created_by == user.id,
                ),
            )
        )
    else:
        query = query.where(QuestionPaper.created_by == user.id)

    if board:
        query = query.where(QuestionPaper.board == board)
    if class_grade:
        query = query.where(QuestionPaper.class_grade == class_grade)
    if subject:
        query = query.where(QuestionPaper.subject == subject)
    if status:
        query = query.where(QuestionPaper.status == status)
    if exam_type:
        query = query.where(QuestionPaper.exam_type == exam_type)

    # Single aggregated query: join papers with question counts to avoid N+1
    count_subq = (
        select(
            PaperQuestion.paper_id,
            func.count(PaperQuestion.id).label("question_count"),
        )
        .group_by(PaperQuestion.paper_id)
        .subquery()
    )
    combined = (
        query.outerjoin(count_subq, QuestionPaper.id == count_subq.c.paper_id)
        .add_columns(func.coalesce(count_subq.c.question_count, 0).label("question_count"))
        .order_by(QuestionPaper.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(combined)
    rows = result.all()

    return [
        QuestionPaperResponse(
            id=paper.id,
            title=paper.title,
            board=paper.board,
            class_grade=paper.class_grade,
            subject=paper.subject,
            exam_type=paper.exam_type,
            total_marks=paper.total_marks,
            duration_minutes=paper.duration_minutes,
            status=paper.status.value,
            sections=paper.sections,
            question_count=count,
            created_at=paper.created_at,
            published_at=paper.published_at,
            starts_at=paper.starts_at,
            ends_at=paper.ends_at,
        )
        for paper, count in rows
    ]


@router.get("/{paper_id}", response_model=QuestionPaperDetail)
async def get_paper(
    paper_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get paper with all questions."""
    result = await db.execute(
        select(QuestionPaper)
        .options(selectinload(QuestionPaper.paper_questions).selectinload(PaperQuestion.question))
        .where(QuestionPaper.id == paper_id)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    questions = []
    for pq in sorted(paper.paper_questions, key=lambda x: x.order):
        q = pq.question
        questions.append({
            "paper_question_id": pq.id,
            "question_id": q.id,
            "section": pq.section,
            "order": pq.order,
            "marks": pq.marks_override or q.marks,
            "is_compulsory": pq.is_compulsory,
            "choice_group": pq.choice_group,
            "question_type": q.question_type.value,
            "question_text": q.question_text,
            "mcq_options": q.mcq_options,
            "difficulty": q.difficulty.value,
            "topic": q.topic,
        })

    return QuestionPaperDetail(
        id=paper.id,
        title=paper.title,
        board=paper.board,
        class_grade=paper.class_grade,
        subject=paper.subject,
        exam_type=paper.exam_type,
        total_marks=paper.total_marks,
        duration_minutes=paper.duration_minutes,
        status=paper.status.value,
        sections=paper.sections,
        question_count=len(questions),
        instructions=paper.instructions,
        questions=questions,
        created_at=paper.created_at,
        published_at=paper.published_at,
        starts_at=paper.starts_at,
        ends_at=paper.ends_at,
    )


@router.patch("/{paper_id}/status", response_model=QuestionPaperResponse)
async def update_paper_status(
    paper_id: int,
    data: PaperStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Update paper lifecycle status (draft → review → published → active → completed → archived)."""
    paper = await db.get(QuestionPaper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Validate status transitions
    valid_transitions = {
        PaperStatus.DRAFT: [PaperStatus.REVIEW, PaperStatus.PUBLISHED],
        PaperStatus.REVIEW: [PaperStatus.DRAFT, PaperStatus.PUBLISHED],
        PaperStatus.PUBLISHED: [PaperStatus.ACTIVE, PaperStatus.DRAFT],
        PaperStatus.ACTIVE: [PaperStatus.COMPLETED],
        PaperStatus.COMPLETED: [PaperStatus.ARCHIVED],
        PaperStatus.ARCHIVED: [],
    }

    new_status = PaperStatus(data.status)
    if new_status not in valid_transitions.get(paper.status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {paper.status.value} to {data.status}",
        )

    paper.status = new_status

    if new_status == PaperStatus.PUBLISHED:
        paper.published_at = datetime.now(timezone.utc)
    if data.starts_at:
        paper.starts_at = data.starts_at
    if data.ends_at:
        paper.ends_at = data.ends_at

    await db.flush()

    count_result = await db.execute(
        select(func.count(PaperQuestion.id)).where(PaperQuestion.paper_id == paper.id)
    )

    return QuestionPaperResponse(
        id=paper.id,
        title=paper.title,
        board=paper.board,
        class_grade=paper.class_grade,
        subject=paper.subject,
        exam_type=paper.exam_type,
        total_marks=paper.total_marks,
        duration_minutes=paper.duration_minutes,
        status=paper.status.value,
        sections=paper.sections,
        question_count=count_result.scalar(),
        created_at=paper.created_at,
        published_at=paper.published_at,
        starts_at=paper.starts_at,
        ends_at=paper.ends_at,
    )


@router.post("/assemble", response_model=PaperAssemblyResult)
async def assemble_paper_endpoint(
    data: PaperAssemblyRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """AI-assisted paper assembly from bank questions + gap-filling generation."""
    from ...services.paper_assembler import assemble_paper

    result = await assemble_paper(
        db=db,
        board=data.board,
        class_grade=data.class_grade,
        subject=data.subject,
        chapters=data.chapters,
        total_marks=data.total_marks,
        duration_minutes=data.duration_minutes,
        sections=[s.model_dump() for s in data.sections],
        question_type_distribution=data.question_type_distribution,
        title=data.title,
        exam_type=data.exam_type,
    )

    return PaperAssemblyResult(**result)


@router.get("/{paper_id}/coverage")
async def get_paper_coverage(
    paper_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Compute target-vs-actual coverage for an existing paper. Workspace-scoped."""
    from ...services.paper_assembler import (
        _build_coverage_analysis, _rag_status,
    )
    from ...services.curriculum_registry import CurriculumRegistry
    from ...models.curriculum import (
        Board, Curriculum, CurriculumSubject, CurriculumChapter,
    )

    result = await db.execute(
        select(QuestionPaper)
        .options(selectinload(QuestionPaper.paper_questions).selectinload(PaperQuestion.question))
        .where(QuestionPaper.id == paper_id)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Workspace scoping
    ws_id = get_current_workspace(user)
    if ws_id and paper.workspace_id and paper.workspace_id != ws_id:
        raise HTTPException(status_code=403, detail="Paper not in your workspace")

    # Build question dicts for the coverage analysis function
    questions = []
    chapter_names = set()
    for pq in paper.paper_questions:
        q = pq.question
        blooms = q.blooms_level.value if q.blooms_level else "understand"
        difficulty = q.difficulty.value if q.difficulty else "medium"
        topic = q.topic or "Unknown"

        # Resolve chapter name from chapter_id FK if available
        chapter_name = topic
        if q.chapter_id:
            chapter = await db.get(CurriculumChapter, q.chapter_id)
            if chapter:
                chapter_name = chapter.name

        chapter_names.add(chapter_name)
        questions.append({
            "topic": chapter_name,
            "blooms_level": blooms,
            "difficulty": difficulty,
            "marks": pq.marks_override or q.marks,
        })

    # Try to get chapter weightages from curriculum
    chapter_weightages = None
    subject_query = (
        select(CurriculumSubject)
        .join(Curriculum, CurriculumSubject.curriculum_id == Curriculum.id)
        .join(Board, Curriculum.board_id == Board.id)
        .where(
            Board.code == paper.board,
            CurriculumSubject.name == paper.subject,
        )
    )
    subj_result = await db.execute(subject_query)
    curriculum_subject = subj_result.scalar_one_or_none()
    if curriculum_subject:
        ch_result = await db.execute(
            select(CurriculumChapter)
            .where(CurriculumChapter.subject_id == curriculum_subject.id)
        )
        db_chapters = ch_result.scalars().all()
        if db_chapters:
            chapter_weightages = {}
            for ch in db_chapters:
                if ch.marks_weightage:
                    chapter_weightages[ch.name] = ch.marks_weightage
                # Also add chapters from DB to list
                chapter_names.add(ch.name)
            if not chapter_weightages:
                chapter_weightages = None

    coverage = _build_coverage_analysis(
        questions, list(chapter_names),
        board=paper.board, total_marks=paper.total_marks,
        chapter_weightages=chapter_weightages,
    )

    return coverage


@router.post("/{paper_id}/questions", status_code=201)
async def add_question_to_paper(
    paper_id: int,
    data: PaperQuestionAdd,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Add a question to a paper."""
    paper = await db.get(QuestionPaper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if paper.status not in (PaperStatus.DRAFT, PaperStatus.REVIEW):
        raise HTTPException(status_code=400, detail="Paper is not editable")

    question = await db.get(Question, data.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    pq = PaperQuestion(
        paper_id=paper_id,
        question_id=data.question_id,
        section=data.section,
        order=data.order,
        marks_override=data.marks_override,
        is_compulsory=data.is_compulsory,
        choice_group=data.choice_group,
    )
    db.add(pq)
    await db.flush()
    return {"id": pq.id, "message": "Question added to paper"}


@router.get("/{paper_id}/export/pdf")
async def export_paper_pdf(
    paper_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export a paper as PDF. Returns StreamingResponse with application/pdf."""
    from ...services.pdf_export import generate_paper_pdf
    from ...models.workspace import Workspace

    result = await db.execute(
        select(QuestionPaper)
        .options(selectinload(QuestionPaper.paper_questions).selectinload(PaperQuestion.question))
        .where(QuestionPaper.id == paper_id)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Get workspace name for header
    workspace_name = None
    if paper.workspace_id:
        ws_result = await db.execute(
            select(Workspace).where(Workspace.id == paper.workspace_id)
        )
        ws = ws_result.scalar_one_or_none()
        if ws:
            workspace_name = ws.name

    questions = []
    for pq in sorted(paper.paper_questions, key=lambda x: x.order):
        q = pq.question
        questions.append({
            "order": pq.order,
            "section": pq.section,
            "marks": pq.marks_override or q.marks,
            "question_type": q.question_type.value,
            "question_text": q.question_text,
            "mcq_options": q.mcq_options,
            "is_compulsory": pq.is_compulsory,
            "choice_group": pq.choice_group,
        })

    pdf_bytes = generate_paper_pdf(paper, questions, workspace_name=workspace_name)

    import io
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{paper.title}.pdf"',
        },
    )
