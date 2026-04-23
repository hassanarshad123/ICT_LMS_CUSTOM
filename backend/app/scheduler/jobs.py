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
    from app.utils.email_sender import send_templated_email

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
                        if zc.institute_id:
                            await send_templated_email(
                                session=session, institute_id=zc.institute_id, user_id=teacher.id,
                                email_type="email_zoom_reminder", template_key="zoom_reminder", to=teacher.email,
                                variables={
                                    "class_title": zc.title,
                                    "meeting_url": meeting_url,
                                    "scheduled_time": scheduled_str,
                                },
                            )
                        else:
                            send_zoom_reminder(teacher.email, zc.title, meeting_url, scheduled_str)
                except Exception as e:
                    logger.error("Failed to send reminder to teacher for class %s: %s", zc.title, e)

                # Send to enrolled students
                student_ids = []
                try:
                    student_result = await session.execute(
                        select(User.id, User.email).join(
                            StudentBatch, StudentBatch.student_id == User.id
                        ).where(
                            StudentBatch.batch_id == zc.batch_id,
                            StudentBatch.removed_at.is_(None),
                            StudentBatch.is_active.is_(True),
                            User.deleted_at.is_(None),
                        )
                    )
                    student_rows = student_result.all()
                    student_ids = [row[0] for row in student_rows]
                    for student_id, student_email in student_rows:
                        try:
                            if zc.institute_id:
                                await send_templated_email(
                                    session=session, institute_id=zc.institute_id, user_id=student_id,
                                    email_type="email_zoom_reminder", template_key="zoom_reminder", to=student_email,
                                    variables={
                                        "class_title": zc.title,
                                        "meeting_url": meeting_url,
                                        "scheduled_time": scheduled_str,
                                    },
                                )
                            else:
                                send_zoom_reminder(student_email, zc.title, meeting_url, scheduled_str)
                        except Exception as e:
                            logger.error("Failed to send reminder to %s for class %s: %s", student_email, zc.title, e)
                except Exception as e:
                    logger.error("Failed to query students for class %s: %s", zc.title, e)

                # In-app notification for teacher + students
                try:
                    from app.services import notification_service
                    all_ids = ([zc.teacher_id] if zc.teacher_id else []) + student_ids
                    if all_ids:
                        await notification_service.create_bulk_notifications(
                            session,
                            user_ids=all_ids,
                            type="class_reminder",
                            title="Class Starting Soon",
                            message=f"'{zc.title}' starts in ~15 minutes at {scheduled_str}",
                            link="/classes",
                            institute_id=zc.institute_id,
                        )
                except Exception as e:
                    logger.warning("Failed to create reminder notifications for %s: %s", zc.title, e)

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


@sentry_job_wrapper("send_trial_expiry_warnings")
async def send_trial_expiry_warnings():
    """Send email warnings when institute trial is about to expire (daily)."""
    from sqlmodel import select
    from app.models.institute import Institute, InstituteStatus
    from app.models.user import User
    from app.models.enums import UserRole
    from app.utils.email import send_email

    now = datetime.now(timezone.utc)
    warning_intervals = [
        (7, "Your trial ends in 7 days"),
        (1, "Your trial expires tomorrow"),
    ]

    async with async_session() as session:
        for days_before, subject_line in warning_intervals:
            target_date = now + timedelta(days=days_before)
            window_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            window_end = window_start + timedelta(days=1)

            result = await session.execute(
                select(Institute).where(
                    Institute.status.in_([InstituteStatus.active, InstituteStatus.trial]),
                    Institute.expires_at.isnot(None),
                    Institute.expires_at >= window_start,
                    Institute.expires_at < window_end,
                    Institute.deleted_at.is_(None),
                )
            )
            institutes = result.scalars().all()

            for inst in institutes:
                # Find the admin user for this institute
                admin_result = await session.execute(
                    select(User.email, User.name).where(
                        User.institute_id == inst.id,
                        User.role == UserRole.admin,
                        User.deleted_at.is_(None),
                    ).limit(1)
                )
                admin = admin_result.first()
                if not admin or not admin[0]:
                    continue

                try:
                    expires_str = inst.expires_at.strftime("%B %d, %Y") if inst.expires_at else "soon"
                    send_email(
                        to=admin[0],
                        subject=f"[{inst.name}] {subject_line}",
                        html=f"""
                        <h2>{subject_line}</h2>
                        <p>Hi {admin[1] or 'Admin'},</p>
                        <p>Your <strong>{inst.name}</strong> LMS trial expires on <strong>{expires_str}</strong>.</p>
                        <p>After expiry, your institute will be suspended and users won't be able to log in.</p>
                        <p>To continue using the LMS, please contact us to upgrade your plan.</p>
                        <br>
                        <p>— The Zensbot LMS Team</p>
                        """,
                    )
                    logger.info("Sent %d-day trial warning to %s for %s", days_before, admin[0], inst.slug)
                except Exception as e:
                    logger.warning("Failed to send trial warning to %s: %s", admin[0], e)


