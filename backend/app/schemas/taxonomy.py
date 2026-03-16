"""Taxonomy-related Pydantic schemas for analytics, generation, and impact analysis."""

from typing import Optional
from pydantic import BaseModel


# ── Bank Analytics ──


class ChapterCoverageSchema(BaseModel):
    chapter_id: int
    chapter_name: str
    textbook_ref: Optional[str] = None
    question_count: int
    target_count: int
    by_difficulty: dict[str, int] = {}
    by_type: dict[str, int] = {}
    by_blooms: dict[str, int] = {}
    status: str  # "green", "amber", "red", "empty"


class GapAlertSchema(BaseModel):
    chapter_id: int
    chapter_name: str
    questions_needed: int
    status: str  # "red" or "empty"


class BankCompositionSchema(BaseModel):
    by_type: dict[str, int] = {}
    by_difficulty: dict[str, int] = {}
    by_blooms: dict[str, int] = {}


class BankAnalyticsResponse(BaseModel):
    bank_id: int
    board: str
    class_grade: int
    subject: str
    total_questions: int
    chapters_covered: int
    chapters_total: int
    chapter_coverage: list[ChapterCoverageSchema] = []
    composition: BankCompositionSchema = BankCompositionSchema()
    gap_alerts: list[GapAlertSchema] = []


# ── Taxonomy Generation ──


class GeneratedOutcome(BaseModel):
    description: str
    bloom_level: str


class GeneratedTopic(BaseModel):
    name: str
    description: Optional[str] = None
    learning_outcomes: list[GeneratedOutcome] = []


class GeneratedChapter(BaseModel):
    number: int
    name: str
    textbook_reference: Optional[str] = None
    marks_weightage: Optional[int] = None
    question_pattern_notes: Optional[str] = None
    topics: list[GeneratedTopic] = []


class TaxonomyGenerateRequest(BaseModel):
    board: str
    class_grade: int
    subject: str


class TaxonomyGenerateResponse(BaseModel):
    board: str
    class_grade: int
    subject: str
    chapters: list[GeneratedChapter] = []
    sources_used: list[str] = []


class TaxonomySaveChapter(BaseModel):
    number: int
    name: str
    textbook_reference: Optional[str] = None
    marks_weightage: Optional[int] = None
    question_pattern_notes: Optional[str] = None
    topics: list[GeneratedTopic] = []


class TaxonomySaveRequest(BaseModel):
    board: str
    class_grade: int
    subject: str
    academic_year: str = "2025-26"
    textbook_name: Optional[str] = None
    chapters: list[TaxonomySaveChapter]


# ── Impact Analysis ──


class ImpactAnalysisRequest(BaseModel):
    chapter_id: int
    change_type: str  # "rename", "delete", "modify_weightage", "add"
    new_value: Optional[str] = None


class ImpactAnalysisResponse(BaseModel):
    affected_questions: int = 0
    affected_question_samples: list[str] = []
    affected_papers: int = 0
    affected_mastery_records: int = 0
    affected_workspaces: int = 0
    change_type: str  # "safe_rename", "safe_add", "breaking_delete", "targets_change"
    recommendation: str = ""


# ── Chapter Update ──


class ChapterUpdateRequest(BaseModel):
    name: Optional[str] = None  # impact type: safe_rename
    textbook_reference: Optional[str] = None  # impact type: cosmetic
    marks_weightage: Optional[int] = None  # impact type: targets_change
    question_pattern_notes: Optional[str] = None  # impact type: cosmetic
    order: Optional[int] = None  # impact type: cosmetic
    impact_acknowledged: bool = False


class ChapterAddRequest(BaseModel):
    subject_id: int
    number: int
    name: str
    textbook_reference: Optional[str] = None
    marks_weightage: Optional[int] = None
    question_pattern_notes: Optional[str] = None


# ── Curriculum Clone + List ──


class CurriculumCloneRequest(BaseModel):
    source_curriculum_id: int
    new_academic_year: str


class CurriculumSubjectItem(BaseModel):
    id: int
    name: str
    class_grade: int
    chapter_count: int


class CurriculumListItem(BaseModel):
    id: int
    board_code: str
    board_name: str
    academic_year: str
    is_active: bool
    subjects: list[CurriculumSubjectItem] = []


class CurriculumListResponse(BaseModel):
    curricula: list[CurriculumListItem] = []


# ── Subject Detail ──


class LearningOutcomeDetail(BaseModel):
    id: int
    code: Optional[str] = None
    description: str
    bloom_level: Optional[str] = None


class TopicDetail(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    learning_outcomes: list[LearningOutcomeDetail] = []


class ChapterDetail(BaseModel):
    id: int
    number: int
    name: str
    textbook_reference: Optional[str] = None
    marks_weightage: Optional[int] = None
    question_pattern_notes: Optional[str] = None
    topics: list[TopicDetail] = []


class SubjectDetailResponse(BaseModel):
    id: int
    name: str
    class_grade: int
    textbook_name: Optional[str] = None
    chapters: list[ChapterDetail] = []


# ── Paper Coverage Analysis ──


class PaperChapterTarget(BaseModel):
    chapter_name: str
    actual: int
    target: int
    status: str  # "green", "amber", "red", "empty"


class PaperBloomsTarget(BaseModel):
    level: str
    actual: int
    target: int
    status: str  # "green", "amber", "red"


class PaperCoverageAnalysis(BaseModel):
    topic_coverage: dict[str, float] = {}
    blooms_distribution: dict[str, int] = {}
    difficulty_distribution: dict[str, int] = {}
    chapter_distribution: dict[str, int] = {}
    chapter_targets: list[PaperChapterTarget] = []
    blooms_targets: list[PaperBloomsTarget] = []
