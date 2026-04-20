import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, col

from app.models.user import User
from app.models.session import UserSession
from app.models.announcement import Announcement
from app.models.zoom import ZoomClass
from app.models.batch import StudentBatch
from app.models.enums import UserRole, UserStatus
from app.utils.security import hash_password


async def _ensure_employee_id_unique(
    session: AsyncSession,
    institute_id: Optional[uuid.UUID],
    employee_id: str,
) -> None:
    """Raise ValueError if employee_id is already linked within this institute."""
    if institute_id is None:
        raise ValueError("Cannot link employee_id without an institute")
    existing = await session.execute(
        select(User.id).where(
            User.institute_id == institute_id,
            User.employee_id == employee_id,
            User.deleted_at.is_(None),
        ).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError(
            f"Employee ID '{employee_id}' is already linked to another officer"
        )


async def create_user(
    session: AsyncSession,
    email: str,
    name: str,
    password: str,
    role: str,
    phone: Optional[str] = None,
    specialization: Optional[str] = None,
    institute_id: Optional[uuid.UUID] = None,
    employee_id: Optional[str] = None,
) -> User:
    """Create a new user (admin only)."""
    email = email.strip().lower()
    # Check duplicate email within same institute
    dup_query = select(User).where(func.lower(User.email) == email, User.deleted_at.is_(None))
    if institute_id is not None:
        dup_query = dup_query.where(User.institute_id == institute_id)
    result = await session.execute(dup_query)
    if result.scalar_one_or_none():
        raise ValueError(f"Email '{email}' is already in use")

    # Check duplicate employee_id within same institute
    if employee_id:
        await _ensure_employee_id_unique(session, institute_id, employee_id)

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
        institute_id=institute_id,
        employee_id=employee_id,
        email_verified=True,  # Admin-created users are trusted
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def find_users_by_emails(
    session: AsyncSession,
    emails: list[str],
    institute_id: Optional[uuid.UUID] = None,
) -> dict[str, User]:
    """Return dict mapping lowercase email -> User for matching active users."""
    if not emails:
        return {}
    lower_emails = [e.lower() for e in emails]
    query = select(User).where(
        func.lower(User.email).in_(lower_emails),
        User.deleted_at.is_(None),
    )
    if institute_id is not None:
        query = query.where(User.institute_id == institute_id)
    result = await session.execute(query)
    return {u.email.lower(): u for u in result.scalars().all()}


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
    batch_id: Optional[uuid.UUID] = None,
    institute_id: Optional[uuid.UUID] = None,
    allowed_roles: Optional[list[str]] = None,
) -> tuple[list[User], int]:
    """Return (users, total_count) with pagination and filters."""
    query = select(User).where(User.deleted_at.is_(None))
    count_query = select(func.count()).select_from(User).where(User.deleted_at.is_(None))

    if institute_id is not None:
        query = query.where(User.institute_id == institute_id)
        count_query = count_query.where(User.institute_id == institute_id)

    if role:
        query = query.where(User.role == UserRole(role))
        count_query = count_query.where(User.role == UserRole(role))

    # Restrict to specific roles (e.g., CCs can only see students/teachers)
    if allowed_roles:
        role_enums = [UserRole(r) for r in allowed_roles]
        query = query.where(User.role.in_(role_enums))
        count_query = count_query.where(User.role.in_(role_enums))

    if status:
        query = query.where(User.status == UserStatus(status))
        count_query = count_query.where(User.status == UserStatus(status))

    if search:
        pattern = f"%{search}%"
        query = query.where(
            (col(User.name).ilike(pattern)) | (col(User.email).ilike(pattern)) | (col(User.phone).ilike(pattern))
        )
        count_query = count_query.where(
            (col(User.name).ilike(pattern)) | (col(User.email).ilike(pattern)) | (col(User.phone).ilike(pattern))
        )

    if batch_id:
        enrolled_sub = select(StudentBatch.student_id).where(
            StudentBatch.batch_id == batch_id, StudentBatch.removed_at.is_(None)
        )
        query = query.where(User.id.in_(enrolled_sub))
        count_query = count_query.where(User.id.in_(enrolled_sub))

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

    # Guard against role changes via generic update (must use dedicated endpoint)
    if "role" in fields:
        raise ValueError("Role changes are not supported through this endpoint")

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
    user.token_version += 1
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

    now = datetime.now(timezone.utc)
    user.deleted_at = now
    user.status = UserStatus.inactive
    user.token_version += 1
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

    # Cascade: remove student enrollments
    if user.role == UserRole.student:
        sb_result = await session.execute(
            select(StudentBatch).where(
                StudentBatch.student_id == user_id,
                StudentBatch.removed_at.is_(None),
            )
        )
        for sb in sb_result.scalars().all():
            sb.removed_at = now
            session.add(sb)

    # Cascade: soft-delete teacher's zoom classes
    if user.role == UserRole.teacher:
        zc_result = await session.execute(
            select(ZoomClass).where(
                ZoomClass.teacher_id == user_id, ZoomClass.deleted_at.is_(None)
            )
        )
        for zc in zc_result.scalars().all():
            zc.deleted_at = now
            session.add(zc)

    # Cascade: soft-delete user's announcements
    ann_result = await session.execute(
        select(Announcement).where(
            Announcement.posted_by == user_id, Announcement.deleted_at.is_(None)
        )
    )
    for ann in ann_result.scalars().all():
        ann.deleted_at = now
        session.add(ann)

    await session.commit()


async def force_logout_user(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Revoke all active sessions for a user and increment token_version (Fix 1)."""
    result = await session.execute(
        select(UserSession).where(
            UserSession.user_id == user_id, UserSession.is_active.is_(True)
        )
    )
    for s in result.scalars().all():
        s.is_active = False
        session.add(s)

    # Increment token_version to revoke outstanding access tokens
    user = await get_user(session, user_id)
    if user:
        user.token_version += 1
        session.add(user)

    await session.commit()
