"""Institute lifecycle operations with full side-effect cleanup.

This module is the SINGLE place that handles institute state transitions
(suspend, activate). It ensures all side effects are handled atomically:
sessions, cache, tokens, and audit trail.

Routers should call these functions instead of directly mutating institute status.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.institute import Institute, InstituteStatus
from app.models.user import User
from app.models.session import UserSession
from app.models.activity import ActivityLog
from app.models.enums import UserRole
from app.core.cache import cache

logger = logging.getLogger("ict_lms.lifecycle")


async def suspend_institute(
    session: AsyncSession,
    institute_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: Optional[str] = None,
) -> Institute:
    """Suspend an institute with full cleanup.

    1. Set status to suspended
    2. Terminate all active sessions
    3. Bump token_version on all users (force JWT invalidation)
    4. Invalidate Redis cache for all users
    5. Log activity
    6. Single commit
    """
    institute = await session.get(Institute, institute_id)
    if not institute or institute.deleted_at:
        raise ValueError("Institute not found")

    institute.status = InstituteStatus.suspended
    institute.updated_at = datetime.now(timezone.utc)
    session.add(institute)

    # Terminate all active sessions for this institute
    result = await session.execute(
        select(UserSession).where(
            UserSession.institute_id == institute_id,
            UserSession.is_active == True,
        )
    )
    sessions_terminated = 0
    for s in result.scalars().all():
        s.is_active = False
        session.add(s)
        sessions_terminated += 1

    # Bump token_version on all users → invalidates all JWTs
    user_result = await session.execute(
        select(User).where(
            User.institute_id == institute_id,
            User.deleted_at.is_(None),
            User.role != UserRole.super_admin,
        )
    )
    user_ids = []
    for user in user_result.scalars().all():
        user.token_version += 1
        session.add(user)
        user_ids.append(str(user.id))

    # Activity log
    log = ActivityLog(
        user_id=actor_id,
        action="institute_suspended",
        entity_type="institute",
        entity_id=institute_id,
        details={
            "institute_name": institute.name,
            "sessions_terminated": sessions_terminated,
            "users_invalidated": len(user_ids),
        },
        ip_address=ip_address,
        institute_id=institute_id,
    )
    session.add(log)

    await session.commit()

    # Invalidate Redis cache for all affected users (best-effort, after commit)
    for uid in user_ids:
        await cache.delete(cache.user_key(uid))
    await cache.invalidate_dashboard(str(institute_id))

    logger.info(
        "Institute %s suspended: %d sessions terminated, %d users invalidated",
        institute_id, sessions_terminated, len(user_ids),
    )
    await session.refresh(institute)
    return institute


async def activate_institute(
    session: AsyncSession,
    institute_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: Optional[str] = None,
) -> Institute:
    """Activate an institute.

    1. Set status to active
    2. Log activity
    3. Invalidate dashboard cache
    4. Single commit
    """
    institute = await session.get(Institute, institute_id)
    if not institute or institute.deleted_at:
        raise ValueError("Institute not found")

    institute.status = InstituteStatus.active
    institute.updated_at = datetime.now(timezone.utc)
    session.add(institute)

    # Activity log
    log = ActivityLog(
        user_id=actor_id,
        action="institute_activated",
        entity_type="institute",
        entity_id=institute_id,
        details={"institute_name": institute.name},
        ip_address=ip_address,
        institute_id=institute_id,
    )
    session.add(log)

    await session.commit()

    # Invalidate dashboard cache (best-effort)
    await cache.invalidate_dashboard(str(institute_id))

    logger.info("Institute %s activated", institute_id)
    await session.refresh(institute)
    return institute


async def archive_institute(
    session: AsyncSession,
    institute_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: Optional[str] = None,
) -> Institute:
    """Archive an institute — hidden from default lists, data preserved.

    Side effects mirror suspend: sessions terminated, tokens invalidated,
    cache cleared. Status set to 'archived' (distinct from 'suspended').
    """
    institute = await session.get(Institute, institute_id)
    if not institute or institute.deleted_at:
        raise ValueError("Institute not found")

    previous_status = institute.status.value if hasattr(institute.status, 'value') else str(institute.status)
    institute.status = InstituteStatus.archived
    institute.updated_at = datetime.now(timezone.utc)
    session.add(institute)

    result = await session.execute(
        select(UserSession).where(
            UserSession.institute_id == institute_id,
            UserSession.is_active == True,
        )
    )
    sessions_terminated = 0
    for s in result.scalars().all():
        s.is_active = False
        session.add(s)
        sessions_terminated += 1

    user_result = await session.execute(
        select(User).where(
            User.institute_id == institute_id,
            User.deleted_at.is_(None),
            User.role != UserRole.super_admin,
        )
    )
    user_ids = []
    for user in user_result.scalars().all():
        user.token_version += 1
        session.add(user)
        user_ids.append(str(user.id))

    log = ActivityLog(
        user_id=actor_id,
        action="institute_archived",
        entity_type="institute",
        entity_id=institute_id,
        details={
            "institute_name": institute.name,
            "previous_status": previous_status,
            "sessions_terminated": sessions_terminated,
        },
        ip_address=ip_address,
        institute_id=institute_id,
    )
    session.add(log)

    await session.commit()

    for uid in user_ids:
        await cache.delete(cache.user_key(uid))
    await cache.invalidate_dashboard(str(institute_id))

    logger.info("Institute %s archived", institute_id)
    await session.refresh(institute)
    return institute
