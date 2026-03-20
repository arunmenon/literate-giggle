"""
Evaluation Engine - Core scoring logic for answer evaluation.

Supports:
- MCQ auto-grading
- Keyword-based scoring for short/long answers
- Step-wise marking for numerical problems
- Rubric-based holistic scoring
- AI-assisted evaluation (optional, via Anthropic API)
"""

import json
import re
from typing import Optional

from ..models.exam import Question, QuestionType, StudentAnswer


def normalize_text(text: str) -> str:
    """Normalize text for comparison."""
    return re.sub(r"\s+", " ", text.strip().lower())


def evaluate_mcq(question: Question, answer: StudentAnswer) -> dict:
    """Evaluate MCQ answer - exact match."""
    is_correct = (
        answer.selected_option
        and answer.selected_option.strip().lower()
        == (question.correct_option or "").strip().lower()
    )
    marks = question.marks if is_correct else 0.0
    return {
        "marks_obtained": marks,
        "marks_possible": question.marks,
        "feedback": "Correct!" if is_correct else f"Incorrect. The correct answer is: {question.correct_option}",
        "keywords_found": [],
        "keywords_missing": [],
    }


def evaluate_true_false(question: Question, answer: StudentAnswer) -> dict:
    """Evaluate True/False answer."""
    return evaluate_mcq(question, answer)


def evaluate_fill_in_blank(question: Question, answer: StudentAnswer) -> dict:
    """Evaluate fill-in-the-blank with flexible matching."""
    if not answer.answer_text or not question.model_answer:
        return {
            "marks_obtained": 0.0,
            "marks_possible": question.marks,
            "feedback": "No answer provided." if not answer.answer_text else "No model answer available.",
            "keywords_found": [],
            "keywords_missing": [],
        }

    student_ans = normalize_text(answer.answer_text)
    # Accept multiple valid answers separated by |
    valid_answers = [normalize_text(a) for a in question.model_answer.split("|")]
    is_correct = student_ans in valid_answers

    return {
        "marks_obtained": question.marks if is_correct else 0.0,
        "marks_possible": question.marks,
        "feedback": "Correct!" if is_correct else f"The expected answer is: {valid_answers[0]}",
        "keywords_found": [student_ans] if is_correct else [],
        "keywords_missing": valid_answers[:1] if not is_correct else [],
    }


def evaluate_keyword_based(question: Question, answer: StudentAnswer) -> dict:
    """Evaluate short/long answers using keyword matching and model answer comparison."""
    if not answer.answer_text:
        return {
            "marks_obtained": 0.0,
            "marks_possible": question.marks,
            "feedback": "No answer provided.",
            "keywords_found": [],
            "keywords_missing": list(question.answer_keywords or []),
            "improvement_hint": "Please attempt the question.",
        }

    student_text = normalize_text(answer.answer_text)
    keywords = question.answer_keywords or []
    found = []
    missing = []

    for keyword in keywords:
        kw_lower = normalize_text(keyword)
        if kw_lower in student_text:
            found.append(keyword)
        else:
            missing.append(keyword)

    # Score based on keyword coverage
    if keywords:
        keyword_ratio = len(found) / len(keywords)
    else:
        keyword_ratio = 0.5  # Default if no keywords defined

    # Length heuristic: penalize very short answers for long-answer questions
    if question.question_type == QuestionType.LONG_ANSWER:
        expected_min_words = max(50, int(question.marks) * 15)
        word_count = len(student_text.split())
        length_factor = min(1.0, word_count / expected_min_words)
        keyword_ratio = keyword_ratio * 0.7 + length_factor * 0.3

    marks = round(question.marks * keyword_ratio, 1)

    # Generate feedback
    if keyword_ratio >= 0.9:
        feedback = "Excellent answer covering all key points."
    elif keyword_ratio >= 0.7:
        feedback = "Good answer but missing some key points."
    elif keyword_ratio >= 0.5:
        feedback = "Partial answer. Several important concepts are missing."
    elif keyword_ratio > 0:
        feedback = "Incomplete answer. Most key concepts are missing."
    else:
        feedback = "Answer does not address the question adequately."

    hint_parts = []
    if missing:
        hint_parts.append(f"Include these concepts: {', '.join(missing[:3])}")
    if question.model_answer:
        hint_parts.append("Review the model answer for a comprehensive response.")

    return {
        "marks_obtained": marks,
        "marks_possible": question.marks,
        "feedback": feedback,
        "keywords_found": found,
        "keywords_missing": missing,
        "improvement_hint": " ".join(hint_parts) if hint_parts else None,
    }


