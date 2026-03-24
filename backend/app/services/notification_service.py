import uuid
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.notification import Notification

logger = logging.getLogger("ict_lms.notifications")


async def create_notification(
    session: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    institute_id: Optional[uuid.UUID] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
        institute_id=institute_id,
    )
    session.add(notification)
    await session.commit()
    await session.refresh(notification)

    # Push real-time notification count via WebSocket
    await _push_notification_count(session, user_id, institute_id)

    return notification


async def create_bulk_notifications(
    session: AsyncSession,
    user_ids: list[uuid.UUID],
    type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    institute_id: Optional[uuid.UUID] = None,
) -> int:
    """Create notifications for multiple users at once. Returns count created."""
    if not user_ids:
        return 0

    notifications = [
        Notification(
            user_id=uid,
            type=type,
            title=title,
            message=message,
            link=link,
            institute_id=institute_id,
        )
        for uid in user_ids
    ]
    session.add_all(notifications)
    await session.commit()

    # Push real-time notification counts via WebSocket for each affected user
    for uid in user_ids:
        await _push_notification_count(session, uid, institute_id)

    return len(notifications)


async def list_notifications(
    session: AsyncSession,
    user_id: uuid.UUID,
    page: int = 1,
    per_page: int = 20,
    institute_id: Optional[uuid.UUID] = None,
) -> tuple[list[Notification], int]:
    base_filters = [Notification.user_id == user_id]
    if institute_id is not None:
        base_filters.append(Notification.institute_id == institute_id)

    count_query = select(func.count()).select_from(Notification).where(*base_filters)
    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    query = (
        select(Notification)
        .where(*base_filters)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await session.execute(query)
    items = result.scalars().all()
    return list(items), total


async def get_unread_count(session: AsyncSession, user_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None) -> int:
    filters = [
        Notification.user_id == user_id,
        Notification.read == False,  # noqa: E712
    ]
    if institute_id is not None:
        filters.append(Notification.institute_id == institute_id)
    query = select(func.count()).select_from(Notification).where(*filters)
    result = await session.execute(query)
    return result.scalar() or 0


async def mark_as_read(
    session: AsyncSession, notification_id: uuid.UUID, user_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> Notification:
    filters = [
        Notification.id == notification_id,
        Notification.user_id == user_id,
    ]
    if institute_id is not None:
        filters.append(Notification.institute_id == institute_id)
    result = await session.execute(
        select(Notification).where(*filters)
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise ValueError("Notification not found")

    notif.read = True
    session.add(notif)
    await session.commit()
    await session.refresh(notif)

    # Push updated count via WebSocket
    await _push_notification_count(session, user_id, institute_id)

    return notif


async def mark_all_read(session: AsyncSession, user_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None) -> int:
    """Mark all unread notifications for a user as read. Returns count updated."""
    from sqlalchemy import update

    filters = [
        Notification.user_id == user_id,
        Notification.read == False,  # noqa: E712
    ]
    if institute_id is not None:
        filters.append(Notification.institute_id == institute_id)

    stmt = (
        update(Notification)
        .where(*filters)
        .values(read=True)
    )
    result = await session.execute(stmt)
    await session.commit()

    # Push updated count (0) via WebSocket
    await _push_notification_count(session, user_id, institute_id)

    return result.rowcount


async def _push_notification_count(
    session: AsyncSession,
    user_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> None:
    """Push updated unread notification count via WebSocket (best-effort)."""
    try:
        from app.websockets.pubsub import publish_ws_event

        count = await get_unread_count(session, user_id, institute_id)
        await publish_ws_event(
            f"notifications:{user_id}",
            {"type": "notification_count_changed", "count": count},
        )
    except Exception as e:
        logger.debug("Failed to push notification count: %s", e)
