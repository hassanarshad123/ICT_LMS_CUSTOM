import uuid
import math
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.notification import NotificationOut, UnreadCountOut
from app.schemas.common import PaginatedResponse
from app.services import notification_service
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter()

AllRoles = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=PaginatedResponse[NotificationOut])
async def list_notifications(
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    items, total = await notification_service.list_notifications(
        session, current_user.id, page=page, per_page=per_page,
    )
    return PaginatedResponse(
        data=[NotificationOut.model_validate(n) for n in items],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/unread-count", response_model=UnreadCountOut)
async def get_unread_count(
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    count = await notification_service.get_unread_count(session, current_user.id)
    return UnreadCountOut(count=count)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        notif = await notification_service.mark_as_read(
            session, notification_id, current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return NotificationOut.model_validate(notif)


@router.post("/mark-all-read", status_code=status.HTTP_200_OK)
async def mark_all_notifications_read(
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    count = await notification_service.mark_all_read(session, current_user.id)
    return {"marked": count}
