"""Curriculum CRUD and document upload routes."""

import os
import pathlib
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional

from ...core.database import get_db
from ...models.user import User
from ...models.curriculum import (
    Board, Curriculum, CurriculumSubject, CurriculumChapter,
    CurriculumTopic, LearningOutcome, QuestionPattern, UploadedDocument,
)
from ..deps import get_current_user, require_teacher_or_admin

router = APIRouter(prefix="/curriculum", tags=["Curriculum"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")


@router.get("/boards")
async def list_boards(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all education boards."""
    result = await db.execute(select(Board).order_by(Board.code))
    boards = result.scalars().all()
    return [
        {"id": b.id, "code": b.code, "name": b.name, "description": b.description}
        for b in boards
    ]


@router.get("/{board}/classes")
async def list_classes(
    board: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List available class grades for a board."""
    result = await db.execute(
        select(CurriculumSubject.class_grade)
        .join(Curriculum).join(Board)
        .where(Board.code == board, Curriculum.is_active == True)
        .distinct()
        .order_by(CurriculumSubject.class_grade)
    )
    return [row[0] for row in result.all()]


@router.get("/{board}/{class_grade}/subjects")
async def list_subjects(
    board: str,
    class_grade: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List subjects for a board and class."""
    result = await db.execute(
        select(CurriculumSubject)
        .join(Curriculum).join(Board)
        .where(
            Board.code == board,
            CurriculumSubject.class_grade == class_grade,
            Curriculum.is_active == True,
        )
        .order_by(CurriculumSubject.name)
    )
    subjects = result.scalars().all()
    return [
        {
            "id": s.id, "code": s.code, "name": s.name,
            "textbook_name": s.textbook_name, "total_marks": s.total_marks,
        }
        for s in subjects
    ]


@router.get("/{board}/{class_grade}/{subject}/chapters")
async def list_chapters(
    board: str,
    class_grade: int,
    subject: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List chapters for a board/class/subject."""
    result = await db.execute(
        select(CurriculumChapter)
        .join(CurriculumSubject).join(Curriculum).join(Board)
        .where(
            Board.code == board,
            CurriculumSubject.class_grade == class_grade,
            CurriculumSubject.name == subject,
            Curriculum.is_active == True,
        )
        .options(selectinload(CurriculumChapter.topics))
        .order_by(CurriculumChapter.number)
    )
    chapters = result.scalars().all()
    return [
        {
            "id": ch.id,
            "number": ch.number,
            "name": ch.name,
            "textbook_reference": ch.textbook_reference,
            "marks_weightage": ch.marks_weightage,
            "topic_count": len(ch.topics),
        }
        for ch in chapters
    ]


@router.get("/chapters/{chapter_id}")
async def get_chapter_detail(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get full chapter detail with topics, learning outcomes, and patterns."""
    result = await db.execute(
        select(CurriculumChapter)
        .where(CurriculumChapter.id == chapter_id)
        .options(
            selectinload(CurriculumChapter.topics)
            .selectinload(CurriculumTopic.learning_outcomes),
            selectinload(CurriculumChapter.question_patterns),
        )
    )
    ch = result.scalars().first()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

    topics = []
    learning_outcomes = []
    for t in ch.topics:
        topics.append({"id": t.id, "name": t.name, "description": t.description})
        for lo in t.learning_outcomes:
            learning_outcomes.append({
                "id": lo.id, "code": lo.code, "description": lo.description,
                "bloom_level": lo.bloom_level, "competency_type": lo.competency_type,
            })

    patterns = [
        {
            "id": qp.id, "question_type": qp.question_type,
            "typical_marks": qp.typical_marks, "frequency": qp.frequency,
            "pattern_notes": qp.pattern_notes, "example_question": qp.example_question,
            "source_year": qp.source_year,
        }
        for qp in ch.question_patterns
    ]

    return {
        "id": ch.id,
        "name": ch.name,
        "textbook_reference": ch.textbook_reference,
        "marks_weightage": ch.marks_weightage,
        "question_pattern_notes": ch.question_pattern_notes,
        "topics": topics,
        "learning_outcomes": learning_outcomes,
        "question_patterns": patterns,
    }


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    content_type: str = Form(...),
    chapter_id: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Upload a PDF document (textbook, past paper, or reference material)."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    if content_type not in ("textbook", "past_paper", "reference"):
        raise HTTPException(status_code=400, detail="content_type must be textbook, past_paper, or reference")

    # Validate chapter exists if provided
    if chapter_id:
        chapter = await db.get(CurriculumChapter, chapter_id)
        if not chapter:
            raise HTTPException(status_code=404, detail="Chapter not found")

    # Save file with path traversal protection
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Sanitize filename: strip directory components and generate a safe name
    original_name = pathlib.Path(file.filename).name
    safe_name = f"{uuid.uuid4().hex}_{original_name}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    # Validate resolved path is within UPLOAD_DIR
    resolved = pathlib.Path(file_path).resolve()
    upload_dir_resolved = pathlib.Path(UPLOAD_DIR).resolve()
    if not str(resolved).startswith(str(upload_dir_resolved)):
        raise HTTPException(status_code=400, detail="Invalid filename")

    # File size limit (50MB)
    MAX_UPLOAD_SIZE = 50 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    # Validate PDF magic bytes
    if not content[:5] == b'%PDF-':
        raise HTTPException(status_code=400, detail="File is not a valid PDF")

    # Write file
    with open(file_path, "wb") as f:
        f.write(content)

    # Try PDF ingestion if available
    extracted_text = None
    extracted_questions = None
    try:
        from ...services.pdf_ingestion import extract_text_from_pdf, parse_exam_paper
        extracted_text = extract_text_from_pdf(file_path)
        if content_type == "past_paper" and extracted_text:
            extracted_questions = await parse_exam_paper(extracted_text, "", "")
    except (ImportError, Exception):
        pass  # PDF ingestion not yet available or failed

    doc = UploadedDocument(
        teacher_id=user.id,
        chapter_id=chapter_id,
        filename=original_name,
        file_path=file_path,
        content_type=content_type,
        extracted_text=extracted_text,
        extracted_questions=extracted_questions,
    )
    db.add(doc)
    await db.flush()

    return {
        "id": doc.id,
        "filename": doc.filename,
        "content_type": doc.content_type,
        "chapter_id": doc.chapter_id,
        "has_extracted_text": bool(doc.extracted_text),
        "extracted_question_count": len(doc.extracted_questions) if doc.extracted_questions else 0,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
    }


@router.get("/documents")
async def list_documents(
    chapter_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List uploaded documents, filtered by ownership (teacher_id)."""
    query = select(UploadedDocument).where(
        UploadedDocument.teacher_id == user.id
    ).order_by(UploadedDocument.uploaded_at.desc())
    if chapter_id:
        query = query.where(UploadedDocument.chapter_id == chapter_id)

    result = await db.execute(query)
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "content_type": d.content_type,
            "chapter_id": d.chapter_id,
            "has_extracted_text": bool(d.extracted_text),
            "extracted_question_count": len(d.extracted_questions) if d.extracted_questions else 0,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in docs
    ]
