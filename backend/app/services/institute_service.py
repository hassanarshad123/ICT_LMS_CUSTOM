import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.institute import Institute, InstituteUsage, InstituteStatus
from app.models.user import User
from app.models.enums import UserRole, UserStatus
from app.utils.security import hash_password


async def get_or_create_usage(session: AsyncSession, institute_id: uuid.UUID) -> InstituteUsage:
    result = await session.execute(
        select(InstituteUsage).where(InstituteUsage.institute_id == institute_id)
    )
    usage = result.scalar_one_or_none()
    if not usage:
        usage = InstituteUsage(
            institute_id=institute_id,
            last_calculated_at=datetime.now(timezone.utc),
        )
        session.add(usage)
        await session.flush()
    return usage


async def increment_usage(
    session: AsyncSession,
    institute_id: uuid.UUID,
    users: int = 0,
    storage_bytes: int = 0,
    video_bytes: int = 0,
) -> None:
    usage = await get_or_create_usage(session, institute_id)
    usage.current_users += users
    usage.current_storage_bytes += storage_bytes
    usage.current_video_bytes += video_bytes
    session.add(usage)


async def decrement_usage(
    session: AsyncSession,
    institute_id: uuid.UUID,
    users: int = 0,
    storage_bytes: int = 0,
    video_bytes: int = 0,
) -> None:
    usage = await get_or_create_usage(session, institute_id)
    usage.current_users = max(0, usage.current_users - users)
    usage.current_storage_bytes = max(0, usage.current_storage_bytes - storage_bytes)
    usage.current_video_bytes = max(0, usage.current_video_bytes - video_bytes)
    session.add(usage)


async def check_user_quota(session: AsyncSession, institute_id: uuid.UUID) -> None:
    usage = await get_or_create_usage(session, institute_id)
    institute = await session.get(Institute, institute_id)
    if not institute:
        return
    if usage.current_users >= institute.max_users:
        raise ValueError(f"User limit reached ({institute.max_users}). Upgrade your plan to add more users.")


async def check_storage_quota(
    session: AsyncSession, institute_id: uuid.UUID, file_size_bytes: int
) -> None:
    usage = await get_or_create_usage(session, institute_id)
    institute = await session.get(Institute, institute_id)
    if not institute:
        return
    max_bytes = int(institute.max_storage_gb * 1024 ** 3)
    if (usage.current_storage_bytes + file_size_bytes) > max_bytes:
        raise ValueError(f"Storage limit reached ({institute.max_storage_gb}GB). Upgrade your plan.")


async def check_video_quota(
    session: AsyncSession, institute_id: uuid.UUID, estimated_bytes: int
) -> None:
    usage = await get_or_create_usage(session, institute_id)
    institute = await session.get(Institute, institute_id)
    if not institute:
        return
    max_bytes = int(institute.max_video_gb * 1024 ** 3)
    if (usage.current_video_bytes + estimated_bytes) > max_bytes:
        raise ValueError(f"Video storage limit reached ({institute.max_video_gb}GB). Upgrade your plan.")


async def recalculate_usage(session: AsyncSession, institute_id: uuid.UUID) -> InstituteUsage:
    """Recalculate usage from actual DB rows (for daily scheduler job)."""
    from app.models.course import BatchMaterial
    from app.models.course import Lecture

    # Count active users
    user_count_result = await session.execute(
        select(func.count(User.id)).where(
            User.institute_id == institute_id,
            User.deleted_at.is_(None),
            User.role != UserRole.super_admin,
        )
    )
    user_count = user_count_result.scalar_one() or 0

    # Count storage bytes from materials
    storage_result = await session.execute(
        select(func.coalesce(func.sum(BatchMaterial.file_size), 0)).where(
            BatchMaterial.institute_id == institute_id,
            BatchMaterial.deleted_at.is_(None),
        )
    )
    storage_bytes = storage_result.scalar_one() or 0

    # Count video bytes from lectures
    video_result = await session.execute(
        select(func.coalesce(func.sum(Lecture.file_size), 0)).where(
            Lecture.institute_id == institute_id,
            Lecture.deleted_at.is_(None),
        )
    )
    video_bytes = video_result.scalar_one() or 0

    usage = await get_or_create_usage(session, institute_id)
    usage.current_users = user_count
    usage.current_storage_bytes = int(storage_bytes)
    usage.current_video_bytes = int(video_bytes)
    usage.last_calculated_at = datetime.now(timezone.utc)
    session.add(usage)
    await session.commit()
    return usage


