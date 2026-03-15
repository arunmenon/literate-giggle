"""Evaluation routes (Assessment)."""

from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...core.database import get_db
from ...models.user import User
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
from ..deps import get_current_user, require_teacher_or_admin

router = APIRouter(prefix="/evaluations", tags=["Evaluation (Assessment)"])


@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_session(
    data: EvaluateSessionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Evaluate a submitted exam session."""
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

    # Evaluate each answer
    total_obtained = 0.0
    total_possible = 0.0
    topic_scores = defaultdict(lambda: {"obtained": 0, "total": 0})
    blooms_scores = defaultdict(lambda: {"obtained": 0, "total": 0})
    difficulty_scores = defaultdict(lambda: {"obtained": 0, "total": 0})

    # Create evaluation record
    evaluation = Evaluation(
        session_id=session.id,
        total_marks_obtained=0,
        total_marks_possible=0,
        percentage=0,
        evaluated_by=data.method,
    )
    db.add(evaluation)
    await db.flush()

    for answer in session.answers:
        # Load the paper question and actual question
        pq = await db.get(PaperQuestion, answer.paper_question_id)
        if not pq:
            continue
        question = await db.get(Question, pq.question_id)
        if not question:
            continue

        marks_possible = pq.marks_override or question.marks

        # Evaluate - try AI first for "ai"/"hybrid" methods, fallback to rubric
        eval_result = None
        if data.method in ("ai", "hybrid"):
            eval_result = await evaluate_with_ai(
                question, answer,
                board=paper.board, subject=paper.subject,
                class_grade=paper.class_grade,
            )

        # Fallback to rule-based evaluation
        if eval_result is None:
            eval_result = evaluate_question(question, answer)

        # Scale marks if override
        if pq.marks_override and question.marks > 0:
            scale = pq.marks_override / question.marks
            eval_result["marks_obtained"] = round(
                eval_result["marks_obtained"] * scale, 1
            )
        eval_result["marks_possible"] = marks_possible

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
        )
        db.add(qe)

        # Update question stats
        question.times_used += 1

    # Calculate analytics
    percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
    grade = calculate_grade(percentage)

    # Convert blooms/difficulty to percentages
    blooms_pcts = {
        k: round(v["obtained"] / v["total"] * 100, 1) if v["total"] > 0 else 0
        for k, v in blooms_scores.items()
    }
    difficulty_pcts = {
        k: round(v["obtained"] / v["total"] * 100, 1) if v["total"] > 0 else 0
        for k, v in difficulty_scores.items()
    }

    # Identify strengths/weaknesses
    topic_pcts = {
        k: round(v["obtained"] / v["total"] * 100, 1) if v["total"] > 0 else 0
        for k, v in topic_scores.items()
    }
    strengths = [t for t, p in topic_pcts.items() if p >= 70]
    weaknesses = [t for t, p in topic_pcts.items() if p < 50]

    # Try AI recommendations first, fallback to rule-based
    recommendations = None
    if data.method in ("ai", "hybrid"):
        recommendations = await generate_ai_recommendations(
            dict(topic_scores), blooms_pcts, difficulty_pcts,
            paper.subject, paper.board, paper.class_grade,
        )
    if recommendations is None:
        recommendations = generate_recommendations(
            dict(topic_scores), blooms_pcts, difficulty_pcts
        )

    # Update evaluation
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
    session.status = ExamSessionStatus.EVALUATED
    session.total_score = round(total_obtained, 1)
    session.percentage = round(percentage, 1)
    session.grade = grade

    # Update topic mastery for the student
    for topic, scores in topic_scores.items():
        if scores["total"] > 0:
            topic_pct = (scores["obtained"] / scores["total"]) * 100
            await update_topic_mastery(
                db, session.student_id, paper.subject, topic,
                paper.board, paper.class_grade, topic_pct, paper.title,
            )

    await db.flush()

    # Build response
    qe_result = await db.execute(
        select(QuestionEvaluation)
        .where(QuestionEvaluation.evaluation_id == evaluation.id)
    )
    qe_list = qe_result.scalars().all()

    qe_responses = []
    for qe in qe_list:
        sa = await db.get(StudentAnswer, qe.student_answer_id)
        pq = await db.get(PaperQuestion, sa.paper_question_id) if sa else None
        q = await db.get(Question, pq.question_id) if pq else None

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


@router.get("/{evaluation_id}", response_model=EvaluationResponse)
async def get_evaluation(
    evaluation_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get evaluation details."""
    evaluation = await db.get(Evaluation, evaluation_id)
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    qe_result = await db.execute(
        select(QuestionEvaluation)
        .where(QuestionEvaluation.evaluation_id == evaluation.id)
    )
    qe_list = qe_result.scalars().all()

    qe_responses = []
    for qe in qe_list:
        sa = await db.get(StudentAnswer, qe.student_answer_id)
        pq = await db.get(PaperQuestion, sa.paper_question_id) if sa else None
        q = await db.get(Question, pq.question_id) if pq else None
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
