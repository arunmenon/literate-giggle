"""
Syllabus Research Service.

Multi-source research pipeline that combines:
1. Curriculum DB lookup (instant)
2. Web search via Serper API (cached)
3. Uploaded document context
4. AI synthesis into a structured research brief
"""

import logging
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .curriculum_registry import CurriculumRegistry
from .ai_service import ai_service

logger = logging.getLogger(__name__)

_registry = CurriculumRegistry()

# Simple in-memory cache for research results
_research_cache: dict[str, dict] = {}


class ResearchBrief(BaseModel):
    """Structured research brief returned by AI."""
    key_concepts: list[str]
    common_misconceptions: list[str]
    question_pattern_suggestions: str
    difficulty_recommendation: str
    teaching_tips: str


RESEARCH_SYSTEM = (
    "You are an expert curriculum analyst for Indian school board exams. "
    "You help teachers prepare exam questions by providing research briefs "
    "on specific chapters. Your analysis is practical and focused on what "
    "matters for exam question creation."
)

RESEARCH_PROMPT = """Analyze this chapter for exam question generation:

**Board:** {board}
**Class:** {class_grade}
**Subject:** {subject}
**Chapter:** {chapter_name}
**Textbook Reference:** {textbook_ref}

**Topics covered:**
{topics_list}

**Learning Outcomes:**
{outcomes_list}

**Board-Specific Question Patterns:**
{pattern_notes}

{teacher_notes_section}

{web_search_section}

{document_section}

Provide a research brief covering:
1. Key concepts and formulas students must know
2. Common student misconceptions in this chapter
3. Board-specific question pattern suggestions
4. Difficulty distribution recommendation
5. Teaching tips relevant to question creation"""


async def research_chapter(
    board: str,
    class_grade: int,
    subject: str,
    chapter: str,
    teacher_notes: Optional[str] = None,
    db: Optional[AsyncSession] = None,
) -> Optional[dict]:
    """
    Research a chapter for grounded question generation.

    Combines curriculum DB, web search, and uploaded documents.
    Results are cached per (board, class, subject, chapter) key.
    """
    if db is None:
        from ..core.database import async_session
        async with async_session() as db:
            return await _do_research(board, class_grade, subject, chapter, teacher_notes, db)
    return await _do_research(board, class_grade, subject, chapter, teacher_notes, db)


