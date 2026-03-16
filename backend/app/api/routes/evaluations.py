"""Evaluation routes (Assessment) -- AI-First."""

import json
from collections import defaultdict
from typing import Optional, Callable, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...core.database import get_db, async_session
from ...models.user import User, UserRole, StudentProfile
from ...models.exam import (
    ExamSession, ExamSessionStatus, StudentAnswer,
    PaperQuestion, Question, QuestionPaper,
)
from ...models.evaluation import Evaluation, QuestionEvaluation
from ...schemas.evaluation import (
    EvaluateSessionRequest, EvaluationResponse,
    QuestionEvaluationResponse, EvaluationSummary,
)
from ...services.evaluation_engine import (
    evaluate_question, calculate_grade, generate_recommendations,
)
from ...services.ai_evaluator import evaluate_with_ai, generate_ai_recommendations
from ...services.learning_plan_generator import update_topic_mastery
from ...models.workspace import WorkspaceMember
from ..deps import get_current_user, require_teacher_or_admin, get_current_workspace

router = APIRouter(prefix="/evaluations", tags=["Evaluation (Assessment)"])


async def _evaluate_single_answer(
    question: Question,
    answer: StudentAnswer,
    paper: QuestionPaper,
    method: str,
) -> dict:
    """Evaluate a single answer, trying AI first and falling back to rubric."""
    eval_result = None
    evaluation_method = "rubric"

    # AI-first: try AI evaluation for all non-rubric methods (ai is default)
    if method in ("ai", "hybrid"):
        eval_result = await evaluate_with_ai(
            question, answer,
            board=paper.board, subject=paper.subject,
            class_grade=paper.class_grade,
        )
        if eval_result is not None:
            evaluation_method = "ai"

    # Fallback to rule-based evaluation
    if eval_result is None:
        eval_result = evaluate_question(question, answer)
        evaluation_method = "rubric"

    # Ensure evaluation_method is set
    if "evaluation_method" not in eval_result:
        eval_result["evaluation_method"] = evaluation_method

    # Ensure confidence is set
    if "confidence" not in eval_result:
        eval_result["confidence"] = 1.0 if evaluation_method == "rubric" else 0.8

    return eval_result


