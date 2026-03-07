import uuid
from datetime import datetime, time, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.zoom import ZoomAccount, ZoomClass, ClassRecording, ZoomAttendance
from app.models.batch import Batch
from app.models.user import User
from app.models.enums import ZoomClassStatus, RecordingStatus
from app.utils.formatters import format_duration


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

    account.deleted_at = datetime.now(timezone.utc)
    session.add(account)
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
    from app.models.batch import StudentBatch

    query = select(ZoomClass).where(ZoomClass.deleted_at.is_(None))
    count_query = select(func.count()).select_from(ZoomClass).where(ZoomClass.deleted_at.is_(None))

    # Role scoping
    if current_user.role == UserRole.teacher:
        query = query.where(ZoomClass.teacher_id == current_user.id)
        count_query = count_query.where(ZoomClass.teacher_id == current_user.id)
    elif current_user.role == UserRole.student:
        my_batches = select(StudentBatch.batch_id).where(
            StudentBatch.student_id == current_user.id, StudentBatch.removed_at.is_(None)
        )
        query = query.where(ZoomClass.batch_id.in_(my_batches))
        count_query = count_query.where(ZoomClass.batch_id.in_(my_batches))

    if batch_id:
        query = query.where(ZoomClass.batch_id == batch_id)
        count_query = count_query.where(ZoomClass.batch_id == batch_id)

    if status_filter:
        query = query.where(ZoomClass.status == ZoomClassStatus(status_filter))
        count_query = count_query.where(ZoomClass.status == ZoomClassStatus(status_filter))

    if teacher_id:
        query = query.where(ZoomClass.teacher_id == teacher_id)
        count_query = count_query.where(ZoomClass.teacher_id == teacher_id)

    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(ZoomClass.scheduled_date.desc(), ZoomClass.scheduled_time.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    classes = result.scalars().all()

    items = []
    for zc in classes:
        batch_name = None
        r = await session.execute(select(Batch.name).where(Batch.id == zc.batch_id))
        batch_name = r.scalar_one_or_none()

        teacher_name = None
        r = await session.execute(select(User.name).where(User.id == zc.teacher_id))
        teacher_name = r.scalar_one_or_none()

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


async def soft_delete_class(session: AsyncSession, class_id: uuid.UUID) -> None:
    result = await session.execute(
        select(ZoomClass).where(ZoomClass.id == class_id, ZoomClass.deleted_at.is_(None))
    )
    zc = result.scalar_one_or_none()
    if not zc:
        raise ValueError("Zoom class not found")

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
        select(ZoomClass).where(ZoomClass.zoom_meeting_id == meeting_id)
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
