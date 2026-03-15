"""Database models for ExamIQ platform."""

from .user import User, StudentProfile, TeacherProfile
from .exam import (
    QuestionBank,
    Question,
    QuestionPaper,
    PaperQuestion,
    ExamSession,
    StudentAnswer,
)
from .evaluation import Evaluation, QuestionEvaluation, RubricTemplate
from .learning import LearningPlan, LearningObjective, TopicMastery
from .curriculum import (
    Board,
    Curriculum,
    CurriculumSubject,
    CurriculumChapter,
    CurriculumTopic,
    LearningOutcome,
    QuestionPattern,
    UploadedDocument,
)

__all__ = [
    "User",
    "StudentProfile",
    "TeacherProfile",
    "QuestionBank",
    "Question",
    "QuestionPaper",
    "PaperQuestion",
    "ExamSession",
    "StudentAnswer",
    "Evaluation",
    "QuestionEvaluation",
    "RubricTemplate",
    "LearningPlan",
    "LearningObjective",
    "TopicMastery",
    "Board",
    "Curriculum",
    "CurriculumSubject",
    "CurriculumChapter",
    "CurriculumTopic",
    "LearningOutcome",
    "QuestionPattern",
    "UploadedDocument",
]
