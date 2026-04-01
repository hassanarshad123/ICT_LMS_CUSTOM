import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlmodel import select, func, col

from app.models.activity import ActivityLog
from app.models.user import User
from app.models.institute import Institute, InstituteStatus
from app.models.session import UserSession
from app.models.enums import UserRole
from app.utils.security import hash_password


async def get_activity_log(
    session: AsyncSession,
    institute_id: Optional[uuid.UUID] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """Cross-institute activity log with optional filters."""
    params: dict = {}
    where_clauses = []

    if institute_id:
        where_clauses.append("a.institute_id = :inst_id")
        params["inst_id"] = str(institute_id)
    if action:
        where_clauses.append("a.action = :action")
        params["action"] = action
    if entity_type:
        where_clauses.append("a.entity_type = :entity_type")
        params["entity_type"] = entity_type
    if user_id:
        where_clauses.append("a.user_id = :user_id")
        params["user_id"] = str(user_id)
    if date_from:
        where_clauses.append("a.created_at >= :date_from")
        params["date_from"] = date_from
    if date_to:
        where_clauses.append("a.created_at <= :date_to")
        params["date_to"] = date_to

    where_sql = (" AND " + " AND ".join(where_clauses)) if where_clauses else ""

    # Count
    r = await session.execute(
        text(f"SELECT COUNT(*) FROM activity_log a WHERE 1=1{where_sql}"), params
    )
    total = r.scalar() or 0

    # Data with user + institute joins
    offset = (page - 1) * per_page
    params["lim"] = per_page
    params["off"] = offset

    r = await session.execute(text(f"""
        SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id,
               a.details, a.ip_address, a.institute_id, a.impersonated_by,
               a.created_at, u.name AS user_name, u.email AS user_email,
               i.name AS institute_name
        FROM activity_log a
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN institutes i ON i.id = a.institute_id
        WHERE 1=1{where_sql}
        ORDER BY a.created_at DESC
        LIMIT :lim OFFSET :off
    """), params)

    items = []
    for row in r.all():
        items.append({
            "id": str(row[0]),
            "user_id": str(row[1]) if row[1] else None,
            "action": row[2],
            "entity_type": row[3],
            "entity_id": str(row[4]) if row[4] else None,
            "details": row[5],
            "ip_address": row[6],
            "institute_id": str(row[7]) if row[7] else None,
            "impersonated_by": str(row[8]) if row[8] else None,
            "created_at": row[9].isoformat() if row[9] else None,
            "user_name": row[10],
            "user_email": row[11],
            "institute_name": row[12],
        })

    return items, total


async def global_user_search(
    session: AsyncSession,
    query_str: str,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """Search users across all institutes by email or name."""
    pattern = f"%{query_str}%"

    r = await session.execute(text("""
        SELECT COUNT(*)
        FROM users u
        WHERE u.deleted_at IS NULL
          AND u.role != 'super_admin'
          AND (u.email ILIKE :pat OR u.name ILIKE :pat)
    """), {"pat": pattern})
    total = r.scalar() or 0

    offset = (page - 1) * per_page
    r = await session.execute(text("""
        SELECT u.id, u.email, u.name, u.role, u.status,
               u.institute_id, i.name AS inst_name, i.slug AS inst_slug,
               u.created_at
        FROM users u
        LEFT JOIN institutes i ON i.id = u.institute_id
        WHERE u.deleted_at IS NULL
          AND u.role != 'super_admin'
          AND (u.email ILIKE :pat OR u.name ILIKE :pat)
        ORDER BY u.created_at DESC
        LIMIT :lim OFFSET :off
    """), {"pat": pattern, "lim": per_page, "off": offset})

    items = []
    for row in r.all():
        items.append({
            "id": str(row[0]),
            "email": row[1],
            "name": row[2],
            "role": row[3],
            "status": row[4],
            "institute_id": str(row[5]) if row[5] else None,
            "institute_name": row[6],
            "institute_slug": row[7],
            "created_at": row[8].isoformat() if row[8] else None,
        })

    return items, total


async def bulk_update_institute_status(
    session: AsyncSession,
    institute_ids: list[uuid.UUID],
    action: str,
    sa_id: uuid.UUID,
) -> int:
    """Bulk suspend or activate institutes using lifecycle module.

    Uses per-item error handling so one failed institute doesn't block others.
    Each operation is a separate transaction via the lifecycle module.
    """
    from app.services.institute_lifecycle import suspend_institute, activate_institute

    lifecycle_fn = suspend_institute if action == "suspend" else activate_institute
    count = 0

    for inst_id in institute_ids:
        try:
            await lifecycle_fn(session, inst_id, sa_id)
            count += 1
        except ValueError:
            # Institute not found or already deleted — skip
            continue
        except Exception as e:
            logging.getLogger("ict_lms.operations").error(
                "Bulk %s failed for institute %s: %s", action, inst_id, e,
            )
            await session.rollback()

    return count


async def list_admins(
    session: AsyncSession,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """List all admin-role users across institutes."""
    r = await session.execute(text("""
        SELECT COUNT(*)
        FROM users u
        WHERE u.deleted_at IS NULL AND u.role = 'admin'
    """))
    total = r.scalar() or 0

    offset = (page - 1) * per_page
    r = await session.execute(text("""
        SELECT u.id, u.email, u.name, u.status,
               u.institute_id, i.name AS inst_name, u.created_at
        FROM users u
        LEFT JOIN institutes i ON i.id = u.institute_id
        WHERE u.deleted_at IS NULL AND u.role = 'admin'
        ORDER BY u.created_at DESC
        LIMIT :lim OFFSET :off
    """), {"lim": per_page, "off": offset})

    items = []
    for row in r.all():
        items.append({
            "id": str(row[0]),
            "email": row[1],
            "name": row[2],
            "status": row[3],
            "institute_id": str(row[4]) if row[4] else None,
            "institute_name": row[5],
            "created_at": row[6].isoformat() if row[6] else None,
        })

    return items, total


async def reset_user_password(
    session: AsyncSession,
    user_id: uuid.UUID,
    new_password: str,
    sa_id: uuid.UUID,
) -> None:
    """Reset a non-SA user's password and revoke existing tokens."""
    user = await session.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise ValueError("User not found")
    if user.role == UserRole.super_admin:
        raise ValueError("Cannot reset super admin password")

    user.hashed_password = hash_password(new_password)
    user.token_version += 1
    session.add(user)

    log = ActivityLog(
        user_id=sa_id,
        action="sa_password_reset",
        entity_type="user",
        entity_id=user_id,
        details={"target_email": user.email},
    )
    session.add(log)
    await session.commit()


async def deactivate_user(
    session: AsyncSession,
    user_id: uuid.UUID,
    sa_id: uuid.UUID,
) -> None:
    """Deactivate a user and terminate all sessions."""
    user = await session.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise ValueError("User not found")
    if user.role == UserRole.super_admin:
        raise ValueError("Cannot deactivate super admin")

    user.status = "inactive"
    user.token_version += 1
    session.add(user)

    # Terminate sessions
    r = await session.execute(
        select(UserSession).where(
            UserSession.user_id == user_id,
            UserSession.is_active == True,
        )
    )
    for s in r.scalars().all():
        s.is_active = False
        session.add(s)

    log = ActivityLog(
        user_id=sa_id,
        action="sa_user_deactivated",
        entity_type="user",
        entity_id=user_id,
        details={"target_email": user.email},
    )
    session.add(log)
    await session.commit()

    # Invalidate Redis cache so stale "active" status isn't served
    from app.core.cache import cache
    await cache.delete(cache.user_key(str(user_id)))


async def activate_user(
    session: AsyncSession,
    user_id: uuid.UUID,
    sa_id: uuid.UUID,
) -> None:
    """Reactivate a deactivated user."""
    user = await session.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise ValueError("User not found")
    if user.role == UserRole.super_admin:
        raise ValueError("Cannot modify super admin status")
    if user.status == "active":
        raise ValueError("User is already active")

    user.status = "active"
    session.add(user)

    log = ActivityLog(
        user_id=sa_id,
        action="sa_user_activated",
        entity_type="user",
        entity_id=user_id,
        details={"target_email": user.email},
    )
    session.add(log)
    await session.commit()

    # Invalidate Redis cache
    from app.core.cache import cache
    await cache.delete(cache.user_key(str(user_id)))


async def list_active_sessions(
    session: AsyncSession,
    institute_id: Optional[uuid.UUID] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """List active user sessions, optionally filtered by institute."""
    params: dict = {}
    inst_clause = ""
    if institute_id:
        inst_clause = " AND s.institute_id = :inst_id"
        params["inst_id"] = str(institute_id)

    r = await session.execute(
        text(f"SELECT COUNT(*) FROM user_sessions s WHERE s.is_active = true{inst_clause}"),
        params,
    )
    total = r.scalar() or 0

    offset = (page - 1) * per_page
    params["lim"] = per_page
    params["off"] = offset

    r = await session.execute(text(f"""
        SELECT s.id, s.user_id, u.name, u.email, s.device_info,
               s.ip_address, s.logged_in_at, s.last_active_at, i.name AS inst_name
        FROM user_sessions s
        LEFT JOIN users u ON u.id = s.user_id
        LEFT JOIN institutes i ON i.id = s.institute_id
        WHERE s.is_active = true{inst_clause}
        ORDER BY s.last_active_at DESC
        LIMIT :lim OFFSET :off
    """), params)

    items = []
    for row in r.all():
        items.append({
            "id": str(row[0]),
            "user_id": str(row[1]),
            "user_name": row[2],
            "user_email": row[3],
            "device_info": row[4],
            "ip_address": row[5],
            "logged_in_at": row[6].isoformat() if row[6] else None,
            "last_active_at": row[7].isoformat() if row[7] else None,
            "institute_name": row[8],
        })

    return items, total


async def terminate_session(
    session: AsyncSession, session_id: uuid.UUID
) -> bool:
    """Terminate a single session (no institute filter for SA)."""
    s = await session.get(UserSession, session_id)
    if not s:
        return False
    s.is_active = False
    session.add(s)
    await session.commit()
    return True


async def terminate_institute_sessions(
    session: AsyncSession, institute_id: uuid.UUID
) -> int:
    """Terminate all active sessions for an institute."""
    r = await session.execute(
        select(UserSession).where(
            UserSession.institute_id == institute_id,
            UserSession.is_active == True,
        )
    )
    count = 0
    for s in r.scalars().all():
        s.is_active = False
        session.add(s)
        count += 1
    await session.commit()
    return count


async def export_institutes_csv(session: AsyncSession) -> str:
    """Generate CSV content for all institutes."""
    r = await session.execute(text("""
        SELECT i.id, i.name, i.slug, i.status, i.plan_tier,
               i.max_users, COALESCE(u.current_users, 0),
               i.max_storage_gb, ROUND(COALESCE(u.current_storage_bytes, 0) / (1024.0^3), 2),
               i.max_video_gb, ROUND(COALESCE(u.current_video_bytes, 0) / (1024.0^3), 2),
               i.contact_email, i.created_at, i.expires_at
        FROM institutes i
        LEFT JOIN institute_usage u ON u.institute_id = i.id
        WHERE i.deleted_at IS NULL
        ORDER BY i.created_at DESC
    """))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Name", "Slug", "Status", "Plan", "Max Users", "Current Users",
        "Max Storage GB", "Current Storage GB", "Max Video GB", "Current Video GB",
        "Contact Email", "Created At", "Expires At",
    ])
    for row in r.all():
        writer.writerow([
            str(row[0]), row[1], row[2], row[3], row[4],
            row[5], row[6], row[7], row[8], row[9], row[10],
            row[11], row[12].isoformat() if row[12] else "", row[13].isoformat() if row[13] else "",
        ])

    return output.getvalue()


async def export_users_csv(session: AsyncSession) -> str:
    """Generate CSV content for all users across institutes."""
    r = await session.execute(text("""
        SELECT u.id, u.name, u.email, u.role, u.status,
               i.name AS inst_name, i.slug AS inst_slug, u.created_at
        FROM users u
        LEFT JOIN institutes i ON i.id = u.institute_id
        WHERE u.deleted_at IS NULL AND u.role != 'super_admin'
        ORDER BY u.created_at DESC
    """))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Name", "Email", "Role", "Status", "Institute", "Slug", "Created At"])
    for row in r.all():
        writer.writerow([
            str(row[0]), row[1], row[2], row[3], row[4],
            row[5] or "", row[6] or "", row[7].isoformat() if row[7] else "",
        ])

    return output.getvalue()