async def _run_evaluation(
    db: AsyncSession,
    session_id: int,
    student_id: int,
    paper: QuestionPaper,
    answers: list[dict],
    method: str,
    is_practice: bool,
    on_progress: Optional[Callable] = None,
) -> Evaluation:
    """
    Shared evaluation logic for both sync and streaming endpoints.

    Args:
        db: Database session
        session_id: ExamSession ID
        student_id: Student profile ID
        paper: The QuestionPaper being evaluated
        answers: List of dicts with keys: id, paper_question_id, hint_count
        method: Evaluation method ("ai", "rubric", "hybrid")
        is_practice: Whether this is a practice exam
        on_progress: Optional async callback for streaming progress events.
            Called with (event_type, event_data) where event_type is
            "progress" or "question_result".
    """
    total_questions = len(answers)

    # -- Batch pre-fetch PaperQuestions and Questions to avoid N+1 --
    pq_ids = [a["paper_question_id"] for a in answers]
    pq_result = await db.execute(
        select(PaperQuestion).where(PaperQuestion.id.in_(pq_ids))
    )
    pq_map = {pq.id: pq for pq in pq_result.scalars().all()}

    q_ids = [pq.question_id for pq in pq_map.values()]
    q_result = await db.execute(
        select(Question).where(Question.id.in_(q_ids))
    )
    q_map = {q.id: q for q in q_result.scalars().all()}

    # Batch-load StudentAnswer objects
    answer_ids = [a["id"] for a in answers]
    sa_result = await db.execute(
        select(StudentAnswer).where(StudentAnswer.id.in_(answer_ids))
    )
    sa_map = {sa.id: sa for sa in sa_result.scalars().all()}

    # Initialize accumulators
    total_obtained = 0.0
    total_possible = 0.0
    topic_scores = defaultdict(lambda: {"obtained": 0, "total": 0})
    blooms_scores = defaultdict(lambda: {"obtained": 0, "total": 0})
    difficulty_scores = defaultdict(lambda: {"obtained": 0, "total": 0})

    # Create evaluation record
    evaluation = Evaluation(
        session_id=session_id,
        total_marks_obtained=0,
        total_marks_possible=0,
        percentage=0,
        evaluated_by=method,
    )
    db.add(evaluation)
    await db.flush()

    for idx, ans_info in enumerate(answers, 1):
        pq = pq_map.get(ans_info["paper_question_id"])
        if not pq:
            continue
        question = q_map.get(pq.question_id)
        if not question:
            continue
        answer = sa_map.get(ans_info["id"])
        if not answer:
            continue

        marks_possible = pq.marks_override or question.marks

        # Emit progress event before evaluation
        if on_progress:
            await on_progress("progress", {
                "type": "progress",
                "question_number": idx,
                "total_questions": total_questions,
                "question_text": question.question_text[:100],
                "status": "evaluating",
            })

        # Evaluate with AI-first pattern
        eval_result = await _evaluate_single_answer(question, answer, paper, method)

        # Scale marks if override
        if pq.marks_override and question.marks > 0:
            scale = pq.marks_override / question.marks
            eval_result["marks_obtained"] = round(
                eval_result["marks_obtained"] * scale, 1
            )
        eval_result["marks_possible"] = marks_possible

        # Apply hint penalty for practice exams
        hint_count = ans_info.get("hint_count", 0) or 0
        if hint_count > 0 and is_practice:
            penalty_pct = min(hint_count * 10.0, 50.0) / 100.0
            eval_result["marks_obtained"] = round(
                eval_result["marks_obtained"] * (1 - penalty_pct), 1
            )

        total_obtained += eval_result["marks_obtained"]
        total_possible += marks_possible

        # Track by topic, blooms, difficulty
        topic_scores[question.topic]["obtained"] += eval_result["marks_obtained"]
        topic_scores[question.topic]["total"] += marks_possible
        blooms_scores[question.blooms_level.value]["obtained"] += eval_result["marks_obtained"]
        blooms_scores[question.blooms_level.value]["total"] += marks_possible
        difficulty_scores[question.difficulty.value]["obtained"] += eval_result["marks_obtained"]
        difficulty_scores[question.difficulty.value]["total"] += marks_possible

        # Create question evaluation
        qe = QuestionEvaluation(
            evaluation_id=evaluation.id,
            student_answer_id=answer.id,
            marks_obtained=eval_result["marks_obtained"],
            marks_possible=marks_possible,
            feedback=eval_result.get("feedback"),
            rubric_scores=eval_result.get("rubric_scores"),
            keywords_found=eval_result.get("keywords_found"),
            keywords_missing=eval_result.get("keywords_missing"),
            step_scores=eval_result.get("step_scores"),
            improvement_hint=eval_result.get("improvement_hint"),
            model_answer_comparison=eval_result.get("model_answer_comparison"),
            confidence=eval_result.get("confidence"),
            evaluation_method=eval_result.get("evaluation_method"),
        )
        db.add(qe)

        # Update question stats
        question.times_used += 1

        # Emit result event after evaluation
        if on_progress:
            await on_progress("question_result", {
                "type": "question_result",
                "question_number": idx,
                "marks_obtained": eval_result["marks_obtained"],
                "marks_possible": marks_possible,
                "evaluation_method": eval_result.get("evaluation_method", "rubric"),
                "feedback": eval_result.get("feedback", ""),
            })

    # Calculate analytics
    percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
    grade = calculate_grade(percentage)

    blooms_pcts = {
        k: round(v["obtained"] / v["total"] * 100, 1) if v["total"] > 0 else 0
        for k, v in blooms_scores.items()
    }
    difficulty_pcts = {
        k: round(v["obtained"] / v["total"] * 100, 1) if v["total"] > 0 else 0
        for k, v in difficulty_scores.items()
    }

    topic_pcts = {
        k: round(v["obtained"] / v["total"] * 100, 1) if v["total"] > 0 else 0
        for k, v in topic_scores.items()
    }
    strengths = [t for t, p in topic_pcts.items() if p >= 70]
    weaknesses = [t for t, p in topic_pcts.items() if p < 50]

    # AI-first recommendations
    recommendations = await generate_ai_recommendations(
        dict(topic_scores), blooms_pcts, difficulty_pcts,
        paper.subject, paper.board, paper.class_grade,
    )
    if recommendations is None:
        recommendations = generate_recommendations(
            dict(topic_scores), blooms_pcts, difficulty_pcts
        )

    # Update evaluation record
    evaluation.total_marks_obtained = round(total_obtained, 1)
    evaluation.total_marks_possible = round(total_possible, 1)
    evaluation.percentage = round(percentage, 1)
    evaluation.grade = grade
    evaluation.topic_scores = dict(topic_scores)
    evaluation.blooms_scores = blooms_pcts
    evaluation.difficulty_scores = difficulty_pcts
    evaluation.strengths = strengths
    evaluation.weaknesses = weaknesses
    evaluation.recommendations = recommendations

    # Update session
    exam_session = await db.get(ExamSession, session_id)
    exam_session.status = ExamSessionStatus.EVALUATED
    exam_session.total_score = round(total_obtained, 1)
    exam_session.percentage = round(percentage, 1)
    exam_session.grade = grade

    # Update topic mastery for the student
    for topic, scores in topic_scores.items():
        if scores["total"] > 0:
            topic_pct = (scores["obtained"] / scores["total"]) * 100
            await update_topic_mastery(
                db, student_id, paper.subject, topic,
                paper.board, paper.class_grade, topic_pct, paper.title,
            )

    return evaluation