@sentry_job_wrapper("deactivate_unverified_users")
async def deactivate_unverified_users():
    """Deactivate users who haven't verified email within 24 hours (daily)."""
    from sqlmodel import select
    from app.models.user import User
    from app.models.enums import UserStatus

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    async with async_session() as session:
        result = await session.execute(
            select(User).where(
                User.email_verified == False,  # noqa: E712
                User.status == UserStatus.active,
                User.created_at < cutoff,
                User.deleted_at.is_(None),
            )
        )
        unverified = result.scalars().all()
        for user in unverified:
            user.status = UserStatus.inactive
            session.add(user)
            logger.info("Deactivated unverified user: %s (email=%s)", user.id, user.email)

        if unverified:
            await session.commit()
            logger.info("Deactivated %d unverified users (24h expired)", len(unverified))


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


@sentry_job_wrapper("process_frappe_sync_tasks")
async def process_frappe_sync_tasks():
    """Drain pending Frappe outbound sync tasks (every 30s).

    Each task calls the institute's Frappe instance. Failures get exponential-
    backoff retry (1m, 5m, 30m, 2h, 12h) for up to 6 attempts total, same
    cadence as webhook deliveries.
    """
    from app.services.frappe_sync_service import process_pending_tasks

    async with async_session() as session:
        try:
            count = await process_pending_tasks(session, batch_size=25)
            if count:
                logger.info("Processed %d Frappe sync tasks", count)
        except Exception as e:
            logger.error("Frappe sync processing failed: %s", e)


@sentry_job_wrapper("send_integration_weekly_digest")
async def send_integration_weekly_digest():
    """Weekly: email each institute admin a 7-day Frappe sync health summary.

    Skipped institutes:
      - frappe_enabled = False (don't pester anyone not using the integration)
      - Zero sync activity in the last 7 days (nothing to report)

    De-duplication relies on the weekly schedule + the cache key in
    integration_digest service — re-running the job within the same 7-day
    window won't re-send.
    """
    from app.services import integration_digest

    async with async_session() as session:
        try:
            count = await integration_digest.send_weekly_digests(session)
            if count:
                logger.info("Sent %d Frappe weekly digest emails", count)
        except Exception as e:
            logger.error("Frappe weekly digest failed: %s", e)


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


@sentry_job_wrapper("sync_stuck_video_statuses")
async def sync_stuck_video_statuses():
    """Poll Bunny for lectures stuck in pending/processing >30 min (every 30 min).

    Safety net for missed webhooks. Only reads from Bunny API (no writes).
    Updates DB only if Bunny reports ready or failed — never downgrades status.
    """
    from sqlmodel import select
    from app.models.course import Lecture
    from app.utils.bunny import get_video_status, get_thumbnail_url

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)

    async with async_session() as session:
        result = await session.execute(
            select(Lecture).where(
                Lecture.video_status.in_(["pending", "processing"]),
                Lecture.bunny_video_id.isnot(None),
                Lecture.video_type == "upload",
                Lecture.created_at < cutoff,
                Lecture.deleted_at.is_(None),
            )
        )
        stuck = result.scalars().all()
        if not stuck:
            return

        fixed = 0
        for lecture in stuck:
            try:
                bunny_status, bunny_duration = await get_video_status(lecture.bunny_video_id)
                if bunny_status in ("ready", "failed"):
                    lecture.video_status = bunny_status
                    if bunny_status == "ready":
                        thumb = get_thumbnail_url(lecture.bunny_video_id)
                        if thumb:
                            lecture.thumbnail_url = thumb
                        if bunny_duration > 0 and not lecture.duration:
                            lecture.duration = bunny_duration
                    lecture.updated_at = datetime.now(timezone.utc)
                    session.add(lecture)
                    fixed += 1
            except Exception as e:
                logger.warning("Failed to sync video %s: %s", lecture.bunny_video_id, e)

        if fixed:
            await session.commit()
            logger.info("Synced %d stuck video statuses from Bunny (%d total checked)", fixed, len(stuck))


