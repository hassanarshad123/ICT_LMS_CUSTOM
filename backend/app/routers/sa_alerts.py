import uuid as _uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.sa_alerts import (
    SAAlertOut,
    SAAlertCountResponse,
    SAAlertPreferenceOut,
    SAAlertPreferenceUpdate,
)
from app.services import sa_alert_service

router = APIRouter()

SA = Annotated[User, Depends(require_roles("super_admin"))]


@router.get("/alerts", response_model=PaginatedResponse[SAAlertOut])
async def list_alerts(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    alert_type: Optional[str] = None,
    unread_only: bool = False,
):
    alerts, total = await sa_alert_service.list_alerts(
        session, sa.id, page, per_page, alert_type, unread_only
    )
    total_pages = (total + per_page - 1) // per_page
    return PaginatedResponse(
        data=[SAAlertOut.model_validate(a) for a in alerts],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/alerts/count", response_model=SAAlertCountResponse)
async def get_alert_count(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    count = await sa_alert_service.get_unread_count(session, sa.id)
    return SAAlertCountResponse(count=count)


@router.post("/alerts/{alert_id}/read", response_model=SAAlertOut)
async def mark_alert_read(
    alert_id: str,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    alert = await sa_alert_service.mark_as_read(session, _uuid.UUID(alert_id))
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    await session.commit()
    return SAAlertOut.model_validate(alert)


@router.post("/alerts/read-all")
async def mark_all_alerts_read(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    count = await sa_alert_service.mark_all_read(session)
    await session.commit()
    return {"count": count}


@router.get("/alerts/preferences", response_model=list[SAAlertPreferenceOut])
async def get_alert_preferences(
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await sa_alert_service.get_preferences(session, sa.id)


@router.put("/alerts/preferences/{alert_type}")
async def update_alert_preference(
    alert_type: str,
    body: SAAlertPreferenceUpdate,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    await sa_alert_service.update_preference(session, sa.id, alert_type, body.muted)
    await session.commit()
    return {"ok": True}
