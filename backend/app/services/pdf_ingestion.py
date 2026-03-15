"""
PDF Ingestion Pipeline.

Extracts text from uploaded PDFs using pymupdf4llm and optionally
parses exam papers into individual questions using AI structured extraction.
"""

import logging
from typing import Optional

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ParsedQuestion(BaseModel):
    """A single question extracted from an exam paper."""
    question_number: str
    question_text: str
    marks: Optional[int] = None
    section: Optional[str] = None
    question_type: Optional[str] = None
    sub_parts: Optional[list[str]] = None
    has_diagram: bool = False


class ParsedPaper(BaseModel):
    """Structured result of parsing an exam paper."""
    questions: list[ParsedQuestion]


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from a PDF file as markdown.

    Uses pymupdf4llm for clean markdown extraction.
    Returns empty string if extraction fails.
    """
    try:
        import pymupdf4llm
        md_text = pymupdf4llm.to_markdown(file_path)
        return md_text
    except Exception as e:
        logger.warning(f"PDF text extraction failed for {file_path}: {e}")
        return ""


async def parse_exam_paper(
    text: str,
    board: str,
    subject: str,
) -> Optional[list[dict]]:
    """
    Parse extracted PDF text into individual questions using AI.

    Returns a list of question dicts, or None if AI is unavailable.
    """
    if not text or len(text.strip()) < 50:
        return None

    try:
        from .ai_service import ai_service

        # Truncate to avoid token limits
        truncated = text[:8000]

        prompt = f"""Parse this exam paper text into individual questions.

**Board:** {board}
**Subject:** {subject}

**Paper Text:**
{truncated}

Extract each question with:
- question_number: The question number as shown
- question_text: The full question text
- marks: Marks allocated (if shown)
- section: Which section (e.g. "Section A")
- question_type: One of mcq, short_answer, long_answer, numerical, fill_in_blank, true_false, case_study
- sub_parts: List of sub-part texts if the question has parts (a), (b), etc.
- has_diagram: true if the question mentions or requires a diagram"""

        system = (
            "You are an expert at parsing Indian board exam papers. "
            "Extract questions accurately, preserving mathematical notation."
        )

        result = await ai_service.generate_structured_fast(
            prompt,
            ParsedPaper,
            system=system,
            temperature=0.1,
        )

        if result:
            return [q.model_dump() for q in result.questions]
        return None

    except Exception as e:
        logger.warning(f"Exam paper parsing failed: {e}")
        return None


async def ingest_document(
    file_path: str,
    filename: str,
    content_type: str,
    teacher_id: int,
    chapter_id: Optional[int] = None,
    db=None,
) -> dict:
    """
    Full ingestion pipeline: extract text, optionally parse questions, save record.

    Returns a dict with document info and extraction results.
    """
    extracted_text = extract_text_from_pdf(file_path)
    extracted_questions = None

    if content_type == "past_paper" and extracted_text:
        extracted_questions = await parse_exam_paper(extracted_text, "", "")

    if db:
        from ..models.curriculum import UploadedDocument
        doc = UploadedDocument(
            teacher_id=teacher_id,
            chapter_id=chapter_id,
            filename=filename,
            file_path=file_path,
            content_type=content_type,
            extracted_text=extracted_text,
            extracted_questions=extracted_questions,
        )
        db.add(doc)
        await db.flush()
        return {
            "id": doc.id,
            "filename": doc.filename,
            "content_type": doc.content_type,
            "extracted_text_length": len(extracted_text) if extracted_text else 0,
            "extracted_question_count": len(extracted_questions) if extracted_questions else 0,
        }

    return {
        "filename": filename,
        "content_type": content_type,
        "extracted_text_length": len(extracted_text) if extracted_text else 0,
        "extracted_question_count": len(extracted_questions) if extracted_questions else 0,
    }