@sentry_job_wrapper("backfill_video_durations")
async def backfill_video_durations():
    """One-time backfill: fetch duration from Bunny for ready videos with no duration.

    Safe to run repeatedly — skips lectures that already have a duration.
    Can be removed once all existing videos have durations populated.
    """
    from sqlmodel import select
    from app.models.course import Lecture
    from app.utils.bunny import get_video_status

    async with async_session() as session:
        result = await session.execute(
            select(Lecture).where(
                Lecture.video_status == "ready",
                Lecture.bunny_video_id.isnot(None),
                Lecture.deleted_at.is_(None),
                (Lecture.duration.is_(None)) | (Lecture.duration == 0),
            )
        )
        lectures = result.scalars().all()
        if not lectures:
            return

        updated = 0
        for lecture in lectures:
            try:
                _, duration = await get_video_status(lecture.bunny_video_id)
                if duration > 0:
                    lecture.duration = duration
                    lecture.updated_at = datetime.now(timezone.utc)
                    session.add(lecture)
                    updated += 1
            except Exception as e:
                logger.warning("Backfill duration failed for %s: %s", lecture.bunny_video_id, e)

        if updated:
            await session.commit()
            logger.info("Backfilled duration for %d/%d lectures", updated, len(lectures))


@sentry_job_wrapper("recalculate_all_usage")
async def recalculate_all_usage():
    """Recalculate usage counters from actual DB rows for all institutes (daily).

    Safety net for any drift between incremental tracking and reality.
    Counts users, storage bytes, and video bytes from live tables.
    """
    from sqlmodel import select
    from app.models.institute import Institute
    from app.services.institute_service import recalculate_usage

    # Fetch IDs first, then process each in its own session so failures
    # don't discard previously committed recalculations.
    async with async_session() as session:
        result = await session.execute(
            select(Institute.id).where(Institute.deleted_at.is_(None))
        )
        institute_ids = [row[0] for row in result.all()]

    recalculated = 0
    for iid in institute_ids:
        try:
            async with async_session() as item_session:
                await recalculate_usage(item_session, iid)
                recalculated += 1
        except Exception as e:
            logger.error("Failed to recalculate usage for institute %s: %s", iid, e)

    if recalculated:
        logger.info("Recalculated usage for %d/%d institutes", recalculated, len(institute_ids))


