import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.course import Lecture
from app.models.progress import LectureProgress
from app.models.enums import VideoType, LectureWatchStatus
from app.utils.formatters import format_duration
from app.utils.transformers import to_db


async def list_in_progress_lectures(
    session: AsyncSession,
    student_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
    limit: int = 10,
) -> list[dict]:
    """Return in-progress lectures across all active student batches,
    ordered by most recently watched."""
    from app.models.batch import Batch, StudentBatch
    from app.models.course import Course, BatchCourse

    # Join progress → lecture → student_batch → batch, filter active enrollments
    query = (
        select(
            LectureProgress.watch_percentage,
            LectureProgress.resume_position_seconds,
            LectureProgress.updated_at.label("last_watched_at"),
            Lecture.id.label("lecture_id"),
            Lecture.title,
            Lecture.thumbnail_url,
            Lecture.video_type,
            Lecture.video_url,
            Lecture.video_status,
            Lecture.duration,
            Lecture.batch_id,
            Lecture.course_id,
            Batch.name.label("batch_name"),
        )
        .join(Lecture, LectureProgress.lecture_id == Lecture.id)
        .join(StudentBatch, (StudentBatch.batch_id == Lecture.batch_id) & (StudentBatch.student_id == student_id))
        .join(Batch, Batch.id == Lecture.batch_id)
        .where(
            LectureProgress.student_id == student_id,
            LectureProgress.status == LectureWatchStatus.in_progress,
            Lecture.deleted_at.is_(None),
            Batch.deleted_at.is_(None),
            StudentBatch.removed_at.is_(None),
            StudentBatch.is_active.is_(True),
        )
        .order_by(LectureProgress.updated_at.desc())
        .limit(limit)
    )

    if institute_id is not None:
        query = query.where(LectureProgress.institute_id == institute_id)

    result = await session.execute(query)
    rows = result.all()

    # Collect course IDs to fetch titles in bulk
    course_ids = {r.course_id for r in rows if r.course_id}
    course_titles: dict[uuid.UUID, str] = {}
    if course_ids:
        course_result = await session.execute(
            select(Course.id, Course.title).where(Course.id.in_(course_ids))
        )
        course_titles = {cid: ctitle for cid, ctitle in course_result.all()}

    items = []
    for row in rows:
        items.append({
            "id": row.lecture_id,
            "title": row.title,
            "thumbnail_url": row.thumbnail_url,
            "video_type": row.video_type.value if hasattr(row.video_type, "value") else row.video_type,
            "video_url": row.video_url,
            "video_status": row.video_status,
            "duration": row.duration,
            "duration_display": format_duration(row.duration),
            "batch_id": row.batch_id,
            "batch_name": row.batch_name,
            "course_id": row.course_id,
            "course_title": course_titles.get(row.course_id) if row.course_id else None,
            "watch_percentage": row.watch_percentage,
            "resume_position_seconds": row.resume_position_seconds,
            "last_watched_at": row.last_watched_at,
        })

    return items


