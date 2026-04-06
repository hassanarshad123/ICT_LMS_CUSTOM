import logging
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlmodel import select, func

from app.models.zoom import ZoomAccount, ZoomClass, ClassRecording, ZoomAttendance
from app.models.batch import Batch, StudentBatch
from app.models.user import User
from app.models.enums import ZoomClassStatus, RecordingStatus
from app.utils.formatters import format_duration

logger = logging.getLogger("ict_lms.zoom")


async def list_accounts(
    session: AsyncSession, institute_id: Optional[uuid.UUID] = None
) -> list[ZoomAccount]:
    query = select(ZoomAccount).where(ZoomAccount.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(ZoomAccount.institute_id == institute_id)
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_account(session: AsyncSession, account_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None) -> ZoomAccount | None:
    filters = [ZoomAccount.id == account_id, ZoomAccount.deleted_at.is_(None)]
    if institute_id is not None:
        filters.append(ZoomAccount.institute_id == institute_id)
    result = await session.execute(select(ZoomAccount).where(*filters))
    return result.scalar_one_or_none()


async def create_account(
    session: AsyncSession, institute_id: Optional[uuid.UUID] = None, **fields
) -> ZoomAccount:
    account = ZoomAccount(**fields, institute_id=institute_id)
    session.add(account)
    await session.commit()
    await session.refresh(account)
    return account


async def update_account(session: AsyncSession, account_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None, **fields) -> ZoomAccount:
    account = await get_account(session, account_id, institute_id=institute_id)
    if not account:
        raise ValueError("Zoom account not found")

    for key, value in fields.items():
        if value is not None and hasattr(account, key):
            setattr(account, key, value)

    account.updated_at = datetime.now(timezone.utc)
    session.add(account)
    await session.commit()
    await session.refresh(account)
    return account


async def soft_delete_account(session: AsyncSession, account_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None) -> None:
    account = await get_account(session, account_id, institute_id=institute_id)
    if not account:
        raise ValueError("Zoom account not found")

    now = datetime.now(timezone.utc)
    account.deleted_at = now
    session.add(account)

    # Cascade: soft-delete zoom classes and delete their Zoom meetings
    zc_result = await session.execute(
        select(ZoomClass).where(
            ZoomClass.zoom_account_id == account_id, ZoomClass.deleted_at.is_(None)
        )
    )
    for zc in zc_result.scalars().all():
        if zc.zoom_meeting_id:
            try:
                from app.utils.zoom_api import delete_meeting
                await delete_meeting(
                    account.account_id, account.client_id,
                    account.client_secret, zc.zoom_meeting_id,
                )
            except Exception as e:
                logger.warning("Failed to delete Zoom meeting %s: %s", zc.zoom_meeting_id, e)
        zc.deleted_at = now
        session.add(zc)

    await session.commit()


async def set_default_account(
    session: AsyncSession, account_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> ZoomAccount:
    # Unset all defaults (scoped to institute)
    filters = [ZoomAccount.deleted_at.is_(None), ZoomAccount.is_default.is_(True)]
    if institute_id is not None:
        filters.append(ZoomAccount.institute_id == institute_id)
    result = await session.execute(
        select(ZoomAccount).where(*filters)
    )
    for acc in result.scalars().all():
        acc.is_default = False
        session.add(acc)

    account = await get_account(session, account_id)
    if not account:
        raise ValueError("Zoom account not found")

    account.is_default = True
    session.add(account)
    await session.commit()
    await session.refresh(account)
    return account


# --- Phase 6: Fixed N+1 with JOINs ---

async def list_classes(
    session: AsyncSession,
    current_user: User,
    batch_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    teacher_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    institute_id: Optional[uuid.UUID] = None,
) -> tuple[list[dict], int]:
    from app.models.enums import UserRole

    Teacher = aliased(User)

    base_filters = [ZoomClass.deleted_at.is_(None)]

    if search:
        base_filters.append(ZoomClass.title.ilike(f"%{search}%"))

    if institute_id is not None:
        base_filters.append(ZoomClass.institute_id == institute_id)

    # Role scoping
    if current_user.role == UserRole.teacher:
        base_filters.append(ZoomClass.teacher_id == current_user.id)
    elif current_user.role == UserRole.student:
        my_batches = (
            select(StudentBatch.batch_id)
            .join(Batch, StudentBatch.batch_id == Batch.id)
            .where(
                StudentBatch.student_id == current_user.id,
                StudentBatch.removed_at.is_(None),
                StudentBatch.is_active.is_(True),
                func.coalesce(StudentBatch.extended_end_date, Batch.end_date) >= date.today(),
            )
        )
        base_filters.append(ZoomClass.batch_id.in_(my_batches))
    elif current_user.role == UserRole.course_creator:
        my_batches = select(Batch.id).where(
            Batch.created_by == current_user.id, Batch.deleted_at.is_(None)
        )
        base_filters.append(ZoomClass.batch_id.in_(my_batches))

    if batch_id:
        base_filters.append(ZoomClass.batch_id == batch_id)
    if status_filter:
        base_filters.append(ZoomClass.status == ZoomClassStatus(status_filter))
    if teacher_id:
        base_filters.append(ZoomClass.teacher_id == teacher_id)

    # Count query
    count_query = select(func.count()).select_from(ZoomClass).where(*base_filters)
    result = await session.execute(count_query)
    total = result.scalar() or 0

    # Data query with JOINs (fixes N+1)
    offset = (page - 1) * per_page
    data_query = (
        select(ZoomClass, Batch.name.label("batch_name"), Teacher.name.label("teacher_name"))
        .join(Batch, ZoomClass.batch_id == Batch.id, isouter=True)
        .join(Teacher, ZoomClass.teacher_id == Teacher.id, isouter=True)
        .where(*base_filters)
        .order_by(ZoomClass.scheduled_date.desc(), ZoomClass.scheduled_time.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await session.execute(data_query)
    rows = result.all()

    # Only teachers (for their own classes) and admin/CC should see zoom_start_url
    # Students should never get the host URL — it grants host privileges
    can_see_start_url = current_user.role in (
        UserRole.admin, UserRole.course_creator, UserRole.teacher
    )

    # scheduled_date/time are stored as naive local time (no timezone).
    # Compare against naive local now to match. Server TZ = UTC, users enter PKT (UTC+5).
    # Use UTC+5 offset to match Pakistan Standard Time.
    from zoneinfo import ZoneInfo
    now_local = datetime.now(ZoneInfo("Asia/Karachi")).replace(tzinfo=None)

    items = []
    for zc, batch_name, teacher_name in rows:
        # Time-based status override: if a class is still "upcoming" but its
        # scheduled time + duration has passed, mark it as "completed" (missed).
        # This handles cases where the webhook was never received.
        effective_status = zc.status.value
        if zc.status == ZoomClassStatus.upcoming and zc.scheduled_date and zc.scheduled_time:
            scheduled_dt = datetime.combine(zc.scheduled_date, zc.scheduled_time)
            class_end = scheduled_dt + timedelta(minutes=(zc.duration or 60) + 15)  # 15-min grace
            if now_local > class_end:
                effective_status = "completed"

        items.append({
            "id": zc.id,
            "title": zc.title,
            "batch_id": zc.batch_id,
            "batch_name": batch_name,
            "teacher_id": zc.teacher_id,
            "teacher_name": teacher_name,
            "zoom_meeting_url": zc.zoom_meeting_url,
            "zoom_start_url": zc.zoom_start_url if can_see_start_url else None,
            "scheduled_date": zc.scheduled_date,
            "scheduled_time": zc.scheduled_time.strftime("%H:%M") if zc.scheduled_time else None,
            "duration": zc.duration,
            "duration_display": format_duration(zc.duration * 60) if zc.duration else None,
            "status": effective_status,
            "zoom_account_id": zc.zoom_account_id,
            "created_at": zc.created_at,
        })

    return items, total


async def create_class(
    session: AsyncSession,
    title: str,
    batch_id: uuid.UUID,
    teacher_id: uuid.UUID,
    zoom_account_id: uuid.UUID,
    scheduled_date,
    scheduled_time: str,
    duration: int,
    zoom_meeting_id: Optional[str] = None,
    zoom_meeting_url: Optional[str] = None,
    zoom_start_url: Optional[str] = None,
    institute_id: Optional[uuid.UUID] = None,
) -> ZoomClass:
    # Parse time
    parts = scheduled_time.split(":")
    t = time(int(parts[0]), int(parts[1]))

    zc = ZoomClass(
        title=title,
        batch_id=batch_id,
        teacher_id=teacher_id,
        zoom_account_id=zoom_account_id,
        scheduled_date=scheduled_date,
        scheduled_time=t,
        duration=duration,
        zoom_meeting_id=zoom_meeting_id,
        zoom_meeting_url=zoom_meeting_url,
        zoom_start_url=zoom_start_url,
        institute_id=institute_id,
    )
    session.add(zc)
    await session.commit()
    await session.refresh(zc)
    return zc


async def update_class(session: AsyncSession, class_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None, **fields) -> ZoomClass:
    filters = [ZoomClass.id == class_id, ZoomClass.deleted_at.is_(None)]
    if institute_id is not None:
        filters.append(ZoomClass.institute_id == institute_id)
    result = await session.execute(select(ZoomClass).where(*filters))
    zc = result.scalar_one_or_none()
    if not zc:
        raise ValueError("Zoom class not found")

    for key, value in fields.items():
        if value is not None and hasattr(zc, key):
            if key == "scheduled_time" and isinstance(value, str):
                parts = value.split(":")
                value = time(int(parts[0]), int(parts[1]))
            setattr(zc, key, value)

    zc.updated_at = datetime.now(timezone.utc)
    session.add(zc)
    await session.commit()
    await session.refresh(zc)
    return zc


# --- Phase 2: Delete Zoom meeting on class deletion ---

async def soft_delete_class(session: AsyncSession, class_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None) -> None:
    filters = [ZoomClass.id == class_id, ZoomClass.deleted_at.is_(None)]
    if institute_id is not None:
        filters.append(ZoomClass.institute_id == institute_id)
    result = await session.execute(select(ZoomClass).where(*filters))
    zc = result.scalar_one_or_none()
    if not zc:
        raise ValueError("Zoom class not found")

    # Delete the Zoom meeting via API
    if zc.zoom_meeting_id:
        try:
            account = await get_account(session, zc.zoom_account_id, institute_id=institute_id)
            if account:
                from app.utils.zoom_api import delete_meeting
                await delete_meeting(
                    account.account_id, account.client_id,
                    account.client_secret, zc.zoom_meeting_id,
                )
        except Exception as e:
            logger.warning("Failed to delete Zoom meeting %s: %s", zc.zoom_meeting_id, e)

    zc.deleted_at = datetime.now(timezone.utc)
    session.add(zc)
    await session.commit()


async def get_attendance(
    session: AsyncSession, class_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> list[dict]:
    filters = [ZoomAttendance.zoom_class_id == class_id]
    if institute_id is not None:
        filters.append(ZoomAttendance.institute_id == institute_id)
    result = await session.execute(
        select(ZoomAttendance, User)
        .join(User, ZoomAttendance.student_id == User.id)
        .where(*filters)
    )
    rows = result.all()
    return [
        {
            "id": att.id,
            "zoom_class_id": att.zoom_class_id,
            "student_id": att.student_id,
            "student_name": u.name,
            "attended": att.attended,
            "join_time": att.join_time,
            "leave_time": att.leave_time,
            "duration_minutes": att.duration_minutes,
        }
        for att, u in rows
    ]


async def get_recordings(
    session: AsyncSession, class_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> list[ClassRecording]:
    filters = [ClassRecording.zoom_class_id == class_id]
    if institute_id is not None:
        filters.append(ClassRecording.institute_id == institute_id)
    result = await session.execute(
        select(ClassRecording).where(*filters)
    )
    return list(result.scalars().all())


async def update_class_status(
    session: AsyncSession, meeting_id: str, new_status: ZoomClassStatus
) -> ZoomClass | None:
    result = await session.execute(
        select(ZoomClass).where(
            ZoomClass.zoom_meeting_id == meeting_id,
            ZoomClass.deleted_at.is_(None),
        )
    )
    zc = result.scalar_one_or_none()
    if not zc:
        return None

    zc.status = new_status
    zc.updated_at = datetime.now(timezone.utc)
    session.add(zc)
    await session.commit()
    await session.refresh(zc)
    return zc


async def create_recording(
    session: AsyncSession,
    zoom_class_id: uuid.UUID,
    original_download_url: Optional[str] = None,
    duration: Optional[int] = None,
    file_size: Optional[int] = None,
    institute_id: Optional[uuid.UUID] = None,
) -> ClassRecording:
    recording = ClassRecording(
        zoom_class_id=zoom_class_id,
        original_download_url=original_download_url,
        duration=duration,
        file_size=file_size,
        institute_id=institute_id,
    )
    session.add(recording)
    await session.commit()
    await session.refresh(recording)
    return recording


# --- Phase 1A: Global recordings list + signed URL ---

async def list_all_recordings(
    session: AsyncSession,
    current_user: User,
    page: int = 1,
    per_page: int = 20,
    institute_id: Optional[uuid.UUID] = None,
    include_deleted: bool = False,
) -> tuple[list[dict], int]:
    from app.models.enums import UserRole

    Teacher = aliased(User)

    base_filters = [ZoomClass.deleted_at.is_(None)]

    if institute_id is not None:
        base_filters.append(ZoomClass.institute_id == institute_id)

    # Role scoping (same as list_classes)
    if current_user.role == UserRole.teacher:
        base_filters.append(ZoomClass.teacher_id == current_user.id)
    elif current_user.role == UserRole.student:
        my_batches = (
            select(StudentBatch.batch_id)
            .join(Batch, StudentBatch.batch_id == Batch.id)
            .where(
                StudentBatch.student_id == current_user.id,
                StudentBatch.removed_at.is_(None),
                StudentBatch.is_active.is_(True),
                func.coalesce(StudentBatch.extended_end_date, Batch.end_date) >= date.today(),
            )
        )
        base_filters.append(ZoomClass.batch_id.in_(my_batches))
    elif current_user.role == UserRole.course_creator:
        my_batches = select(Batch.id).where(
            Batch.created_by == current_user.id, Batch.deleted_at.is_(None)
        )
        base_filters.append(ZoomClass.batch_id.in_(my_batches))

    # Only show ready recordings (or processing for admin/CC)
    if current_user.role in (UserRole.student, UserRole.teacher):
        base_filters.append(ClassRecording.status == RecordingStatus.ready)

    # Soft-delete filtering
    if current_user.role in (UserRole.student, UserRole.teacher):
        base_filters.append(ClassRecording.deleted_at.is_(None))
    elif not include_deleted:
        base_filters.append(ClassRecording.deleted_at.is_(None))

    count_query = (
        select(func.count())
        .select_from(ClassRecording)
        .join(ZoomClass, ClassRecording.zoom_class_id == ZoomClass.id)
        .where(*base_filters)
    )
    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    data_query = (
        select(
            ClassRecording,
            ZoomClass.title.label("class_title"),
            ZoomClass.scheduled_date,
            ZoomClass.scheduled_time,
            Batch.name.label("batch_name"),
            Teacher.name.label("teacher_name"),
        )
        .join(ZoomClass, ClassRecording.zoom_class_id == ZoomClass.id)
        .join(Batch, ZoomClass.batch_id == Batch.id, isouter=True)
        .join(Teacher, ZoomClass.teacher_id == Teacher.id, isouter=True)
        .where(*base_filters)
        .order_by(ClassRecording.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await session.execute(data_query)
    rows = result.all()

    items = []
    for rec, class_title, sched_date, sched_time, batch_name, teacher_name in rows:
        # Build Bunny thumbnail URL if video exists
        thumbnail_url = None
        if rec.bunny_video_id and rec.bunny_library_id:
            thumbnail_url = f"https://{rec.bunny_library_id}.b-cdn.net/{rec.bunny_video_id}/thumbnail.jpg"

        items.append({
            "id": rec.id,
            "class_title": class_title,
            "teacher_name": teacher_name,
            "batch_name": batch_name,
            "scheduled_date": sched_date,
            "scheduled_time": sched_time.strftime("%H:%M") if sched_time else None,
            "thumbnail_url": thumbnail_url,
            "duration": rec.duration,
            "file_size": rec.file_size,
            "status": rec.status.value,
            "title": rec.title,
            "description": rec.description,
            "deleted_at": rec.deleted_at,
            "created_at": rec.created_at,
        })

    return items, total


async def get_recording_signed_url(
    session: AsyncSession, recording_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> dict:
    filters = [ClassRecording.id == recording_id]
    if institute_id is not None:
        filters.append(ClassRecording.institute_id == institute_id)
    result = await session.execute(
        select(ClassRecording).where(*filters)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise ValueError("Recording not found")

    # Prefer Bunny embed if available
    if rec.bunny_video_id:
        from app.utils.bunny import generate_embed_token

        embed_url, expires_at = generate_embed_token(rec.bunny_video_id)
        return {"url": embed_url, "type": "bunny", "expires_at": expires_at}

    # Never expose raw Zoom download URLs to the client
    raise ValueError("Recording is still being processed. Please try again later.")


# --- Phase 4A: Attendance sync ---

async def sync_attendance(session: AsyncSession, class_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None) -> int:
    """Sync Zoom meeting participants into ZoomAttendance records. Returns count synced."""
    # Check if already synced
    existing = await session.execute(
        select(func.count()).select_from(ZoomAttendance).where(
            ZoomAttendance.zoom_class_id == class_id
        )
    )
    if (existing.scalar() or 0) > 0:
        return 0  # Already synced

    # Get the class + account (skip deleted classes)
    filters = [ZoomClass.id == class_id, ZoomClass.deleted_at.is_(None)]
    if institute_id is not None:
        filters.append(ZoomClass.institute_id == institute_id)
    result = await session.execute(select(ZoomClass).where(*filters))
    zc = result.scalar_one_or_none()
    if not zc or not zc.zoom_meeting_id:
        return 0

    account = await get_account(session, zc.zoom_account_id, institute_id=institute_id)
    if not account:
        return 0

    # Get Zoom participants
    from app.utils.zoom_api import get_meeting_participants
    try:
        participants = await get_meeting_participants(
            account.account_id, account.client_id,
            account.client_secret, zc.zoom_meeting_id,
        )
    except Exception as e:
        logger.warning("Failed to get participants for meeting %s: %s", zc.zoom_meeting_id, e)
        return 0

    # Build participant map by email (aggregate for rejoins)
    participant_map: dict[str, dict] = {}
    for p in participants:
        email = (p.get("user_email") or "").lower().strip()
        if not email:
            continue
        if email not in participant_map:
            participant_map[email] = {
                "join_time": p.get("join_time"),
                "leave_time": p.get("leave_time"),
                "duration": int(p.get("duration", 0)),
            }
        else:
            # Aggregate: earliest join, latest leave, sum duration
            entry = participant_map[email]
            if p.get("join_time") and (not entry["join_time"] or p["join_time"] < entry["join_time"]):
                entry["join_time"] = p["join_time"]
            if p.get("leave_time") and (not entry["leave_time"] or p["leave_time"] > entry["leave_time"]):
                entry["leave_time"] = p["leave_time"]
            entry["duration"] += int(p.get("duration", 0))

    # Get enrolled students for this batch
    from app.models.enums import UserRole
    enrolled_result = await session.execute(
        select(User)
        .join(StudentBatch, StudentBatch.student_id == User.id)
        .where(
            StudentBatch.batch_id == zc.batch_id,
            StudentBatch.removed_at.is_(None),
            User.deleted_at.is_(None),
            User.role == UserRole.student,
        )
    )
    students = enrolled_result.scalars().all()

    count = 0
    for student in students:
        email = (student.email or "").lower().strip()
        p_data = participant_map.get(email)

        join_time = None
        leave_time = None
        duration_minutes = None
        attended = False

        if p_data:
            attended = True
            duration_minutes = p_data["duration"] // 60 if p_data["duration"] else None
            if p_data["join_time"]:
                try:
                    join_time = datetime.fromisoformat(p_data["join_time"].replace("Z", "+00:00"))
                except (ValueError, AttributeError):
                    pass
            if p_data["leave_time"]:
                try:
                    leave_time = datetime.fromisoformat(p_data["leave_time"].replace("Z", "+00:00"))
                except (ValueError, AttributeError):
                    pass

        attendance = ZoomAttendance(
            zoom_class_id=class_id,
            student_id=student.id,
            attended=attended,
            join_time=join_time,
            leave_time=leave_time,
            duration_minutes=duration_minutes,
            institute_id=zc.institute_id,
        )
        session.add(attendance)
        count += 1

    await session.commit()
    return count


# --- Phase 5C: Recording processing (Zoom → Bunny) ---

async def process_recording(session: AsyncSession, recording_id: uuid.UUID) -> None:
    """Download recording from Zoom and upload to Bunny.net."""
    result = await session.execute(
        select(ClassRecording).where(ClassRecording.id == recording_id)
    )
    rec = result.scalar_one_or_none()
    if not rec or not rec.original_download_url:
        return

    # Save IDs before any commit expires ORM attributes
    zoom_class_id = rec.zoom_class_id

    # Get the class and its account
    zc_result = await session.execute(
        select(ZoomClass).where(ZoomClass.id == rec.zoom_class_id)
    )
    zc = zc_result.scalar_one_or_none()
    if not zc:
        return

    account = await get_account(session, zc.zoom_account_id)
    if not account:
        return

    try:
        from app.utils.zoom_api import get_recording_download_url, _get_access_token
        from app.utils.bunny import create_video_from_url

        # The webhook_download URL is short-lived and may expire before Bunny
        # fetches it. Instead, get a fresh download URL from the Zoom recordings API.
        download_url = rec.original_download_url
        if zc.zoom_meeting_id:
            try:
                import httpx as _httpx
                token = await _get_access_token(
                    account.account_id, account.client_id, account.client_secret
                )
                async with _httpx.AsyncClient(timeout=15) as _client:
                    resp = await _client.get(
                        f"https://api.zoom.us/v2/meetings/{zc.zoom_meeting_id}/recordings",
                        headers={"Authorization": f"Bearer {token}"},
                    )
                if resp.status_code == 200:
                    for rf in resp.json().get("recording_files", []):
                        if rf.get("file_type") == "MP4" and rf.get("download_url"):
                            download_url = rf["download_url"]
                            break
                    logger.info("Using fresh download URL from recordings API for %s", recording_id)
            except Exception as e:
                logger.warning("Failed to get fresh download URL, using webhook URL: %s", e)

        # Get authenticated download URL (appends ?access_token=)
        authed_url = await get_recording_download_url(
            account.account_id, account.client_id,
            account.client_secret, download_url,
        )

        # Tell Bunny to fetch from that URL
        bunny_result = await create_video_from_url(
            title=f"{zc.title} - Recording",
            source_url=authed_url,
        )

        rec.bunny_video_id = bunny_result["video_id"]
        rec.bunny_library_id = bunny_result["library_id"]
        rec.status = RecordingStatus.ready
        rec.updated_at = datetime.now(timezone.utc)
        session.add(rec)
        await session.commit()
        logger.info("Recording %s uploaded to Bunny: %s", recording_id, bunny_result["video_id"])

        # Notify students that recording is available
        # Use saved zoom_class_id (rec attributes may be expired after commit)
        try:
            from app.services.zoom_notification_service import notify_recording_available
            zc_result = await session.execute(
                select(ZoomClass).where(ZoomClass.id == zoom_class_id)
            )
            zc_notif = zc_result.scalar_one_or_none()
            if zc_notif:
                await notify_recording_available(session, zc_notif)
        except Exception as notif_err:
            logger.warning("Failed to send recording notification: %s", notif_err)

    except Exception as e:
        logger.error("Failed to process recording %s: %s", recording_id, e)
        rec.status = RecordingStatus.failed
        rec.updated_at = datetime.now(timezone.utc)
        session.add(rec)
        await session.commit()


async def get_zoom_analytics(
    session: AsyncSession, institute_id: Optional[uuid.UUID] = None
) -> dict:
    """Return aggregate Zoom class/recording/attendance stats for dashboards."""
    base_filter = [ZoomClass.deleted_at.is_(None)]
    if institute_id is not None:
        base_filter.append(ZoomClass.institute_id == institute_id)

    # Class counts by status — apply the same time-based override as list_classes
    # so stale "upcoming" classes past their end time count as completed, not upcoming
    from zoneinfo import ZoneInfo
    now_local = datetime.now(ZoneInfo("Asia/Karachi")).replace(tzinfo=None)

    r = await session.execute(
        select(ZoomClass.status, ZoomClass.scheduled_date, ZoomClass.scheduled_time, ZoomClass.duration)
        .where(*base_filter)
    )
    rows = r.all()

    upcoming = 0
    live = 0
    completed = 0
    for row in rows:
        effective_status = row[0].value
        if effective_status in ("upcoming", "scheduled") and row[1] and row[2]:
            scheduled_dt = datetime.combine(row[1], row[2])
            class_end = scheduled_dt + timedelta(minutes=(row[3] or 60) + 15)
            if now_local > class_end:
                effective_status = "completed"

        if effective_status in ("upcoming", "scheduled"):
            upcoming += 1
        elif effective_status == "live":
            live += 1
        elif effective_status == "completed":
            completed += 1

    total_classes = upcoming + live + completed

    # Total recordings (ClassRecording has no deleted_at — filter via parent class)
    rec_query = select(func.count(ClassRecording.id))
    if institute_id is not None:
        rec_query = rec_query.where(
            ClassRecording.zoom_class_id.in_(
                select(ZoomClass.id).where(*base_filter)
            )
        )
    r = await session.execute(rec_query)
    total_recordings = r.scalar() or 0

    # Average attendance rate
    from sqlalchemy import case
    att_query = select(
        func.count(ZoomAttendance.id),
        func.sum(case((ZoomAttendance.attended == True, 1), else_=0)),  # noqa: E712
    )
    if institute_id is not None:
        att_query = att_query.where(
            ZoomAttendance.zoom_class_id.in_(
                select(ZoomClass.id).where(*base_filter)
            )
        )
    r = await session.execute(att_query)
    row = r.one_or_none()
    total_attendance_records = row[0] if row else 0
    attended_count = row[1] if row and row[1] else 0
    avg_attendance_rate = round((attended_count / total_attendance_records) * 100, 1) if total_attendance_records > 0 else 0

    return {
        "total_classes": total_classes,
        "upcoming_classes": upcoming,
        "live_classes": live,
        "completed_classes": completed,
        "total_recordings": total_recordings,
        "average_attendance_rate": avg_attendance_rate,
    }


async def update_recording(
    session: AsyncSession,
    recording_id: uuid.UUID,
    title: Optional[str] = None,
    description: Optional[str] = None,
    institute_id: Optional[uuid.UUID] = None,
) -> ClassRecording:
    filters = [ClassRecording.id == recording_id, ClassRecording.deleted_at.is_(None)]
    if institute_id is not None:
        filters.append(ClassRecording.institute_id == institute_id)
    result = await session.execute(select(ClassRecording).where(*filters))
    rec = result.scalar_one_or_none()
    if not rec:
        raise ValueError("Recording not found")
    if title is not None:
        rec.title = title
    if description is not None:
        rec.description = description
    rec.updated_at = datetime.now(timezone.utc)
    session.add(rec)
    await session.commit()
    await session.refresh(rec)
    return rec


async def soft_delete_recording(
    session: AsyncSession,
    recording_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> None:
    filters = [ClassRecording.id == recording_id, ClassRecording.deleted_at.is_(None)]
    if institute_id is not None:
        filters.append(ClassRecording.institute_id == institute_id)
    result = await session.execute(select(ClassRecording).where(*filters))
    rec = result.scalar_one_or_none()
    if not rec:
        raise ValueError("Recording not found")
    rec.deleted_at = datetime.now(timezone.utc)
    session.add(rec)
    await session.commit()


async def hard_delete_recording(
    session: AsyncSession,
    recording_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> None:
    filters = [ClassRecording.id == recording_id, ClassRecording.deleted_at.isnot(None)]
    if institute_id is not None:
        filters.append(ClassRecording.institute_id == institute_id)
    result = await session.execute(select(ClassRecording).where(*filters))
    rec = result.scalar_one_or_none()
    if not rec:
        raise ValueError("Recording not found or not soft-deleted")
    if rec.bunny_video_id:
        from app.utils.bunny import delete_video
        try:
            await delete_video(rec.bunny_video_id)
        except Exception as e:
            logger.warning("Failed to delete Bunny video %s: %s", rec.bunny_video_id, e)
    await session.delete(rec)
    await session.commit()


async def restore_recording(
    session: AsyncSession,
    recording_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> ClassRecording:
    filters = [ClassRecording.id == recording_id, ClassRecording.deleted_at.isnot(None)]
    if institute_id is not None:
        filters.append(ClassRecording.institute_id == institute_id)
    result = await session.execute(select(ClassRecording).where(*filters))
    rec = result.scalar_one_or_none()
    if not rec:
        raise ValueError("Recording not found or not deleted")
    rec.deleted_at = None
    rec.updated_at = datetime.now(timezone.utc)
    session.add(rec)
    await session.commit()
    await session.refresh(rec)
    return rec