@sentry_job_wrapper("capture_daily_snapshots")
async def capture_daily_snapshots():
    """Capture daily usage snapshots for all institutes + platform aggregate.

    Runs after recalculate_all_usage so the numbers are fresh.
    Stores one row per institute per day in usage_snapshots, and one
    platform-level row per day in platform_snapshots.
    """
    import uuid as _uuid
    from sqlmodel import select
    from sqlalchemy import func
    from app.models.institute import (
        Institute, InstituteUsage, InstituteStatus,
        UsageSnapshot, PlatformSnapshot,
    )
    from app.models.user import User
    from app.models.enums import UserRole
    from app.models.course import Course, Lecture
    from app.models.zoom import ZoomClass

    today = datetime.now(timezone.utc).date()

    async with async_session() as session:
        result = await session.execute(
            select(Institute.id).where(Institute.deleted_at.is_(None))
        )
        institute_ids = [row[0] for row in result.all()]

    totals = {
        "institutes": len(institute_ids), "active": 0,
        "users": 0, "students": 0, "storage": 0, "video": 0,
        "courses": 0, "lectures": 0,
    }
    captured = 0

    for iid in institute_ids:
        try:
            async with async_session() as session:
                inst = await session.get(Institute, iid)
                if not inst:
                    continue

                usage_r = await session.execute(
                    select(InstituteUsage).where(InstituteUsage.institute_id == iid)
                )
                usage = usage_r.scalar_one_or_none()

                users_r = await session.execute(
                    select(func.count(User.id)).where(
                        User.institute_id == iid, User.deleted_at.is_(None),
                        User.role != UserRole.super_admin,
                    )
                )
                users_count = users_r.scalar_one() or 0

                students_r = await session.execute(
                    select(func.count(User.id)).where(
                        User.institute_id == iid, User.deleted_at.is_(None),
                        User.role == UserRole.student,
                    )
                )
                students_count = students_r.scalar_one() or 0

                courses_r = await session.execute(
                    select(func.count(Course.id)).where(
                        Course.institute_id == iid, Course.deleted_at.is_(None),
                    )
                )
                courses_count = courses_r.scalar_one() or 0

                lectures_r = await session.execute(
                    select(func.count(Lecture.id)).where(
                        Lecture.institute_id == iid, Lecture.deleted_at.is_(None),
                    )
                )
                lectures_count = lectures_r.scalar_one() or 0

                zoom_r = await session.execute(
                    select(
                        func.count(ZoomClass.id),
                        func.coalesce(func.sum(ZoomClass.duration), 0),
                    ).where(
                        ZoomClass.institute_id == iid,
                        ZoomClass.deleted_at.is_(None),
                    )
                )
                zoom_row = zoom_r.one()
                zoom_count = zoom_row[0] or 0
                zoom_minutes = zoom_row[1] or 0

                storage_bytes = usage.current_storage_bytes if usage else 0
                video_bytes = usage.current_video_bytes if usage else 0

                from sqlalchemy.dialects.postgresql import insert as pg_insert
                stmt = pg_insert(UsageSnapshot).values(
                    id=_uuid.uuid4(),
                    institute_id=iid,
                    snapshot_date=today,
                    users_count=users_count,
                    students_count=students_count,
                    storage_bytes=storage_bytes,
                    video_bytes=video_bytes,
                    courses_count=courses_count,
                    lectures_count=lectures_count,
                    zoom_meetings_count=zoom_count,
                    zoom_total_minutes=zoom_minutes,
                ).on_conflict_do_update(
                    constraint="uq_usage_snapshot_inst_date",
                    set_={
                        "users_count": users_count,
                        "students_count": students_count,
                        "storage_bytes": storage_bytes,
                        "video_bytes": video_bytes,
                        "courses_count": courses_count,
                        "lectures_count": lectures_count,
                        "zoom_meetings_count": zoom_count,
                        "zoom_total_minutes": zoom_minutes,
                    },
                )
                await session.execute(stmt)
                await session.commit()

                if inst.status == InstituteStatus.active:
                    totals["active"] += 1
                totals["users"] += users_count
                totals["students"] += students_count
                totals["storage"] += storage_bytes
                totals["video"] += video_bytes
                totals["courses"] += courses_count
                totals["lectures"] += lectures_count
                captured += 1
        except Exception as e:
            logger.error("Snapshot failed for institute %s: %s", iid, e)

    # Platform-level aggregate
    try:
        async with async_session() as session:
            from sqlalchemy.dialects.postgresql import insert as pg_insert
            stmt = pg_insert(PlatformSnapshot).values(
                id=_uuid.uuid4(),
                snapshot_date=today,
                total_institutes=totals["institutes"],
                active_institutes=totals["active"],
                total_users=totals["users"],
                total_students=totals["students"],
                total_storage_bytes=totals["storage"],
                total_video_bytes=totals["video"],
                total_courses=totals["courses"],
                total_lectures=totals["lectures"],
            ).on_conflict_do_update(
                constraint="uq_platform_snapshot_date",
                set_={
                    "total_institutes": totals["institutes"],
                    "active_institutes": totals["active"],
                    "total_users": totals["users"],
                    "total_students": totals["students"],
                    "total_storage_bytes": totals["storage"],
                    "total_video_bytes": totals["video"],
                    "total_courses": totals["courses"],
                    "total_lectures": totals["lectures"],
                },
            )
            await session.execute(stmt)
            await session.commit()
    except Exception as e:
        logger.error("Platform snapshot failed: %s", e)

    logger.info("Captured daily snapshots for %d/%d institutes", captured, len(institute_ids))


