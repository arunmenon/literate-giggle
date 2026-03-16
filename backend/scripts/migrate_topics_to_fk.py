"""
Migration script: link existing questions to CurriculumChapters via chapter_id FK.

Iterates Questions with chapter_id IS NULL, fuzzy matches topic string against
curriculum chapters for the bank's board/class/subject.
Target: >= 90% match rate on seeded data.

Usage:
    cd backend
    python scripts/migrate_topics_to_fk.py
"""

import asyncio
import sys
import os

# Add backend directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.core.database import init_db, async_session
from app.models.exam import Question, QuestionBank
from app.services.taxonomy_service import fuzzy_match_topic_to_chapter


async def migrate():
    await init_db()

    matched = 0
    unmatched = 0
    unmatched_topics = []
    total = 0

    async with async_session() as db:
        # Get all questions with chapter_id IS NULL
        result = await db.execute(
            select(Question).where(Question.chapter_id.is_(None))
        )
        questions = result.scalars().all()
        total = len(questions)

        if total == 0:
            print("No questions need migration (all have chapter_id set).")
            return

        print(f"Found {total} questions without chapter_id. Starting migration...")

        # Cache bank lookups
        bank_cache: dict[int, QuestionBank] = {}

        for q in questions:
            if not q.topic:
                unmatched += 1
                unmatched_topics.append(f"Q#{q.id}: (no topic)")
                continue

            # Get bank info for board/class/subject context
            if q.bank_id not in bank_cache:
                bank = await db.get(QuestionBank, q.bank_id)
                if bank:
                    bank_cache[q.bank_id] = bank

            bank = bank_cache.get(q.bank_id)
            if not bank:
                unmatched += 1
                unmatched_topics.append(f"Q#{q.id}: bank not found")
                continue

            chapter_id = await fuzzy_match_topic_to_chapter(
                q.topic, bank.board, bank.class_grade, bank.subject, db
            )

            if chapter_id:
                q.chapter_id = chapter_id
                matched += 1
            else:
                unmatched += 1
                unmatched_topics.append(
                    f"Q#{q.id}: '{q.topic}' ({bank.board} {bank.class_grade} {bank.subject})"
                )

        await db.commit()

    # Report
    pct = (matched / total * 100) if total > 0 else 0
    print(f"\nMigration complete:")
    print(f"  Total:     {total}")
    print(f"  Matched:   {matched} ({pct:.1f}%)")
    print(f"  Unmatched: {unmatched}")

    if unmatched_topics:
        print(f"\nUnmatched topics:")
        for t in unmatched_topics:
            print(f"  - {t}")

    if pct >= 90:
        print(f"\n[PASS] Match rate {pct:.1f}% >= 90% target")
    else:
        print(f"\n[WARN] Match rate {pct:.1f}% < 90% target")


if __name__ == "__main__":
    asyncio.run(migrate())
