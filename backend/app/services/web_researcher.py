"""
Web Research Service.

Uses Serper API to search for official syllabus documents, past board papers,
question patterns, and marking schemes. Results are cached with a 30-day TTL.
"""

import logging
import time
from typing import Optional

import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)

# In-memory cache: key -> (timestamp, results)
_search_cache: dict[str, tuple[float, list[dict]]] = {}
CACHE_TTL_SECONDS = 30 * 24 * 60 * 60  # 30 days

SERPER_URL = "https://google.serper.dev/search"


async def search_web(query: str, num_results: int = 5) -> list[dict]:
    """
    Search the web using Serper API.

    Returns a list of {title, link, snippet} dicts.
    Returns empty list if SERPER_API_KEY is not configured.
    """
    if not settings.SERPER_API_KEY:
        logger.debug("SERPER_API_KEY not set -- skipping web search")
        return []

    # Check cache
    cache_key = f"{query}:{num_results}"
    if cache_key in _search_cache:
        cached_time, cached_results = _search_cache[cache_key]
        if time.time() - cached_time < CACHE_TTL_SECONDS:
            return cached_results

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                SERPER_URL,
                headers={
                    "X-API-KEY": settings.SERPER_API_KEY,
                    "Content-Type": "application/json",
                },
                json={"q": query, "num": num_results},
            )
            response.raise_for_status()
            data = response.json()

        results = [
            {
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "snippet": item.get("snippet", ""),
            }
            for item in data.get("organic", [])
        ]

        _search_cache[cache_key] = (time.time(), results)
        return results

    except Exception as e:
        logger.warning(f"Web search failed: {e}")
        return []


async def research_chapter_web(
    board: str,
    class_grade: int,
    subject: str,
    chapter: str,
    teacher_notes: Optional[str] = None,
) -> dict:
    """
    Run targeted web searches for a chapter and return combined results.

    Runs 2-3 searches:
    1. Important questions and competency-based patterns
    2. Marking scheme and weightage
    3. NCERT exercise solutions (for CBSE)

    Returns dict with web_sources list.
    """
    year = "2025"
    queries = [
        f"{board} Class {class_grade} {subject} {chapter} important questions competency based {year}",
        f"{board} {subject} {chapter} marking scheme weightage board exam",
    ]
    if board == "CBSE":
        queries.append(
            f"NCERT {subject} {chapter} exercise solutions class {class_grade}"
        )

    all_results = []
    seen_links = set()

    for query in queries:
        results = await search_web(query, num_results=3)
        for r in results:
            if r["link"] not in seen_links:
                seen_links.add(r["link"])
                all_results.append(r)

    return {
        "web_sources": all_results,
        "queries_run": queries,
    }
