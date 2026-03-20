"""Question Bank and Question CRUD routes (Curation)."""

import os
import uuid
import pathlib
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional

from ...core.database import get_db
from ...models.user import User
from ...models.exam import QuestionBank, Question, QuestionType, DifficultyLevel, BloomsTaxonomy
from ...schemas.exam import (
    QuestionBankCreate, QuestionBankResponse,
    QuestionCreate, QuestionResponse, QuestionFilter,
    QuestionGenerateRequest, BulkGenerateRequest,
    GeneratedQuestionResponse, GenerateResponse,
    ApproveQuestionsRequest,
)
from ...schemas.exam import (
    CurriculumResponse,
    ResearchRequest, ResearchResult,
    RegenerateRequest,
)
from ...schemas.taxonomy import (
    BankAnalyticsResponse,
    CoverageHeatmapResponse,
    DifficultyCalibrationResponse,
    DifficultyCalibrationBankResponse,
)
from ...services.taxonomy_service import get_bank_analytics, get_coverage_heatmap, fuzzy_match_topic_to_chapter
from ...services.question_generator import generate_questions, generate_bulk_questions
from ...services.curriculum_context import build_curriculum_context
from ...services.difficulty_calibration import calibrate_difficulty, calibrate_bank
from ...services.curriculum_registry import CurriculumRegistry
from ...services.diagram_generator import diagram_service, DiagramResult
from ..deps import get_current_user, require_teacher_or_admin, get_current_workspace

router = APIRouter(prefix="/questions", tags=["Question Bank (Curation)"])
_registry = CurriculumRegistry()

# Note: _registry methods are now async and require db session


# ── Question Banks ──


