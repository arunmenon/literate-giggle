"""Question Bank and Question CRUD routes (Curation)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
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
from ...services.question_generator import generate_questions, generate_bulk_questions
from ...services.curriculum_registry import CurriculumRegistry
from ..deps import get_current_user, require_teacher_or_admin

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
    """Create a new question bank."""
    bank = QuestionBank(**data.model_dump(), created_by=user.id)
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
    """List question banks with optional filters."""
    query = select(QuestionBank)
    if board:
        query = query.where(QuestionBank.board == board)
    if class_grade:
        query = query.where(QuestionBank.class_grade == class_grade)
    if subject:
        query = query.where(QuestionBank.subject == subject)

    result = await db.execute(query.order_by(QuestionBank.created_at.desc()))
    banks = result.scalars().all()

    responses = []
    for bank in banks:
        count_result = await db.execute(
            select(func.count(Question.id)).where(Question.bank_id == bank.id)
        )
        count = count_result.scalar()
        responses.append(
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
        )
    return responses


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
    """Get a question by ID."""
    question = await db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: int,
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Update a question."""
    question = await db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(question, key, value)

    await db.flush()
    return question


@router.post("/generate", response_model=GenerateResponse)
async def generate_questions_endpoint(
    data: QuestionGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Generate questions using AI for teacher review."""
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
        if q_dict.get("blooms_level"):
            q_dict["blooms_level"] = BloomsTaxonomy[q_dict["blooms_level"].upper()]
        if q_dict.get("difficulty"):
            q_dict["difficulty"] = DifficultyLevel[q_dict["difficulty"].upper()]
        if q_dict.get("question_type"):
            q_dict["question_type"] = QuestionType[q_dict["question_type"].upper().replace(" ", "_")]
        # Ensure provenance fields are preserved
        q_dict.setdefault("original_ai_text", None)
        q_dict.setdefault("teacher_edited", False)
        q_dict.setdefault("quality_rating", None)
        q_dict.setdefault("generation_context", None)
        question = Question(**q_dict)
        question.bank_id = data.bank_id
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
    """Soft-delete a question."""
    question = await db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    question.is_active = False
    await db.flush()
