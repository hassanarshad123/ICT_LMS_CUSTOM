"""One-off backfill: fetch actual storageSize from Bunny API for all lectures missing file_size.

Usage (on production EC2):
    cd /home/ubuntu/ICT_LMS_CUSTOM/backend
    source venv/bin/activate
    python -m scripts.backfill_video_sizes
"""
import asyncio
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def main() -> None:
    from sqlmodel import select
    from app.database import async_session
    from app.models.course import Lecture
    from app.utils.bunny import get_video_details
    from app.services.institute_service import recalculate_usage

    async with async_session() as session:
        result = await session.execute(
            select(Lecture).where(
                Lecture.bunny_video_id.isnot(None),
                Lecture.file_size.is_(None),
                Lecture.deleted_at.is_(None),
            )
        )
        lectures = result.scalars().all()

    logger.info("Found %d lectures with NULL file_size", len(lectures))
    if not lectures:
        logger.info("Nothing to backfill")
        return

    updated = 0
    failed = 0
    institute_ids: set = set()

    for lecture in lectures:
        try:
            details = await get_video_details(lecture.bunny_video_id)
            storage_size = details["storage_size"]
            if storage_size <= 0:
                logger.warning(
                    "Lecture %s (bunny=%s): storageSize is %d, skipping",
                    lecture.id, lecture.bunny_video_id, storage_size,
                )
                continue

            async with async_session() as session:
                from sqlalchemy import update
                await session.execute(
                    update(Lecture)
                    .where(Lecture.id == lecture.id)
                    .values(
                        file_size=storage_size,
                        duration=details["duration"] if details["duration"] > 0 and not lecture.duration else lecture.duration,
                    )
                )
                await session.commit()

            if lecture.institute_id:
                institute_ids.add(lecture.institute_id)
            updated += 1
            logger.info(
                "  [%d/%d] Lecture %s → %s bytes (%.2f MB)",
                updated + failed, len(lectures),
                str(lecture.id)[:8], storage_size, storage_size / (1024 * 1024),
            )
        except Exception as e:
            failed += 1
            logger.error("  [%d/%d] Lecture %s FAILED: %s", updated + failed, len(lectures), lecture.id, e)

    logger.info("Backfill complete: %d updated, %d failed out of %d", updated, failed, len(lectures))

    if institute_ids:
        logger.info("Recalculating usage for %d institutes...", len(institute_ids))
        for iid in institute_ids:
            try:
                async with async_session() as session:
                    await recalculate_usage(session, iid)
                logger.info("  Recalculated institute %s", str(iid)[:8])
            except Exception as e:
                logger.error("  Failed to recalculate institute %s: %s", iid, e)

    logger.info("Done.")


if __name__ == "__main__":
    asyncio.run(main())