@router.post("/banks", response_model=QuestionBankResponse, status_code=201)
async def create_question_bank(
    data: QuestionBankCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Create a new question bank. Auto-sets workspace_id from JWT."""
    bank = QuestionBank(
        **data.model_dump(),
        created_by=user.id,
        workspace_id=get_current_workspace(user),
    )
    db.add(bank)
    await db.flush()
    return QuestionBankResponse(
        id=bank.id,
        name=bank.name,
        board=bank.board,
        class_grade=bank.class_grade,
        subject=bank.subject,
        chapter=bank.chapter,
        question_count=0,
        created_at=bank.created_at,
    )


@router.get("/banks", response_model=list[QuestionBankResponse])
async def list_question_banks(
    board: Optional[str] = None,
    class_grade: Optional[int] = None,
    subject: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List question banks with optional filters, scoped to workspace."""
    ws_id = get_current_workspace(user)
    query = select(QuestionBank)

    # Workspace scoping: show banks from current workspace OR legacy (null) owned by user
    if ws_id:
        query = query.where(
            or_(
                QuestionBank.workspace_id == ws_id,
                and_(
                    QuestionBank.workspace_id.is_(None),
                    QuestionBank.created_by == user.id,
                ),
            )
        )
    else:
        query = query.where(QuestionBank.created_by == user.id)

    if board:
        query = query.where(QuestionBank.board == board)
    if class_grade:
        query = query.where(QuestionBank.class_grade == class_grade)
    if subject:
        query = query.where(QuestionBank.subject == subject)

    # Single aggregated query: join banks with question counts to avoid N+1
    count_subq = (
        select(
            Question.bank_id,
            func.count(Question.id).label("question_count"),
        )
        .where(Question.is_active == True)
        .group_by(Question.bank_id)
        .subquery()
    )
    combined = (
        query.outerjoin(count_subq, QuestionBank.id == count_subq.c.bank_id)
        .add_columns(func.coalesce(count_subq.c.question_count, 0).label("question_count"))
        .order_by(QuestionBank.created_at.desc())
    )
    result = await db.execute(combined)
    rows = result.all()

    return [
        QuestionBankResponse(
            id=bank.id,
            name=bank.name,
            board=bank.board,
            class_grade=bank.class_grade,
            subject=bank.subject,
            chapter=bank.chapter,
            question_count=count,
            created_at=bank.created_at,
        )
        for bank, count in rows
    ]


# ── Bank Analytics ──


@router.get("/banks/{bank_id}/analytics", response_model=BankAnalyticsResponse)
async def get_bank_analytics_endpoint(
    bank_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Get coverage analytics for a question bank against its curriculum."""
    # Workspace-scoped: verify bank belongs to user's workspace
    bank = await db.get(QuestionBank, bank_id)
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")

    ws_id = get_current_workspace(user)
    if bank.workspace_id is not None:
        if ws_id != bank.workspace_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        if bank.created_by != user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    analytics = await get_bank_analytics(db, bank_id)
    return analytics


# ── Curriculum ──


@router.get("/curriculum", response_model=CurriculumResponse)
async def get_curriculum(
    board: Optional[str] = None,
    class_grade: Optional[int] = None,
    subject: Optional[str] = None,
    chapter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get curriculum data with cascading filters."""
    result = await _registry.get_curriculum(
        db=db,
        board=board,
        class_grade=class_grade,
        subject=subject,
        chapter=chapter,
    )
    return CurriculumResponse(**result)


# ── Questions ──


@router.post("", response_model=QuestionResponse, status_code=201)
async def create_question(
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Create a new question in a bank."""
    # Verify bank exists
    bank = await db.get(QuestionBank, data.bank_id)
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")

    question = Question(**data.model_dump())

    # Auto-set chapter_id via fuzzy match if not provided
    if not question.chapter_id and question.topic and bank:
        matched_id = await fuzzy_match_topic_to_chapter(
            question.topic, bank.board, bank.class_grade, bank.subject, db
        )
        if matched_id:
            question.chapter_id = matched_id

    db.add(question)
    await db.flush()
    return question


@router.get("", response_model=list[QuestionResponse])
async def list_questions(
    bank_id: Optional[int] = None,
    board: Optional[str] = None,
    class_grade: Optional[int] = None,
    subject: Optional[str] = None,
    topic: Optional[str] = None,
    question_type: Optional[str] = None,
    difficulty: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Search and filter questions across banks."""
    query = select(Question).join(QuestionBank)

    if bank_id:
        query = query.where(Question.bank_id == bank_id)
    if board:
        query = query.where(QuestionBank.board == board)
    if class_grade:
        query = query.where(QuestionBank.class_grade == class_grade)
    if subject:
        query = query.where(QuestionBank.subject == subject)
    if topic:
        query = query.where(Question.topic.ilike(f"%{topic}%"))
    if question_type:
        query = query.where(Question.question_type == question_type)
    if difficulty:
        query = query.where(Question.difficulty == difficulty)

    query = query.where(Question.is_active == True)
    query = query.order_by(Question.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a question by ID (workspace-scoped)."""
    question = await db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # IDOR check: question's bank must be in current workspace or legacy (null + created_by == user)
    bank = await db.get(QuestionBank, question.bank_id)
    ws_id = get_current_workspace(user)
    if bank:
        if bank.workspace_id is not None:
            if ws_id != bank.workspace_id:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            if bank.created_by != user.id:
                raise HTTPException(status_code=403, detail="Access denied")

    return question


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: int,
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Update a question (workspace-scoped)."""
    question = await db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # IDOR check: question's bank must be in current workspace or legacy (null + created_by == user)
    bank = await db.get(QuestionBank, question.bank_id)
    ws_id = get_current_workspace(user)
    if bank:
        if bank.workspace_id is not None:
            if ws_id != bank.workspace_id:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            if bank.created_by != user.id:
                raise HTTPException(status_code=403, detail="Access denied")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(question, key, value)

    # Lazy migrate: set workspace_id on the parent bank if null
    if bank and bank.workspace_id is None:
        ws_id = get_current_workspace(user)
        if ws_id:
            bank.workspace_id = ws_id

    await db.flush()
    return question


@router.post("/generate", response_model=GenerateResponse)
async def generate_questions_endpoint(
    data: QuestionGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Generate questions using AI for teacher review."""
    # Build CurriculumContext from DB when chapter data exists
    curriculum_context = None
    if data.chapter:
        curriculum_context = await build_curriculum_context(
            db=db,
            board=data.board,
            class_grade=data.class_grade,
            subject=data.subject,
            chapter_name=data.chapter,
        )

    questions = await generate_questions(
        topic=data.topic,
        subject=data.subject,
        board=data.board,
        class_grade=data.class_grade,
        difficulty=data.difficulty,
        question_type=data.question_type,
        count=data.count,
        chapter=data.chapter,
        research_context=data.research_context,
        teacher_notes=data.teacher_notes,
        curriculum_context=curriculum_context,
    )

    if questions is None:
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable. Please set OPENAI_API_KEY.",
        )

    generated = [GeneratedQuestionResponse(**q) for q in questions]
    return GenerateResponse(questions=generated, count=len(generated))


@router.post("/generate/bulk", response_model=GenerateResponse)
async def bulk_generate_questions_endpoint(
    data: BulkGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Bulk generate questions across multiple types for a chapter."""
    questions = await generate_bulk_questions(
        subject=data.subject,
        board=data.board,
        class_grade=data.class_grade,
        chapter=data.chapter,
        question_distribution=data.question_distribution,
    )

    if questions is None:
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable. Please set OPENAI_API_KEY.",
        )

    generated = [GeneratedQuestionResponse(**q) for q in questions]
    return GenerateResponse(questions=generated, count=len(generated))


@router.post("/generate/approve", response_model=list[QuestionResponse], status_code=201)
async def approve_generated_questions(
    data: ApproveQuestionsRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Approve and save AI-generated questions to a question bank."""
    bank = await db.get(QuestionBank, data.bank_id)
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")

    saved_questions = []
    for question_data in data.questions:
        q_dict = question_data.model_dump()

        # Track original AI-assigned blooms_level for teacher override detection
        original_blooms = q_dict.get("blooms_level", "").lower()

        if q_dict.get("blooms_level"):
            # AI may return full names like "Application" -- map to enum names
            blooms_map = {
                "APPLICATION": "APPLY", "KNOWLEDGE": "REMEMBER",
                "COMPREHENSION": "UNDERSTAND", "ANALYSIS": "ANALYZE",
                "SYNTHESIS": "CREATE", "EVALUATION": "EVALUATE",
            }
            raw = q_dict["blooms_level"].upper().replace(" ", "_")
            mapped = blooms_map.get(raw, raw)
            try:
                q_dict["blooms_level"] = BloomsTaxonomy[mapped]
            except KeyError:
                # Try matching by value instead of name
                try:
                    q_dict["blooms_level"] = BloomsTaxonomy(raw.lower())
                except ValueError:
                    q_dict["blooms_level"] = BloomsTaxonomy.UNDERSTAND  # safe default
        if q_dict.get("difficulty"):
            try:
                q_dict["difficulty"] = DifficultyLevel[q_dict["difficulty"].upper()]
            except KeyError:
                q_dict["difficulty"] = DifficultyLevel(q_dict["difficulty"].lower())
        if q_dict.get("question_type"):
            try:
                q_dict["question_type"] = QuestionType[q_dict["question_type"].upper().replace(" ", "_")]
            except KeyError:
                q_dict["question_type"] = QuestionType(q_dict["question_type"].lower().replace(" ", "_"))
        # Ensure provenance fields are preserved
        q_dict.setdefault("original_ai_text", None)
        q_dict.setdefault("teacher_edited", False)
        q_dict.setdefault("quality_rating", None)
        q_dict.setdefault("generation_context", None)

        # Handle Bloom's confidence fields
        blooms_confidence = q_dict.pop("blooms_confidence", None)
        blooms_teacher_confirmed = q_dict.pop("blooms_teacher_confirmed", False)

        # Detect teacher Bloom's level override: if the approved level differs
        # from the original AI-assigned level, set confirmed=True, confidence=1.0
        resolved_blooms = q_dict["blooms_level"]
        resolved_blooms_val = resolved_blooms.value if hasattr(resolved_blooms, "value") else str(resolved_blooms).lower()
        if original_blooms and resolved_blooms_val != original_blooms:
            blooms_teacher_confirmed = True
            blooms_confidence = 1.0

        # Extract chapter_id before creating Question (if present from generation)
        chapter_id = q_dict.pop("chapter_id", None)
        question = Question(**q_dict)
        question.bank_id = data.bank_id
        question.blooms_confidence = blooms_confidence
        question.blooms_teacher_confirmed = blooms_teacher_confirmed

        # Set chapter_id from generation payload or attempt fuzzy match
        if chapter_id:
            question.chapter_id = chapter_id
        elif question.topic and bank:
            matched_id = await fuzzy_match_topic_to_chapter(
                question.topic, bank.board, bank.class_grade, bank.subject, db
            )
            if matched_id:
                question.chapter_id = matched_id
        db.add(question)
        await db.flush()
        saved_questions.append(question)

    return saved_questions


@router.post("/generate/regenerate", response_model=GeneratedQuestionResponse)
async def regenerate_question_endpoint(
    data: RegenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Regenerate a single question with teacher feedback."""
    from ...services.question_generator import regenerate_question

    result = await regenerate_question(
        original_question=data.original_question,
        feedback=data.feedback,
        research_context=data.research_context,
        board=data.board,
        class_grade=data.class_grade,
        subject=data.subject,
        chapter=data.chapter,
    )

    if result is None:
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable. Please set OPENAI_API_KEY.",
        )

    return GeneratedQuestionResponse(**result)


@router.post("/research", response_model=ResearchResult)
async def research_chapter_endpoint(
    data: ResearchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Research a chapter for grounded question generation."""
    from ...services.syllabus_researcher import research_chapter

    result = await research_chapter(
        board=data.board,
        class_grade=data.class_grade,
        subject=data.subject,
        chapter=data.chapter,
        teacher_notes=data.teacher_notes,
        db=db,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Chapter not found in curriculum registry.",
        )

    return result


@router.delete("/{question_id}", status_code=204)
async def delete_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Soft-delete a question (workspace-scoped)."""
    question = await db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # IDOR check: question's bank must be in current workspace or legacy (null + created_by == user)
    bank = await db.get(QuestionBank, question.bank_id)
    ws_id = get_current_workspace(user)
    if bank:
        if bank.workspace_id is not None:
            if ws_id != bank.workspace_id:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            if bank.created_by != user.id:
                raise HTTPException(status_code=403, detail="Access denied")

    question.is_active = False
    await db.flush()


# ── Image Upload ──

QUESTION_IMAGE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads", "questions",
)
ALLOWED_IMAGE_TYPES = {".png", ".jpg", ".jpeg", ".gif", ".svg"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/{question_id}/upload-image")
async def upload_question_image(
    question_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Upload an image for a question (diagram, figure, etc.)."""
    question = await db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Workspace scoping
    bank = await db.get(QuestionBank, question.bank_id)
    ws_id = get_current_workspace(user)
    if bank:
        if bank.workspace_id is not None:
            if ws_id != bank.workspace_id:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            if bank.created_by != user.id:
                raise HTTPException(status_code=403, detail="Access denied")

    # Validate file extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    ext = pathlib.Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Accepted: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 5MB)")

    # Save with UUID filename (no raw client filenames for security)
    os.makedirs(QUESTION_IMAGE_DIR, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(QUESTION_IMAGE_DIR, safe_name)

    # Path traversal protection
    resolved = pathlib.Path(file_path).resolve()
    upload_dir_resolved = pathlib.Path(QUESTION_IMAGE_DIR).resolve()
    if not str(resolved).startswith(str(upload_dir_resolved)):
        raise HTTPException(status_code=400, detail="Invalid filename")

    with open(file_path, "wb") as f:
        f.write(content)

    image_url = f"/api/uploads/questions/{safe_name}"
    question.question_image_url = image_url
    await db.flush()

    return {"image_url": image_url, "question_id": question_id}


# ── Diagram Generation ──


class DiagramGenerateRequest(BaseModel):
    """Request body for diagram generation."""
    subject: str
    topic: str
    question_text: str


class DiagramGenerateResponse(BaseModel):
    """Response from diagram generation."""
    svg_url: Optional[str] = None
    renderer_used: str
    client_params: Optional[dict] = None
    alt_text: str


@router.post("/{question_id}/generate-diagram", response_model=DiagramGenerateResponse)
async def generate_diagram_for_question(
    question_id: int,
    data: DiagramGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Generate a diagram for a question using AI + multi-renderer architecture.

    Teacher previews the result, then calls accept-diagram to save it.
    """
    question = await db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Workspace scoping
    bank = await db.get(QuestionBank, question.bank_id)
    ws_id = get_current_workspace(user)
    if bank:
        if bank.workspace_id is not None:
            if ws_id != bank.workspace_id:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            if bank.created_by != user.id:
                raise HTTPException(status_code=403, detail="Access denied")

    result = await diagram_service.generate_diagram(
        question_text=data.question_text,
        subject=data.subject,
        topic=data.topic,
    )

    if not result:
        raise HTTPException(
            status_code=503,
            detail="Diagram generation failed. AI service may be unavailable.",
        )

    return DiagramGenerateResponse(
        svg_url=result.svg_url,
        renderer_used=result.renderer_used,
        client_params=result.client_params,
        alt_text=result.alt_text,
    )


class AcceptDiagramRequest(BaseModel):
    """Request body to accept a generated diagram for a question."""
    svg_url: Optional[str] = None
    alt_text: Optional[str] = None


@router.post("/{question_id}/accept-diagram")
async def accept_diagram_for_question(
    question_id: int,
    data: AcceptDiagramRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Accept a generated diagram and save its URL to the question."""
    question = await db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Workspace scoping
    bank = await db.get(QuestionBank, question.bank_id)
    ws_id = get_current_workspace(user)
    if bank:
        if bank.workspace_id is not None:
            if ws_id != bank.workspace_id:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            if bank.created_by != user.id:
                raise HTTPException(status_code=403, detail="Access denied")

    if data.svg_url:
        question.question_image_url = data.svg_url

    await db.flush()
    return {
        "question_id": question_id,
        "question_image_url": question.question_image_url,
        "accepted": True,
    }


# ── Coverage Heatmap ──


@router.get("/banks/{bank_id}/heatmap", response_model=CoverageHeatmapResponse)
async def get_bank_heatmap_endpoint(
    bank_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Get chapter x Bloom's level coverage heatmap for a question bank."""
    bank = await db.get(QuestionBank, bank_id)
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")

    ws_id = get_current_workspace(user)
    if bank.workspace_id is not None:
        if ws_id != bank.workspace_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        if bank.created_by != user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    return await get_coverage_heatmap(db, bank_id)


# ── Difficulty Calibration ──


@router.get("/{question_id}/calibration", response_model=DifficultyCalibrationResponse)
async def get_question_calibration(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Get difficulty calibration for a single question based on historical student data."""
    question = await db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Workspace scoping
    bank = await db.get(QuestionBank, question.bank_id)
    ws_id = get_current_workspace(user)
    if bank:
        if bank.workspace_id is not None:
            if ws_id != bank.workspace_id:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            if bank.created_by != user.id:
                raise HTTPException(status_code=403, detail="Access denied")

    calibration = await calibrate_difficulty(db, question_id)
    if calibration is None:
        raise HTTPException(
            status_code=404,
            detail="No student attempt data available for calibration.",
        )

    return calibration


@router.get("/banks/{bank_id}/calibration", response_model=DifficultyCalibrationBankResponse)
async def get_bank_calibration(
    bank_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Get difficulty calibration for all questions in a bank with student data."""
    bank = await db.get(QuestionBank, bank_id)
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")

    ws_id = get_current_workspace(user)
    if bank.workspace_id is not None:
        if ws_id != bank.workspace_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        if bank.created_by != user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    calibrations = await calibrate_bank(db, bank_id)
    mismatches = [c for c in calibrations if c.mismatch]
    return DifficultyCalibrationBankResponse(
        bank_id=bank_id,
        calibrations=calibrations,
        total_calibrated=len(calibrations),
        total_mismatches=len(mismatches),
    )
