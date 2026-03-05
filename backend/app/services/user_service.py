import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.models.user import User
from app.models.other import UserSession
from app.models.enums import UserRole, UserStatus
from app.utils.security import hash_password


async def create_user(
    session: AsyncSession,
    email: str,
    name: str,
    password: str,
    role: str,
    phone: Optional[str] = None,
    specialization: Optional[str] = None,
) -> User:
    """Create a new user (admin only)."""
    # Check duplicate email
    result = await session.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    )
    if result.scalar_one_or_none():
        raise ValueError(f"Email '{email}' is already in use")

    # Validate specialization
    if role != "teacher" and specialization:
        raise ValueError("Only teachers can have a specialization")

    user = User(
        email=email,
        name=name,
        hashed_password=hash_password(password),
        role=UserRole(role),
        phone=phone,
        specialization=specialization,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await session.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def list_users(
    session: AsyncSession,
    page: int = 1,
    per_page: int = 20,
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> tuple[list[User], int]:
    """Return (users, total_count) with pagination and filters."""
    query = select(User).where(User.deleted_at.is_(None))
    count_query = select(func.count()).select_from(User).where(User.deleted_at.is_(None))

    if role:
        query = query.where(User.role == UserRole(role))
        count_query = count_query.where(User.role == UserRole(role))

    if status:
        query = query.where(User.status == UserStatus(status))
        count_query = count_query.where(User.status == UserStatus(status))

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (col(User.name).ilike(pattern)) | (col(User.email).ilike(pattern))
        )
        count_query = count_query.where(
            (col(User.name).ilike(pattern)) | (col(User.email).ilike(pattern))
        )

    # Get total
    result = await session.execute(count_query)
    total = result.scalar()

    # Get page
    offset = (page - 1) * per_page
    query = query.order_by(User.created_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    users = result.scalars().all()

    return list(users), total


async def update_user(
    session: AsyncSession,
    user_id: uuid.UUID,
    **fields,
) -> User:
    """Update user fields. Only non-None fields are applied."""
    user = await get_user(session, user_id)
    if not user:
        raise ValueError("User not found")

    for key, value in fields.items():
        if value is not None and hasattr(user, key):
            setattr(user, key, value)

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def deactivate_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    """Set user status to inactive and revoke all sessions."""
    user = await get_user(session, user_id)
    if not user:
        raise ValueError("User not found")

    user.status = UserStatus.inactive
    session.add(user)

    # Revoke all active sessions
    result = await session.execute(
        select(UserSession).where(
            UserSession.user_id == user_id, UserSession.is_active.is_(True)
        )
    )
    for s in result.scalars().all():
        s.is_active = False
        session.add(s)

    await session.commit()
    await session.refresh(user)
    return user


async def activate_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await get_user(session, user_id)
    if not user:
        raise ValueError("User not found")

    user.status = UserStatus.active
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def soft_delete_user(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Soft-delete a user."""
    user = await get_user(session, user_id)
    if not user:
        raise ValueError("User not found")

    user.deleted_at = datetime.now(timezone.utc)
    user.status = UserStatus.inactive
    session.add(user)

    # Revoke sessions
    result = await session.execute(
        select(UserSession).where(
            UserSession.user_id == user_id, UserSession.is_active.is_(True)
        )
    )
    for s in result.scalars().all():
        s.is_active = False
        session.add(s)

    await session.commit()


async def force_logout_user(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Revoke all active sessions for a user."""
    result = await session.execute(
        select(UserSession).where(
            UserSession.user_id == user_id, UserSession.is_active.is_(True)
        )
    )
    for s in result.scalars().all():
        s.is_active = False
        session.add(s)
    await session.commit()
