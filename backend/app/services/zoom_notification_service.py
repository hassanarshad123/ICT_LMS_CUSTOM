"""Zoom class notification service -- in-app only notifications for class lifecycle events."""

import logging
import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.zoom import ZoomClass
from app.models.batch import StudentBatch
from app.models.user import User
from app.services import notification_service

logger = logging.getLogger("ict_lms.zoom_notifications")


# ---------------------------------------------------------------------------
# Helper: resolve recipients for a zoom class
# ---------------------------------------------------------------------------

async def _get_class_recipients(
    session: AsyncSession,
    zoom_class: ZoomClass,
) -> tuple[list[uuid.UUID], Optional[uuid.UUID]]:
    """Return (student_ids, teacher_id) for a zoom class."""
    stmt = (
        select(User.id)
        .join(StudentBatch, StudentBatch.student_id == User.id)
        .where(
            StudentBatch.batch_id == zoom_class.batch_id,
            StudentBatch.removed_at.is_(None),
            StudentBatch.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )
    result = await session.execute(stmt)
    student_ids = [row[0] for row in result.all()]

    teacher_id: Optional[uuid.UUID] = None
    if zoom_class.teacher_id:
        t = await session.get(User, zoom_class.teacher_id)
        if t and t.deleted_at is None:
            teacher_id = t.id

    return student_ids, teacher_id


# ---------------------------------------------------------------------------
# 1. Class Scheduled
# ---------------------------------------------------------------------------

async def notify_class_scheduled(
    session: AsyncSession,
    zoom_class: ZoomClass,
    batch_name: str,
    teacher_name: str,
) -> None:
    """Notify students + teacher that a new class has been scheduled."""
    try:
        student_ids, teacher_id = await _get_class_recipients(session, zoom_class)

        all_ids = list(student_ids)
        if teacher_id:
            all_ids.append(teacher_id)

        if all_ids:
            await notification_service.create_bulk_notifications(
                session,
                user_ids=all_ids,
                type="class_scheduled",
                title="New Class Scheduled",
                message=f"{zoom_class.title} on {zoom_class.scheduled_date} at {zoom_class.scheduled_time}",
                link="/classes",
                institute_id=zoom_class.institute_id,
            )

    except Exception as exc:
        logger.warning("Failed to send class-scheduled notifications: %s", exc, exc_info=True)


# ---------------------------------------------------------------------------
# 2. Class Live
# ---------------------------------------------------------------------------

async def notify_class_live(
    session: AsyncSession,
    zoom_class: ZoomClass,
) -> None:
    """Notify students that a class is now live (teacher is already in the meeting)."""
    try:
        student_ids, _teacher_id = await _get_class_recipients(session, zoom_class)

        if student_ids:
            await notification_service.create_bulk_notifications(
                session,
                user_ids=student_ids,
                type="class_live",
                title="Class is LIVE!",
                message=f"{zoom_class.title} is happening now — join from your classes page",
                link="/classes",
                institute_id=zoom_class.institute_id,
            )

    except Exception as exc:
        logger.warning("Failed to send class-live notifications: %s", exc, exc_info=True)


# ---------------------------------------------------------------------------
# 3. Class Cancelled
# ---------------------------------------------------------------------------

async def notify_class_cancelled(
    session: AsyncSession,
    zoom_class: ZoomClass,
    batch_name: str,
) -> None:
    """Notify students + teacher that a class has been cancelled."""
    try:
        student_ids, teacher_id = await _get_class_recipients(session, zoom_class)

        all_ids = list(student_ids)
        if teacher_id:
            all_ids.append(teacher_id)

        if all_ids:
            await notification_service.create_bulk_notifications(
                session,
                user_ids=all_ids,
                type="class_cancelled",
                title="Class Cancelled",
                message=f"{zoom_class.title} scheduled for {zoom_class.scheduled_date} has been cancelled",
                link="/classes",
                institute_id=zoom_class.institute_id,
            )

    except Exception as exc:
        logger.warning("Failed to send class-cancelled notifications: %s", exc, exc_info=True)


# ---------------------------------------------------------------------------
# 4. Class Rescheduled
# ---------------------------------------------------------------------------

async def notify_class_rescheduled(
    session: AsyncSession,
    zoom_class: ZoomClass,
    batch_name: str,
    old_date: str,
    old_time: str,
) -> None:
    """Notify students + teacher that a class has been rescheduled."""
    try:
        student_ids, teacher_id = await _get_class_recipients(session, zoom_class)

        all_ids = list(student_ids)
        if teacher_id:
            all_ids.append(teacher_id)

        if all_ids:
            await notification_service.create_bulk_notifications(
                session,
                user_ids=all_ids,
                type="class_rescheduled",
                title="Class Rescheduled",
                message=(
                    f"{zoom_class.title} moved from {old_date} {old_time} "
                    f"to {zoom_class.scheduled_date} {zoom_class.scheduled_time}"
                ),
                link="/classes",
                institute_id=zoom_class.institute_id,
            )

    except Exception as exc:
        logger.warning("Failed to send class-rescheduled notifications: %s", exc, exc_info=True)


# ---------------------------------------------------------------------------
# 5. Recording Available
# ---------------------------------------------------------------------------

async def notify_recording_available(
    session: AsyncSession,
    zoom_class: ZoomClass,
) -> None:
    """Notify students that a class recording is ready to watch."""
    try:
        student_ids, _teacher_id = await _get_class_recipients(session, zoom_class)

        if student_ids:
            await notification_service.create_bulk_notifications(
                session,
                user_ids=student_ids,
                type="recording_available",
                title="Recording Available",
                message=f"Recording for {zoom_class.title} is ready to watch",
                link="/recordings",
                institute_id=zoom_class.institute_id,
            )

    except Exception as exc:
        logger.warning("Failed to send recording-available notifications: %s", exc, exc_info=True)


# ---------------------------------------------------------------------------
# 6. Class Cancelled (snapshot-based — avoids ORM expiry after soft-delete)
# ---------------------------------------------------------------------------

async def notify_class_cancelled_from_snapshot(
    session: AsyncSession,
    snapshot: dict,
) -> None:
    """Notify students + teacher using pre-snapshot data (safe after soft-delete commit)."""
    try:
        batch_id = snapshot["batch_id"]
        teacher_id = snapshot.get("teacher_id")
        institute_id = snapshot.get("institute_id")

        result = await session.execute(
            select(User.id)
            .join(StudentBatch, StudentBatch.student_id == User.id)
            .where(
                StudentBatch.batch_id == batch_id,
                StudentBatch.removed_at.is_(None),
                StudentBatch.is_active.is_(True),
                User.deleted_at.is_(None),
            )
        )
        student_ids = [r[0] for r in result.all()]

        all_ids = list(student_ids)
        if teacher_id:
            all_ids.append(teacher_id)

        if all_ids:
            await notification_service.create_bulk_notifications(
                session,
                user_ids=all_ids,
                type="class_cancelled",
                title="Class Cancelled",
                message=f"{snapshot['title']} scheduled for {snapshot['scheduled_date']} has been cancelled",
                link="/classes",
                institute_id=institute_id,
            )

    except Exception as exc:
        logger.warning("Failed to send class-cancelled notifications: %s", exc, exc_info=True)
