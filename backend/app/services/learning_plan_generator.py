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
        "Polynomials": [
            {"type": "concept", "title": "Review zeroes and factorization of polynomials"},
            {"type": "practice", "title": "Practice finding zeroes and verifying relationships"},
        ],
        "Quadratic Equations": [
            {"type": "concept", "title": "Master factorization, completing square, and quadratic formula"},
            {"type": "practice", "title": "Solve discriminant-based and word problems"},
        ],
        "Arithmetic Progressions": [
            {"type": "concept", "title": "Review nth term and sum formulas"},
            {"type": "practice", "title": "Solve AP word problems from board papers"},
        ],
        "Linear Equations": [
            {"type": "concept", "title": "Review graphical and algebraic methods"},
            {"type": "practice", "title": "Practice consistency conditions and word problems"},
        ],
        "Coordinate Geometry": [
            {"type": "concept", "title": "Review distance, section, and area formulas"},
            {"type": "practice", "title": "Solve coordinate geometry numerical problems"},
        ],
        "Geometry": [
            {"type": "concept", "title": "Review theorems and proofs"},
            {"type": "practice", "title": "Practice constructions and proofs"},
            {"type": "video", "title": "Geometry visualization exercises"},
        ],
        "Triangles": [
            {"type": "concept", "title": "Review similarity and congruence theorems"},
            {"type": "practice", "title": "Practice BPT and Pythagoras theorem problems"},
        ],
        "Trigonometry": [
            {"type": "concept", "title": "Memorize trigonometric ratios and identities"},
            {"type": "practice", "title": "Solve height and distance problems"},
        ],
        "Statistics": [
            {"type": "concept", "title": "Review mean, median, mode for grouped data"},
            {"type": "practice", "title": "Practice data interpretation and ogive problems"},
        ],
        "Real Numbers": [
            {"type": "concept", "title": "Review Euclid's division and fundamental theorem of arithmetic"},
            {"type": "practice", "title": "Practice HCF, LCM, and irrationality proofs"},
        ],
        "Surface Areas and Volumes": [
            {"type": "concept", "title": "Review formulas for combined solids"},
            {"type": "practice", "title": "Solve conversion of solids problems"},
        ],
        "Sets": [
            {"type": "concept", "title": "Review set operations - union, intersection, complement"},
            {"type": "practice", "title": "Practice Venn diagram problems"},
        ],
        "Matrices": [
            {"type": "concept", "title": "Review matrix operations and determinants"},
            {"type": "practice", "title": "Solve simultaneous equations using matrices"},
        ],
        "Mensuration": [
            {"type": "concept", "title": "Review area and volume formulas for 3D shapes"},
            {"type": "practice", "title": "Practice combined solids problems"},
        ],
        "Number Systems": [
            {"type": "concept", "title": "Review rational and irrational numbers"},
            {"type": "practice", "title": "Practice representation on number line"},
        ],
        "Heron's Formula": [
            {"type": "concept", "title": "Review Heron's formula and applications"},
            {"type": "practice", "title": "Solve area problems for irregular shapes"},
        ],
    },
    "Science": {
        "Electricity": [
            {"type": "concept", "title": "Review Ohm's law, resistance, and circuits"},
            {"type": "practice", "title": "Solve circuit and power numerical problems"},
            {"type": "experiment", "title": "Review Ohm's law verification experiment"},
        ],
        "Light - Reflection and Refraction": [
            {"type": "concept", "title": "Review mirror and lens formulas, sign convention"},
            {"type": "practice", "title": "Practice ray diagram and numerical problems"},
        ],
        "Chemical Reactions and Equations": [
            {"type": "concept", "title": "Review types of reactions and balancing"},
            {"type": "practice", "title": "Practice balancing equations and identifying reaction types"},
        ],
        "Acids, Bases and Salts": [
            {"type": "concept", "title": "Review pH scale, indicators, and reactions"},
            {"type": "practice", "title": "Practice salt preparation and property questions"},
        ],
        "Life Processes": [
            {"type": "concept", "title": "Review nutrition, respiration, transportation, excretion"},
            {"type": "practice", "title": "Practice diagram-based questions"},
            {"type": "experiment", "title": "Review photosynthesis and respiration experiments"},
        ],
        "Physics": [
            {"type": "concept", "title": "Review formulas and laws"},
            {"type": "practice", "title": "Solve numerical problems"},
            {"type": "experiment", "title": "Review lab experiments"},
        ],
        "Chemistry": [
            {"type": "concept", "title": "Review reactions, equations, and periodic table"},
            {"type": "practice", "title": "Practice balancing equations and reactions"},
        ],
        "Biology": [
            {"type": "concept", "title": "Review diagrams and processes"},
            {"type": "practice", "title": "Practice labeling diagrams"},
        ],
        "Microorganisms": [
            {"type": "concept", "title": "Review types of microorganisms and their uses"},
            {"type": "practice", "title": "Practice questions on fermentation and diseases"},
        ],
        "Force and Pressure": [
            {"type": "concept", "title": "Review types of forces and pressure concepts"},
            {"type": "practice", "title": "Solve pressure calculation problems"},
        ],
        "Synthetic Fibres and Plastics": [
            {"type": "concept", "title": "Review types and properties of synthetic fibres"},
            {"type": "practice", "title": "Compare natural and synthetic materials"},
        ],
        "Combustion and Flame": [
            {"type": "concept", "title": "Review conditions for combustion and types of flames"},
            {"type": "practice", "title": "Practice fire safety and fuel efficiency questions"},
        ],
    },
    "English": {
        "Grammar": [
            {"type": "concept", "title": "Review grammar rules - tenses, voice, speech"},
            {"type": "practice", "title": "Daily grammar exercises and transformations"},
        ],
        "Writing": [
            {"type": "concept", "title": "Study letter, essay, and story writing formats"},
            {"type": "practice", "title": "Write one composition daily"},
        ],
        "Literature": [
            {"type": "concept", "title": "Review character analysis and literary devices"},
            {"type": "practice", "title": "Practice comprehension and extract-based questions"},
        ],
        "Reading Comprehension": [
            {"type": "concept", "title": "Review strategies for unseen passages"},
            {"type": "practice", "title": "Practice 2 passages daily with timed attempts"},
        ],
    },
    "Social Studies": {
        "History": [
            {"type": "concept", "title": "Review key events, dates, and personalities"},
            {"type": "practice", "title": "Practice source-based and analytical questions"},
        ],
        "Geography": [
            {"type": "concept", "title": "Review maps, resources, and climate concepts"},
            {"type": "practice", "title": "Practice map-based and data questions"},
        ],
        "Civics": [
            {"type": "concept", "title": "Review constitutional provisions and governance"},
            {"type": "practice", "title": "Practice case-study and analytical questions"},
        ],
        "Economics": [
            {"type": "concept", "title": "Review sectors, development indicators, and GDP"},
            {"type": "practice", "title": "Practice data interpretation and comparison questions"},
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
