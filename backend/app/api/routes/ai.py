"""AI-specific API routes: hints, explanations, and conversational tutor."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...models.user import User
from ...models.exam import (
    ExamSession, ExamSessionStatus, StudentAnswer,
    PaperQuestion, Question, QuestionPaper,
)
from ...models.evaluation import QuestionEvaluation
from ...services.ai_tutor import get_hint, explain_answer, chat
from ..deps import get_current_user

router = APIRouter(prefix="/ai", tags=["AI Tutor"])


# ── Request/Response schemas ──


class HintRequest(BaseModel):
    session_id: int
    paper_question_id: int


class HintResponseSchema(BaseModel):
    hint: str
    hint_level: int
    hint_number: int
    marks_penalty_pct: float
    total_penalty_pct: float


class ExplainRequest(BaseModel):
    question_evaluation_id: int


class ExplainResponseSchema(BaseModel):
    explanation: str
    key_concept: str
    common_mistake: str
    study_tip: str


class ChatRequest(BaseModel):
    message: str
    subject: str = "General"
    board: str = "CBSE"
    class_grade: int = 10
    conversation_history: Optional[list[dict]] = None
    context: Optional[str] = None


# ── Endpoints ──


@router.post("/hint", response_model=HintResponseSchema)
async def get_hint_endpoint(
    data: HintRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a progressive hint for a question during a practice exam."""
    # Load session and verify it's a practice exam in progress
    session = await db.get(ExamSession, data.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.is_practice:
        raise HTTPException(status_code=400, detail="Hints are only available for practice exams")
    if session.status != ExamSessionStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Exam is not in progress")

    # Load the answer record (or create one if it doesn't exist yet)
    result = await db.execute(
        select(StudentAnswer).where(
            StudentAnswer.session_id == data.session_id,
            StudentAnswer.paper_question_id == data.paper_question_id,
        )
    )
    student_answer = result.scalar_one_or_none()

    if not student_answer:
        # Create an empty answer record to track hints
        student_answer = StudentAnswer(
            session_id=data.session_id,
            paper_question_id=data.paper_question_id,
            hint_count=0,
            hints_used=[],
        )
        db.add(student_answer)
        await db.flush()

    # Load the question
    paper_question = await db.get(PaperQuestion, data.paper_question_id)
    if not paper_question:
        raise HTTPException(status_code=404, detail="Paper question not found")
    question = await db.get(Question, paper_question.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Load paper for context
    paper = await db.get(QuestionPaper, session.paper_id)

    # Get the hint
    hint_number = (student_answer.hint_count or 0) + 1
    hint_result = await get_hint(
        question_text=question.question_text,
        question_type=question.question_type.value,
        topic=question.topic,
        subject=paper.subject if paper else "General",
        board=paper.board if paper else "CBSE",
        class_grade=paper.class_grade if paper else 10,
        marks=paper_question.marks_override or question.marks,
        hint_number=hint_number,
        model_answer=question.model_answer,
    )

    if hint_result is None:
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable. Please set ANTHROPIC_API_KEY.",
        )

    # Update the student answer record
    student_answer.hint_count = hint_number
    existing_hints = student_answer.hints_used or []
    existing_hints.append(hint_result.hint)
    student_answer.hints_used = existing_hints
    await db.flush()

    # Calculate total penalty
    total_penalty = min(hint_result.marks_penalty_pct * hint_number, 50.0)

    return HintResponseSchema(
        hint=hint_result.hint,
        hint_level=hint_result.hint_level,
        hint_number=hint_number,
        marks_penalty_pct=hint_result.marks_penalty_pct,
        total_penalty_pct=total_penalty,
    )


@router.post("/explain", response_model=ExplainResponseSchema)
async def explain_evaluation_endpoint(
    data: ExplainRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Explain an evaluation result for a specific question using AI."""
    # Load the question evaluation
    question_eval = await db.get(QuestionEvaluation, data.question_evaluation_id)
    if not question_eval:
        raise HTTPException(status_code=404, detail="Question evaluation not found")

    # Load related data
    student_answer = await db.get(StudentAnswer, question_eval.student_answer_id)
    if not student_answer:
        raise HTTPException(status_code=404, detail="Student answer not found")

    paper_question = await db.get(PaperQuestion, student_answer.paper_question_id)
    question = await db.get(Question, paper_question.question_id) if paper_question else None
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Load session and paper for context
    session = await db.get(ExamSession, student_answer.session_id)
    paper = await db.get(QuestionPaper, session.paper_id) if session else None

    explanation = await explain_answer(
        question_text=question.question_text,
        question_type=question.question_type.value,
        topic=question.topic,
        subject=paper.subject if paper else "General",
        board=paper.board if paper else "CBSE",
        class_grade=paper.class_grade if paper else 10,
        student_answer=student_answer.answer_text,
        model_answer=question.model_answer,
        marks_obtained=question_eval.marks_obtained,
        marks_possible=question_eval.marks_possible,
        feedback=question_eval.feedback,
    )

    if explanation is None:
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable. Please set ANTHROPIC_API_KEY.",
        )

    return ExplainResponseSchema(
        explanation=explanation.explanation,
        key_concept=explanation.key_concept,
        common_mistake=explanation.common_mistake,
        study_tip=explanation.study_tip,
    )


@router.post("/chat")
async def chat_endpoint(
    data: ChatRequest,
    user: User = Depends(get_current_user),
):
    """Conversational AI tutor with streaming response (SSE)."""

    async def event_stream():
        async for chunk in chat(
            message=data.message,
            subject=data.subject,
            board=data.board,
            class_grade=data.class_grade,
            conversation_history=data.conversation_history,
        ):
            # Format as SSE
            yield f"data: {json.dumps({'text': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