@sentry_job_wrapper("check_quota_alerts")
async def check_quota_alerts():
    """Check all institutes for quota threshold crossings and send alerts.

    Thresholds: 80% (warning), 90% (critical), 100% (exceeded).
    Deduplicates via quota_alert_logs — same threshold is only alerted once
    until the usage drops below the threshold and the log row is cleared.
    """
    import uuid as _uuid
    from sqlmodel import select
    from sqlalchemy import func
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models.institute import Institute, InstituteUsage
    from app.models.platform_cost import QuotaAlertLog
    from app.models.user import User
    from app.models.enums import UserRole
    from app.config import get_settings
    from app.utils.email_sender import send_email_background

    settings = get_settings()
    thresholds = [100, 90, 80]
    sent_count = 0

    async with async_session() as session:
        result = await session.execute(
            select(Institute, InstituteUsage).outerjoin(
                InstituteUsage, InstituteUsage.institute_id == Institute.id,
            ).where(Institute.deleted_at.is_(None))
        )
        rows = result.all()

    for inst, usage in rows:
        if not usage:
            continue

        checks = []
        if inst.max_students and inst.max_students > 0:
            async with async_session() as session:
                sr = await session.execute(
                    select(func.count(User.id)).where(
                        User.institute_id == inst.id,
                        User.role == UserRole.student,
                        User.deleted_at.is_(None),
                    )
                )
                student_count = sr.scalar_one() or 0
            checks.append(("students", student_count, inst.max_students))

        if inst.max_users and inst.max_users > 0:
            checks.append(("users", usage.current_users, inst.max_users))

        if inst.max_storage_gb and inst.max_storage_gb > 0:
            current_gb = round(usage.current_storage_bytes / (1024 ** 3), 3)
            checks.append(("storage", current_gb, inst.max_storage_gb))

        if inst.max_video_gb and inst.max_video_gb > 0:
            current_gb = round(usage.current_video_bytes / (1024 ** 3), 3)
            checks.append(("video", current_gb, inst.max_video_gb))

        for resource, current, limit in checks:
            pct = (current / limit * 100) if limit > 0 else 0
            for threshold in thresholds:
                if pct < threshold:
                    continue

                # Check if alert already sent for this threshold
                async with async_session() as session:
                    existing = await session.execute(
                        select(QuotaAlertLog.id).where(
                            QuotaAlertLog.institute_id == inst.id,
                            QuotaAlertLog.resource == resource,
                            QuotaAlertLog.threshold_pct == threshold,
                        )
                    )
                    if existing.scalar_one_or_none():
                        break  # Already alerted at this or higher threshold

                    severity = "exceeded" if threshold >= 100 else ("critical" if threshold >= 90 else "warning")

                    # Record the alert
                    alert_log = QuotaAlertLog(
                        id=_uuid.uuid4(),
                        institute_id=inst.id,
                        resource=resource,
                        threshold_pct=threshold,
                        notified_sa=True,
                        notified_admin=True,
                    )
                    session.add(alert_log)
                    await session.commit()

                    # Send email to SA
                    if settings.SUPER_ADMIN_EMAIL:
                        send_email_background(
                            to=settings.SUPER_ADMIN_EMAIL,
                            subject=f"[{severity.upper()}] {inst.name} — {resource} at {round(pct)}%",
                            html=f"<p>Institute <b>{inst.name}</b> ({inst.slug}) has reached "
                                 f"<b>{round(pct)}%</b> of its {resource} quota.</p>"
                                 f"<p>Current: {current} / Limit: {limit}</p>"
                                 f"<p>Severity: <b>{severity}</b></p>",
                        )

                    # Send email to institute admin
                    if inst.contact_email:
                        send_email_background(
                            to=inst.contact_email,
                            subject=f"Your {resource} usage is at {round(pct)}%",
                            html=f"<p>Your institute <b>{inst.name}</b> has reached "
                                 f"<b>{round(pct)}%</b> of its {resource} quota.</p>"
                                 f"<p>Current: {current} / Limit: {limit}</p>"
                                 f"<p>Please contact support if you need to upgrade.</p>",
                        )

                    sent_count += 1
                    logger.info(
                        "Quota alert: %s %s at %d%% (threshold=%d%%)",
                        inst.name, resource, round(pct), threshold,
                    )
                break  # Only alert at the highest crossed threshold

    if sent_count:
        logger.info("Sent %d quota alerts", sent_count)


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

                    # Also send email (respects admin + student preferences)
                    try:
                        from app.utils.email_sender import send_templated_email, build_login_url, get_institute_branding
                        from app.models.user import User as UserModel

                        email_type = f"email_batch_expiry_{window['offset_days']}d" if window["offset_days"] > 0 else "email_batch_expired"
                        student = await session.get(UserModel, sb.student_id)
                        if student and student.email and sb.institute_id:
                            branding = await get_institute_branding(session, sb.institute_id)
                            login_url = build_login_url(branding["slug"]) if branding["slug"] else ""

                            if window["offset_days"] > 0:
                                await send_templated_email(
                                    session=session, institute_id=sb.institute_id, user_id=sb.student_id,
                                    email_type=email_type, template_key="batch_expiry_warning", to=student.email,
                                    variables={
                                        "student_name": student.name,
                                        "batch_name": batch.name,
                                        "days_remaining": str(window["offset_days"]),
                                        "end_date": effective_end.strftime("%b %d, %Y"),
                                        "login_url": login_url,
                                    },
                                )
                            else:
                                await send_templated_email(
                                    session=session, institute_id=sb.institute_id, user_id=sb.student_id,
                                    email_type=email_type, template_key="batch_expired", to=student.email,
                                    variables={
                                        "student_name": student.name,
                                        "batch_name": batch.name,
                                    },
                                )
                    except Exception as email_err:
                        logger.warning("Failed to send expiry email to %s: %s", sb.student_id, email_err)

                except Exception as e:
                    logger.error(
                        "Failed to send %s notification to student %s: %s",
                        window["type"], sb.student_id, e,
                    )
                    await session.rollback()

        if total_sent:
            logger.info("Sent %d batch expiry notifications", total_sent)


