"""
Learning Plan Generator - Creates personalized study plans from evaluation data.

Uses AI to generate personalized study recommendations based on specific wrong answers,
with spaced repetition scheduling for topic review.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.evaluation import Evaluation, QuestionEvaluation
from ..models.learning import (
    LearningPlan, LearningObjective, TopicMastery,
    MasteryLevel, ObjectiveStatus,
)
from ..models.exam import ExamSession, StudentAnswer, PaperQuestion, Question
from .ai_service import ai_service

logger = logging.getLogger(__name__)


# ── Pydantic models for AI-generated resources ──


class StudyResource(BaseModel):
    type: str = Field(description="Resource type: concept, practice, video, experiment, revision")
    title: str
    description: str = ""
    priority: int = Field(ge=1, le=5, default=3, description="1=highest priority")


class TopicStudyPlan(BaseModel):
    topic: str
    misconceptions: list[str] = []
    resources: list[StudyResource]
    estimated_hours: float = Field(ge=0.5, default=2.0)
    study_approach: str = ""


class AILearningPlan(BaseModel):
    topics: list[TopicStudyPlan]
    overall_strategy: str = ""
    motivational_note: str = ""


# ── Spaced Repetition ──

# Intervals in days based on mastery level
SPACED_REPETITION_INTERVALS = {
    MasteryLevel.NOT_STARTED: 1,
    MasteryLevel.BEGINNER: 2,
    MasteryLevel.DEVELOPING: 4,
    MasteryLevel.PROFICIENT: 7,
    MasteryLevel.MASTERED: 14,
}


def get_mastery_from_score(score_pct: float) -> MasteryLevel:
    """Convert score percentage to mastery level."""
    if score_pct >= 90:
        return MasteryLevel.MASTERED
    elif score_pct >= 70:
        return MasteryLevel.PROFICIENT
    elif score_pct >= 50:
        return MasteryLevel.DEVELOPING
    elif score_pct > 0:
        return MasteryLevel.BEGINNER
    return MasteryLevel.NOT_STARTED


def calculate_next_review_date(mastery_level: MasteryLevel, last_reviewed: Optional[datetime] = None) -> datetime:
    """Calculate next review date based on spaced repetition and mastery level."""
    interval_days = SPACED_REPETITION_INTERVALS.get(mastery_level, 7)
    base_date = last_reviewed or datetime.now(timezone.utc)
    return base_date + timedelta(days=interval_days)


async def _generate_ai_resources(
    subject: str,
    board: str,
    class_grade: int,
    weak_topics: list[tuple[str, float, float]],
    wrong_answers_context: Optional[str] = None,
) -> Optional[AILearningPlan]:
    """Use AI to generate personalized study resources for weak topics."""
    topics_str = "\n".join(
        f"- {topic}: current score {score:.0f}%, gap to target {gap:.0f}%"
        for topic, score, gap in weak_topics
    )

    prompt = f"""Create a personalized study plan for a Class {class_grade} {board} {subject} student.

## Weak Topics (sorted by priority)
{topics_str}

{f'## Analysis of Wrong Answers{chr(10)}{wrong_answers_context}' if wrong_answers_context else ''}

For each topic, provide:
1. Specific misconceptions the student likely has (based on their score pattern)
2. Study resources (concept review, practice problems, video recommendations, experiments)
3. Estimated study hours needed
4. Recommended study approach

Also provide:
- An overall learning strategy
- A motivational note for the student