def evaluate_stepwise(question: Question, answer: StudentAnswer) -> dict:
    """Evaluate numerical/step-based answers using marking scheme."""
    if not answer.answer_text:
        return {
            "marks_obtained": 0.0,
            "marks_possible": question.marks,
            "feedback": "No answer provided.",
            "keywords_found": [],
            "keywords_missing": [],
            "step_scores": [],
        }

    marking_scheme = question.marking_scheme or []
    if not marking_scheme:
        return evaluate_keyword_based(question, answer)

    student_text = normalize_text(answer.answer_text)
    step_scores = []
    total_obtained = 0.0

    for step in marking_scheme:
        step_desc = step.get("step", "")
        step_marks = step.get("marks", 0)
        step_keywords = step.get("keywords", [])

        # Check if step keywords appear in answer
        found_count = sum(
            1 for kw in step_keywords if normalize_text(kw) in student_text
        )
        ratio = found_count / len(step_keywords) if step_keywords else 0
        step_obtained = round(step_marks * ratio, 1)
        total_obtained += step_obtained

        step_scores.append({
            "step": step_desc,
            "marks_possible": step_marks,
            "marks_obtained": step_obtained,
        })

    return {
        "marks_obtained": min(total_obtained, question.marks),
        "marks_possible": question.marks,
        "feedback": f"Scored {total_obtained}/{question.marks} across {len(marking_scheme)} steps.",
        "keywords_found": [],
        "keywords_missing": [],
        "step_scores": step_scores,
    }


def evaluate_question(question: Question, answer: StudentAnswer) -> dict:
    """Route to appropriate evaluator based on question type."""
    evaluators = {
        QuestionType.MCQ: evaluate_mcq,
        QuestionType.TRUE_FALSE: evaluate_true_false,
        QuestionType.FILL_IN_BLANK: evaluate_fill_in_blank,
        QuestionType.VERY_SHORT: evaluate_keyword_based,
        QuestionType.SHORT_ANSWER: evaluate_keyword_based,
        QuestionType.LONG_ANSWER: evaluate_keyword_based,
        QuestionType.CASE_STUDY: evaluate_keyword_based,
        QuestionType.NUMERICAL: evaluate_stepwise,
        QuestionType.MATCH_FOLLOWING: evaluate_keyword_based,
        QuestionType.DIAGRAM: evaluate_keyword_based,
    }

    evaluator = evaluators.get(question.question_type, evaluate_keyword_based)
    result = evaluator(question, answer)

    # Add model answer comparison
    if question.model_answer and answer.answer_text:
        result["model_answer_comparison"] = (
            f"Model answer: {question.model_answer[:500]}"
        )

    return result


