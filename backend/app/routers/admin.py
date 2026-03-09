import uuid
import io
import csv
import math
from datetime import datetime, timezone, timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.database import get_session
from app.schemas.admin import (
    DashboardResponse, InsightsResponse, SessionOut,
    UserDeviceSummary, SettingsResponse, SettingsUpdate,
    ActivityLogOut, ExportResponse,
)
from app.schemas.common import PaginatedResponse
from app.services import analytics_service
from app.middleware.auth import require_roles
from app.models.user import User
from app.models.other import UserSession, SystemSetting, ActivityLog

router = APIRouter()

Admin = Annotated[User, Depends(require_roles("admin"))]


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await analytics_service.get_dashboard(session)


@router.get("/insights", response_model=InsightsResponse)
async def insights(
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await analytics_service.get_insights(session)


@router.get("/devices", response_model=PaginatedResponse[UserDeviceSummary])
async def list_devices(
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
    role: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    query = select(User).where(User.deleted_at.is_(None))
    count_query = select(func.count()).select_from(User).where(User.deleted_at.is_(None))

    if role:
        from app.models.enums import UserRole
        query = query.where(User.role == UserRole(role))
        count_query = count_query.where(User.role == UserRole(role))

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (col(User.name).ilike(pattern)) | (col(User.email).ilike(pattern))
        )
        count_query = count_query.where(
            (col(User.name).ilike(pattern)) | (col(User.email).ilike(pattern))
        )

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
                UserSession.user_id.in_(user_ids), UserSession.is_active.is_(True)
            )
        )
        all_sessions = r.scalars().all()
    else:
        all_sessions = []

    from collections import defaultdict
    sessions_by_user = defaultdict(list)
    for s in all_sessions:
        sessions_by_user[s.user_id].append(s)

    items = []
    for u in users:
        user_sessions = sessions_by_user.get(u.id, [])
        items.append(UserDeviceSummary(
            user_id=u.id, user_name=u.name, user_email=u.email,
            user_role=u.role.value,
            active_sessions=[
                SessionOut(
                    id=s.id, device_info=s.device_info, ip_address=s.ip_address,
                    logged_in_at=s.logged_in_at, last_active_at=s.last_active_at,
                )
                for s in user_sessions
            ],
        ))

    return PaginatedResponse(
        data=items, total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.delete("/devices/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def terminate_session(
    session_id: uuid.UUID,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(UserSession).where(UserSession.id == session_id)
    )
    user_session = result.scalar_one_or_none()
    if not user_session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_session.is_active = False
    session.add(user_session)
    await session.commit()


@router.delete("/devices/user/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def terminate_all_user_sessions(
    user_id: uuid.UUID,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(
        select(UserSession).where(
            UserSession.user_id == user_id, UserSession.is_active.is_(True)
        )
    )
    for s in result.scalars().all():
        s.is_active = False
        session.add(s)
    await session.commit()


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    result = await session.execute(select(SystemSetting))
    settings_dict = {s.setting_key: s.value for s in result.scalars().all()}
    return SettingsResponse(settings=settings_dict)


@router.patch("/settings", response_model=SettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    for key, value in body.settings.items():
        result = await session.execute(
            select(SystemSetting).where(SystemSetting.setting_key == key)
        )
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
            setting.updated_at = datetime.now(timezone.utc)
            session.add(setting)
        else:
            session.add(SystemSetting(setting_key=key, value=value))

    await session.commit()

    result = await session.execute(select(SystemSetting))
    settings_dict = {s.setting_key: s.value for s in result.scalars().all()}
    return SettingsResponse(settings=settings_dict)


@router.get("/activity-log", response_model=PaginatedResponse[ActivityLogOut])
async def get_activity_log(
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    query = select(ActivityLog)
    count_query = select(func.count()).select_from(ActivityLog)

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
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/export/{entity_type}")
async def export_data(
    entity_type: str,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
    format: str = Query("csv", pattern="^(csv|pdf)$"),
):
    if format != "csv":
        raise HTTPException(status_code=400, detail="Only CSV export is currently supported")

    output = io.StringIO()
    writer = csv.writer(output)

    if entity_type == "users":
        writer.writerow(["ID", "Name", "Email", "Phone", "Role", "Status", "Created At"])
        result = await session.execute(select(User).where(User.deleted_at.is_(None)))
        for u in result.scalars().all():
            writer.writerow([str(u.id), u.name, u.email, u.phone, u.role.value, u.status.value, str(u.created_at)])
    elif entity_type == "batches":
        from app.models.batch import Batch
        writer.writerow(["ID", "Name", "Start Date", "End Date", "Created At"])
        result = await session.execute(select(Batch).where(Batch.deleted_at.is_(None)))
        for b in result.scalars().all():
            writer.writerow([str(b.id), b.name, str(b.start_date), str(b.end_date), str(b.created_at)])
    elif entity_type == "courses":
        from app.models.course import Course
        writer.writerow(["ID", "Title", "Status", "Created At"])
        result = await session.execute(select(Course).where(Course.deleted_at.is_(None)))
        for c in result.scalars().all():
            writer.writerow([str(c.id), c.title, c.status.value, str(c.created_at)])
    else:
        raise HTTPException(status_code=400, detail=f"Unknown entity type: {entity_type}")

    # Upload to S3
    csv_content = output.getvalue()
    try:
        from app.utils.s3 import _get_client
        from app.config import get_settings as gs
        s = gs()
        client = _get_client()
        key = f"exports/export_{entity_type}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
        client.put_object(
            Bucket=s.S3_BUCKET_NAME, Key=key, Body=csv_content.encode(),
            ContentType="text/csv",
        )
        url = client.generate_presigned_url(
            "get_object", Params={"Bucket": s.S3_BUCKET_NAME, "Key": key}, ExpiresIn=3600,
        )
        return ExportResponse(
            download_url=url,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    except Exception:
        # If S3 is not configured, return inline
        from fastapi.responses import StreamingResponse
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=export_{entity_type}.csv"},
        )
