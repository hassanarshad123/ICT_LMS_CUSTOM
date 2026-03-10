import logging
import uuid
from datetime import datetime, time, timezone
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


async def list_accounts(session: AsyncSession) -> list[ZoomAccount]:
    result = await session.execute(
        select(ZoomAccount).where(ZoomAccount.deleted_at.is_(None))
    )
    return list(result.scalars().all())


async def get_account(session: AsyncSession, account_id: uuid.UUID) -> ZoomAccount | None:
    result = await session.execute(
        select(ZoomAccount).where(
            ZoomAccount.id == account_id, ZoomAccount.deleted_at.is_(None)
        )
    )
    return result.scalar_one_or_none()


async def create_account(session: AsyncSession, **fields) -> ZoomAccount:
    account = ZoomAccount(**fields)
    session.add(account)
    await session.commit()
    await session.refresh(account)
    return account


async def update_account(session: AsyncSession, account_id: uuid.UUID, **fields) -> ZoomAccount:
    account = await get_account(session, account_id)
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


async def soft_delete_account(session: AsyncSession, account_id: uuid.UUID) -> None:
    account = await get_account(session, account_id)
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


async def set_default_account(session: AsyncSession, account_id: uuid.UUID) -> ZoomAccount:
    # Unset all defaults
    result = await session.execute(
        select(ZoomAccount).where(ZoomAccount.deleted_at.is_(None), ZoomAccount.is_default.is_(True))
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
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    from app.models.enums import UserRole

    Teacher = aliased(User)

    base_filters = [ZoomClass.deleted_at.is_(None)]

    # Role scoping
    if current_user.role == UserRole.teacher:
        base_filters.append(ZoomClass.teacher_id == current_user.id)
    elif current_user.role == UserRole.student:
        my_batches = select(StudentBatch.batch_id).where(
            StudentBatch.student_id == current_user.id, StudentBatch.removed_at.is_(None)
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

    items = []
    for zc, batch_name, teacher_name in rows:
        items.append({
            "id": zc.id,
            "title": zc.title,
            "batch_id": zc.batch_id,
            "batch_name": batch_name,
            "teacher_id": zc.teacher_id,
            "teacher_name": teacher_name,
            "zoom_meeting_url": zc.zoom_meeting_url,
            "zoom_start_url": zc.zoom_start_url,
            "scheduled_date": zc.scheduled_date,
            "scheduled_time": zc.scheduled_time.strftime("%H:%M") if zc.scheduled_time else None,
            "duration": zc.duration,
            "duration_display": format_duration(zc.duration * 60) if zc.duration else None,
            "status": zc.status.value,
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
    )
    session.add(zc)
    await session.commit()
    await session.refresh(zc)
    return zc


async def update_class(session: AsyncSession, class_id: uuid.UUID, **fields) -> ZoomClass:
    result = await session.execute(
        select(ZoomClass).where(ZoomClass.id == class_id, ZoomClass.deleted_at.is_(None))
    )
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

async def soft_delete_class(session: AsyncSession, class_id: uuid.UUID) -> None:
    result = await session.execute(
        select(ZoomClass).where(ZoomClass.id == class_id, ZoomClass.deleted_at.is_(None))
    )
    zc = result.scalar_one_or_none()
    if not zc:
        raise ValueError("Zoom class not found")

    # Delete the Zoom meeting via API
    if zc.zoom_meeting_id:
        try:
            account = await get_account(session, zc.zoom_account_id)
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


async def get_attendance(session: AsyncSession, class_id: uuid.UUID) -> list[dict]:
    result = await session.execute(
        select(ZoomAttendance, User)
        .join(User, ZoomAttendance.student_id == User.id)
        .where(ZoomAttendance.zoom_class_id == class_id)
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


async def get_recordings(session: AsyncSession, class_id: uuid.UUID) -> list[ClassRecording]:
    result = await session.execute(
        select(ClassRecording).where(ClassRecording.zoom_class_id == class_id)
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
) -> ClassRecording:
    recording = ClassRecording(
        zoom_class_id=zoom_class_id,
        original_download_url=original_download_url,
        duration=duration,
        file_size=file_size,
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
) -> tuple[list[dict], int]:
    from app.models.enums import UserRole

    Teacher = aliased(User)

    base_filters = [ZoomClass.deleted_at.is_(None)]

    # Role scoping (same as list_classes)
    if current_user.role == UserRole.teacher:
        base_filters.append(ZoomClass.teacher_id == current_user.id)
    elif current_user.role == UserRole.student:
        my_batches = select(StudentBatch.batch_id).where(
            StudentBatch.student_id == current_user.id, StudentBatch.removed_at.is_(None)
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
            "created_at": rec.created_at,
        })

    return items, total


async def get_recording_signed_url(
    session: AsyncSession, recording_id: uuid.UUID
) -> dict:
    result = await session.execute(
        select(ClassRecording).where(ClassRecording.id == recording_id)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise ValueError("Recording not found")

    # Prefer Bunny embed if available
    if rec.bunny_video_id:
        from app.utils.bunny import generate_embed_token
        embed_url, _ = generate_embed_token(rec.bunny_video_id)
        return {"url": embed_url, "type": "bunny"}

    # Fall back to original download URL
    if rec.original_download_url:
        return {"url": rec.original_download_url, "type": "direct"}

    raise ValueError("No playable URL available for this recording")


# --- Phase 4A: Attendance sync ---

async def sync_attendance(session: AsyncSession, class_id: uuid.UUID) -> int:
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
    result = await session.execute(
        select(ZoomClass).where(
            ZoomClass.id == class_id,
            ZoomClass.deleted_at.is_(None),
        )
    )
    zc = result.scalar_one_or_none()
    if not zc or not zc.zoom_meeting_id:
        return 0

    account = await get_account(session, zc.zoom_account_id)
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
        from app.utils.zoom_api import get_recording_download_url
        from app.utils.bunny import create_video_from_url

        # Get authenticated download URL
        authed_url = await get_recording_download_url(
            account.account_id, account.client_id,
            account.client_secret, rec.original_download_url,
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

    except Exception as e:
        logger.error("Failed to process recording %s: %s", recording_id, e)
        rec.status = RecordingStatus.failed
        rec.updated_at = datetime.now(timezone.utc)
        session.add(rec)
        await session.commit()