async def evaluate_question_async(
    question: Question,
    answer: StudentAnswer,
    board: str = "CBSE",
    subject: str = "Science",
    class_grade: int = 10,
) -> dict:
    """Async evaluation that handles diagram questions with vision-based evaluation.

    For DIAGRAM question type:
    - If answer has answer_image_url, use vision-based AI evaluation
    - If answer has only answer_text, fall back to keyword-based evaluation
    - If both exist, combine scores (70% image, 30% text)

    For all other question types, delegates to the sync evaluate_question().

    IMPORTANT: This is a SEPARATE function from evaluate_question() -- the sync
    function is NOT modified to preserve backward compatibility.
    """
    if question.question_type != QuestionType.DIAGRAM:
        return evaluate_question(question, answer)

    from .ai_evaluator import evaluate_diagram_answer

    has_image = bool(answer.answer_image_url)
    has_text = bool(answer.answer_text)

    image_result = None
    text_result = None

    if has_image:
        image_result = await evaluate_diagram_answer(
            question, answer,
            board=board, subject=subject, class_grade=class_grade,
        )

    if has_text:
        text_result = evaluate_keyword_based(question, answer)

    # Combine results based on what's available
    if image_result and text_result:
        # Weighted combination: 70% image, 30% text
        combined_marks = round(
            image_result["marks_obtained"] * 0.7 + text_result["marks_obtained"] * 0.3,
            1,
        )
        combined_marks = min(combined_marks, question.marks)
        return {
            "marks_obtained": combined_marks,
            "marks_possible": question.marks,
            "feedback": (
                f"Diagram evaluation: {image_result['feedback']} "
                f"Text evaluation: {text_result['feedback']}"
            ),
            "keywords_found": text_result.get("keywords_found", []),
            "keywords_missing": text_result.get("keywords_missing", []),
            "improvement_hint": text_result.get("improvement_hint", ""),
            "rubric_scores": image_result.get("rubric_scores"),
            "confidence": 0.85,
            "evaluation_method": "ai_vision_hybrid",
        }
    elif image_result:
        return image_result
    elif text_result:
        return text_result
    else:
        # No answer at all
        return {
            "marks_obtained": 0.0,
            "marks_possible": question.marks,
            "feedback": "No diagram or text answer provided.",
            "keywords_found": [],
            "keywords_missing": list(question.answer_keywords or []),
            "improvement_hint": "Please draw the diagram and label all required parts.",
            "evaluation_method": "fallback",
        }


def calculate_grade(percentage: float) -> str:
    """Calculate grade based on CBSE/ICSE grading system."""
    if percentage >= 91:
        return "A1"
    elif percentage >= 81:
        return "A2"
    elif percentage >= 71:
        return "B1"
    elif percentage >= 61:
        return "B2"
    elif percentage >= 51:
        return "C1"
    elif percentage >= 41:
        return "C2"
    elif percentage >= 33:
        return "D"
    else:
        return "E"


def generate_recommendations(
    topic_scores: dict, blooms_scores: dict, difficulty_scores: dict
) -> str:
    """Generate study recommendations based on evaluation analytics."""
    recommendations = []

    # Identify weak topics
    weak_topics = [
        topic
        for topic, scores in topic_scores.items()
        if scores["total"] > 0 and (scores["obtained"] / scores["total"]) < 0.5
    ]
    if weak_topics:
        recommendations.append(
            f"Focus on these weak areas: {', '.join(weak_topics)}. "
            "Review textbook chapters and solve practice problems."
        )

    # Blooms taxonomy analysis
    if blooms_scores:
        low_blooms = [
            level for level, pct in blooms_scores.items() if pct < 50
        ]
        if "apply" in low_blooms or "analyze" in low_blooms:
            recommendations.append(
                "Work on application and analytical skills. "
                "Practice word problems and case studies."
            )
        if "remember" in low_blooms:
            recommendations.append(
                "Strengthen foundational knowledge. Review definitions, "
                "formulas, and key concepts."
            )

    # Difficulty analysis
    if difficulty_scores:
        if difficulty_scores.get("easy", 100) < 80:
            recommendations.append(
                "Basics need strengthening. Focus on fundamental concepts first."
            )
        if difficulty_scores.get("hard", 0) > 70:
            recommendations.append(
                "Great performance on difficult questions! "
                "Challenge yourself with competitive-level problems."
            )

    if not recommendations:
        recommendations.append(
            "Good overall performance. Continue practicing regularly "
            "and attempt previous year question papers."
        )

    return "\n\n".join(recommendations)
