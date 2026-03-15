"""Scheduled jobs for the ICT LMS."""
import logging
from datetime import datetime, timezone, timedelta

from app.database import async_session

logger = logging.getLogger("ict_lms.scheduler")


async def cleanup_expired_sessions():
    """Deactivate expired sessions (hourly)."""
    from sqlmodel import select
    from app.models.session import UserSession

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
    from app.models.user import User
    from app.models.batch import StudentBatch
    from app.models.enums import ZoomClassStatus
    from app.utils.email import send_zoom_reminder

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
                # Mark sent BEFORE sending to prevent spam on retries
                zc.reminder_sent = True
                session.add(zc)

                scheduled_str = scheduled_dt.strftime("%Y-%m-%d %H:%M")
                meeting_url = zc.zoom_meeting_url or ""

                # Send to teacher
                try:
                    teacher_result = await session.execute(
                        select(User).where(User.id == zc.teacher_id)
                    )
                    teacher = teacher_result.scalar_one_or_none()
                    if teacher and teacher.email:
                        send_zoom_reminder(teacher.email, zc.title, meeting_url, scheduled_str)
                except Exception as e:
                    logger.error("Failed to send reminder to teacher for class %s: %s", zc.title, e)

                # Send to enrolled students
                try:
                    student_result = await session.execute(
                        select(User.email).join(
                            StudentBatch, StudentBatch.student_id == User.id
                        ).where(
                            StudentBatch.batch_id == zc.batch_id,
                            StudentBatch.removed_at.is_(None),
                            User.deleted_at.is_(None),
                        )
                    )
                    student_emails = [row[0] for row in student_result.all()]
                    for student_email in student_emails:
                        try:
                            send_zoom_reminder(student_email, zc.title, meeting_url, scheduled_str)
                        except Exception as e:
                            logger.error("Failed to send reminder to %s for class %s: %s", student_email, zc.title, e)
                except Exception as e:
                    logger.error("Failed to query students for class %s: %s", zc.title, e)

                logger.info("Sent reminders for class %s", zc.title)

        await session.commit()


async def auto_suspend_expired_institutes():
    """Auto-suspend institutes whose subscription has expired (daily)."""
    from sqlmodel import select
    from app.models.institute import Institute, InstituteStatus

    now = datetime.now(timezone.utc)

    async with async_session() as session:
        result = await session.execute(
            select(Institute).where(
                Institute.status.in_([InstituteStatus.active, InstituteStatus.trial]),
                Institute.expires_at.isnot(None),
                Institute.expires_at < now,
                Institute.deleted_at.is_(None),
            )
        )
        expired = result.scalars().all()
        for institute in expired:
            institute.status = InstituteStatus.suspended
            session.add(institute)
            logger.info("Auto-suspended expired institute: %s (slug=%s)", institute.id, institute.slug)

        if expired:
            await session.commit()
            logger.info("Auto-suspended %d expired institutes", len(expired))


async def process_webhook_deliveries():
    """Process pending webhook deliveries and retries (every 1 minute)."""
    from app.services.webhook_event_service import process_pending_deliveries

    async with async_session() as session:
        try:
            count = await process_pending_deliveries(session, batch_size=50)
            if count:
                logger.info("Processed %d webhook deliveries", count)
        except Exception as e:
            logger.error("Webhook delivery processing failed: %s", e)


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