Make resources specific to {board} Class {class_grade} {subject} syllabus.
Keep recommendations practical and actionable."""

    system = (
        f"You are an expert {board} {subject} tutor for Class {class_grade}. "
        "You create personalized study plans that address specific learning gaps. "
        "Your recommendations are practical, specific to the Indian school curriculum, "
        "and encouraging."
    )

    return await ai_service.generate_structured(
        prompt,
        AILearningPlan,
        system=system,
        temperature=0.5,
    )


def _get_fallback_resources(subject: str, topic: str) -> list[dict]:
    """Fallback resources when AI is unavailable."""
    return [
        {"type": "concept", "title": f"Review {topic} fundamentals from your {subject} textbook", "description": "", "priority": 1},
        {"type": "practice", "title": f"Solve practice problems on {topic}", "description": "", "priority": 2},
        {"type": "revision", "title": f"Revise key formulas and definitions for {topic}", "description": "", "priority": 3},
    ]


async def _get_wrong_answers_context(
    db: AsyncSession,
    student_id: int,
    limit: int = 20,
) -> Optional[str]:
    """Fetch recent wrong answers to provide context for AI-generated study plans."""
    result = await db.execute(
        select(QuestionEvaluation, StudentAnswer, Question)
        .join(StudentAnswer, QuestionEvaluation.student_answer_id == StudentAnswer.id)
        .join(PaperQuestion, StudentAnswer.paper_question_id == PaperQuestion.id)
        .join(Question, PaperQuestion.question_id == Question.id)
        .join(ExamSession, StudentAnswer.session_id == ExamSession.id)
        .where(
            ExamSession.student_id == student_id,
            QuestionEvaluation.marks_obtained < QuestionEvaluation.marks_possible * 0.5,
        )
        .order_by(QuestionEvaluation.id.desc())
        .limit(limit)
    )
    rows = result.all()

    if not rows:
        return None

    context_parts = []
    for qe, sa, q in rows:
        context_parts.append(
            f"- Topic: {q.topic} | Question: {q.question_text[:100]}... | "
            f"Score: {qe.marks_obtained}/{qe.marks_possible} | "
            f"Feedback: {qe.feedback or 'N/A'}"
        )

    return "\n".join(context_parts)


async def generate_learning_plan(
    db: AsyncSession,
    student_id: int,
    subject: str,
    board: str,
    class_grade: int,
    target_score: float = 90.0,
    target_date: Optional[datetime] = None,
) -> LearningPlan:
    """Generate a personalized learning plan based on evaluation history."""

    # Fetch recent evaluations for this subject
    result = await db.execute(
        select(Evaluation)
        .join(ExamSession, Evaluation.session_id == ExamSession.id)
        .where(ExamSession.student_id == student_id)
        .order_by(Evaluation.evaluated_at.desc())
        .limit(5)
    )
    evaluations = result.scalars().all()

    # Aggregate topic scores across evaluations
    topic_analysis = {}
    current_avg = 0.0

    for eval_ in evaluations:
        if eval_.topic_scores:
            for topic, scores in eval_.topic_scores.items():
                if topic not in topic_analysis:
                    topic_analysis[topic] = {"total_obtained": 0, "total_possible": 0}
                topic_analysis[topic]["total_obtained"] += scores.get("obtained", 0)
                topic_analysis[topic]["total_possible"] += scores.get("total", 0)
        current_avg = max(current_avg, eval_.percentage or 0)

    # Identify weak topics (below target) and sort by priority
    weak_topics = []
    for topic, scores in topic_analysis.items():
        if scores["total_possible"] > 0:
            pct = (scores["total_obtained"] / scores["total_possible"]) * 100
            if pct < target_score:
                weak_topics.append((topic, pct, target_score - pct))

    # Sort by gap (highest gap = highest priority)
    weak_topics.sort(key=lambda x: x[2], reverse=True)

    # If no evaluation data, create a general plan
    if not weak_topics:
        weak_topics = [(subject, 0, 100)]

    # Try AI-generated resources first
    wrong_answers_context = await _get_wrong_answers_context(db, student_id)
    ai_plan = await _generate_ai_resources(
        subject, board, class_grade, weak_topics, wrong_answers_context
    )

    # Estimate study hours
    if ai_plan:
        estimated_hours = sum(tp.estimated_hours for tp in ai_plan.topics)
    else:
        estimated_hours = sum(gap * 0.5 for _, _, gap in weak_topics)

    if not target_date:
        target_date = datetime.now(timezone.utc) + timedelta(days=30)

    # Build description
    description_parts = [
        f"Personalized study plan targeting {target_score}% in {subject}.",
        f"Focus areas: {', '.join(t[0] for t in weak_topics[:5])}.",
    ]
    if ai_plan and ai_plan.overall_strategy:
        description_parts.append(ai_plan.overall_strategy)

    # Create the plan
    plan = LearningPlan(
        student_id=student_id,
        subject=subject,
        board=board,
        class_grade=class_grade,
        title=f"{subject} Improvement Plan - {board} Class {class_grade}",
        description=" ".join(description_parts),
        focus_areas=[t[0] for t in weak_topics],
        target_score=target_score,
        current_score=current_avg,
        estimated_hours=round(estimated_hours, 1),
        start_date=datetime.now(timezone.utc),
        target_date=target_date,
    )
    db.add(plan)
    await db.flush()

    # Create objectives for each weak topic
    ai_topic_map = {}
    if ai_plan:
        ai_topic_map = {tp.topic.lower(): tp for tp in ai_plan.topics}

    for i, (topic, current_pct, gap) in enumerate(weak_topics):
        mastery = get_mastery_from_score(current_pct)

        # Try to find AI-generated resources for this topic
        ai_topic = ai_topic_map.get(topic.lower())

        if ai_topic:
            resources = [r.model_dump() for r in ai_topic.resources]
            description = ai_topic.study_approach or f"Improve {topic} from {current_pct:.0f}% to {target_score:.0f}%"
        else:
            resources = _get_fallback_resources(subject, topic)
            description = f"Improve {topic} from {current_pct:.0f}% to {target_score:.0f}%"

        objective = LearningObjective(
            plan_id=plan.id,
            topic=topic,
            description=description,
            priority=i + 1,
            status=ObjectiveStatus.PENDING,
            resources=resources,
            target_mastery=MasteryLevel.PROFICIENT if gap < 30 else MasteryLevel.MASTERED,
            current_mastery=mastery,
            order=i,
        )
        db.add(objective)

    await db.flush()
    return plan


async def update_topic_mastery(
    db: AsyncSession,
    student_id: int,
    subject: str,
    topic: str,
    board: str,
    class_grade: int,
    score_pct: float,
    exam_name: str = "",
) -> TopicMastery:
    """Update or create topic mastery record for a student."""
    result = await db.execute(
        select(TopicMastery).where(
            TopicMastery.student_id == student_id,
            TopicMastery.subject == subject,
            TopicMastery.topic == topic,
        )
    )
    mastery = result.scalar_one_or_none()

    if mastery:
        # Update existing
        history = mastery.score_history or []
        history.append({
            "date": datetime.now(timezone.utc).isoformat(),
            "score": score_pct,
            "exam": exam_name,
        })
        mastery.score_history = history
        mastery.total_attempts += 1
        mastery.last_score_pct = score_pct
        mastery.avg_score_pct = round(
            sum(h["score"] for h in history) / len(history), 1
        )
        mastery.mastery_level = get_mastery_from_score(mastery.avg_score_pct)

        # Calculate trend
        if len(history) >= 2:
            recent = [h["score"] for h in history[-3:]]
            if recent[-1] > recent[0]:
                mastery.trend = "improving"
            elif recent[-1] < recent[0]:
                mastery.trend = "declining"
            else:
                mastery.trend = "stable"
    else:
        mastery = TopicMastery(
            student_id=student_id,
            subject=subject,
            topic=topic,
            board=board,
            class_grade=class_grade,
            mastery_level=get_mastery_from_score(score_pct),
            score_history=[{
                "date": datetime.now(timezone.utc).isoformat(),
                "score": score_pct,
                "exam": exam_name,
            }],
            total_attempts=1,
            avg_score_pct=score_pct,
            last_score_pct=score_pct,
        )
        db.add(mastery)

    await db.flush()
    return mastery


async def get_topics_due_for_review(
    db: AsyncSession,
    student_id: int,
    subject: Optional[str] = None,
) -> list[dict]:
    """Get topics that are due for review based on spaced repetition scheduling."""
    query = select(TopicMastery).where(TopicMastery.student_id == student_id)
    if subject:
        query = query.where(TopicMastery.subject == subject)

    result = await db.execute(query)
    masteries = result.scalars().all()

    due_topics = []
    now = datetime.now(timezone.utc)

    for mastery in masteries:
        last_reviewed = mastery.updated_at or now
        next_review = calculate_next_review_date(mastery.mastery_level, last_reviewed)

        if next_review <= now:
            due_topics.append({
                "topic": mastery.topic,
                "subject": mastery.subject,
                "board": mastery.board,
                "class_grade": mastery.class_grade,
                "mastery_level": mastery.mastery_level.value,
                "avg_score_pct": mastery.avg_score_pct,
                "last_score_pct": mastery.last_score_pct,
                "trend": mastery.trend,
                "days_overdue": (now - next_review).days,
                "next_review_date": next_review.isoformat(),
            })

    # Sort by overdue days (most overdue first)
    due_topics.sort(key=lambda x: x["days_overdue"], reverse=True)
    return due_topics


async def generate_practice_set(
    db: AsyncSession,
    student_id: int,
    subject: Optional[str] = None,
    topic: Optional[str] = None,
    count: int = 10,
) -> list[dict]:
    """
    Generate a targeted practice quiz from weak topics.

    Selects questions from the question bank that match the student's weak areas.
    """
    # Find weak topics if not specified
    if not topic:
        query = (
            select(TopicMastery)
            .where(TopicMastery.student_id == student_id)
            .order_by(TopicMastery.avg_score_pct.asc())
            .limit(3)
        )
        if subject:
            query = query.where(TopicMastery.subject == subject)

        result = await db.execute(query)
        weak_masteries = result.scalars().all()
        weak_topic_names = [m.topic for m in weak_masteries]
    else:
        weak_topic_names = [topic]

    if not weak_topic_names:
        return []

    # Fetch questions matching weak topics
    from ..models.exam import Question as QuestionModel
    questions_query = (
        select(QuestionModel)
        .where(
            QuestionModel.is_active == True,
            QuestionModel.topic.in_(weak_topic_names),
        )
        .order_by(QuestionModel.avg_score_pct.asc().nullslast())
        .limit(count)
    )

    result = await db.execute(questions_query)
    questions = result.scalars().all()

    return [
        {
            "id": q.id,
            "question_type": q.question_type.value,
            "question_text": q.question_text,
            "marks": q.marks,
            "difficulty": q.difficulty.value,
            "blooms_level": q.blooms_level.value,
            "topic": q.topic,
            "subtopic": q.subtopic,
            "mcq_options": q.mcq_options,
        }
        for q in questions
    ]
