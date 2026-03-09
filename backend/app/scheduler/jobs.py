"""Scheduled jobs for the ICT LMS."""
import logging
from datetime import datetime, timezone, timedelta

from app.database import async_session

logger = logging.getLogger("ict_lms.scheduler")


async def cleanup_expired_sessions():
    """Deactivate expired sessions (hourly)."""
    from sqlmodel import select
    from app.models.other import UserSession

    async with async_session() as session:
        result = await session.execute(
            select(UserSession).where(
                UserSession.is_active.is_(True),
                UserSession.expires_at < datetime.now(timezone.utc),
            )
        )
        expired = result.scalars().all()
        for s in expired:
            s.is_active = False
            session.add(s)
        if expired:
            await session.commit()
            logger.info("Cleaned up %d expired sessions", len(expired))


async def retry_failed_recordings():
    """Retry recordings stuck in 'processing' status (every 30 minutes)."""
    from sqlmodel import select
    from app.models.zoom import ClassRecording
    from app.models.enums import RecordingStatus
    from app.services import zoom_service

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)

    async with async_session() as session:
        result = await session.execute(
            select(ClassRecording).where(
                ClassRecording.status == RecordingStatus.processing,
                ClassRecording.created_at < cutoff,
            )
        )
        stuck = result.scalars().all()
        for rec in stuck:
            try:
                await zoom_service.process_recording(session, rec.id)
                logger.info("Retried processing for recording %s", rec.id)
            except Exception as e:
                logger.error("Retry failed for recording %s: %s", rec.id, e)


async def send_zoom_reminders():
    """Send reminders for upcoming Zoom classes (every 10 minutes)."""
    from sqlmodel import select
    from app.models.zoom import ZoomClass
    from app.models.enums import ZoomClassStatus

    now = datetime.now(timezone.utc)
    reminder_window = now + timedelta(minutes=15)

    async with async_session() as session:
        result = await session.execute(
            select(ZoomClass).where(
                ZoomClass.status == ZoomClassStatus.upcoming,
                ZoomClass.reminder_sent.is_(False),
                ZoomClass.deleted_at.is_(None),
            )
        )
        classes = result.scalars().all()
        for zc in classes:
            scheduled_dt = datetime.combine(zc.scheduled_date, zc.scheduled_time)
            if scheduled_dt <= reminder_window.replace(tzinfo=None):
                zc.reminder_sent = True
                session.add(zc)
                logger.warning(
                    "Email sending not implemented yet — reminder flagged but not sent for class %s",
                    zc.title,
                )

        await session.commit()


async def cleanup_stale_uploads():
    """Soft-delete lectures stuck in 'pending' for over 24 hours (daily).

    These are upload-init records where TUS upload never completed.
    Only cleans 'pending' — never touches 'processing' which may still be encoding.
    """
    from sqlmodel import select
    from app.models.course import Lecture
    from app.utils.bunny import delete_video

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    async with async_session() as session:
        result = await session.execute(
            select(Lecture).where(
                Lecture.video_status == "pending",
                Lecture.created_at < cutoff,
                Lecture.deleted_at.is_(None),
            )
        )
        stale = result.scalars().all()
        for lecture in stale:
            # Best-effort cleanup of Bunny entry
            if lecture.bunny_video_id:
                try:
                    await delete_video(lecture.bunny_video_id)
                except Exception as e:
                    logger.warning("Failed to delete Bunny video %s: %s", lecture.bunny_video_id, e)
            lecture.deleted_at = datetime.now(timezone.utc)
            session.add(lecture)

        if stale:
            await session.commit()
            logger.info("Cleaned up %d stale pending uploads", len(stale))