@sentry_job_wrapper("send_fee_reminders")
async def send_fee_reminders():
    """Daily fee reminders for the Admissions Officer portal.

    Two rules:
      1. Installment due in 7 days / 1 day → notify the student (in-app + email).
      2. Installment went overdue today    → notify the student AND the
         admissions officer who onboarded them (in-app only — the overdue
         overlay will prompt the student inside the app).

    Dedup: each in-app notification uses a ``type`` suffixed with the
    installment UUID, so re-runs within the window won't double-send.
    """
    from datetime import date as _date_cls

    from sqlmodel import select
    from app.models.fee import FeePlan, FeeInstallment
    from app.models.notification import Notification
    from app.models.user import User
    from app.models.batch import Batch
    from app.services import notification_service

    today = _date_cls.today()
    windows = [
        {"offset_days": 7, "title": "Fee payment due in 7 days", "kind": "fee_due_soon_7d"},
        {"offset_days": 1, "title": "Fee payment due tomorrow", "kind": "fee_due_soon_1d"},
        {"offset_days": 0, "title": "Fee is now overdue", "kind": "fee_overdue"},
    ]

    async with async_session() as session:
        total_sent = 0

        for window in windows:
            target = today + timedelta(days=window["offset_days"])

            q = (
                select(FeeInstallment, FeePlan, Batch, User)
                .join(FeePlan, FeePlan.id == FeeInstallment.fee_plan_id)
                .join(Batch, Batch.id == FeePlan.batch_id)
                .join(User, User.id == FeePlan.student_id)
                .where(
                    FeeInstallment.due_date == target,
                    FeeInstallment.status.in_(["pending", "partially_paid", "overdue"]),
                    FeePlan.deleted_at.is_(None),
                    User.deleted_at.is_(None),
                )
            )
            rows = (await session.execute(q)).all()
            if not rows:
                continue

            for installment, plan, batch, student in rows:
                dedup_type = f"{window['kind']}:{installment.id}"

                # Skip if already sent for this installment (in-app dedup = single source of truth)
                existing = await session.execute(
                    select(Notification.id).where(
                        Notification.user_id == student.id,
                        Notification.type == dedup_type,
                    ).limit(1)
                )
                if existing.scalar_one_or_none():
                    continue

                amount_due = max(int(installment.amount_due) - int(installment.amount_paid), 0)
                due_str = installment.due_date.strftime("%b %d, %Y")

                if window["offset_days"] > 0:
                    student_msg = (
                        f"{plan.currency} {amount_due:,} for {batch.name} is due on {due_str}."
                    )
                else:
                    student_msg = (
                        f"{plan.currency} {amount_due:,} for {batch.name} was due on {due_str}. "
                        f"Content access is now locked."
                    )

                try:
                    await notification_service.create_notification(
                        session,
                        user_id=student.id,
                        type=dedup_type,
                        title=window["title"],
                        message=student_msg,
                        link="/fees",
                        institute_id=plan.institute_id,
                    )
                    total_sent += 1
                except Exception as e:
                    logger.warning("Fee reminder student notif failed for %s: %s", student.id, e)
                    await session.rollback()
                    continue

                # Fire overdue webhook event — same dedup as the notification.
                # Only on transition-to-overdue (offset_days == 0) so retries
                # within the day don't re-fire.
                if window["offset_days"] == 0:
                    try:
                        from app.services import webhook_event_service
                        from datetime import datetime as _dt, timezone as _tz

                        await webhook_event_service.queue_webhook_event(
                            session,
                            plan.institute_id,
                            "fee.installment_overdue",
                            {
                                "fee_plan_id": str(plan.id),
                                "fee_installment_id": str(installment.id),
                                "student_id": str(student.id),
                                "batch_id": str(plan.batch_id),
                                "student_batch_id": str(plan.student_batch_id),
                                "installment_sequence": installment.sequence,
                                "amount_due": amount_due,
                                "currency": plan.currency,
                                "due_date": installment.due_date.isoformat(),
                                "occurred_at": _dt.now(_tz.utc).isoformat(),
                            },
                        )
                        await session.commit()
                    except Exception as e:
                        logger.warning(
                            "Fee overdue webhook emit failed for installment %s: %s",
                            installment.id, e,
                        )

                # Also ping the admissions officer for overdue
                if window["offset_days"] == 0:
                    officer_type = f"fee_overdue_alert:{installment.id}"
                    officer_existing = await session.execute(
                        select(Notification.id).where(
                            Notification.user_id == plan.onboarded_by_user_id,
                            Notification.type == officer_type,
                        ).limit(1)
                    )
                    if not officer_existing.scalar_one_or_none():
                        try:
                            await notification_service.create_notification(
                                session,
                                user_id=plan.onboarded_by_user_id,
                                type=officer_type,
                                title="A student's fee is overdue",
                                message=(
                                    f"{student.name} owes {plan.currency} {amount_due:,} for {batch.name}."
                                ),
                                link=f"/admissions/students/{student.id}",
                                institute_id=plan.institute_id,
                            )
                        except Exception as e:
                            logger.warning(
                                "Fee overdue officer notif failed for officer %s: %s",
                                plan.onboarded_by_user_id, e,
                            )

                # Email to the student — best effort, respects preferences
                try:
                    from app.utils.email_sender import send_templated_email, build_login_url, get_institute_branding

                    if not plan.institute_id:
                        continue

                    branding = await get_institute_branding(session, plan.institute_id)
                    login_url = build_login_url(branding["slug"]) if branding.get("slug") else ""

                    if window["offset_days"] > 0:
                        await send_templated_email(
                            session=session, institute_id=plan.institute_id, user_id=student.id,
                            email_type="email_fee_due", template_key="fee_due_soon", to=student.email,
                            variables={
                                "student_name": student.name,
                                "batch_name": batch.name,
                                "amount_due": str(amount_due),
                                "currency": plan.currency,
                                "due_date": due_str,
                                "days_remaining": str(window["offset_days"]),
                                "login_url": login_url,
                            },
                        )
                    else:
                        await send_templated_email(
                            session=session, institute_id=plan.institute_id, user_id=student.id,
                            email_type="email_fee_overdue", template_key="fee_overdue", to=student.email,
                            variables={
                                "student_name": student.name,
                                "batch_name": batch.name,
                                "amount_due": str(amount_due),
                                "currency": plan.currency,
                                "due_date": due_str,
                                "login_url": login_url,
                            },
                        )
                except Exception as e:
                    logger.warning("Fee reminder email failed for %s: %s", student.id, e)

        if total_sent:
            logger.info("Sent %d fee reminders", total_sent)


