"""Exam-related schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ── Question Bank ──


class QuestionBankCreate(BaseModel):
    name: str
    board: str
    class_grade: int
    subject: str
    chapter: Optional[str] = None
    description: Optional[str] = None


class QuestionBankResponse(BaseModel):
    id: int
    name: str
    board: str
    class_grade: int
    subject: str
    chapter: Optional[str]
    question_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# ── Question ──


class QuestionCreate(BaseModel):
    bank_id: int
    question_type: str
    question_text: str
    marks: float
    difficulty: str = "medium"
    blooms_level: str = "understand"
    topic: str
    subtopic: Optional[str] = None
    model_answer: Optional[str] = None
    answer_keywords: Optional[list[str]] = None
    mcq_options: Optional[dict] = None
    correct_option: Optional[str] = None
    marking_scheme: Optional[list[dict]] = None
    source: Optional[str] = None
    question_image_url: Optional[str] = None


class QuestionResponse(BaseModel):
    id: int
    bank_id: int
    question_type: str
    question_text: str
    marks: float
    difficulty: str
    blooms_level: str
    topic: str
    subtopic: Optional[str]
    model_answer: Optional[str] = None
    answer_keywords: Optional[list[str]] = None
    mcq_options: Optional[dict] = None
    correct_option: Optional[str] = None
    marking_scheme: Optional[list[dict]] = None
    source: Optional[str]
    question_image_url: Optional[str] = None
    times_used: int
    avg_score_pct: Optional[float]
    blooms_confidence: Optional[float] = None
    blooms_teacher_confirmed: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionFilter(BaseModel):
    board: Optional[str] = None
    class_grade: Optional[int] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    question_type: Optional[str] = None
    difficulty: Optional[str] = None
    blooms_level: Optional[str] = None


# ── AI Question Generation ──


class QuestionGenerateRequest(BaseModel):
    topic: str
    subject: str
    board: str = "CBSE"
    class_grade: int = 10
    difficulty: str = "medium"
    question_type: str = "short_answer"
    count: int = 5
    chapter: Optional[str] = None
    research_context: Optional[str] = None
    teacher_notes: Optional[str] = None


class BulkGenerateRequest(BaseModel):
    subject: str
    board: str = "CBSE"
    class_grade: int = 10
    chapter: str
    question_distribution: dict[str, int]  # {"mcq": 5, "short_answer": 3, ...}


class GeneratedQuestionResponse(BaseModel):
    question_text: str
    question_type: str
    marks: float
    difficulty: str
    blooms_level: str
    topic: str
    subtopic: Optional[str] = None
    model_answer: str
    answer_keywords: list[str] = []
    mcq_options: Optional[dict] = None
    correct_option: Optional[str] = None
    marking_scheme: Optional[list[dict]] = None
    source: Optional[str] = None
    blooms_confidence: Optional[float] = None
    generation_context: Optional[str] = None
    question_image_url: Optional[str] = None


class GenerateResponse(BaseModel):
    questions: list[GeneratedQuestionResponse]
    count: int


class ApproveQuestionItem(BaseModel):
    """Individual question in an approval request, with optional provenance."""
    bank_id: int
    question_type: str
    question_text: str
    marks: float
    difficulty: str = "medium"
    blooms_level: str = "understand"
    topic: str
    subtopic: Optional[str] = None
    model_answer: Optional[str] = None
    answer_keywords: Optional[list[str]] = None
    mcq_options: Optional[dict] = None
    correct_option: Optional[str] = None
    marking_scheme: Optional[list[dict]] = None
    source: Optional[str] = None
    question_image_url: Optional[str] = None
    # Taxonomy FK
    chapter_id: Optional[int] = None
    # Provenance fields
    original_ai_text: Optional[str] = None
    teacher_edited: bool = False
    quality_rating: Optional[int] = None
    generation_context: Optional[str] = None


class ApproveQuestionsRequest(BaseModel):
    bank_id: int
    questions: list[ApproveQuestionItem]


# ── Question Paper ──


class PaperQuestionAdd(BaseModel):
    question_id: int
    section: Optional[str] = None
    order: int
    marks_override: Optional[float] = None
    is_compulsory: bool = True
    choice_group: Optional[str] = None


class QuestionPaperCreate(BaseModel):
    title: str
    board: str
    class_grade: int
    subject: str
    academic_year: Optional[str] = None
    exam_type: Optional[str] = None
    total_marks: float
    duration_minutes: int
    instructions: Optional[str] = None
    sections: Optional[list[dict]] = None
    questions: list[PaperQuestionAdd] = []


class QuestionPaperResponse(BaseModel):
    id: int
    title: str
    board: str
    class_grade: int
    subject: str
    exam_type: Optional[str]
    total_marks: float
    duration_minutes: int
    status: str
    sections: Optional[list[dict]]
    question_count: int = 0
    created_at: datetime
    published_at: Optional[datetime]
    starts_at: Optional[datetime]
    ends_at: Optional[datetime]

    class Config:
        from_attributes = True


class QuestionPaperDetail(QuestionPaperResponse):
    instructions: Optional[str]
    questions: list[dict] = []


class PaperStatusUpdate(BaseModel):
    status: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


# ── Exam Session ──


class StartExamRequest(BaseModel):
    paper_id: int
    is_practice: bool = False


class SubmitAnswerRequest(BaseModel):
    paper_question_id: int
    answer_text: Optional[str] = None
    selected_option: Optional[str] = None
    answer_image_url: Optional[str] = None
    canvas_state: Optional[dict] = None


class AutoSaveRequest(BaseModel):
    answers: list[SubmitAnswerRequest]
    time_spent_seconds: int


class ExamSessionResponse(BaseModel):
    id: int
    paper_id: int
    status: str
    started_at: Optional[datetime]
    submitted_at: Optional[datetime]
    time_spent_seconds: int
    is_practice: bool
    total_score: Optional[float]
    percentage: Optional[float]
    grade: Optional[str]

    class Config:
        from_attributes = True


class ExamSessionDetail(ExamSessionResponse):
    paper: QuestionPaperResponse
    answers: list[dict] = []


# ── Cross-Workspace Exam Views ──


class CrossWorkspaceExam(BaseModel):
    """An exam assignment enriched with workspace/teacher/class attribution."""
    assignment_id: int
    paper_id: int
    paper_title: str
    subject: str
    total_marks: float
    duration_minutes: int
    class_id: int
    class_name: str
    workspace_id: int
    workspace_name: str
    teacher_name: Optional[str] = None
    color: str = "#3B82F6"
    status: str
    label: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_practice: bool = False


# ── Curriculum Registry ──


class ChapterSummary(BaseModel):
    name: str
    textbook_ref: str
    topic_count: int


class ChapterDetail(BaseModel):
    name: str
    textbook_ref: str
    topics: list[str]
    learning_outcomes: list[str]
    question_pattern_notes: str
    suggested_distribution: dict[str, int]


class CurriculumResponse(BaseModel):
    type: str  # "boards", "classes", "subjects", "chapters", "chapter_detail"
    data: object  # list[str] | list[int] | list[ChapterSummary] | ChapterDetail | None


# ── Syllabus Research ──


class ResearchRequest(BaseModel):
    board: str
    class_grade: int
    subject: str
    chapter: str
    teacher_notes: Optional[str] = None


class WebSource(BaseModel):
    title: str
    url: str
    snippet: str


class DocumentSource(BaseModel):
    filename: str
    content_type: str
    excerpt: Optional[str] = None


class ResearchResult(BaseModel):
    chapter_info: dict
    generation_brief: str
    suggested_distribution: dict[str, int]
    key_concepts: list[str]
    misconceptions: list[str]
    teacher_notes_incorporated: Optional[str] = None
    web_sources: list[WebSource] = []
    document_sources: list[DocumentSource] = []


# ── Regeneration ──


class RegenerateRequest(BaseModel):
    original_question: dict
    feedback: str
    research_context: Optional[str] = None
    board: str = "CBSE"
    class_grade: int = 10
    subject: str = ""
    chapter: str = ""


# ── Teacher Preferences ──


class TeacherPreferenceUpdate(BaseModel):
    ai_assistance_level: str  # "auto", "guided", "expert"


class TeacherPreferenceResponse(BaseModel):
    ai_assistance_level: str
    board: Optional[str] = None
    subjects: Optional[list[str]] = None
    classes: Optional[list[int]] = None


# ── Paper Assembly ──


class SectionConfig(BaseModel):
    name: str
    marks: float
    question_types: Optional[list[str]] = None


class PaperAssemblyRequest(BaseModel):
    board: str
    class_grade: int
    subject: str
    chapters: list[str]
    total_marks: float
    duration_minutes: int
    sections: list[SectionConfig]
    question_type_distribution: Optional[dict[str, int]] = None
    title: Optional[str] = None
    exam_type: Optional[str] = None


class CoverageAnalysis(BaseModel):
    topic_coverage: dict[str, float] = {}  # topic -> coverage percentage
    blooms_distribution: dict[str, int] = {}  # blooms level -> count
    difficulty_distribution: dict[str, int] = {}  # difficulty -> count
    chapter_distribution: dict[str, int] = {}  # chapter -> count
    chapter_targets: list[dict] = []  # [{chapter_name, actual, target, status}]
    blooms_targets: list[dict] = []  # [{level, actual, target, status}]


class PaperAssemblyResult(BaseModel):
    paper: dict  # title, sections, instructions
    questions: list[dict]  # ordered questions with section assignments
    coverage_analysis: CoverageAnalysis
    gaps_filled: int  # how many new questions were generated
    total_questions: int
    from_bank: int
