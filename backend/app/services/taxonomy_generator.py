"""
AI Taxonomy Generator.

Generates curriculum taxonomy (chapters, topics, learning outcomes)
from web research or uploaded PDF documents using AI structured extraction.
"""

import logging
from typing import Optional

from pydantic import BaseModel, Field

from .ai_service import ai_service
from .web_researcher import search_web

logger = logging.getLogger(__name__)


# ── Pydantic models for structured generation ──


class GeneratedOutcome(BaseModel):
    description: str
    bloom_level: str = "understand"


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


class GeneratedTaxonomy(BaseModel):
    chapters: list[GeneratedChapter] = Field(default_factory=list)


TAXONOMY_SYSTEM = (
    "You are an expert curriculum specialist for Indian board exams (CBSE, ICSE, "
    "and State Boards). You have deep knowledge of official syllabi, NCERT/ICSE "
    "textbooks, and board exam patterns. You create accurate, comprehensive "
    "curriculum structures aligned with the official syllabus."
)

TAXONOMY_PROMPT = """Generate a complete curriculum taxonomy for:

**Board:** {board}
**Class:** {class_grade}
**Subject:** {subject}

{research_context}

Create the full chapter-topic-outcome tree with:
- All chapters in the official syllabus for this board/class/subject
- Each chapter should have: number, name, textbook_reference (e.g. "NCERT Ch. 1"),
  marks_weightage (marks typically allocated in board exams), question_pattern_notes
- Each chapter's topics (key concepts within the chapter)
- Each topic's learning outcomes with Bloom's taxonomy levels
  (remember, understand, apply, analyze, evaluate, create)

Be comprehensive and accurate. Include ALL chapters from the official syllabus.
Use the research context provided to ensure accuracy."""

PDF_EXTRACTION_PROMPT = """Extract a curriculum taxonomy from this document text:

**Board:** {board}
**Class:** {class_grade}
**Subject:** {subject}

**Document Text:**
{document_text}

Extract the chapter-topic structure visible in the document. For each chapter found:
- Identify chapter number and name
- Extract topics/subtopics
- Infer learning outcomes where possible
- Note any question patterns mentioned
- Estimate marks weightage if shown

If this appears to be a table of contents, extract the full chapter structure.
If this is a past paper, extract the chapters/topics covered and note question patterns."""


async def generate_from_research(
    board: str,
    class_grade: int,
    subject: str,
) -> Optional[dict]:
    """
    Generate a taxonomy from web research.

    Runs 3 web searches (syllabus, textbook TOC, marking scheme),
    combines snippets into grounding prompt, and uses AI structured extraction.

    Returns a dict with chapters, topics, outcomes, and sources_used.
    Returns None if AI is unavailable.
    """
    sources_used = []
    research_snippets = []

    # Run 3 targeted searches
    searches = [
        f"{board} Class {class_grade} {subject} official syllabus 2025-26",
        f"{board} Class {class_grade} {subject} textbook table of contents chapters",
        f"{board} Class {class_grade} {subject} marking scheme weightage",
    ]

    for query in searches:
        results = await search_web(query, num_results=3)
        for r in results:
            sources_used.append(r.get("link", ""))
            snippet = r.get("snippet", "")
            title = r.get("title", "")
            if snippet:
                research_snippets.append(f"**{title}**: {snippet}")

    # Build research context
    research_context = ""
    if research_snippets:
        research_context = (
            "**Research Context (from web search):**\n"
            + "\n".join(research_snippets[:15])
        )
    else:
        research_context = (
            "No web research available. Generate based on your knowledge of "
            f"the official {board} syllabus for Class {class_grade} {subject}."
        )

    prompt = TAXONOMY_PROMPT.format(
        board=board,
        class_grade=class_grade,
        subject=subject,
        research_context=research_context,
    )

    result = await ai_service.generate_structured(
        prompt,
        GeneratedTaxonomy,
        system=TAXONOMY_SYSTEM,
        temperature=0.3,
        use_cache=False,
        max_tokens=4000,
    )

    if result is None:
        return None

    # Convert to response dict
    chapters = []
    for ch in result.chapters:
        topics = []
        for t in ch.topics:
            outcomes = [
                {"description": lo.description, "bloom_level": lo.bloom_level}
                for lo in t.learning_outcomes
            ]
            topics.append({
                "name": t.name,
                "description": t.description,
                "learning_outcomes": outcomes,
            })
        chapters.append({
            "number": ch.number,
            "name": ch.name,
            "textbook_reference": ch.textbook_reference,
            "marks_weightage": ch.marks_weightage,
            "question_pattern_notes": ch.question_pattern_notes,
            "topics": topics,
        })

    return {
        "board": board,
        "class_grade": class_grade,
        "subject": subject,
        "chapters": chapters,
        "sources_used": [s for s in sources_used if s],
    }


async def generate_from_pdf(
    extracted_text: str,
    board: str,
    class_grade: int,
    subject: str,
) -> Optional[dict]:
    """
    Extract chapter/topic structure from document text via AI structured extraction.

    For textbooks: extracts chapter/topic structure from TOC.
    For past papers: extracts question patterns per chapter.

    Returns a dict with chapters, topics, outcomes.
    Returns None if AI is unavailable.
    """
    if not extracted_text or len(extracted_text.strip()) < 50:
        return None

    # Truncate to avoid token limits
    truncated = extracted_text[:8000]

    prompt = PDF_EXTRACTION_PROMPT.format(
        board=board,
        class_grade=class_grade,
        subject=subject,
        document_text=truncated,
    )

    result = await ai_service.generate_structured(
        prompt,
        GeneratedTaxonomy,
        system=TAXONOMY_SYSTEM,
        temperature=0.2,
        use_cache=False,
        max_tokens=4000,
    )

    if result is None:
        return None

    chapters = []
    for ch in result.chapters:
        topics = []
        for t in ch.topics:
            outcomes = [
                {"description": lo.description, "bloom_level": lo.bloom_level}
                for lo in t.learning_outcomes
            ]
            topics.append({
                "name": t.name,
                "description": t.description,
                "learning_outcomes": outcomes,
            })
        chapters.append({
            "number": ch.number,
            "name": ch.name,
            "textbook_reference": ch.textbook_reference,
            "marks_weightage": ch.marks_weightage,
            "question_pattern_notes": ch.question_pattern_notes,
            "topics": topics,
        })

    return {
        "board": board,
        "class_grade": class_grade,
        "subject": subject,
        "chapters": chapters,
        "sources_used": [],
    }
