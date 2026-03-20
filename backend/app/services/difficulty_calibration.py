"""
Difficulty Calibration Service.

Computes empirical difficulty from historical StudentAnswer data and
compares with the assigned difficulty to detect mismatches.
"""

import logging
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.exam import (
    Question, QuestionBank, PaperQuestion, StudentAnswer,
)
from ..models.evaluation import QuestionEvaluation
from ..schemas.taxonomy import DifficultyCalibrationResponse

logger = logging.getLogger(__name__)


async def calibrate_difficulty(
    db: AsyncSession,
    question_id: int,
) -> Optional[DifficultyCalibrationResponse]:
    """
    Compute empirical difficulty for a single question from StudentAnswer data.

    FK chain: StudentAnswer -> PaperQuestion -> Question
    Also joins QuestionEvaluation (via student_answer_id) for marks_obtained/marks_possible.

    Returns None if no student attempts exist.
    """
    question = await db.get(Question, question_id)
    if not question:
        return None

    # Query: StudentAnswer -> PaperQuestion (question_id matches) -> QuestionEvaluation
    eval_query = (
        select(
            QuestionEvaluation.marks_obtained,
            QuestionEvaluation.marks_possible,
        )
        .join(StudentAnswer, QuestionEvaluation.student_answer_id == StudentAnswer.id)
        .join(PaperQuestion, StudentAnswer.paper_question_id == PaperQuestion.id)
        .where(PaperQuestion.question_id == question_id)
    )
    result = await db.execute(eval_query)
    rows = result.all()

    if not rows:
        return None

    # Compute empirical difficulty
    scores = []
    for marks_obtained, marks_possible in rows:
        if marks_possible and marks_possible > 0:
            scores.append(marks_obtained / marks_possible)

    if not scores:
        return None

    sample_size = len(scores)
    avg_score_pct = sum(scores) / len(scores)

    # Determine empirical difficulty
    if avg_score_pct >= 0.75:
        empirical_difficulty = "easy"
    elif avg_score_pct >= 0.45:
        empirical_difficulty = "medium"
    else:
        empirical_difficulty = "hard"

    # Determine confidence based on sample size
    if sample_size < 5:
        confidence = "low"
    elif sample_size <= 20:
        confidence = "medium"
    else:
        confidence = "high"

    # Check for mismatch
    assigned_difficulty = question.difficulty.value if question.difficulty else "medium"
    mismatch = assigned_difficulty != empirical_difficulty

    mismatch_direction = None
    if mismatch:
        difficulty_order = {"easy": 0, "medium": 1, "hard": 2}
        assigned_rank = difficulty_order.get(assigned_difficulty, 1)
        empirical_rank = difficulty_order.get(empirical_difficulty, 1)
        if empirical_rank < assigned_rank:
            mismatch_direction = "easier_than_marked"
        else:
            mismatch_direction = "harder_than_marked"

    # Update the denormalized avg_score_pct on the Question model
    question.avg_score_pct = avg_score_pct * 100  # Store as percentage
    await db.flush()

    return DifficultyCalibrationResponse(
        question_id=question_id,
        assigned_difficulty=assigned_difficulty,
        empirical_difficulty=empirical_difficulty,
        empirical_score=avg_score_pct,
        sample_size=sample_size,
        confidence=confidence,
        mismatch=mismatch,
        mismatch_direction=mismatch_direction,
    )


async def calibrate_bank(
    db: AsyncSession,
    bank_id: int,
) -> list[DifficultyCalibrationResponse]:
    """
    Calibrate all questions in a bank that have student answer data.

    Returns list of calibrations sorted by mismatch severity (mismatches first).
    """
    # Get all active question IDs in this bank
    questions_result = await db.execute(
        select(Question.id).where(
            Question.bank_id == bank_id,
            Question.is_active == True,
        )
    )
    question_ids = [row[0] for row in questions_result.all()]

    if not question_ids:
        return []

    # Find which questions have student answer data
    questions_with_data = await db.execute(
        select(PaperQuestion.question_id)
        .join(StudentAnswer, StudentAnswer.paper_question_id == PaperQuestion.id)
        .where(PaperQuestion.question_id.in_(question_ids))
        .distinct()
    )
    answered_question_ids = [row[0] for row in questions_with_data.all()]

    calibrations = []
    for q_id in answered_question_ids:
        calibration = await calibrate_difficulty(db, q_id)
        if calibration:
            calibrations.append(calibration)

    # Sort: mismatches first, then by empirical_score ascending (hardest first)
    calibrations.sort(key=lambda c: (not c.mismatch, c.empirical_score))

    return calibrations
