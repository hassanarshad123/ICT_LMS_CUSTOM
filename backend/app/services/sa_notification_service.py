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

    # Find admin users in target institutes (single query instead of N+1)
    r = await session.execute(
        select(User.id).where(
            User.institute_id.in_(inst_ids),
            User.role == UserRole.admin,
            User.deleted_at.is_(None),
        )
    )
    admin_user_ids = [row[0] for row in r.all()]

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

    rows = list(r.all())
    if not rows:
        return [], total

    # Resolve delivery_count as "number of admin-role recipients at the
    # time of display". Announcements fan out to admin users of the
    # target institutes (or all institutes when targets is empty).
    # We COUNT those admins here so SA sees a real number instead of
    # a stubbed zero.
    broadcast_ids: list[uuid.UUID] = []
    targeted_id_sets: list[list[uuid.UUID]] = []
    for row in rows:
        target_ids = [uuid.UUID(str(i)) for i in (row[3] or [])]
        if not target_ids:
            broadcast_ids.append(row[0])
        else:
            targeted_id_sets.append(target_ids)

    # Single query for broadcast: count admins across all active institutes.
    broadcast_count = 0
    if broadcast_ids:
        br = await session.execute(text("""
            SELECT COUNT(*)
            FROM users u
            JOIN institutes i ON i.id = u.institute_id
            WHERE u.role = 'admin'
              AND u.deleted_at IS NULL
              AND i.deleted_at IS NULL
        """))
        broadcast_count = br.scalar() or 0

    # Per-announcement counts for targeted announcements: one aggregate
    # per unique set. Most SA announcements target one or a few
    # institutes so this scales fine.
    targeted_counts: dict[tuple, int] = {}
    for ids in targeted_id_sets:
        key = tuple(sorted(str(i) for i in ids))
        if key in targeted_counts:
            continue
        tr = await session.execute(
            text(
                "SELECT COUNT(*) FROM users "
                "WHERE role = 'admin' AND deleted_at IS NULL "
                "AND institute_id = ANY(:ids)"
            ),
            {"ids": list(ids)},
        )
        targeted_counts[key] = tr.scalar() or 0

    items = []
    for row in rows:
        target_ids = [str(i) for i in (row[3] or [])]
        if not target_ids:
            dc = broadcast_count
        else:
            key = tuple(sorted(target_ids))
            dc = targeted_counts.get(key, 0)
        items.append({
            "id": str(row[0]),
            "title": row[1],
            "message": row[2],
            "target_institute_ids": target_ids,
            "sent_by": str(row[4]),
            "sent_by_name": row[5],
            "created_at": row[6].isoformat() if row[6] else None,
            "delivery_count": dc,
        })

    return items, total
