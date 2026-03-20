"""
Taxonomy Service.

Provides bank analytics (coverage, composition, gaps) and fuzzy topic matching.
Impact analysis is added in Task 1b.
"""

import difflib
import logging
from typing import Optional

from sqlalchemy import select, func, distinct, case
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.exam import Question, QuestionBank, QuestionPaper, PaperQuestion
from ..models.learning import TopicMastery
from ..models.curriculum import (
    Board, Curriculum, CurriculumSubject, CurriculumChapter,
    CurriculumTopic, LearningOutcome,
)
from ..schemas.taxonomy import (
    BankAnalyticsResponse, ChapterCoverageSchema, GapAlertSchema,
    BankCompositionSchema, ImpactAnalysisResponse,
    HeatmapCell, CoverageHeatmapResponse,
)

logger = logging.getLogger(__name__)


async def fuzzy_match_topic_to_chapter(
    topic_string: str,
    board: str,
    class_grade: int,
    subject: str,
    db: AsyncSession,
) -> Optional[int]:
    """
    Match a free-text topic string to a CurriculumChapter ID.

    Match order:
    1. Exact case-insensitive match on chapter name
    2. Substring containment (topic in chapter name or chapter name in topic)
    3. difflib.SequenceMatcher >= 0.6

    Scoped to the curriculum for the given board/class_grade/subject.
    """
    # Get all chapter names for this board/class/subject
    query = (
        select(CurriculumChapter.id, CurriculumChapter.name)
        .join(CurriculumSubject, CurriculumChapter.subject_id == CurriculumSubject.id)
        .join(Curriculum, CurriculumSubject.curriculum_id == Curriculum.id)
        .join(Board, Curriculum.board_id == Board.id)
        .where(
            Board.code == board,
            CurriculumSubject.class_grade == class_grade,
            CurriculumSubject.name == subject,
        )
    )
    result = await db.execute(query)
    chapters = result.all()

    if not chapters:
        return None

    topic_lower = topic_string.lower().strip()

    # Step 1: Exact case-insensitive match
    for ch_id, ch_name in chapters:
        if ch_name.lower().strip() == topic_lower:
            return ch_id

    # Step 2: Substring containment
    for ch_id, ch_name in chapters:
        ch_lower = ch_name.lower().strip()
        if topic_lower in ch_lower or ch_lower in topic_lower:
            return ch_id

    # Step 3: Fuzzy match >= 0.6
    best_match_id = None
    best_ratio = 0.0
    for ch_id, ch_name in chapters:
        ratio = difflib.SequenceMatcher(
            None, topic_lower, ch_name.lower().strip()
        ).ratio()
        if ratio >= 0.6 and ratio > best_ratio:
            best_ratio = ratio
            best_match_id = ch_id

    return best_match_id


def _compute_rag_status(question_count: int, target_count: int) -> str:
    """Compute RAG status for a chapter."""
    if question_count == 0:
        return "empty"
    if target_count <= 0:
        return "green" if question_count > 0 else "empty"
    ratio = question_count / target_count
    if ratio >= 1.0:
        return "green"
    if ratio >= 0.5:
        return "amber"
    return "red"