async def list_lectures(
    session: AsyncSession,
    batch_id: uuid.UUID,
    course_id: Optional[uuid.UUID] = None,
    page: int = 1,
    per_page: int = 50,
    institute_id: Optional[uuid.UUID] = None,
    student_id: Optional[uuid.UUID] = None,
) -> tuple[list[dict], int]:
    query = select(Lecture).where(
        Lecture.batch_id == batch_id, Lecture.deleted_at.is_(None)
    )
    count_query = select(func.count()).select_from(Lecture).where(
        Lecture.batch_id == batch_id, Lecture.deleted_at.is_(None)
    )

    if institute_id is not None:
        query = query.where(Lecture.institute_id == institute_id)
        count_query = count_query.where(Lecture.institute_id == institute_id)

    if course_id:
        query = query.where(Lecture.course_id == course_id)
        count_query = count_query.where(Lecture.course_id == course_id)

    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(Lecture.sequence_order).offset(offset).limit(per_page)
    result = await session.execute(query)
    lectures = result.scalars().all()

    # Fetch progress and gating info for students
    progress_map: dict[uuid.UUID, tuple[int, str]] = {}
    gating_enabled = False
    gating_threshold = 65
    prev_lecture_map: dict[uuid.UUID, uuid.UUID] = {}  # lecture_id -> previous lecture_id
    if student_id:
        from app.models.batch import Batch
        batch = await session.get(Batch, batch_id)
        if batch:
            gating_enabled = batch.enable_lecture_gating
            gating_threshold = batch.lecture_gating_threshold

        # Build predecessor map from ALL lectures (not just current page)
        # so gating works correctly across pagination boundaries.
        if gating_enabled:
            all_lec_query = select(Lecture.id, Lecture.course_id, Lecture.sequence_order).where(
                Lecture.batch_id == batch_id, Lecture.deleted_at.is_(None),
            )
            if course_id:
                all_lec_query = all_lec_query.where(Lecture.course_id == course_id)
            if institute_id is not None:
                all_lec_query = all_lec_query.where(Lecture.institute_id == institute_id)
            all_lec_query = all_lec_query.order_by(Lecture.course_id, Lecture.sequence_order)
            all_lec_result = await session.execute(all_lec_query)
            all_lecs = all_lec_result.all()

            # Group by course_id and link each lecture to its predecessor
            from collections import defaultdict
            by_course: dict[uuid.UUID | None, list[uuid.UUID]] = defaultdict(list)
            for lid, cid, _seq in all_lecs:
                by_course[cid].append(lid)
            for ordered_ids in by_course.values():
                for j in range(1, len(ordered_ids)):
                    prev_lecture_map[ordered_ids[j]] = ordered_ids[j - 1]

        # Fetch progress for lectures on this page + any predecessors needed for gating
        lecture_ids = [lec.id for lec in lectures]
        ids_to_fetch = set(lecture_ids) | set(prev_lecture_map.get(lid) for lid in lecture_ids if prev_lecture_map.get(lid))
        if ids_to_fetch:
            prog_result = await session.execute(
                select(LectureProgress).where(
                    LectureProgress.student_id == student_id,
                    LectureProgress.lecture_id.in_(ids_to_fetch),
                )
            )
            for p in prog_result.scalars().all():
                progress_map[p.lecture_id] = (p.watch_percentage, p.status.value)

    items = []
    for lec in lectures:
        item = {
            "id": lec.id,
            "title": lec.title,
            "description": lec.description,
            "video_type": lec.video_type.value,
            "video_url": lec.video_url,
            "bunny_video_id": lec.bunny_video_id,
            "duration": lec.duration,
            "duration_display": format_duration(lec.duration),
            "file_size": lec.file_size,
            "batch_id": lec.batch_id,
            "course_id": lec.course_id,
            "sequence_order": lec.sequence_order,
            "video_status": lec.video_status,
            "thumbnail_url": lec.thumbnail_url,
            "upload_date": lec.created_at,
            "created_at": lec.created_at,
        }

        if student_id:
            wp, ps = progress_map.get(lec.id, (0, "unwatched"))
            item["watch_percentage"] = wp
            item["progress_status"] = ps
            if gating_enabled:
                prev_id = prev_lecture_map.get(lec.id)
                if prev_id is None:
                    # First lecture in its course — always unlocked
                    item["is_locked"] = False
                else:
                    prev_wp, _ = progress_map.get(prev_id, (0, "unwatched"))
                    item["is_locked"] = prev_wp < gating_threshold
            else:
                item["is_locked"] = False

        items.append(item)

    return items, total


