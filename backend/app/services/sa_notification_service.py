import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlmodel import select, func

from app.models.billing import SANotification
from app.models.user import User
from app.models.institute import Institute
from app.models.enums import UserRole


async def send_sa_announcement(
    session: AsyncSession,
    title: str,
    message: str,
    target_institute_ids: list[uuid.UUID],
    sent_by: uuid.UUID,
) -> SANotification:
    """Create SA announcement and deliver as notifications to admin users."""
    notif = SANotification(
        title=title,
        message=message,
        target_institute_ids=target_institute_ids,
        sent_by=sent_by,
    )
    session.add(notif)
    await session.flush()

    # Get target institute IDs (all if empty)
    if target_institute_ids:
        inst_ids = target_institute_ids
    else:
        r = await session.execute(
            select(Institute.id).where(Institute.deleted_at.is_(None))
        )
        inst_ids = [row[0] for row in r.all()]

    # Find admin users in target institutes
    admin_user_ids = []
    for inst_id in inst_ids:
        r = await session.execute(
            select(User.id).where(
                User.institute_id == inst_id,
                User.role == UserRole.admin,
                User.deleted_at.is_(None),
            )
        )
        admin_user_ids.extend([row[0] for row in r.all()])

    # Create notifications using the existing Notification model
    if admin_user_ids:
        from app.models.notification import Notification

        for uid in admin_user_ids:
            n = Notification(
                user_id=uid,
                type="sa_announcement",
                title=title,
                message=message,
                institute_id=None,  # SA announcements are cross-institute
            )
            session.add(n)

    await session.commit()
    await session.refresh(notif)
    return notif


async def list_sa_announcements(
    session: AsyncSession,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    r = await session.execute(text("SELECT COUNT(*) FROM sa_notifications"))
    total = r.scalar() or 0

    offset = (page - 1) * per_page
    r = await session.execute(text("""
        SELECT n.id, n.title, n.message, n.target_institute_ids,
               n.sent_by, u.name AS sent_by_name, n.created_at
        FROM sa_notifications n
        LEFT JOIN users u ON u.id = n.sent_by
        ORDER BY n.created_at DESC
        LIMIT :lim OFFSET :off
    """), {"lim": per_page, "off": offset})

    items = []
    for row in r.all():
        items.append({
            "id": str(row[0]),
            "title": row[1],
            "message": row[2],
            "target_institute_ids": [str(i) for i in (row[3] or [])],
            "sent_by": str(row[4]),
            "sent_by_name": row[5],
            "created_at": row[6].isoformat() if row[6] else None,
            "delivery_count": 0,
        })

    return items, total
