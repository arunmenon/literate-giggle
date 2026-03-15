"""Question Bank and Question CRUD routes (Curation)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional

from ...core.database import get_db
from ...models.user import User
from ...models.exam import QuestionBank, Question
from ...schemas.exam import (
    QuestionBankCreate, QuestionBankResponse,
    QuestionCreate, QuestionResponse, QuestionFilter,
)
from ..deps import get_current_user, require_teacher_or_admin

router = APIRouter(prefix="/questions", tags=["Question Bank (Curation)"])


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