async def get_lecture(
    session: AsyncSession, lecture_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> Lecture | None:
    filters = [Lecture.id == lecture_id, Lecture.deleted_at.is_(None)]
    if institute_id is not None:
        filters.append(Lecture.institute_id == institute_id)
    result = await session.execute(select(Lecture).where(*filters))
    return result.scalar_one_or_none()


async def create_lecture(
    session: AsyncSession,
    title: str,
    batch_id: uuid.UUID,
    video_type: str,
    created_by: uuid.UUID,
    description: Optional[str] = None,
    video_url: Optional[str] = None,
    duration: Optional[int] = None,
    course_id: Optional[uuid.UUID] = None,
    bunny_video_id: Optional[str] = None,
    bunny_library_id: Optional[str] = None,
    file_size: Optional[int] = None,
    thumbnail_url: Optional[str] = None,
    video_status: Optional[str] = None,
    institute_id: Optional[uuid.UUID] = None,
) -> Lecture:
    # Auto-assign sequence_order
    result = await session.execute(
        select(func.coalesce(func.max(Lecture.sequence_order), 0)).where(
            Lecture.batch_id == batch_id,
            Lecture.deleted_at.is_(None),
            *([Lecture.course_id == course_id] if course_id else []),
        )
    )
    max_order = result.scalar() or 0

    lecture = Lecture(
        title=title,
        description=description,
        video_type=VideoType(to_db(video_type)),
        video_url=video_url,
        duration=duration,
        batch_id=batch_id,
        course_id=course_id,
        sequence_order=max_order + 1,
        bunny_video_id=bunny_video_id,
        bunny_library_id=bunny_library_id,
        file_size=file_size,
        thumbnail_url=thumbnail_url,
        video_status=video_status,
        created_by=created_by,
        institute_id=institute_id,
    )
    session.add(lecture)
    await session.commit()
    await session.refresh(lecture)
    return lecture


async def update_lecture(session: AsyncSession, lecture_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None, **fields) -> Lecture:
    lecture = await get_lecture(session, lecture_id, institute_id=institute_id)
    if not lecture:
        raise ValueError("Lecture not found")

    for key, value in fields.items():
        if value is not None and hasattr(lecture, key):
            setattr(lecture, key, value)

    lecture.updated_at = datetime.now(timezone.utc)
    session.add(lecture)
    await session.commit()
    await session.refresh(lecture)
    return lecture


async def soft_delete_lecture(session: AsyncSession, lecture_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None) -> None:
    lecture = await get_lecture(session, lecture_id, institute_id=institute_id)
    if not lecture:
        raise ValueError("Lecture not found")

    # Delete video from Bunny if it exists
    if lecture.bunny_video_id:
        try:
            from app.utils.bunny import delete_video
            await delete_video(lecture.bunny_video_id)
        except Exception:
            pass  # Best-effort cleanup; don't block deletion

    lecture.deleted_at = datetime.now(timezone.utc)
    session.add(lecture)
    await session.commit()


async def reorder_lecture(session: AsyncSession, lecture_id: uuid.UUID, new_order: int, institute_id: Optional[uuid.UUID] = None) -> Lecture:
    lecture = await get_lecture(session, lecture_id, institute_id=institute_id)
    if not lecture:
        raise ValueError("Lecture not found")

    lecture.sequence_order = new_order
    lecture.updated_at = datetime.now(timezone.utc)
    session.add(lecture)
    await session.commit()
    await session.refresh(lecture)
    return lecture


async def upsert_progress(
    session: AsyncSession,
    student_id: uuid.UUID,
    lecture_id: uuid.UUID,
    watch_percentage: int,
    resume_position_seconds: int = 0,
    institute_id: Optional[uuid.UUID] = None,
) -> LectureProgress:
    # Validate watch_percentage bounds
    if not (0 <= watch_percentage <= 100):
        raise ValueError("watch_percentage must be between 0 and 100")

    # Validate lecture belongs to the same institute
    if institute_id is not None:
        lec = await get_lecture(session, lecture_id, institute_id=institute_id)
        if not lec:
            raise ValueError("Lecture not found")
    result = await session.execute(
        select(LectureProgress).where(
            LectureProgress.student_id == student_id,
            LectureProgress.lecture_id == lecture_id,
        )
    )
    progress = result.scalar_one_or_none()

    # Determine status
    if watch_percentage >= 90:
        status = LectureWatchStatus.completed
    elif watch_percentage > 0:
        status = LectureWatchStatus.in_progress
    else:
        status = LectureWatchStatus.unwatched

    if progress:
        # High-water-mark: never downgrade watch_percentage or revert completed status
        if progress.status == LectureWatchStatus.completed:
            # Once completed, only update resume position
            progress.resume_position_seconds = resume_position_seconds
            progress.updated_at = datetime.now(timezone.utc)
        else:
            progress.watch_percentage = max(watch_percentage, progress.watch_percentage)
            progress.resume_position_seconds = resume_position_seconds
            # Recalculate status based on the (possibly preserved) higher percentage
            if progress.watch_percentage >= 90:
                progress.status = LectureWatchStatus.completed
            elif progress.watch_percentage > 0:
                progress.status = LectureWatchStatus.in_progress
            else:
                progress.status = LectureWatchStatus.unwatched
            progress.updated_at = datetime.now(timezone.utc)
    else:
        progress = LectureProgress(
            student_id=student_id,
            lecture_id=lecture_id,
            watch_percentage=watch_percentage,
            resume_position_seconds=resume_position_seconds,
            status=status,
            institute_id=institute_id,
        )

    session.add(progress)
    await session.commit()
    await session.refresh(progress)
    return progress


_STATUS_RANK = {"pending": 0, "processing": 1, "ready": 2, "failed": 2}


async def update_lecture_status(
    session: AsyncSession,
    bunny_video_id: str,
    status: str,
    thumbnail_url: Optional[str] = None,
    duration: Optional[int] = None,
    file_size: Optional[int] = None,
) -> None:
    """Find lecture by bunny_video_id and update its video_status (and optionally thumbnail/duration/file_size).

    Called from Bunny webhook (HMAC-signed, no auth context). Queries globally by
    bunny_video_id which is unique per video. The HMAC signature on the webhook
    prevents unauthorized callers.

    Status rank protection: never downgrades a higher-rank status (e.g. ready → processing).
    """
    result = await session.execute(
        select(Lecture).where(
            Lecture.bunny_video_id == bunny_video_id,
            Lecture.deleted_at.is_(None),
        )
    )
    lecture = result.scalar_one_or_none()
    if lecture and lecture.institute_id is None:
        logging.getLogger(__name__).warning(
            "Lecture %s has no institute_id (bunny_video_id=%s)", lecture.id, bunny_video_id,
        )
    if lecture:
        current_rank = _STATUS_RANK.get(lecture.video_status, 0)
        new_rank = _STATUS_RANK.get(status, 0)
        if new_rank < current_rank:
            return  # Never downgrade status
        lecture.video_status = status
        if thumbnail_url:
            lecture.thumbnail_url = thumbnail_url
        if duration is not None and duration > 0:
            lecture.duration = duration
        if file_size is not None and file_size > 0:
            lecture.file_size = file_size
        lecture.updated_at = datetime.now(timezone.utc)
        session.add(lecture)
        await session.commit()


async def bulk_reorder_lectures(
    session: AsyncSession,
    items: list[tuple[uuid.UUID, int]],
    institute_id: Optional[uuid.UUID] = None,
) -> None:
    """Reorder multiple lectures in a single transaction (batched SELECT)."""
    lecture_ids = [item[0] for item in items]
    order_map = {lid: order for lid, order in items}

    # Single batched SELECT instead of N+1
    filters = [
        Lecture.id.in_(lecture_ids),
        Lecture.deleted_at.is_(None),
    ]
    if institute_id is not None:
        filters.append(Lecture.institute_id == institute_id)

    result = await session.execute(select(Lecture).where(*filters))
    fetched = {lec.id: lec for lec in result.scalars().all()}

    not_found = [str(lid) for lid in lecture_ids if lid not in fetched]
    if not_found:
        raise ValueError(f"Lectures not found or not accessible: {', '.join(not_found)}")

    now = datetime.now(timezone.utc)
    for lecture_id, lecture in fetched.items():
        lecture.sequence_order = order_map[lecture_id]
        lecture.updated_at = now
        session.add(lecture)
    await session.commit()


async def get_progress(
    session: AsyncSession, student_id: uuid.UUID, lecture_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> LectureProgress | None:
    # Validate lecture belongs to the same institute
    if institute_id is not None:
        lec = await get_lecture(session, lecture_id, institute_id=institute_id)
        if not lec:
            raise ValueError("Lecture not found")
    result = await session.execute(
        select(LectureProgress).where(
            LectureProgress.student_id == student_id,
            LectureProgress.lecture_id == lecture_id,
        )
    )
    return result.scalar_one_or_none()
