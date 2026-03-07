import uuid
import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate, AnnouncementOut
from app.schemas.common import PaginatedResponse
from app.services import announcement_service
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter()

AllRoles = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=PaginatedResponse[AnnouncementOut])
async def list_announcements(
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
    scope: Optional[str] = None,
    batch_id: Optional[uuid.UUID] = None,
    course_id: Optional[uuid.UUID] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    items, total = await announcement_service.list_announcements(
        session, current_user, scope=scope, batch_id=batch_id,
        course_id=course_id, page=page, per_page=per_page,
    )
    return PaginatedResponse(
        data=[AnnouncementOut(**item) for item in items],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    body: AnnouncementCreate,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        ann = await announcement_service.create_announcement(
            session, title=body.title, content=body.content,
            scope=body.scope, posted_by=current_user.id,
            batch_id=body.batch_id, course_id=body.course_id,
            expires_at=body.expires_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    from sqlmodel import select
    from app.models.user import User as UserModel
    r = await session.execute(select(UserModel.name).where(UserModel.id == current_user.id))
    poster_name = r.scalar_one_or_none()

    return AnnouncementOut(
        id=ann.id, title=ann.title, content=ann.content,
        scope=ann.scope.value, batch_id=ann.batch_id, course_id=ann.course_id,
        posted_by=ann.posted_by, posted_by_name=poster_name,
        expires_at=ann.expires_at, created_at=ann.created_at,
    )


@router.patch("/{announcement_id}", response_model=AnnouncementOut)
async def update_announcement(
    announcement_id: uuid.UUID,
    body: AnnouncementUpdate,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        ann = await announcement_service.update_announcement(
            session, announcement_id, **body.model_dump(exclude_unset=True)
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    from sqlmodel import select
    from app.models.user import User as UserModel
    poster_name = None
    if ann.posted_by:
        r = await session.execute(select(UserModel.name).where(UserModel.id == ann.posted_by))
        poster_name = r.scalar_one_or_none()

    return AnnouncementOut(
        id=ann.id, title=ann.title, content=ann.content,
        scope=ann.scope.value, batch_id=ann.batch_id, course_id=ann.course_id,
        posted_by=ann.posted_by, posted_by_name=poster_name,
        expires_at=ann.expires_at, created_at=ann.created_at,
    )


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    announcement_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await announcement_service.soft_delete_announcement(session, announcement_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
