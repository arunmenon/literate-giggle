"""Taxonomy admin routes: generation, saving, impact analysis, chapter CRUD."""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.rate_limit import limiter
from ...models.user import User
from ...models.exam import Question
from ...models.curriculum import (
    Board, Curriculum, CurriculumSubject, CurriculumChapter,
    CurriculumTopic, LearningOutcome,
)
from ...schemas.taxonomy import (
    TaxonomyGenerateRequest, TaxonomyGenerateResponse,
    TaxonomySaveRequest, ImpactAnalysisRequest, ImpactAnalysisResponse,
    ChapterUpdateRequest, ChapterAddRequest,
    GeneratedChapter, GeneratedTopic, GeneratedOutcome,
    CurriculumCloneRequest, CurriculumListItem, CurriculumListResponse,
    SubjectDetailResponse,
)
from ...services.taxonomy_generator import generate_from_research, generate_from_pdf
from ...services.taxonomy_service import (
    analyze_impact, clone_curriculum, list_curricula, get_subject_detail,
)
from ..deps import require_teacher_or_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/taxonomy", tags=["Taxonomy Admin"])


# ── Generation ──


@router.post("/generate", response_model=TaxonomyGenerateResponse)
@limiter.limit("3/minute")
async def generate_taxonomy(
    request: Request,
    data: TaxonomyGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Generate a taxonomy using AI web research. Rate-limited: 3/minute."""
    result = await generate_from_research(
        board=data.board,
        class_grade=data.class_grade,
        subject=data.subject,
    )

    if result is None:
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable. Please set OPENAI_API_KEY.",
        )

    chapters = [
        GeneratedChapter(
            number=ch["number"],
            name=ch["name"],
            textbook_reference=ch.get("textbook_reference"),
            marks_weightage=ch.get("marks_weightage"),
            question_pattern_notes=ch.get("question_pattern_notes"),
            topics=[
                GeneratedTopic(
                    name=t["name"],
                    description=t.get("description"),
                    learning_outcomes=[
                        GeneratedOutcome(**lo) for lo in t.get("learning_outcomes", [])
                    ],
                )
                for t in ch.get("topics", [])
            ],
        )
        for ch in result.get("chapters", [])
    ]

    return TaxonomyGenerateResponse(
        board=data.board,
        class_grade=data.class_grade,
        subject=data.subject,
        chapters=chapters,
        sources_used=result.get("sources_used", []),
    )


@router.post("/generate/from-pdf", response_model=TaxonomyGenerateResponse)
async def generate_taxonomy_from_pdf(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Extract taxonomy from an uploaded PDF document."""
    from ...models.curriculum import UploadedDocument

    doc = await db.get(UploadedDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.extracted_text:
        raise HTTPException(
            status_code=400,
            detail="Document has no extracted text. Re-upload or process first.",
        )

    # Infer board/class/subject from the document's chapter context
    board = "CBSE"
    class_grade = 10
    subject = "General"

    if doc.chapter_id:
        chapter = await db.get(CurriculumChapter, doc.chapter_id)
        if chapter:
            subject_obj_result = await db.execute(
                select(CurriculumSubject).where(CurriculumSubject.id == chapter.subject_id)
            )
            subject_obj = subject_obj_result.scalar_one_or_none()
            if subject_obj:
                subject = subject_obj.name
                class_grade = subject_obj.class_grade
                curriculum_result = await db.execute(
                    select(Curriculum).where(Curriculum.id == subject_obj.curriculum_id)
                )
                curriculum = curriculum_result.scalar_one_or_none()
                if curriculum:
                    board_result = await db.execute(
                        select(Board).where(Board.id == curriculum.board_id)
                    )
                    board_obj = board_result.scalar_one_or_none()
                    if board_obj:
                        board = board_obj.code

    result = await generate_from_pdf(
        extracted_text=doc.extracted_text,
        board=board,
        class_grade=class_grade,
        subject=subject,
    )

    if result is None:
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable or document text too short.",
        )

    chapters = [
        GeneratedChapter(
            number=ch["number"],
            name=ch["name"],
            textbook_reference=ch.get("textbook_reference"),
            marks_weightage=ch.get("marks_weightage"),
            question_pattern_notes=ch.get("question_pattern_notes"),
            topics=[
                GeneratedTopic(
                    name=t["name"],
                    description=t.get("description"),
                    learning_outcomes=[
                        GeneratedOutcome(**lo) for lo in t.get("learning_outcomes", [])
                    ],
                )
                for t in ch.get("topics", [])
            ],
        )
        for ch in result.get("chapters", [])
    ]

    return TaxonomyGenerateResponse(
        board=board,
        class_grade=class_grade,
        subject=subject,
        chapters=chapters,
        sources_used=[],
    )


# ── Save ──


@router.post("/save", status_code=201)
async def save_taxonomy(
    data: TaxonomySaveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """
    Persist generated taxonomy to DB.

    Checks uniqueness on (board, class_grade, subject, academic_year).
    Returns 409 with existing_id if duplicate.
    """
    # Find or create board
    board_result = await db.execute(
        select(Board).where(Board.code == data.board)
    )
    board = board_result.scalar_one_or_none()
    if not board:
        board = Board(code=data.board, name=data.board)
        db.add(board)
        await db.flush()

    # Find or create curriculum for this board/academic_year
    curriculum_result = await db.execute(
        select(Curriculum).where(
            Curriculum.board_id == board.id,
            Curriculum.academic_year == data.academic_year,
        )
    )
    curriculum = curriculum_result.scalar_one_or_none()
    if not curriculum:
        curriculum = Curriculum(
            board_id=board.id,
            academic_year=data.academic_year,
        )
        db.add(curriculum)
        await db.flush()

    # Check uniqueness: (board, class_grade, subject, academic_year)
    existing_result = await db.execute(
        select(CurriculumSubject).where(
            CurriculumSubject.curriculum_id == curriculum.id,
            CurriculumSubject.class_grade == data.class_grade,
            CurriculumSubject.name == data.subject,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": f"Curriculum for {data.board} Class {data.class_grade} {data.subject} ({data.academic_year}) already exists.",
                "existing_id": existing.id,
            },
        )

    # Create subject
    subject_code = data.subject[:4].upper()
    subject = CurriculumSubject(
        curriculum_id=curriculum.id,
        code=subject_code,
        name=data.subject,
        class_grade=data.class_grade,
        textbook_name=data.textbook_name,
    )
    db.add(subject)
    await db.flush()

    # Create chapters, topics, learning outcomes
    for ch_data in data.chapters:
        chapter = CurriculumChapter(
            subject_id=subject.id,
            number=ch_data.number,
            name=ch_data.name,
            textbook_reference=ch_data.textbook_reference,
            marks_weightage=ch_data.marks_weightage,
            question_pattern_notes=ch_data.question_pattern_notes,
        )
        db.add(chapter)
        await db.flush()

        for t_data in ch_data.topics:
            topic = CurriculumTopic(
                chapter_id=chapter.id,
                name=t_data.name,
                description=t_data.description,
            )
            db.add(topic)
            await db.flush()

            for lo_data in t_data.learning_outcomes:
                outcome = LearningOutcome(
                    topic_id=topic.id,
                    description=lo_data.description,
                    bloom_level=lo_data.bloom_level,
                )
                db.add(outcome)

    await db.flush()

    return {
        "message": f"Taxonomy saved for {data.board} Class {data.class_grade} {data.subject}",
        "subject_id": subject.id,
        "chapters_count": len(data.chapters),
    }


# ── Impact Analysis ──


@router.post("/impact-analysis", response_model=ImpactAnalysisResponse)
async def analyze_taxonomy_impact(
    data: ImpactAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Analyze impact of a proposed taxonomy change."""
    result = await analyze_impact(
        db=db,
        chapter_id=data.chapter_id,
        change_type=data.change_type,
        new_value=data.new_value,
    )
    return result


# ── Chapter CRUD ──


@router.put("/chapters/{chapter_id}")
async def update_chapter(
    chapter_id: int,
    data: ChapterUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """
    Update a chapter. Requires prior impact analysis call.
    Request body includes impact_acknowledged: bool.
    """
    chapter = await db.get(CurriculumChapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Determine if impact analysis is needed
    needs_impact = False
    if data.name is not None and data.name != chapter.name:
        needs_impact = True
    if data.marks_weightage is not None and data.marks_weightage != chapter.marks_weightage:
        needs_impact = True

    if needs_impact and not data.impact_acknowledged:
        raise HTTPException(
            status_code=400,
            detail="Impact analysis required. Set impact_acknowledged=true after reviewing impact.",
        )

    # Apply updates
    if data.name is not None:
        chapter.name = data.name
    if data.textbook_reference is not None:
        chapter.textbook_reference = data.textbook_reference
    if data.marks_weightage is not None:
        chapter.marks_weightage = data.marks_weightage
    if data.question_pattern_notes is not None:
        chapter.question_pattern_notes = data.question_pattern_notes
    if data.order is not None:
        chapter.number = data.order

    await db.flush()

    return {
        "message": "Chapter updated",
        "chapter_id": chapter.id,
        "name": chapter.name,
    }


@router.post("/chapters/{chapter_id}/deprecate")
async def deprecate_chapter(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """
    Soft-delete a chapter (set is_active=False if references exist, hard delete otherwise).
    Preserves all FK references. Chapter hidden from CurriculumPicker but
    visible in analytics for existing questions.
    """
    chapter = await db.get(CurriculumChapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Check if any questions reference this chapter
    q_count_result = await db.execute(
        select(Question.id).where(Question.chapter_id == chapter_id).limit(1)
    )
    has_references = q_count_result.scalar_one_or_none() is not None

    if has_references:
        # Soft-delete: we need an is_active column on CurriculumChapter
        # For now, mark via question_pattern_notes (pragmatic for v1)
        # In a future migration, add is_active column to CurriculumChapter
        chapter.question_pattern_notes = (
            f"[DEPRECATED] {chapter.question_pattern_notes or ''}"
        ).strip()
        await db.flush()
        return {
            "message": "Chapter deprecated (soft-deleted). FK references preserved.",
            "chapter_id": chapter.id,
            "action": "soft_delete",
        }
    else:
        # Hard delete -- no references
        await db.delete(chapter)
        await db.flush()
        return {
            "message": "Chapter deleted (no references).",
            "chapter_id": chapter_id,
            "action": "hard_delete",
        }


@router.post("/chapters", status_code=201)
async def add_chapter(
    data: ChapterAddRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Add a new chapter to a subject. Safe add -- no impact analysis needed."""
    subject = await db.get(CurriculumSubject, data.subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    chapter = CurriculumChapter(
        subject_id=data.subject_id,
        number=data.number,
        name=data.name,
        textbook_reference=data.textbook_reference,
        marks_weightage=data.marks_weightage,
        question_pattern_notes=data.question_pattern_notes,
    )
    db.add(chapter)
    await db.flush()

    return {
        "message": "Chapter added",
        "chapter_id": chapter.id,
        "name": chapter.name,
    }


# ── Curriculum Clone + List ──


@router.post("/clone")
async def clone_curriculum_endpoint(
    data: CurriculumCloneRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Clone a curriculum for a new academic year. Sets source inactive, new active."""
    try:
        result = await clone_curriculum(
            db=db,
            source_curriculum_id=data.source_curriculum_id,
            new_academic_year=data.new_academic_year,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/list", response_model=CurriculumListResponse)
async def list_curricula_endpoint(
    board: Optional[str] = None,
    class_grade: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """List all curricula with subject counts and chapter counts."""
    items = await list_curricula(db=db, board=board, class_grade=class_grade)
    return CurriculumListResponse(
        curricula=[CurriculumListItem(**item) for item in items]
    )


@router.get("/subjects/{subject_id}", response_model=SubjectDetailResponse)
async def get_subject_detail_endpoint(
    subject_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Get full subject detail (chapters, topics, outcomes) for editing."""
    result = await get_subject_detail(db=db, subject_id=subject_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    return SubjectDetailResponse(**result)
