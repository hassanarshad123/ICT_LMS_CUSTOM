import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.course import Lecture
from app.models.other import LectureProgress
from app.models.enums import VideoType, LectureWatchStatus
from app.utils.formatters import format_duration
from app.utils.transformers import to_db


async def list_lectures(
    session: AsyncSession,
    batch_id: uuid.UUID,
    course_id: Optional[uuid.UUID] = None,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[dict], int]:
    query = select(Lecture).where(
        Lecture.batch_id == batch_id, Lecture.deleted_at.is_(None)
    )
    count_query = select(func.count()).select_from(Lecture).where(
        Lecture.batch_id == batch_id, Lecture.deleted_at.is_(None)
    )

    if course_id:
        query = query.where(Lecture.course_id == course_id)
        count_query = count_query.where(Lecture.course_id == course_id)

    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(Lecture.sequence_order).offset(offset).limit(per_page)
    result = await session.execute(query)
    lectures = result.scalars().all()

    return [
        {
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
            "thumbnail_url": lec.thumbnail_url,
            "upload_date": lec.created_at,
            "created_at": lec.created_at,
        }
        for lec in lectures
    ], total


async def get_lecture(session: AsyncSession, lecture_id: uuid.UUID) -> Lecture | None:
    result = await session.execute(
        select(Lecture).where(Lecture.id == lecture_id, Lecture.deleted_at.is_(None))
    )
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
        created_by=created_by,
    )
    session.add(lecture)
    await session.commit()
    await session.refresh(lecture)
    return lecture


async def update_lecture(session: AsyncSession, lecture_id: uuid.UUID, **fields) -> Lecture:
    lecture = await get_lecture(session, lecture_id)
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


async def soft_delete_lecture(session: AsyncSession, lecture_id: uuid.UUID) -> None:
    lecture = await get_lecture(session, lecture_id)
    if not lecture:
        raise ValueError("Lecture not found")

    lecture.deleted_at = datetime.now(timezone.utc)
    session.add(lecture)
    await session.commit()


async def reorder_lecture(session: AsyncSession, lecture_id: uuid.UUID, new_order: int) -> Lecture:
    lecture = await get_lecture(session, lecture_id)
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
) -> LectureProgress:
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
        progress.watch_percentage = watch_percentage
        progress.resume_position_seconds = resume_position_seconds
        progress.status = status
        progress.updated_at = datetime.now(timezone.utc)
    else:
        progress = LectureProgress(
            student_id=student_id,
            lecture_id=lecture_id,
            watch_percentage=watch_percentage,
            resume_position_seconds=resume_position_seconds,
            status=status,
        )

    session.add(progress)
    await session.commit()
    await session.refresh(progress)
    return progress


async def get_progress(
    session: AsyncSession, student_id: uuid.UUID, lecture_id: uuid.UUID
) -> LectureProgress | None:
    result = await session.execute(
        select(LectureProgress).where(
            LectureProgress.student_id == student_id,
            LectureProgress.lecture_id == lecture_id,
        )
    )
    return result.scalar_one_or_none()
