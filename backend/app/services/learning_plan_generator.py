"""
Learning Plan Generator - Creates personalized study plans from evaluation data.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.evaluation import Evaluation
from ..models.learning import (
    LearningPlan, LearningObjective, TopicMastery,
    MasteryLevel, ObjectiveStatus,
)
from ..models.exam import ExamSession


# CBSE/ICSE curriculum topics by subject (extensible)
CURRICULUM_RESOURCES = {
    "Mathematics": {
        "Algebra": [
            {"type": "concept", "title": "Review algebraic identities and equations"},
            {"type": "practice", "title": "Solve 20 practice problems daily"},
            {"type": "video", "title": "Khan Academy - Algebra fundamentals"},
        ],
        "Geometry": [
            {"type": "concept", "title": "Review theorems and proofs"},
            {"type": "practice", "title": "Practice constructions and proofs"},
            {"type": "video", "title": "Geometry visualization exercises"},
        ],
        "Trigonometry": [
            {"type": "concept", "title": "Memorize trigonometric ratios and identities"},
            {"type": "practice", "title": "Solve height and distance problems"},
        ],
        "Statistics": [
            {"type": "concept", "title": "Review mean, median, mode concepts"},
            {"type": "practice", "title": "Practice data interpretation questions"},
        ],
    },
    "Science": {
        "Physics": [
            {"type": "concept", "title": "Review formulas and laws"},
            {"type": "practice", "title": "Solve numerical problems"},
            {"type": "experiment", "title": "Review lab experiments"},
        ],
        "Chemistry": [
            {"type": "concept", "title": "Review reactions and equations"},
            {"type": "practice", "title": "Practice balancing equations"},
        ],
        "Biology": [
            {"type": "concept", "title": "Review diagrams and processes"},
            {"type": "practice", "title": "Practice labeling diagrams"},
        ],
    },
    "English": {
        "Grammar": [
            {"type": "concept", "title": "Review grammar rules"},
            {"type": "practice", "title": "Daily grammar exercises"},
        ],
        "Writing": [
            {"type": "concept", "title": "Study essay structures"},
            {"type": "practice", "title": "Write one essay daily"},
        ],
        "Literature": [
            {"type": "concept", "title": "Review character analysis techniques"},
            {"type": "practice", "title": "Practice comprehension passages"},
        ],
    },
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


def get_resources_for_topic(subject: str, topic: str) -> list[dict]:
    """Get learning resources for a topic."""
    subject_resources = CURRICULUM_RESOURCES.get(subject, {})
    # Try exact match first, then partial match
    resources = subject_resources.get(topic)
    if not resources:
        for key, val in subject_resources.items():
            if key.lower() in topic.lower() or topic.lower() in key.lower():
                resources = val
                break
    return resources or [
        {"type": "concept", "title": f"Review {topic} fundamentals"},
        {"type": "practice", "title": f"Practice {topic} questions"},
    ]


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
        subject_topics = CURRICULUM_RESOURCES.get(subject, {})
        weak_topics = [(topic, 0, 100) for topic in subject_topics.keys()]

    # Estimate study hours
    estimated_hours = sum(gap * 0.5 for _, _, gap in weak_topics)
    if not target_date:
        target_date = datetime.now(timezone.utc) + timedelta(days=30)

    # Create the plan
    plan = LearningPlan(
        student_id=student_id,
        subject=subject,
        board=board,
        class_grade=class_grade,
        title=f"{subject} Improvement Plan - {board} Class {class_grade}",
        description=(
            f"Personalized study plan targeting {target_score}% in {subject}. "
            f"Focus areas: {', '.join(t[0] for t in weak_topics[:5])}."
        ),
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
    for i, (topic, current_pct, gap) in enumerate(weak_topics):
        resources = get_resources_for_topic(subject, topic)
        mastery = get_mastery_from_score(current_pct)

        objective = LearningObjective(
            plan_id=plan.id,
            topic=topic,
            description=f"Improve {topic} from {current_pct:.0f}% to {target_score:.0f}%",
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