@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_session(
    data: EvaluateSessionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Evaluate a submitted exam session. AI evaluation is the default method."""
    # Load session with answers
    result = await db.execute(
        select(ExamSession)
        .options(selectinload(ExamSession.answers))
        .where(ExamSession.id == data.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status not in (
        ExamSessionStatus.SUBMITTED, ExamSessionStatus.AUTO_SUBMITTED
    ):
        raise HTTPException(status_code=400, detail="Session has not been submitted")

    # Check if already evaluated
    existing_result = await db.execute(
        select(Evaluation).where(Evaluation.session_id == session.id)
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Session already evaluated")

    # Load paper info
    paper = await db.get(QuestionPaper, session.paper_id)

    # Build answer data list
    answer_data = [
        {"id": a.id, "paper_question_id": a.paper_question_id,
         "hint_count": a.hint_count or 0}
        for a in session.answers
    ]

    evaluation = await _run_evaluation(
        db, session.id, session.student_id, paper, answer_data,
        data.method, session.is_practice,
    )

    await db.flush()

    return await _build_evaluation_response(db, evaluation)


@router.post("/evaluate/stream")
async def evaluate_session_stream(
    data: EvaluateSessionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Evaluate a submitted exam session with streaming progress via SSE.

    Streams per-question evaluation progress so the frontend can show
    "Evaluating Q1... Q2... Q3..." in real-time.

    Uses its own DB session inside the generator since the FastAPI
    dependency lifecycle ends before the streaming generator runs.
    """
    # Validate before streaming (uses the dependency-injected session)
    result = await db.execute(
        select(ExamSession)
        .options(selectinload(ExamSession.answers))
        .where(ExamSession.id == data.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status not in (
        ExamSessionStatus.SUBMITTED, ExamSessionStatus.AUTO_SUBMITTED
    ):
        raise HTTPException(status_code=400, detail="Session has not been submitted")

    existing_result = await db.execute(
        select(Evaluation).where(Evaluation.session_id == session.id)
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Session already evaluated")

    # Capture IDs needed by the generator
    session_id = session.id
    paper_id = session.paper_id
    student_id = session.student_id
    is_practice = session.is_practice
    answer_data = [
        {"id": a.id, "paper_question_id": a.paper_question_id,
         "hint_count": a.hint_count or 0}
        for a in session.answers
    ]
    method = data.method

    async def evaluation_stream():
        # Use a fresh DB session inside the generator
        async with async_session() as stream_db:
            try:
                paper = await stream_db.get(QuestionPaper, paper_id)

                # SSE progress callback
                async def on_progress(event_type: str, event_data: dict):
                    # This is a closure; we yield from the outer generator
                    # by appending to a shared list that the loop reads.
                    # Instead, we use a different pattern: store events.
                    pass  # handled via wrapper below

                # We need to yield from within the generator, so we use
                # a list to collect events and yield after each question.
                events: list[str] = []

                async def collect_event(event_type: str, event_data: dict):
                    events.append(f"data: {json.dumps(event_data)}\n\n")

                evaluation = await _run_evaluation(
                    stream_db, session_id, student_id, paper, answer_data,
                    method, is_practice, on_progress=collect_event,
                )

                await stream_db.commit()

                # Yield all collected progress events
                for event in events:
                    yield event

                # Yield final completion event
                complete_event = {
                    "type": "complete",
                    "evaluation_id": evaluation.id,
                    "total_marks_obtained": evaluation.total_marks_obtained,
                    "total_marks_possible": evaluation.total_marks_possible,
                    "percentage": evaluation.percentage,
                    "grade": evaluation.grade,
                    "strengths": evaluation.strengths,
                    "weaknesses": evaluation.weaknesses,
                }
                yield f"data: {json.dumps(complete_event)}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                await stream_db.rollback()
                error_event = {"type": "error", "message": str(e)}
                yield f"data: {json.dumps(error_event)}\n\n"
                yield "data: [DONE]\n\n"

    return StreamingResponse(
        evaluation_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{evaluation_id}", response_model=EvaluationResponse)
async def get_evaluation(
    evaluation_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get evaluation details (ownership-checked)."""
    evaluation = await db.get(Evaluation, evaluation_id)
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # IDOR check: verify the user owns this evaluation's session or is a teacher in the same workspace
    session = await db.get(ExamSession, evaluation.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # Check if user is the student who owns the session
    student_result = await db.execute(
        select(StudentProfile).where(
            StudentProfile.user_id == user.id,
            StudentProfile.id == session.student_id,
        )
    )
    is_owner = student_result.scalar_one_or_none() is not None

    # Check if user is a teacher in the same workspace as the paper
    is_teacher_in_workspace = False
    if not is_owner and user.role in (UserRole.TEACHER, UserRole.ADMIN):
        paper = await db.get(QuestionPaper, session.paper_id)
        if paper and paper.workspace_id:
            ws_id = get_current_workspace(user)
            if ws_id and ws_id == paper.workspace_id:
                is_teacher_in_workspace = True

    if not is_owner and not is_teacher_in_workspace:
        raise HTTPException(status_code=403, detail="Access denied")

    return await _build_evaluation_response(db, evaluation)


@router.get("/paper/{paper_id}/summary", response_model=EvaluationSummary)
async def get_paper_evaluation_summary(
    paper_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_teacher_or_admin),
):
    """Get aggregate evaluation summary for a paper (teacher view)."""
    result = await db.execute(
        select(Evaluation)
        .join(ExamSession, Evaluation.session_id == ExamSession.id)
        .where(ExamSession.paper_id == paper_id)
    )
    evaluations = result.scalars().all()

    if not evaluations:
        raise HTTPException(status_code=404, detail="No evaluations found")

    percentages = [e.percentage for e in evaluations]
    grades = [e.grade for e in evaluations]

    # Aggregate topic analysis
    topic_analysis = defaultdict(lambda: {"total_obtained": 0, "total_possible": 0, "count": 0})
    for e in evaluations:
        if e.topic_scores:
            for topic, scores in e.topic_scores.items():
                topic_analysis[topic]["total_obtained"] += scores.get("obtained", 0)
                topic_analysis[topic]["total_possible"] += scores.get("total", 0)
                topic_analysis[topic]["count"] += 1

    topic_avgs = {
        t: round(s["total_obtained"] / s["total_possible"] * 100, 1)
        if s["total_possible"] > 0 else 0
        for t, s in topic_analysis.items()
    }

    # Difficulty analysis
    diff_analysis = defaultdict(lambda: {"total": 0, "count": 0})
    for e in evaluations:
        if e.difficulty_scores:
            for diff, pct in e.difficulty_scores.items():
                diff_analysis[diff]["total"] += pct
                diff_analysis[diff]["count"] += 1

    diff_avgs = {
        d: round(s["total"] / s["count"], 1) if s["count"] > 0 else 0
        for d, s in diff_analysis.items()
    }

    # Grade distribution
    grade_dist = defaultdict(int)
    for g in grades:
        grade_dist[g] += 1

    return EvaluationSummary(
        total_students=len(evaluations),
        average_score=round(sum(percentages) / len(percentages), 1),
        highest_score=max(percentages),
        lowest_score=min(percentages),
        pass_rate=round(
            sum(1 for p in percentages if p >= 33) / len(percentages) * 100, 1
        ),
        topic_analysis=topic_avgs,
        difficulty_analysis=diff_avgs,
        grade_distribution=dict(grade_dist),
    )


async def _build_evaluation_response(
    db: AsyncSession, evaluation: Evaluation
) -> EvaluationResponse:
    """Build a full EvaluationResponse from an Evaluation model."""
    # Batch-load all QuestionEvaluations with their StudentAnswers via selectinload
    qe_result = await db.execute(
        select(QuestionEvaluation)
        .options(selectinload(QuestionEvaluation.student_answer))
        .where(QuestionEvaluation.evaluation_id == evaluation.id)
    )
    qe_list = qe_result.scalars().all()

    # Batch-load all PaperQuestions and Questions needed
    pq_ids = [
        qe.student_answer.paper_question_id
        for qe in qe_list if qe.student_answer
    ]
    if pq_ids:
        pq_result = await db.execute(
            select(PaperQuestion).where(PaperQuestion.id.in_(pq_ids))
        )
        pq_map = {pq.id: pq for pq in pq_result.scalars().all()}
    else:
        pq_map = {}

    q_ids = [pq.question_id for pq in pq_map.values()]
    if q_ids:
        q_result = await db.execute(
            select(Question).where(Question.id.in_(q_ids))
        )
        q_map = {q.id: q for q in q_result.scalars().all()}
    else:
        q_map = {}

    qe_responses = []
    for qe in qe_list:
        sa = qe.student_answer
        pq = pq_map.get(sa.paper_question_id) if sa else None
        q = q_map.get(pq.question_id) if pq else None

        qe_responses.append(
            QuestionEvaluationResponse(
                id=qe.id,
                question_text=q.question_text if q else "",
                question_type=q.question_type.value if q else "",
                marks_obtained=qe.marks_obtained,
                marks_possible=qe.marks_possible,
                student_answer=sa.answer_text if sa else None,
                model_answer=q.model_answer if q else None,
                feedback=qe.feedback,
                keywords_found=qe.keywords_found,
                keywords_missing=qe.keywords_missing,
                improvement_hint=qe.improvement_hint,
                confidence=qe.confidence,
                evaluation_method=qe.evaluation_method,
            )
        )

    return EvaluationResponse(
        id=evaluation.id,
        session_id=evaluation.session_id,
        total_marks_obtained=evaluation.total_marks_obtained,
        total_marks_possible=evaluation.total_marks_possible,
        percentage=evaluation.percentage,
        grade=evaluation.grade,
        topic_scores=evaluation.topic_scores,
        blooms_scores=evaluation.blooms_scores,
        difficulty_scores=evaluation.difficulty_scores,
        strengths=evaluation.strengths,
        weaknesses=evaluation.weaknesses,
        recommendations=evaluation.recommendations,
        evaluated_by=evaluation.evaluated_by,
        evaluated_at=evaluation.evaluated_at,
        is_final=evaluation.is_final,
        question_evaluations=qe_responses,
    )