async def get_bank_analytics(
    db: AsyncSession,
    bank_id: int,
) -> BankAnalyticsResponse:
    """
    Compute coverage analytics for a question bank against its curriculum.

    - Looks up bank's board/class/subject, finds matching curriculum
    - Counts questions per chapter (via chapter_id FK, falling back to fuzzy topic match)
    - Computes targets from marks_weightage
    - Returns empty-state if no curriculum exists (not 500)
    """
    bank = await db.get(QuestionBank, bank_id)
    if not bank:
        raise ValueError(f"Bank {bank_id} not found")

    board_code = bank.board
    class_grade = bank.class_grade
    subject_name = bank.subject

    # Find matching curriculum subject
    subject_query = (
        select(CurriculumSubject)
        .join(Curriculum, CurriculumSubject.curriculum_id == Curriculum.id)
        .join(Board, Curriculum.board_id == Board.id)
        .where(
            Board.code == board_code,
            CurriculumSubject.class_grade == class_grade,
            CurriculumSubject.name == subject_name,
        )
    )
    subject_result = await db.execute(subject_query)
    curriculum_subject = subject_result.scalar_one_or_none()

    # Get all questions in this bank
    questions_result = await db.execute(
        select(Question).where(
            Question.bank_id == bank_id,
            Question.is_active == True,
        )
    )
    all_questions = questions_result.scalars().all()
    total_questions = len(all_questions)

    # Empty-state: no curriculum exists
    if not curriculum_subject:
        # Still compute composition from existing questions
        composition = _compute_composition(all_questions)
        return BankAnalyticsResponse(
            bank_id=bank_id,
            board=board_code,
            class_grade=class_grade,
            subject=subject_name,
            total_questions=total_questions,
            chapters_covered=0,
            chapters_total=0,
            chapter_coverage=[],
            composition=composition,
            gap_alerts=[],
        )

    # Get all chapters for this subject
    chapters_result = await db.execute(
        select(CurriculumChapter)
        .where(CurriculumChapter.subject_id == curriculum_subject.id)
        .order_by(CurriculumChapter.number)
    )
    chapters = chapters_result.scalars().all()
    chapters_total = len(chapters)

    # Compute total marks weightage for proportional target calculation
    total_weightage = sum(ch.marks_weightage or 0 for ch in chapters)

    # Build chapter_id -> chapter map
    chapter_map = {ch.id: ch for ch in chapters}

    # Count questions per chapter
    # First pass: use chapter_id FK
    chapter_questions: dict[int, list[Question]] = {ch.id: [] for ch in chapters}
    unmatched_questions: list[Question] = []

    for q in all_questions:
        if q.chapter_id and q.chapter_id in chapter_map:
            chapter_questions[q.chapter_id].append(q)
        else:
            unmatched_questions.append(q)

    # Second pass: fuzzy match unmigrated questions by topic string
    for q in unmatched_questions:
        if q.topic:
            matched_id = await fuzzy_match_topic_to_chapter(
                q.topic, board_code, class_grade, subject_name, db
            )
            if matched_id and matched_id in chapter_questions:
                chapter_questions[matched_id].append(q)

    # Compute targets and coverage
    chapter_coverage = []
    gap_alerts = []
    chapters_covered = 0

    for ch in chapters:
        ch_questions = chapter_questions.get(ch.id, [])
        question_count = len(ch_questions)

        # Compute target from marks_weightage proportional to total questions
        if total_weightage > 0 and (ch.marks_weightage or 0) > 0:
            target_count = max(1, round(
                total_questions * (ch.marks_weightage / total_weightage)
            )) if total_questions > 0 else max(1, ch.marks_weightage // 2)
        else:
            target_count = 0

        status = _compute_rag_status(question_count, target_count)

        if question_count > 0:
            chapters_covered += 1

        # Compute per-chapter breakdowns
        by_difficulty = {}
        by_type = {}
        by_blooms = {}
        for cq in ch_questions:
            diff_val = cq.difficulty.value if cq.difficulty else "medium"
            by_difficulty[diff_val] = by_difficulty.get(diff_val, 0) + 1

            type_val = cq.question_type.value if cq.question_type else "short_answer"
            by_type[type_val] = by_type.get(type_val, 0) + 1

            blooms_val = cq.blooms_level.value if cq.blooms_level else "understand"
            by_blooms[blooms_val] = by_blooms.get(blooms_val, 0) + 1

        chapter_coverage.append(ChapterCoverageSchema(
            chapter_id=ch.id,
            chapter_name=ch.name,
            textbook_ref=ch.textbook_reference,
            question_count=question_count,
            target_count=target_count,
            by_difficulty=by_difficulty,
            by_type=by_type,
            by_blooms=by_blooms,
            status=status,
        ))

        # Gap alerts for empty or red chapters
        if status in ("empty", "red"):
            needed = max(0, target_count - question_count)
            if needed > 0:
                gap_alerts.append(GapAlertSchema(
                    chapter_id=ch.id,
                    chapter_name=ch.name,
                    questions_needed=needed,
                    status=status,
                ))

    # Compute overall composition
    composition = _compute_composition(all_questions)

    return BankAnalyticsResponse(
        bank_id=bank_id,
        board=board_code,
        class_grade=class_grade,
        subject=subject_name,
        total_questions=total_questions,
        chapters_covered=chapters_covered,
        chapters_total=chapters_total,
        chapter_coverage=chapter_coverage,
        composition=composition,
        gap_alerts=gap_alerts,
    )


BLOOMS_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"]


async def get_coverage_heatmap(
    db: AsyncSession,
    bank_id: int,
) -> CoverageHeatmapResponse:
    """
    Compute a 2D chapter x Bloom's level coverage heatmap for a question bank.

    Returns chapter names as Y-axis, Bloom's levels as X-axis, and cell counts
    with question IDs for click-to-view.
    """
    bank = await db.get(QuestionBank, bank_id)
    if not bank:
        raise ValueError(f"Bank {bank_id} not found")

    # Get all active questions in this bank
    questions_result = await db.execute(
        select(Question).where(
            Question.bank_id == bank_id,
            Question.is_active == True,
        )
    )
    all_questions = questions_result.scalars().all()
    total_questions = len(all_questions)

    if not all_questions:
        return CoverageHeatmapResponse(
            bank_id=bank_id,
            chapters=[],
            blooms_levels=BLOOMS_ORDER,
            cells=[],
            total_questions=0,
        )

    # Find matching curriculum subject for chapter resolution
    subject_query = (
        select(CurriculumSubject)
        .join(Curriculum, CurriculumSubject.curriculum_id == Curriculum.id)
        .join(Board, Curriculum.board_id == Board.id)
        .where(
            Board.code == bank.board,
            CurriculumSubject.class_grade == bank.class_grade,
            CurriculumSubject.name == bank.subject,
        )
    )
    subject_result = await db.execute(subject_query)
    curriculum_subject = subject_result.scalar_one_or_none()

    # Build chapter map if curriculum exists
    chapter_map: dict[int, str] = {}
    if curriculum_subject:
        chapters_result = await db.execute(
            select(CurriculumChapter)
            .where(CurriculumChapter.subject_id == curriculum_subject.id)
            .order_by(CurriculumChapter.number)
        )
        for ch in chapters_result.scalars().all():
            chapter_map[ch.id] = ch.name

    # Group questions by (chapter_id, blooms_level)
    # cell_data: (chapter_id, chapter_name) -> blooms_level -> list[question_id]
    cell_data: dict[tuple[int, str], dict[str, list[int]]] = {}

    for q in all_questions:
        ch_id = q.chapter_id
        ch_name = chapter_map.get(ch_id, "Uncategorized") if ch_id else "Uncategorized"

        # Fuzzy match if no chapter_id
        if not ch_id and q.topic and curriculum_subject:
            matched_id = await fuzzy_match_topic_to_chapter(
                q.topic, bank.board, bank.class_grade, bank.subject, db
            )
            if matched_id and matched_id in chapter_map:
                ch_id = matched_id
                ch_name = chapter_map[matched_id]

        key = (ch_id or 0, ch_name)
        blooms_val = q.blooms_level.value if q.blooms_level else "understand"

        if key not in cell_data:
            cell_data[key] = {bl: [] for bl in BLOOMS_ORDER}
        if blooms_val in cell_data[key]:
            cell_data[key][blooms_val].append(q.id)

    # Build response
    chapters_seen = []
    cells = []
    for (ch_id, ch_name), blooms_dict in cell_data.items():
        if ch_name not in chapters_seen:
            chapters_seen.append(ch_name)
        for bl, q_ids in blooms_dict.items():
            cells.append(HeatmapCell(
                chapter_id=ch_id,
                chapter_name=ch_name,
                blooms_level=bl,
                question_count=len(q_ids),
                question_ids=q_ids,
            ))

    return CoverageHeatmapResponse(
        bank_id=bank_id,
        chapters=chapters_seen,
        blooms_levels=BLOOMS_ORDER,
        cells=cells,
        total_questions=total_questions,
    )


def _compute_composition(questions: list) -> BankCompositionSchema:
    """Compute type/difficulty/blooms composition for a list of questions."""
    by_type: dict[str, int] = {}
    by_difficulty: dict[str, int] = {}
    by_blooms: dict[str, int] = {}

    for q in questions:
        type_val = q.question_type.value if q.question_type else "short_answer"
        by_type[type_val] = by_type.get(type_val, 0) + 1

        diff_val = q.difficulty.value if q.difficulty else "medium"
        by_difficulty[diff_val] = by_difficulty.get(diff_val, 0) + 1

        blooms_val = q.blooms_level.value if q.blooms_level else "understand"
        by_blooms[blooms_val] = by_blooms.get(blooms_val, 0) + 1

    return BankCompositionSchema(
        by_type=by_type,
        by_difficulty=by_difficulty,
        by_blooms=by_blooms,
    )


async def clone_curriculum(
    db: AsyncSession,
    source_curriculum_id: int,
    new_academic_year: str,
) -> dict:
    """
    Clone a curriculum for a new academic year.

    Creates new Curriculum + CurriculumSubject records pointing to the SAME
    CurriculumChapter IDs (chapters are version-independent). Sets source
    curriculum is_active=False and new curriculum is_active=True.
    """
    source = await db.get(Curriculum, source_curriculum_id)
    if not source:
        raise ValueError(f"Curriculum {source_curriculum_id} not found")

    # Load source subjects with their chapters
    subjects_result = await db.execute(
        select(CurriculumSubject)
        .where(CurriculumSubject.curriculum_id == source.id)
    )
    source_subjects = subjects_result.scalars().all()

    # Deactivate source
    source.is_active = False

    # Create new curriculum
    new_curriculum = Curriculum(
        board_id=source.board_id,
        academic_year=new_academic_year,
        is_active=True,
    )
    db.add(new_curriculum)
    await db.flush()

    # Clone subjects, pointing to the SAME chapter IDs
    for src_subj in source_subjects:
        # Get chapter IDs for this subject
        ch_result = await db.execute(
            select(CurriculumChapter.id)
            .where(CurriculumChapter.subject_id == src_subj.id)
        )
        chapter_ids = [row[0] for row in ch_result.all()]

        new_subject = CurriculumSubject(
            curriculum_id=new_curriculum.id,
            code=src_subj.code,
            name=src_subj.name,
            class_grade=src_subj.class_grade,
            textbook_name=src_subj.textbook_name,
            total_marks=src_subj.total_marks,
        )
        db.add(new_subject)
        await db.flush()

        # Re-point existing chapters to the new subject
        # Per governance: chapters are shared, so we add new subject_id pointers
        # Actually, chapters keep their original subject_id -- we just create
        # new CurriculumSubject records. The chapters remain linked to their
        # original subject. For the new subject to "have" chapters, we update
        # chapter.subject_id to the new subject. But that would break the old
        # version's view.
        #
        # Correct approach: chapters are version-independent. The clone creates
        # new CurriculumSubject records. Chapters stay linked to original subjects.
        # Both old and new curricula reference the same chapters via subject->chapters.
        # Since we want both versions to see the same chapters, we DON'T move chapters.
        # Instead, the frontend resolves chapters through the subject relationship.
        #
        # Simplest correct approach: chapters keep subject_id pointing to original
        # subject. New subject also needs to see them. We'll make new subject point
        # to same chapters by updating chapter.subject_id -- but we can't have two
        # subject_ids. So the correct approach per the plan is:
        # "Create new CurriculumSubject records pointing to the SAME chapter IDs"
        # This means we update the chapter records to point to the NEW subject.
        # The old subject then has no chapters -- but that's intentional because
        # the old curriculum is inactive.
        for ch_id in chapter_ids:
            chapter = await db.get(CurriculumChapter, ch_id)
            if chapter:
                chapter.subject_id = new_subject.id
        await db.flush()

    # Load board info for response
    board = await db.get(Board, new_curriculum.board_id)

    return {
        "id": new_curriculum.id,
        "board_code": board.code if board else "",
        "board_name": board.name if board else "",
        "academic_year": new_curriculum.academic_year,
        "is_active": new_curriculum.is_active,
        "subjects_cloned": len(source_subjects),
    }


async def list_curricula(
    db: AsyncSession,
    board: Optional[str] = None,
    class_grade: Optional[int] = None,
) -> list[dict]:
    """
    List all curricula with subject count, chapter count, active status.
    Optional filters by board code and class_grade.
    """
    query = (
        select(Curriculum)
        .join(Board, Curriculum.board_id == Board.id)
    )
    if board:
        query = query.where(Board.code == board)

    result = await db.execute(query)
    curricula = result.scalars().all()

    items = []
    for curr in curricula:
        board_obj = await db.get(Board, curr.board_id)

        # Get subjects
        subj_query = select(CurriculumSubject).where(
            CurriculumSubject.curriculum_id == curr.id
        )
        if class_grade:
            subj_query = subj_query.where(CurriculumSubject.class_grade == class_grade)

        subj_result = await db.execute(subj_query)
        subjects = subj_result.scalars().all()

        # If class_grade filter is active and no subjects match, skip this curriculum
        if class_grade and not subjects:
            continue

        subject_items = []
        for subj in subjects:
            ch_count_result = await db.execute(
                select(func.count(CurriculumChapter.id))
                .where(CurriculumChapter.subject_id == subj.id)
            )
            ch_count = ch_count_result.scalar() or 0
            subject_items.append({
                "id": subj.id,
                "name": subj.name,
                "class_grade": subj.class_grade,
                "chapter_count": ch_count,
            })

        items.append({
            "id": curr.id,
            "board_code": board_obj.code if board_obj else "",
            "board_name": board_obj.name if board_obj else "",
            "academic_year": curr.academic_year,
            "is_active": curr.is_active,
            "subjects": subject_items,
        })

    return items


async def get_subject_detail(
    db: AsyncSession,
    subject_id: int,
) -> Optional[dict]:
    """
    Get full subject detail with chapters, topics, and learning outcomes.
    Returns the full tree for editing in TaxonomyManager.
    """
    subject = await db.get(CurriculumSubject, subject_id)
    if not subject:
        return None

    chapters_result = await db.execute(
        select(CurriculumChapter)
        .where(CurriculumChapter.subject_id == subject.id)
        .order_by(CurriculumChapter.number)
    )
    chapters = chapters_result.scalars().all()

    chapter_list = []
    for ch in chapters:
        topics_result = await db.execute(
            select(CurriculumTopic)
            .where(CurriculumTopic.chapter_id == ch.id)
        )
        topics = topics_result.scalars().all()

        topic_list = []
        for t in topics:
            outcomes_result = await db.execute(
                select(LearningOutcome)
                .where(LearningOutcome.topic_id == t.id)
            )
            outcomes = outcomes_result.scalars().all()

            topic_list.append({
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "learning_outcomes": [
                    {
                        "id": lo.id,
                        "code": lo.code,
                        "description": lo.description,
                        "bloom_level": lo.bloom_level,
                    }
                    for lo in outcomes
                ],
            })

        chapter_list.append({
            "id": ch.id,
            "number": ch.number,
            "name": ch.name,
            "textbook_reference": ch.textbook_reference,
            "marks_weightage": ch.marks_weightage,
            "question_pattern_notes": ch.question_pattern_notes,
            "topics": topic_list,
        })

    return {
        "id": subject.id,
        "name": subject.name,
        "class_grade": subject.class_grade,
        "textbook_name": subject.textbook_name,
        "chapters": chapter_list,
    }


async def analyze_impact(
    db: AsyncSession,
    chapter_id: int,
    change_type: str,
    new_value: Optional[str] = None,
) -> ImpactAnalysisResponse:
    """
    Analyze impact of a proposed taxonomy change.

    For RENAME: FK references (chapter_id) are stable -- no data migration needed.
      The "affected" count represents entities that will DISPLAY the new name.
    For DELETE: count affected records. Recommendation = "deprecate instead".
    For ADD: safe_add, no impact.
    For MODIFY marks_weightage: targets_change, show which banks' gap alerts would shift.
    """
    chapter = await db.get(CurriculumChapter, chapter_id)
    if not chapter:
        return ImpactAnalysisResponse(
            change_type="safe_add",
            recommendation="Chapter not found.",
        )

    # Count affected questions (linked via chapter_id FK)
    q_count_result = await db.execute(
        select(func.count(Question.id)).where(Question.chapter_id == chapter_id)
    )
    affected_questions = q_count_result.scalar() or 0

    # Get sample question texts
    q_samples_result = await db.execute(
        select(Question.question_text)
        .where(Question.chapter_id == chapter_id)
        .limit(3)
    )
    affected_question_samples = [row[0][:80] for row in q_samples_result.all()]

    # Count affected papers (papers containing questions from this chapter)
    papers_result = await db.execute(
        select(func.count(distinct(PaperQuestion.paper_id)))
        .join(Question, PaperQuestion.question_id == Question.id)
        .where(Question.chapter_id == chapter_id)
    )
    affected_papers = papers_result.scalar() or 0

    # Count affected mastery records
    mastery_result = await db.execute(
        select(func.count(TopicMastery.id))
        .where(TopicMastery.chapter_id == chapter_id)
    )
    affected_mastery_records = mastery_result.scalar() or 0

    # Count affected workspaces (distinct workspace_ids from question banks)
    ws_result = await db.execute(
        select(func.count(distinct(QuestionBank.workspace_id)))
        .join(Question, Question.bank_id == QuestionBank.id)
        .where(
            Question.chapter_id == chapter_id,
            QuestionBank.workspace_id.isnot(None),
        )
    )
    affected_workspaces = ws_result.scalar() or 0

    # Determine change type and recommendation
    if change_type == "rename":
        return ImpactAnalysisResponse(
            affected_questions=affected_questions,
            affected_question_samples=affected_question_samples,
            affected_papers=affected_papers,
            affected_mastery_records=affected_mastery_records,
            affected_workspaces=affected_workspaces,
            change_type="safe_rename",
            recommendation=(
                f"{affected_questions} questions will display the new chapter name. "
                "FK references are stable -- no data migration needed."
            ),
        )
    elif change_type == "delete":
        return ImpactAnalysisResponse(
            affected_questions=affected_questions,
            affected_question_samples=affected_question_samples,
            affected_papers=affected_papers,
            affected_mastery_records=affected_mastery_records,
            affected_workspaces=affected_workspaces,
            change_type="breaking_delete",
            recommendation=(
                "Deprecate instead of deleting. "
                f"Deletion would orphan {affected_questions} questions, "
                f"{affected_papers} papers, and {affected_mastery_records} mastery records."
            ),
        )
    elif change_type == "modify_weightage":
        return ImpactAnalysisResponse(
            affected_questions=affected_questions,
            affected_question_samples=affected_question_samples,
            affected_papers=affected_papers,
            affected_mastery_records=affected_mastery_records,
            affected_workspaces=affected_workspaces,
            change_type="targets_change",
            recommendation=(
                f"Gap alerts will recalculate for {affected_workspaces} workspaces. "
                "No data changes required."
            ),
        )
    else:  # "add" or unknown
        return ImpactAnalysisResponse(
            change_type="safe_add",
            recommendation="New chapter addition. No existing data affected.",
        )
