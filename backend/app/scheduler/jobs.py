"""Scheduled jobs for the ICT LMS."""
import logging
from datetime import datetime, timezone, timedelta

from app.database import async_session
from app.core.sentry import sentry_job_wrapper

logger = logging.getLogger("ict_lms.scheduler")


@sentry_job_wrapper("cleanup_expired_sessions")
async def cleanup_expired_sessions():
    """Deactivate expired sessions (hourly).

    Processes ALL institutes globally — system-level cleanup is tenant-agnostic.
    """
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


@sentry_job_wrapper("retry_failed_recordings")
async def retry_failed_recordings():
    """Retry recordings stuck in 'processing' status (every 30 minutes).

    Processes ALL institutes globally — retry logic is tenant-agnostic.
    """
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


@sentry_job_wrapper("send_zoom_reminders")
async def send_zoom_reminders():
    """Send reminders for upcoming Zoom classes (every 10 minutes).

    Processes ALL institutes globally — email delivery is tenant-agnostic.
    Each class's batch/student relationship ensures correct recipients.
    """
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


@sentry_job_wrapper("auto_suspend_expired_institutes")
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


@sentry_job_wrapper("process_webhook_deliveries")
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


@sentry_job_wrapper("cleanup_stale_uploads")
async def cleanup_stale_uploads():
    """Soft-delete lectures stuck in 'pending' for over 24 hours (daily).

    Processes ALL institutes globally — cleanup is tenant-agnostic.

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


@sentry_job_wrapper("recalculate_all_usage")
async def recalculate_all_usage():
    """Recalculate usage counters from actual DB rows for all institutes (daily).

    Safety net for any drift between incremental tracking and reality.
    Counts users, storage bytes, and video bytes from live tables.
    """
    from sqlmodel import select
    from app.models.institute import Institute
    from app.services.institute_service import recalculate_usage

    async with async_session() as session:
        result = await session.execute(
            select(Institute.id).where(Institute.deleted_at.is_(None))
        )
        institute_ids = [row[0] for row in result.all()]

        recalculated = 0
        for iid in institute_ids:
            try:
                await recalculate_usage(session, iid)
                recalculated += 1
            except Exception as e:
                logger.error("Failed to recalculate usage for institute %s: %s", iid, e)
                await session.rollback()

        if recalculated:
            logger.info("Recalculated usage for %d/%d institutes", recalculated, len(institute_ids))


@sentry_job_wrapper("send_batch_expiry_notifications")
async def send_batch_expiry_notifications():
    """Send notifications for students whose batch access is about to expire (daily).

    Sends three types:
    - 7-day warning: effective_end_date is exactly 7 days from today
    - 1-day warning: effective_end_date is tomorrow
    - Expired: effective_end_date was yesterday (just expired)

    Deduplicates by checking if a notification of the same type was already
    sent for the same batch within the relevant window.
    """
    from sqlmodel import select
    from app.models.batch import Batch, StudentBatch
    from app.models.notification import Notification
    from app.services import notification_service

    async with async_session() as session:
        today = datetime.now(timezone.utc).date()

        # Define the three notification windows
        windows = [
            {
                "offset_days": 7,
                "type": "batch_expiry_warning_7d",
                "title": "Access Expiring Soon",
                "msg_template": "Your access to {batch} expires in 7 days ({date}).",
            },
            {
                "offset_days": 1,
                "type": "batch_expiry_warning_1d",
                "title": "Access Expires Tomorrow",
                "msg_template": "Your access to {batch} expires tomorrow ({date}).",
            },
            {
                "offset_days": -1,
                "type": "batch_expired",
                "title": "Access Expired",
                "msg_template": "Your access to {batch} has expired.",
            },
        ]

        total_sent = 0

        for window in windows:
            target_date = today + timedelta(days=window["offset_days"])

            # Find enrollments where effective_end_date matches the target
            # Case 1: extended_end_date is set and matches
            result = await session.execute(
                select(StudentBatch, Batch).join(
                    Batch, Batch.id == StudentBatch.batch_id,
                ).where(
                    StudentBatch.removed_at.is_(None),
                    StudentBatch.is_active.is_(True),
                    Batch.deleted_at.is_(None),
                    StudentBatch.extended_end_date == target_date,
                )
            )
            extended_rows = result.all()

            # Case 2: no extension and batch.end_date matches
            result2 = await session.execute(
                select(StudentBatch, Batch).join(
                    Batch, Batch.id == StudentBatch.batch_id,
                ).where(
                    StudentBatch.removed_at.is_(None),
                    StudentBatch.is_active.is_(True),
                    Batch.deleted_at.is_(None),
                    StudentBatch.extended_end_date.is_(None),
                    Batch.end_date == target_date,
                )
            )
            batch_rows = result2.all()

            all_rows = extended_rows + batch_rows

            for sb, batch in all_rows:
                # Dedup: check if we already sent this notification type for this batch
                existing = await session.execute(
                    select(Notification.id).where(
                        Notification.user_id == sb.student_id,
                        Notification.type == window["type"],
                        Notification.title == window["title"],
                    ).limit(1)
                )
                if existing.scalar_one_or_none():
                    continue

                effective_end = sb.extended_end_date or batch.end_date
                msg = window["msg_template"].format(
                    batch=batch.name,
                    date=effective_end.strftime("%b %d, %Y"),
                )

                try:
                    await notification_service.create_notification(
                        session,
                        user_id=sb.student_id,
                        type=window["type"],
                        title=window["title"],
                        message=msg,
                        link=f"/batches/{batch.id}",
                        institute_id=sb.institute_id,
                    )
                    total_sent += 1
                except Exception as e:
                    logger.error(
                        "Failed to send %s notification to student %s: %s",
                        window["type"], sb.student_id, e,
                    )
                    await session.rollback()

        if total_sent:
            logger.info("Sent %d batch expiry notifications", total_sent)
