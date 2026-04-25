"""RBAC dependency factories for FastAPI.

- require_permissions(*perms): checks user has ALL listed permissions
- get_user_permissions(user, session): resolves full permission set
"""

from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.cache import cache
from app.database import get_session
from app.middleware.auth import get_current_user
from app.models.enums import UserRole
from app.models.user import User
from app.rbac.constants import SYSTEM_ROLE_PERMISSIONS
from app.rbac.models import CustomRolePermission, Permission

logger = logging.getLogger("ict_lms.rbac")

_PERMS_CACHE_TTL = 300  # 5 minutes, same as user cache


class _SuperAdminPermissions(frozenset):
    """Sentinel permission set that contains every permission string."""

    def __contains__(self, item: object) -> bool:
        return True

    def __iter__(self):
        return iter(())

    def __len__(self) -> int:
        return 0


SUPERADMIN_SENTINEL = _SuperAdminPermissions()


async def _load_permissions_from_db(
    session: AsyncSession, custom_role_id: uuid.UUID,
) -> frozenset[str]:
    result = await session.execute(
        select(Permission.code)
        .join(CustomRolePermission, CustomRolePermission.permission_id == Permission.id)
        .where(CustomRolePermission.custom_role_id == custom_role_id)
    )
    return frozenset(row[0] for row in result.all())


async def get_user_permissions(
    user: User, session: AsyncSession,
) -> frozenset[str]:
    if user.role == UserRole.super_admin:
        return SUPERADMIN_SENTINEL

    if user.role != UserRole.custom:
        return SYSTEM_ROLE_PERMISSIONS.get(user.role.value, frozenset())

    if not user.custom_role_id:
        return frozenset()

    cache_key = f"lms:perms:{user.id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return frozenset(cached)

    perms = await _load_permissions_from_db(session, user.custom_role_id)
    await cache.set(cache_key, list(perms), ttl=_PERMS_CACHE_TTL)
    return perms


def require_permissions(*perms: str):
    """FastAPI dependency factory: require ALL listed permissions."""

    async def permission_checker(
        current_user: Annotated[User, Depends(get_current_user)],
        session: Annotated[AsyncSession, Depends(get_session)],
    ) -> User:
        if current_user.role == UserRole.super_admin:
            return current_user

        user_perms = await get_user_permissions(current_user, session)
        missing = [p for p in perms if p not in user_perms]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return permission_checker