async def _do_research(
    board: str,
    class_grade: int,
    subject: str,
    chapter: str,
    teacher_notes: Optional[str],
    db: AsyncSession,
) -> Optional[dict]:
    """Internal multi-source research implementation."""

    # ── Source 1: Curriculum DB ──
    chapter_detail = await _registry.get_chapter_detail(
        db, board, class_grade, subject, chapter
    )
    if chapter_detail is None:
        return None

    # Check cache
    cache_key = f"{board}:{class_grade}:{subject}:{chapter}:{teacher_notes or ''}"
    if cache_key in _research_cache:
        return _research_cache[cache_key]

    topics_list = "\n".join(f"- {t}" for t in chapter_detail.get("topics", []))
    outcomes_list = "\n".join(
        f"- {o}" for o in chapter_detail.get("learning_outcomes", [])
    )
    pattern_notes = chapter_detail.get("question_pattern_notes", "")
    textbook_ref = chapter_detail.get("textbook_ref", "")

    teacher_notes_section = ""
    if teacher_notes:
        teacher_notes_section = f"\n**Teacher Notes:**\n{teacher_notes}\n"

    # ── Source 2: Web search ──
    web_sources = []
    web_search_section = ""
    try:
        from .web_researcher import research_chapter_web
        web_data = await research_chapter_web(board, class_grade, subject, chapter, teacher_notes)
        web_sources = web_data.get("web_sources", [])
        if web_sources:
            snippets = "\n".join(
                f"- [{r['title']}]: {r['snippet']}" for r in web_sources[:5]
            )
            web_search_section = f"\n**Web Research Results:**\n{snippets}\n"
    except (ImportError, Exception) as e:
        logger.debug(f"Web search skipped: {e}")

    # ── Source 3: Uploaded documents ──
    document_sources = []
    document_section = ""
    try:
        from ..models.curriculum import UploadedDocument, CurriculumChapter, CurriculumSubject, Curriculum, Board as BoardModel
        from sqlalchemy import func

        # Find chapter ID for document lookup
        ch_result = await db.execute(
            select(CurriculumChapter.id)
            .join(CurriculumSubject)
            .join(Curriculum)
            .join(BoardModel)
            .where(
                BoardModel.code == board,
                CurriculumSubject.class_grade == class_grade,
                CurriculumSubject.name == subject,
                func.lower(CurriculumChapter.name) == chapter.lower(),
                Curriculum.is_active == True,
            )
        )
        chapter_row = ch_result.first()
        if chapter_row:
            chapter_id = chapter_row[0]
            doc_result = await db.execute(
                select(UploadedDocument).where(
                    UploadedDocument.chapter_id == chapter_id
                )
            )
            docs = doc_result.scalars().all()
            for doc in docs:
                excerpt = None
                if doc.extracted_text:
                    excerpt = doc.extracted_text[:500]
                document_sources.append({
                    "filename": doc.filename,
                    "content_type": doc.content_type,
                    "excerpt": excerpt,
                })
            if document_sources:
                doc_snippets = "\n".join(
                    f"- [{d['filename']} ({d['content_type']})]: {d.get('excerpt', '')[:200]}"
                    for d in document_sources
                )
                document_section = f"\n**Uploaded Reference Material:**\n{doc_snippets}\n"
    except Exception as e:
        logger.debug(f"Document lookup skipped: {e}")

    # ── AI Synthesis ──
    prompt = RESEARCH_PROMPT.format(
        board=board,
        class_grade=class_grade,
        subject=subject,
        chapter_name=chapter,
        textbook_ref=textbook_ref,
        topics_list=topics_list,
        outcomes_list=outcomes_list,
        pattern_notes=pattern_notes,
        teacher_notes_section=teacher_notes_section,
        web_search_section=web_search_section,
        document_section=document_section,
    )

    ai_result = await ai_service.generate_structured_fast(
        prompt,
        ResearchBrief,
        system=RESEARCH_SYSTEM,
        temperature=0.3,
        use_cache=True,
    )

    suggested_distribution = chapter_detail.get(
        "suggested_distribution", {"easy": 25, "medium": 50, "hard": 25}
    )

    if ai_result:
        generation_brief = (
            f"**Key Concepts:** {', '.join(ai_result.key_concepts)}\n\n"
            f"**Question Patterns:** {ai_result.question_pattern_suggestions}\n\n"
            f"**Difficulty Recommendation:** {ai_result.difficulty_recommendation}\n\n"
            f"**Teaching Tips:** {ai_result.teaching_tips}"
        )
        key_concepts = ai_result.key_concepts
        misconceptions = ai_result.common_misconceptions
    else:
        generation_brief = (
            f"**Topics:** {', '.join(chapter_detail.get('topics', []))}\n\n"
            f"**Board Pattern:** {pattern_notes}\n\n"
            f"**Textbook:** {textbook_ref}"
        )
        key_concepts = chapter_detail.get("topics", [])
        misconceptions = []

    result = {
        "chapter_info": {
            "name": chapter_detail["name"],
            "textbook_ref": textbook_ref,
            "topics": chapter_detail.get("topics", []),
            "learning_outcomes": chapter_detail.get("learning_outcomes", []),
        },
        "generation_brief": generation_brief,
        "suggested_distribution": suggested_distribution,
        "key_concepts": key_concepts,
        "misconceptions": misconceptions,
        "teacher_notes_incorporated": teacher_notes,
        "web_sources": [
            {"title": s["title"], "url": s["link"], "snippet": s["snippet"]}
            for s in web_sources
        ],
        "document_sources": document_sources,
    }

    _research_cache[cache_key] = result
    return result
