import logging
import uuid
import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate, AnnouncementOut
from app.schemas.common import PaginatedResponse
from app.services import announcement_service, notification_service
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

AllRoles = Annotated[User, Depends(get_current_user)]


async def _send_announcement_notifications(
    session: AsyncSession, ann, poster_id: uuid.UUID,
) -> None:
    """Create notifications for all users who should see this announcement."""
    from sqlmodel import select
    from app.models.user import User as UserModel
    from app.models.batch import Batch, StudentBatch
    from app.models.course import BatchCourse
    from app.models.enums import AnnouncementScope, UserStatus

    notif_message = ann.content[:100] if ann.content else ""
    user_ids: list[uuid.UUID] = []

    try:
        if ann.scope == AnnouncementScope.institute:
            # All active users except the poster
            result = await session.execute(
                select(UserModel.id).where(
                    UserModel.deleted_at.is_(None),
                    UserModel.status == UserStatus.active,
                    UserModel.id != poster_id,
                )
            )
            user_ids = [row[0] for row in result.all()]

        elif ann.scope == AnnouncementScope.batch and ann.batch_id:
            # All students in the batch + the batch teacher (excluding poster)
            result = await session.execute(
                select(StudentBatch.student_id).where(
                    StudentBatch.batch_id == ann.batch_id,
                    StudentBatch.removed_at.is_(None),
                )
            )
            user_ids = [row[0] for row in result.all()]

            # Add the batch teacher
            result = await session.execute(
                select(Batch.teacher_id).where(Batch.id == ann.batch_id)
            )
            teacher_id = result.scalar_one_or_none()
            if teacher_id and teacher_id not in user_ids:
                user_ids.append(teacher_id)

            # Remove the poster from the list
            user_ids = [uid for uid in user_ids if uid != poster_id]

        elif ann.scope == AnnouncementScope.course and ann.course_id:
            # All students enrolled in batches that have this course
            batch_ids_q = select(BatchCourse.batch_id).where(
                BatchCourse.course_id == ann.course_id,
                BatchCourse.deleted_at.is_(None),
            )
            result = await session.execute(
                select(StudentBatch.student_id).where(
                    StudentBatch.batch_id.in_(batch_ids_q),
                    StudentBatch.removed_at.is_(None),
                )
            )
            user_ids = list(set(row[0] for row in result.all()))

            # Remove the poster from the list
            user_ids = [uid for uid in user_ids if uid != poster_id]

        if user_ids:
            await notification_service.create_bulk_notifications(
                session,
                user_ids=user_ids,
                type="announcement",
                title=ann.title,
                message=notif_message,
                link="/announcements",
            )
    except Exception:
        logger.exception("Failed to create announcement notifications for announcement %s", ann.id)


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

    response = AnnouncementOut(
        id=ann.id, title=ann.title, content=ann.content,
        scope=ann.scope.value, batch_id=ann.batch_id, course_id=ann.course_id,
        posted_by=ann.posted_by, posted_by_name=poster_name,
        expires_at=ann.expires_at, created_at=ann.created_at,
    )

    # Send notifications to affected users (non-blocking — errors are logged, not raised)
    await _send_announcement_notifications(session, ann, current_user.id)

    return response


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