async def create_institute(
    session: AsyncSession,
    name: str,
    slug: str,
    contact_email: str,
    plan_tier: str = "free",
    max_users: int = 10,
    max_storage_gb: float = 1.0,
    max_video_gb: float = 5.0,
    expires_at: Optional[datetime] = None,
) -> Institute:
    from app.models.institute import PlanTier
    institute = Institute(
        name=name,
        slug=slug,
        contact_email=contact_email,
        plan_tier=PlanTier(plan_tier),
        max_users=max_users,
        max_storage_gb=max_storage_gb,
        max_video_gb=max_video_gb,
        expires_at=expires_at,
    )
    session.add(institute)
    await session.flush()

    # Create usage tracking row
    usage = InstituteUsage(
        institute_id=institute.id,
        last_calculated_at=datetime.now(timezone.utc),
    )
    session.add(usage)
    await session.commit()
    await session.refresh(institute)
    return institute


async def create_admin_for_institute(
    session: AsyncSession,
    institute_id: uuid.UUID,
    email: str,
    name: str,
    password: str,
    phone: Optional[str] = None,
) -> User:
    user = User(
        email=email,
        name=name,
        phone=phone,
        hashed_password=hash_password(password),
        role=UserRole.admin,
        institute_id=institute_id,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def get_platform_stats(session: AsyncSession) -> dict:
    from app.models.institute import Institute, InstituteUsage, InstituteStatus, PlanTier

    # Total institutes
    total_result = await session.execute(
        select(func.count(Institute.id)).where(Institute.deleted_at.is_(None))
    )
    total = total_result.scalar_one() or 0

    # By status
    status_result = await session.execute(
        select(Institute.status, func.count(Institute.id))
        .where(Institute.deleted_at.is_(None))
        .group_by(Institute.status)
    )
    status_counts = {row[0].value: row[1] for row in status_result.all()}

    # By plan
    plan_result = await session.execute(
        select(Institute.plan_tier, func.count(Institute.id))
        .where(Institute.deleted_at.is_(None))
        .group_by(Institute.plan_tier)
    )
    plan_counts = {row[0].value: row[1] for row in plan_result.all()}

    # Total users
    user_result = await session.execute(
        select(func.count(User.id)).where(
            User.deleted_at.is_(None),
            User.role != UserRole.super_admin,
        )
    )
    total_users = user_result.scalar_one() or 0

    # Aggregated usage
    usage_result = await session.execute(
        select(
            func.coalesce(func.sum(InstituteUsage.current_storage_bytes), 0),
            func.coalesce(func.sum(InstituteUsage.current_video_bytes), 0),
        )
    )
    agg = usage_result.one()
    total_storage_gb = round((agg[0] or 0) / (1024 ** 3), 2)
    total_video_gb = round((agg[1] or 0) / (1024 ** 3), 2)

    # Recent institutes
    recent_result = await session.execute(
        select(Institute)
        .where(Institute.deleted_at.is_(None))
        .order_by(Institute.created_at.desc())
        .limit(5)
    )
    recent = recent_result.scalars().all()

    return {
        "total_institutes": total,
        "active_institutes": status_counts.get("active", 0),
        "suspended_institutes": status_counts.get("suspended", 0),
        "trial_institutes": status_counts.get("trial", 0),
        "total_users": total_users,
        "total_storage_gb": total_storage_gb,
        "total_video_gb": total_video_gb,
        "institutes_by_plan": {
            "free": plan_counts.get("free", 0),
            "basic": plan_counts.get("basic", 0),
            "pro": plan_counts.get("pro", 0),
            "enterprise": plan_counts.get("enterprise", 0),
        },
        "recent_institutes": [
            {
                "id": str(i.id),
                "name": i.name,
                "slug": i.slug,
                "status": i.status.value,
                "plan_tier": i.plan_tier.value,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in recent
        ],
    }
