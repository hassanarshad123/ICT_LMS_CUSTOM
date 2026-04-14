import uuid
import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.database import get_session
from app.models.user import User
from app.models.institute import Institute, InstituteStatus
from app.models.enums import UserStatus, UserRole
from app.utils.security import decode_token
from app.core.cache import cache

logger = logging.getLogger("ict_lms.auth")
bearer_scheme = HTTPBearer()

# ── TTL for user auth cache (seconds) ──
_USER_CACHE_TTL = 300  # 5 minutes



async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    """Extract and validate the JWT access token, return the User.

    Uses Redis cache to avoid 2 DB queries on every request. Cache is keyed
    by (institute_id, user_id) with a 5-minute TTL.
    """
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    token_tv = payload.get("tv")
    imp_id = payload.get("imp")

    # ── Try cache first ──────────────────────────────────────────
    cache_key = cache.user_key(user_id)
    cached = await cache.get(cache_key)

    if cached is not None:
        # Validate token_version — reject stale cache
        if token_tv is not None and cached.get("token_version") != token_tv:
            await cache.delete(cache_key)
            cached = None

    if cached is not None:
        # Validate user status from cache
        if cached.get("status") != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

        user_role = cached.get("role", "")
        inst_id = cached.get("institute_id")

        # Defensive guard: non-SA users MUST have an institute
        if user_role != "super_admin" and inst_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account configuration error: missing institute assignment",
            )

        # Check institute suspension/expiry from cached data
        if user_role != "super_admin" and inst_id is not None:
            inst_status = cached.get("institute_status")
            if inst_status == "suspended":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Institute account is suspended")
            inst_expires = cached.get("institute_expires_at")
            if inst_expires:
                expires_dt = datetime.fromisoformat(inst_expires)
                if expires_dt < datetime.now(timezone.utc):
                    # Institute expired — need to auto-suspend via DB, fall through
                    await cache.delete(cache_key)
                    cached = None

    if cached is not None:
        # Cache hit — reconstruct a minimal User object for downstream compatibility
        try:
            user = User(
                id=uuid.UUID(cached["id"]),
                email=cached["email"],
                name=cached["name"],
                role=UserRole(cached["role"]),
                status=UserStatus(cached["status"]),
                institute_id=uuid.UUID(cached["institute_id"]) if cached.get("institute_id") else None,
                token_version=cached["token_version"],
            )
            user._impersonator_id = uuid.UUID(imp_id) if imp_id else None

            # Propagate to request.state for downstream middleware (error_tracking)
            request.state.user_id = cached["id"]
            request.state.user_email = cached["email"]
            request.state.institute_id = cached.get("institute_id")
            request.state.user_role = cached["role"]
            if imp_id:
                request.state.impersonator_id = str(imp_id)

            # Set Sentry context
            try:
                import sentry_sdk
                sentry_sdk.set_user({"id": cached["id"], "email": cached["email"], "username": cached["name"]})
                sentry_sdk.set_tag("user.role", cached["role"])
                sentry_sdk.set_tag("institute_id", cached.get("institute_id") or "none")
                if imp_id:
                    sentry_sdk.set_tag("impersonator_id", str(imp_id))
            except Exception:
                pass

            return user
        except (KeyError, ValueError, TypeError) as e:
            # Corrupt cache entry — delete and fall through to DB
            logger.warning("Corrupt user cache for %s, falling through to DB: %s", user_id, e)
            await cache.delete(cache_key)
            # Fall through to DB query below

    # ── Cache miss — query DB ────────────────────────────────────
    result = await session.execute(
        select(User)
        .options(selectinload(User.institute))
        .where(User.id == uuid.UUID(user_id), User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.status != UserStatus.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    # Verify token_version
    if token_tv is None or token_tv != user.token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    # Attach impersonator info
    user._impersonator_id = uuid.UUID(imp_id) if imp_id else None

    # Defensive guard: non-SA users MUST have an institute
    if user.role != UserRole.super_admin and user.institute_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account configuration error: missing institute assignment",
        )

    # Check institute suspension/expiry
    if user.role != UserRole.super_admin and user.institute_id is not None:
        institute = user.institute
        if institute:
            if institute.status == InstituteStatus.suspended:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Institute account is suspended")
            if institute.expires_at and institute.expires_at < datetime.now(timezone.utc):
                if institute.status != InstituteStatus.suspended:
                    institute.status = InstituteStatus.suspended
                    session.add(institute)
                    await session.commit()
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Institute subscription has expired")

    # ── Populate cache ──────────────────────────────────────────
    inst = user.institute
    cache_data = {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "status": user.status.value,
        "institute_id": str(user.institute_id) if user.institute_id else None,
        "token_version": user.token_version,
        "institute_status": inst.status.value if inst else None,
        "institute_expires_at": inst.expires_at.isoformat() if inst and inst.expires_at else None,
    }
    await cache.set(cache.user_key(user_id), cache_data, ttl=_USER_CACHE_TTL)

    # Propagate to request.state for downstream middleware (error_tracking)
    request.state.user_id = str(user.id)
    request.state.user_email = user.email
    request.state.institute_id = str(user.institute_id) if user.institute_id else None
    request.state.user_role = user.role.value
    if hasattr(user, "_impersonator_id") and user._impersonator_id:
        request.state.impersonator_id = str(user._impersonator_id)

    # Set Sentry context
    try:
        import sentry_sdk
        sentry_sdk.set_user({"id": str(user.id), "email": user.email, "username": user.name})
        sentry_sdk.set_tag("user.role", user.role.value)
        sentry_sdk.set_tag("institute_id", str(user.institute_id) if user.institute_id else "none")
        if hasattr(user, "_impersonator_id") and user._impersonator_id:
            sentry_sdk.set_tag("impersonator_id", str(user._impersonator_id))
    except Exception:
        pass

    return user


def require_roles(*roles: str):
    """FastAPI dependency factory: restrict endpoint to specific roles."""

    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return role_checker


def get_institute_slug_from_header(request: Request) -> str | None:
    """Read X-Institute-Slug header for public endpoints."""
    return request.headers.get("X-Institute-Slug")


# Role type annotations for dependency injection
SA = Annotated[User, Depends(require_roles("super_admin"))]
Admin = Annotated[User, Depends(require_roles("admin"))]
CC = Annotated[User, Depends(require_roles("course_creator"))]
AO = Annotated[User, Depends(require_roles("admissions_officer"))]
AdminOrAO = Annotated[User, Depends(require_roles("admin", "admissions_officer"))]
