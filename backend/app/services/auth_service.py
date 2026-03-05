import uuid
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.config import get_settings
from app.models.user import User
from app.models.other import UserSession, SystemSetting
from app.models.enums import UserStatus
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
) -> tuple[User, str, str]:
    """Authenticate user, enforce device limit, return (user, access_token, refresh_token)."""

    # Find user
    result = await session.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise ValueError("Invalid email or password")

    if user.status != UserStatus.active:
        raise ValueError("Account is deactivated")

    # Enforce device limit
    await _enforce_device_limit(session, user.id)

    # Create tokens
    access_token = create_access_token(user.id, user.role.value)
    refresh_token, token_id = create_refresh_token(user.id)

    # Store session
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    user_session = UserSession(
        user_id=user.id,
        session_token=_hash_token(token_id),
        device_info=device_info,
        ip_address=ip_address,
        expires_at=expires_at,
    )
    session.add(user_session)
    await session.commit()

    return user, access_token, refresh_token


async def refresh_access_token(session: AsyncSession, refresh_token: str) -> str:
    """Validate refresh token and return new access token."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise ValueError("Invalid refresh token")

    user_id = payload.get("sub")
    token_id = payload.get("jti")
    if not user_id or not token_id:
        raise ValueError("Invalid refresh token payload")

    # Check session exists and is active
    hashed = _hash_token(token_id)
    result = await session.execute(
        select(UserSession).where(
            UserSession.session_token == hashed,
            UserSession.user_id == uuid.UUID(user_id),
            UserSession.is_active.is_(True),
        )
    )
    user_session = result.scalar_one_or_none()
    if not user_session:
        raise ValueError("Session expired or revoked")

    # Update last active
    user_session.last_active_at = datetime.now(timezone.utc)
    session.add(user_session)

    # Get user for role
    result = await session.execute(
        select(User).where(User.id == uuid.UUID(user_id), User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user or user.status != UserStatus.active:
        raise ValueError("User not found or deactivated")

    await session.commit()
    return create_access_token(user.id, user.role.value)


async def logout(session: AsyncSession, refresh_token: str) -> None:
    """Revoke the refresh token session."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return  # silently ignore invalid tokens on logout

    token_id = payload.get("jti")
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
        await session.commit()


async def _enforce_device_limit(session: AsyncSession, user_id: uuid.UUID) -> None:
    """If user has too many active sessions, deactivate the oldest."""
    # Get device limit from system settings
    result = await session.execute(
        select(SystemSetting).where(SystemSetting.setting_key == "max_device_limit")
    )
    setting = result.scalar_one_or_none()
    device_limit = int(setting.value) if setting else settings.DEVICE_LIMIT

    # Count active sessions
    result = await session.execute(
        select(func.count()).where(
            UserSession.user_id == user_id,
            UserSession.is_active.is_(True),
        )
    )
    count = result.scalar()

    if count >= device_limit:
        # Deactivate oldest sessions to make room
        result = await session.execute(
            select(UserSession)
            .where(UserSession.user_id == user_id, UserSession.is_active.is_(True))
            .order_by(UserSession.logged_in_at.asc())
            .limit(count - device_limit + 1)
        )
        oldest_sessions = result.scalars().all()
        for s in oldest_sessions:
            s.is_active = False
            session.add(s)
