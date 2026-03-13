import uuid
import io
import csv
import math
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.models.user import User
from app.models.session import UserSession
from app.models.settings import SystemSetting
from app.models.activity import ActivityLog
from app.schemas.admin import (
    SessionOut,
    UserDeviceSummary,
    ActivityLogOut,
)
from app.schemas.common import PaginatedResponse


async def list_devices(
    session: AsyncSession,
    institute_id: uuid.UUID,
    role: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> PaginatedResponse[UserDeviceSummary]:
    """List users with their active device sessions, paginated."""
    query = select(User).where(
        User.deleted_at.is_(None),
        User.institute_id == institute_id,
    )
    count_query = select(func.count()).select_from(User).where(
        User.deleted_at.is_(None),
        User.institute_id == institute_id,
    )

    if role:
        from app.models.enums import UserRole
        query = query.where(User.role == UserRole(role))
        count_query = count_query.where(User.role == UserRole(role))

    if search:
        pattern = f"%{search}%"
        search_filter = (col(User.name).ilike(pattern)) | (col(User.email).ilike(pattern))
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(User.created_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    users = result.scalars().all()

    # Batch-fetch all active sessions for these users in one query instead of N+1
    user_ids = [u.id for u in users]
    if user_ids:
        r = await session.execute(
            select(UserSession).where(
                UserSession.user_id.in_(user_ids),
                UserSession.is_active.is_(True),
            )
        )
        all_sessions = r.scalars().all()
    else:
        all_sessions = []

    sessions_by_user: dict[uuid.UUID, list] = defaultdict(list)
    for s in all_sessions:
        sessions_by_user[s.user_id].append(s)

    items = []
    for u in users:
        user_sessions = sessions_by_user.get(u.id, [])
        items.append(UserDeviceSummary(
            user_id=u.id,
            user_name=u.name,
            user_email=u.email,
            user_role=u.role.value,
            active_sessions=[
                SessionOut(
                    id=s.id,
                    device_info=s.device_info,
                    ip_address=s.ip_address,
                    logged_in_at=s.logged_in_at,
                    last_active_at=s.last_active_at,
                )
                for s in user_sessions
            ],
        ))

    return PaginatedResponse(
        data=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


async def terminate_session(
    session: AsyncSession,
    session_id: uuid.UUID,
    institute_id: uuid.UUID,
) -> bool:
    """Deactivate a single user session. Returns True if found, False otherwise."""
    result = await session.execute(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.institute_id == institute_id,
        )
    )
    user_session = result.scalar_one_or_none()
    if not user_session:
        return False

    user_session.is_active = False
    session.add(user_session)
    await session.commit()
    return True


async def terminate_all_user_sessions(
    session: AsyncSession,
    user_id: uuid.UUID,
    institute_id: uuid.UUID,
) -> None:
    """Deactivate all active sessions for a given user."""
    result = await session.execute(
        select(UserSession).where(
            UserSession.user_id == user_id,
            UserSession.is_active.is_(True),
            UserSession.institute_id == institute_id,
        )
    )
    for s in result.scalars().all():
        s.is_active = False
        session.add(s)
    await session.commit()


async def get_settings(
    session: AsyncSession,
    institute_id: uuid.UUID,
) -> dict[str, str]:
    """Return all system settings for an institute as a key-value dict."""
    result = await session.execute(
        select(SystemSetting).where(SystemSetting.institute_id == institute_id)
    )
    return {s.setting_key: s.value for s in result.scalars().all()}


async def upsert_settings(
    session: AsyncSession,
    institute_id: uuid.UUID,
    settings: dict[str, str],
) -> dict[str, str]:
    """Upsert system settings and return the full settings dict afterward."""
    for key, value in settings.items():
        result = await session.execute(
            select(SystemSetting).where(
                SystemSetting.setting_key == key,
                SystemSetting.institute_id == institute_id,
            )
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
            setting.updated_at = datetime.now(timezone.utc)
            session.add(setting)
        else:
            session.add(SystemSetting(
                setting_key=key,
                value=value,
                institute_id=institute_id,
            ))

    await session.commit()

    result = await session.execute(
        select(SystemSetting).where(SystemSetting.institute_id == institute_id)
    )
    return {s.setting_key: s.value for s in result.scalars().all()}


async def get_activity_log(
    session: AsyncSession,
    institute_id: uuid.UUID,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> PaginatedResponse[ActivityLogOut]:
    """List activity logs with optional filters, paginated."""
    query = select(ActivityLog).where(ActivityLog.institute_id == institute_id)
    count_query = select(func.count()).select_from(ActivityLog).where(
        ActivityLog.institute_id == institute_id,
    )

    if action:
        query = query.where(ActivityLog.action == action)
        count_query = count_query.where(ActivityLog.action == action)
    if entity_type:
        query = query.where(ActivityLog.entity_type == entity_type)
        count_query = count_query.where(ActivityLog.entity_type == entity_type)
    if user_id:
        query = query.where(ActivityLog.user_id == user_id)
        count_query = count_query.where(ActivityLog.user_id == user_id)
    if date_from:
        query = query.where(ActivityLog.created_at >= date_from)
        count_query = count_query.where(ActivityLog.created_at >= date_from)
    if date_to:
        query = query.where(ActivityLog.created_at <= date_to)
        count_query = count_query.where(ActivityLog.created_at <= date_to)

    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(ActivityLog.created_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    logs = result.scalars().all()

    return PaginatedResponse(
        data=[ActivityLogOut.model_validate(log) for log in logs],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


class ExportResult:
    """Holds the outcome of an export operation: either CSV content or an S3 URL."""

    def __init__(
        self,
        csv_content: Optional[str] = None,
        download_url: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        entity_type: str = "",
    ):
        self.csv_content = csv_content
        self.download_url = download_url
        self.expires_at = expires_at
        self.entity_type = entity_type

    @property
    def is_s3(self) -> bool:
        return self.download_url is not None


async def export_data(
    session: AsyncSession,
    institute_id: uuid.UUID,
    entity_type: str,
) -> ExportResult:
    """Generate a CSV export and attempt to upload to S3. Returns an ExportResult.

    Raises ValueError for unknown entity types.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    if entity_type == "users":
        writer.writerow(["ID", "Name", "Email", "Phone", "Role", "Status", "Created At"])
        result = await session.execute(
            select(User).where(
                User.deleted_at.is_(None),
                User.institute_id == institute_id,
            )
        )
        for u in result.scalars().all():
            writer.writerow([
                str(u.id), u.name, u.email, u.phone,
                u.role.value, u.status.value, str(u.created_at),
            ])
    elif entity_type == "batches":
        from app.models.batch import Batch
        writer.writerow(["ID", "Name", "Start Date", "End Date", "Created At"])
        result = await session.execute(
            select(Batch).where(
                Batch.deleted_at.is_(None),
                Batch.institute_id == institute_id,
            )
        )
        for b in result.scalars().all():
            writer.writerow([
                str(b.id), b.name, str(b.start_date),
                str(b.end_date), str(b.created_at),
            ])
    elif entity_type == "courses":
        from app.models.course import Course
        writer.writerow(["ID", "Title", "Status", "Created At"])
        result = await session.execute(
            select(Course).where(
                Course.deleted_at.is_(None),
                Course.institute_id == institute_id,
            )
        )
        for c in result.scalars().all():
            writer.writerow([
                str(c.id), c.title, c.status.value, str(c.created_at),
            ])
    else:
        raise ValueError(f"Unknown entity type: {entity_type}")

    csv_content = output.getvalue()

    # Attempt S3 upload; fall back to inline CSV if S3 is unavailable
    try:
        from app.utils.s3 import _get_client
        from app.config import get_settings as gs
        s = gs()
        client = _get_client()
        key = f"exports/export_{entity_type}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
        client.put_object(
            Bucket=s.S3_BUCKET_NAME,
            Key=key,
            Body=csv_content.encode(),
            ContentType="text/csv",
        )
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": s.S3_BUCKET_NAME, "Key": key},
            ExpiresIn=3600,
        )
        return ExportResult(
            download_url=url,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            entity_type=entity_type,
        )
    except Exception:
        return ExportResult(
            csv_content=csv_content,
            entity_type=entity_type,
        )
