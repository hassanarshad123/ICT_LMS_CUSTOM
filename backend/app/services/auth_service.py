import uuid
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.config import get_settings
from app.models.user import User
from app.models.session import UserSession
from app.models.settings import SystemSetting
from app.models.enums import UserStatus, UserRole
from app.utils.security import verify_password, create_access_token, create_refresh_token, decode_token

settings = get_settings()


def _hash_token(token_id: str) -> str:
    """SHA-256 hash of the refresh token ID for DB storage."""
    return sha256(token_id.encode()).hexdigest()


async def authenticate_user(
    session: AsyncSession,
    email: str,
    password: str,
    device_info: str | None = None,
    ip_address: str | None = None,
    institute_id: uuid.UUID | None = None,
) -> tuple[User, str, str]:
    """Authenticate user, enforce device limit, return (user, access_token, refresh_token)."""
    email = email.strip().lower()

    # Find user — scope by institute if provided, otherwise find by email only (for super_admin)
    query = select(User).where(func.lower(User.email) == email, User.deleted_at.is_(None))
    if institute_id is not None:
        query = query.where(User.institute_id == institute_id)
    else:
        # For bare-domain login (no institute slug), require institute_id NULL + super_admin role
        # so institute admins can't login without a slug (Fix 3)
        query = query.where(User.institute_id.is_(None))
        query = query.where(User.role == UserRole.super_admin)

    result = await session.execute(query)
    user = result.scalar_one_or_none()

    # Check account lockout before password verification
    if user and user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise ValueError("Account temporarily locked due to too many failed attempts. Try again later.")

    if not user or not verify_password(password, user.hashed_password):
        # Increment failed attempts if user exists
        if user:
            user.failed_login_attempts += 1
            # Progressive lockout: 5 attempts → 5 min, 10 → 30 min, 15+ → 60 min
            attempts = user.failed_login_attempts
            if attempts >= 15:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=60)
            elif attempts >= 10:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)
            elif attempts >= 5:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=5)
            session.add(user)
            await session.commit()
        raise ValueError("Invalid email or password")

    if user.status != UserStatus.active:
        raise ValueError("Account is deactivated")

    # Reset failed login attempts on successful auth
    if user.failed_login_attempts > 0 or user.locked_until is not None:
        user.failed_login_attempts = 0
        user.locked_until = None
        session.add(user)

    # Enforce device limit (scoped to institute for per-tenant settings)
    await _enforce_device_limit(session, user.id, institute_id=user.institute_id)

    # Create tokens (embed token_version for revocation — Fix 1)
    access_token = create_access_token(user.id, user.role.value, user.token_version)
    refresh_token, token_id = create_refresh_token(user.id)

    # Store session (set institute_id so device mgmt filters work — Fix 2)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    user_session = UserSession(
        user_id=user.id,
        session_token=_hash_token(token_id),
        device_info=device_info,
        ip_address=ip_address,
        expires_at=expires_at,
        institute_id=user.institute_id,
    )
    session.add(user_session)
    await session.commit()

    return user, access_token, refresh_token


async def refresh_access_token(session: AsyncSession, refresh_token: str) -> tuple[str, str]:
    """Validate refresh token, rotate it, and return (new_access_token, new_refresh_token)."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise ValueError("Invalid refresh token")

    user_id = payload.get("sub")
    token_id = payload.get("jti")
    if not user_id or not token_id:
        raise ValueError("Invalid refresh token payload")

    # Check session exists, is active, and not expired
    hashed = _hash_token(token_id)
    result = await session.execute(
        select(UserSession).where(
            UserSession.session_token == hashed,
            UserSession.user_id == uuid.UUID(user_id),
            UserSession.is_active.is_(True),
            UserSession.expires_at > datetime.now(timezone.utc),
        )
    )
    user_session = result.scalar_one_or_none()
    if not user_session:
        raise ValueError("Session expired or revoked")

    # Get user for role
    result = await session.execute(
        select(User).where(User.id == uuid.UUID(user_id), User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user or user.status != UserStatus.active:
        raise ValueError("User not found or deactivated")

    # Rotate refresh token: issue new one, update session hash
    new_refresh_token, new_token_id = create_refresh_token(user.id)
    user_session.session_token = _hash_token(new_token_id)
    user_session.last_active_at = datetime.now(timezone.utc)
    session.add(user_session)

    await session.commit()
    new_access_token = create_access_token(user.id, user.role.value, user.token_version)
    return new_access_token, new_refresh_token


async def logout(session: AsyncSession, refresh_token: str) -> None:
    """Revoke the refresh token session and increment token_version (Fix 1)."""
    from app.core.cache import cache

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return  # silently ignore invalid tokens on logout

    token_id = payload.get("jti")
    user_id = payload.get("sub")
    if not token_id:
        return

    hashed = _hash_token(token_id)
    result = await session.execute(
        select(UserSession).where(UserSession.session_token == hashed)
    )
    user_session = result.scalar_one_or_none()
    if user_session:
        user_session.is_active = False
        session.add(user_session)

    # Increment token_version to revoke all outstanding access tokens
    if user_id:
        result = await session.execute(
            select(User).where(User.id == uuid.UUID(user_id), User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if user:
            user.token_version += 1
            session.add(user)

    await session.commit()

    # Invalidate user cache
    if user_id:
        await cache.delete(f"lms:user_index:{user_id}")


async def logout_all(session: AsyncSession, user_id: uuid.UUID) -> int:
    """Revoke all active sessions for a user and increment token_version. Returns count terminated."""
    from app.core.cache import cache

    result = await session.execute(
        select(UserSession).where(
            UserSession.user_id == user_id, UserSession.is_active.is_(True)
        )
    )
    sessions = result.scalars().all()
    count = len(sessions)
    for s in sessions:
        s.is_active = False
        session.add(s)

    # Increment token_version to revoke all outstanding access tokens (Fix 1)
    result = await session.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if user:
        user.token_version += 1
        session.add(user)

    await session.commit()

    # Invalidate user cache
    await cache.delete(f"lms:user_index:{user_id}")

    return count


async def _enforce_device_limit(
    session: AsyncSession, user_id: uuid.UUID, institute_id: uuid.UUID | None = None,
) -> None:
    """If user has too many active sessions, deactivate the oldest.

    Uses SELECT FOR UPDATE to prevent TOCTOU race conditions on concurrent logins.
    """
    # Get device limit from system settings (scoped to institute)
    setting_query = select(SystemSetting).where(SystemSetting.setting_key == "max_device_limit")
    if institute_id is not None:
        setting_query = setting_query.where(SystemSetting.institute_id == institute_id)
    else:
        setting_query = setting_query.where(SystemSetting.institute_id.is_(None))
    result = await session.execute(setting_query)
    setting = result.scalar_one_or_none()
    device_limit = int(setting.value) if setting else settings.DEVICE_LIMIT

    # Lock and fetch all active sessions atomically to prevent race conditions
    result = await session.execute(
        select(UserSession)
        .where(
            UserSession.user_id == user_id,
            UserSession.is_active.is_(True),
        )
        .with_for_update()
        .order_by(UserSession.logged_in_at.asc())
    )
    active_sessions = result.scalars().all()
    count = len(active_sessions)

    if count >= device_limit:
        # Deactivate oldest sessions to make room
        to_deactivate = count - device_limit + 1
        for s in active_sessions[:to_deactivate]:
            s.is_active = False
            session.add(s)