@sentry_job_wrapper("purge_stale_records")
async def purge_stale_records():
    """Daily cleanup: delete old inactive sessions, read notifications, resolved errors, old activity logs.
    Each table purged in its own transaction to avoid long-held locks."""
    from sqlmodel import delete

    now = datetime.now(timezone.utc)
    cutoff_30 = now - timedelta(days=30)
    cutoff_90 = now - timedelta(days=90)
    cutoff_180 = now - timedelta(days=180)
    cutoff_365 = now - timedelta(days=365)

    # 1. Purge inactive sessions older than 90 days (including those with NULL expires_at)
    async with async_session() as session:
        from app.models.session import UserSession
        from sqlalchemy import or_
        await session.execute(
            delete(UserSession).where(
                UserSession.is_active.is_(False),
                or_(
                    UserSession.expires_at < cutoff_90,
                    UserSession.expires_at.is_(None),
                ),
            )
        )
        await session.commit()

    # 2. Purge read notifications older than 90 days
    async with async_session() as session:
        from app.models.notification import Notification
        await session.execute(
            delete(Notification).where(
                Notification.read.is_(True),
                Notification.created_at < cutoff_90,
            )
        )
        await session.commit()

    # 3. Purge ALL notifications older than 180 days (read or unread — stale data)
    async with async_session() as session:
        from app.models.notification import Notification
        await session.execute(
            delete(Notification).where(
                Notification.read.is_(True),
                Notification.created_at < cutoff_180,
            )
        )
        await session.commit()

    # 4. Purge resolved error logs older than 30 days
    async with async_session() as session:
        from app.models.error_log import ErrorLog
        await session.execute(
            delete(ErrorLog).where(
                ErrorLog.resolved.is_(True),
                ErrorLog.created_at < cutoff_30,
            )
        )
        await session.commit()

    # 5. Purge unresolved error logs older than 90 days
    async with async_session() as session:
        from app.models.error_log import ErrorLog
        await session.execute(
            delete(ErrorLog).where(
                ErrorLog.resolved.is_(False),
                ErrorLog.created_at < cutoff_90,
            )
        )
        await session.commit()

    # 6. Purge activity logs older than 365 days
    async with async_session() as session:
        from app.models.activity import ActivityLog
        await session.execute(
            delete(ActivityLog).where(
                ActivityLog.created_at < cutoff_365,
            )
        )
        await session.commit()

    # 7. Purge delivered/failed webhook deliveries older than 30 days
    async with async_session() as session:
        from app.models.api_integration import WebhookDelivery
        await session.execute(
            delete(WebhookDelivery).where(
                WebhookDelivery.status.in_(["delivered", "failed"]),
                WebhookDelivery.created_at < cutoff_30,
            )
        )
        await session.commit()

    logger.info("Stale records purged: sessions/notifications/errors/activity/webhooks")


@sentry_job_wrapper("enforce_overdue_access_revocation")
async def enforce_overdue_access_revocation():
    """Daily at 00:00 PKT (19:00 UTC): for every institute with Frappe
    integration enabled, suspend students whose Sales Order has an
    overdue payment_schedule row and lift prior auto-suspensions whose
    overdue balance has cleared.

    Non-Frappe institutes are untouched. Errors on one institute are
    logged and the loop continues for the rest.
    """
    from sqlmodel import select
    from app.models.integration import InstituteIntegration
    from app.services import fee_enforcement_service

    async with async_session() as session:
        result = await session.execute(
            select(InstituteIntegration.institute_id).where(
                InstituteIntegration.frappe_enabled.is_(True),
            )
        )
        institute_ids = [row[0] for row in result.all()]
        logger.info(
            "Overdue enforcement: starting for %d Frappe-enabled institute(s)",
            len(institute_ids),
        )

        total_new_sus = total_already_sus = total_lifted = total_err = 0
        for institute_id in institute_ids:
            try:
                s1 = await fee_enforcement_service.enforce_overdue_suspensions(
                    session, institute_id,
                )
                s2 = await fee_enforcement_service.lift_suspensions_if_cleared(
                    session, institute_id,
                )
                total_new_sus += s1.newly_suspended
                total_already_sus += s1.already_suspended
                total_lifted += s2.newly_reactivated
                total_err += s1.errors + s2.errors
                logger.info(
                    "Overdue enforcement[%s]: checked=%d "
                    "newly_suspended=%d already_suspended=%d "
                    "newly_reactivated=%d errors=%d",
                    institute_id,
                    s1.checked,
                    s1.newly_suspended,
                    s1.already_suspended,
                    s2.newly_reactivated,
                    s1.errors + s2.errors,
                )
            except Exception:  # noqa: BLE001
                logger.exception(
                    "Overdue enforcement crashed for institute %s", institute_id,
                )
                total_err += 1

    logger.info(
        "Overdue enforcement complete: newly_suspended=%d already_suspended=%d "
        "newly_reactivated=%d errors=%d",
        total_new_sus, total_already_sus, total_lifted, total_err,
    )


@sentry_job_wrapper("refresh_payment_erp_statuses")
async def refresh_payment_erp_statuses():
    """Daily at 00:30 PKT: for each Frappe-enabled institute, refresh every
    pending payment's erp_status from Frappe (PE docstatus) and update the
    mirrored SI status on each affected plan.

    Runs 30 minutes after the overdue-suspension job so the two don't
    overlap (both hammer Frappe). Non-Frappe institutes short-circuit.
    """
    from sqlmodel import select
    from app.models.integration import InstituteIntegration
    from app.services import payment_status_service

    async with async_session() as session:
        result = await session.execute(
            select(InstituteIntegration.institute_id).where(
                InstituteIntegration.frappe_enabled.is_(True),
            )
        )
        institute_ids = [row[0] for row in result.all()]
        logger.info(
            "Payment ERP-status refresh: %d Frappe-enabled institute(s)",
            len(institute_ids),
        )

        total_confirmed = total_cancelled = total_pending = 0
        total_si_updated = total_err = 0
        for institute_id in institute_ids:
            try:
                s = await payment_status_service.refresh_stale_payment_erp_statuses(
                    session, institute_id,
                )
                total_confirmed += s.confirmed
                total_cancelled += s.cancelled
                total_pending += s.still_pending
                total_si_updated += s.si_status_updated
                total_err += s.errors
                logger.info(
                    "ERP-status refresh[%s]: checked=%d confirmed=%d cancelled=%d "
                    "still_pending=%d si_updated=%d errors=%d",
                    institute_id, s.checked, s.confirmed, s.cancelled,
                    s.still_pending, s.si_status_updated, s.errors,
                )
            except Exception:  # noqa: BLE001
                logger.exception(
                    "Payment ERP-status refresh crashed for institute %s", institute_id,
                )
                total_err += 1

    logger.info(
        "Payment ERP-status refresh complete: confirmed=%d cancelled=%d "
        "still_pending=%d si_updated=%d errors=%d",
        total_confirmed, total_cancelled, total_pending, total_si_updated, total_err,
    )
