import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.institute import Institute, InstituteUsage, InstituteStatus
from app.models.user import User
from app.models.enums import UserRole, UserStatus
from app.utils.plan_limits import is_v2_billing_tier
from app.utils.security import hash_password


async def _effective_storage_limit_gb(
    session: AsyncSession,
    institute: Institute,
    kind: str,
) -> float:
    """Base institute cap + active addon bonus (v2 tiers only).

    Grandfathered tiers (ICT is on 'pro') return the bare max_*_gb value
    without ever touching the institute_addons table. This is the
    ICT-protection invariant — any regression here could silently grant
    ICT addon capacity or trigger an addon lookup for a tier that never
    uses them.

    kind: "docs" → uses max_storage_gb + docs addons
          "video" → uses max_video_gb + video addons
    """
    if kind == "docs":
        base = institute.max_storage_gb
    elif kind == "video":
        base = institute.max_video_gb
    else:
        raise ValueError(f"Unknown storage kind '{kind}'")

    if not is_v2_billing_tier(institute.plan_tier):
        return base

    # Lazy import avoids a cycle (addon_service imports from institute_service
    # in the future if billing logic grows). Safe — only reached on v2 tiers.
    from app.services.addon_service import get_addon_storage_bonus
    docs_bonus, video_bonus = await get_addon_storage_bonus(session, institute.id)
    bonus = docs_bonus if kind == "docs" else video_bonus
    return base + bonus


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
        raise ValueError("Institute not found — cannot check user quota")
    if usage.current_users >= institute.max_users:
        raise ValueError(f"User limit reached ({institute.max_users}). Upgrade your plan to add more users.")


async def check_storage_quota(
    session: AsyncSession, institute_id: uuid.UUID, file_size_bytes: int
) -> None:
    usage = await get_or_create_usage(session, institute_id)
    institute = await session.get(Institute, institute_id)
    if not institute:
        raise ValueError("Institute not found — cannot check storage quota")
    max_bytes = int(institute.max_storage_gb * 1024 ** 3)
    if (usage.current_storage_bytes + file_size_bytes) > max_bytes:
        raise ValueError(f"Storage limit reached ({institute.max_storage_gb}GB). Upgrade your plan.")


async def check_video_quota(
    session: AsyncSession, institute_id: uuid.UUID, estimated_bytes: int
) -> None:
    usage = await get_or_create_usage(session, institute_id)
    institute = await session.get(Institute, institute_id)
    if not institute:
        raise ValueError("Institute not found — cannot check video quota")
    max_bytes = int(institute.max_video_gb * 1024 ** 3)
    if (usage.current_video_bytes + estimated_bytes) > max_bytes:
        raise ValueError(f"Video storage limit reached ({institute.max_video_gb}GB). Upgrade your plan.")


# ── Atomic check-and-increment functions ─────────────────────────
# These use FOR UPDATE to prevent concurrent requests from bypassing
# quotas. Must be called BEFORE the service's create function so
# that the service's internal commit also persists the increment.


async def _lock_usage(session: AsyncSession, institute_id: uuid.UUID) -> InstituteUsage:
    """Acquire a row-level lock on the usage row for atomic quota operations."""
    result = await session.execute(
        select(InstituteUsage)
        .where(InstituteUsage.institute_id == institute_id)
        .with_for_update()
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


async def check_and_increment_student_quota(
    session: AsyncSession, institute_id: uuid.UUID,
) -> None:
    """Atomically lock, count students, check against max_students, increment usage.

    Only users with role=student count toward the cap. Staff roles
    (admin/teacher/course_creator) are uncapped — use
    increment_staff_usage() for those.

    Call BEFORE create_user() so the service's internal commit also
    persists this increment.

    Raises ValueError if the student cap would be exceeded.
    """
    # Lock the usage row first so concurrent requests serialize
    usage = await _lock_usage(session, institute_id)
    institute = await session.get(Institute, institute_id)
    if not institute:
        return

    # Count actual students (not all users) to honor the tier cap exactly.
    # Recounting on every create is cheap (indexed by institute_id + role).
    student_count_result = await session.execute(
        select(func.count(User.id)).where(
            User.institute_id == institute_id,
            User.role == UserRole.student,
            User.deleted_at.is_(None),
        )
    )
    current_students = student_count_result.scalar_one() or 0

    if current_students >= institute.max_students:
        from app.utils.plan_limits import TIER_LABELS
        tier_label = TIER_LABELS.get(institute.plan_tier, institute.plan_tier.value)
        raise ValueError(
            f"{tier_label} plan limit reached: maximum {institute.max_students} students. "
            f"Please upgrade to add more."
        )

    # Track total users for SA visibility. current_users is advisory now,
    # not a gate — max_students is the authoritative cap.
    usage.current_users += 1
    session.add(usage)


async def increment_staff_usage(
    session: AsyncSession, institute_id: uuid.UUID,
) -> None:
    """Track a new staff user (admin/teacher/course_creator) for SA visibility.

    Staff roles are uncapped in the 5-tier model — only students count
    toward the tier cap. This function just bumps current_users for the
    SA dashboard and does not raise.
    """
    usage = await _lock_usage(session, institute_id)
    usage.current_users += 1
    session.add(usage)


async def check_and_increment_user_quota(
    session: AsyncSession, institute_id: uuid.UUID,
) -> None:
    """DEPRECATED — kept for backwards compatibility with pre-Phase-2 callers.

    This function assumes student creation and routes to
    check_and_increment_student_quota. New code should call the specific
    helper directly based on the role being created.
    """
    await check_and_increment_student_quota(session, institute_id)


async def check_and_increment_storage_quota(
    session: AsyncSession, institute_id: uuid.UUID, file_size_bytes: int,
) -> None:
    """Atomically lock, check, and increment storage bytes.

    Effective limit = institute.max_storage_gb + active docs addons
    (v2 tiers only). Grandfathered institutes use bare max_storage_gb.

    Call BEFORE create_material() so the service's internal commit
    also persists this increment.
    """
    usage = await _lock_usage(session, institute_id)
    institute = await session.get(Institute, institute_id)
    if not institute:
        return
    effective_gb = await _effective_storage_limit_gb(session, institute, "docs")
    max_bytes = int(effective_gb * 1024 ** 3)
    if (usage.current_storage_bytes + file_size_bytes) > max_bytes:
        raise ValueError(
            f"Storage limit reached ({effective_gb}GB). Upgrade your plan."
        )
    usage.current_storage_bytes += file_size_bytes
    session.add(usage)


async def check_and_increment_video_quota(
    session: AsyncSession, institute_id: uuid.UUID, estimated_bytes: int,
) -> None:
    """Atomically lock, check, and increment video bytes.

    Effective limit = institute.max_video_gb + active video addons
    (v2 tiers only). Grandfathered institutes use bare max_video_gb.

    Call BEFORE create_lecture() so the service's internal commit
    also persists this increment.
    """
    usage = await _lock_usage(session, institute_id)
    institute = await session.get(Institute, institute_id)
    if not institute:
        return
    effective_gb = await _effective_storage_limit_gb(session, institute, "video")
    max_bytes = int(effective_gb * 1024 ** 3)
    if (usage.current_video_bytes + estimated_bytes) > max_bytes:
        raise ValueError(
            f"Video storage limit reached ({effective_gb}GB). Upgrade your plan."
        )
    usage.current_video_bytes += estimated_bytes
    session.add(usage)


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
    max_students: int = 15,
    max_storage_gb: float = 1.0,
    max_video_gb: float = 5.0,
    expires_at: Optional[datetime] = None,
) -> Institute:
    from app.models.institute import PlanTier
    from app.utils.plan_limits import PLAN_LIMITS

    # If caller didn't specify quotas, source sensible defaults from
    # PLAN_LIMITS for the requested tier. Explicit args still override.
    tier_enum = PlanTier(plan_tier)
    tier_defaults = PLAN_LIMITS.get(tier_enum, {})
    resolved_max_students = max_students if max_students != 15 else (tier_defaults.get("students") or 15)
    resolved_max_storage = max_storage_gb if max_storage_gb != 1.0 else (tier_defaults.get("storage_gb") or 1.0)
    resolved_max_video = max_video_gb if max_video_gb != 5.0 else (tier_defaults.get("video_gb") or 5.0)

    institute = Institute(
        name=name,
        slug=slug,
        contact_email=contact_email,
        plan_tier=tier_enum,
        max_users=max_users,
        max_students=resolved_max_students,
        max_storage_gb=resolved_max_storage,
        max_video_gb=resolved_max_video,
        expires_at=expires_at,
    )
    session.add(institute)
    await session.flush()

    # Create usage tracking row (same transaction — caller owns commit)
    usage = InstituteUsage(
        institute_id=institute.id,
        last_calculated_at=datetime.now(timezone.utc),
    )
    session.add(usage)
    await session.flush()
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
    await session.flush()
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
            "starter": plan_counts.get("starter", 0),
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


# ──────────────────────────────────────────────────────────────────────
# Tier-change helper — centralizes the unlimited-tier comp/revoke flow.
# ──────────────────────────────────────────────────────────────────────

async def change_institute_tier(
    session: AsyncSession,
    *,
    institute: Institute,
    new_tier: "PlanTier",
    reason: Optional[str],
) -> Institute:
    """Move an institute to a different plan_tier, with extra handling
    when entering or leaving the SA-only `unlimited` tier.

    Entering `unlimited`:
      - Null out max_users / max_students / max_storage_gb / max_video_gb
        so quota checks pass unconditionally (effective_limit is None).
      - `reason` is required (non-empty string); recorded in ActivityLog.

    Leaving `unlimited`:
      - `reason` is required (non-empty string); recorded in ActivityLog.
      - Caller is responsible for setting appropriate new caps via the
        same PATCH body. We do NOT auto-apply defaults — it is an
        intentional, audited action.

    Plain tier swaps that don't touch `unlimited` pass through with no
    special handling (caller still sets whatever fields they want).

    Returns the mutated institute (not yet flushed).
    """
    from app.models.institute import PlanTier as _PlanTier
    tier = new_tier if isinstance(new_tier, _PlanTier) else _PlanTier(new_tier)
    old_tier = institute.plan_tier

    entering_unlimited = tier == _PlanTier.unlimited and old_tier != _PlanTier.unlimited
    leaving_unlimited = old_tier == _PlanTier.unlimited and tier != _PlanTier.unlimited

    if (entering_unlimited or leaving_unlimited) and not (reason and reason.strip()):
        raise ValueError(
            "tier_change_reason is required when assigning or revoking the "
            "Unlimited plan (recorded in ActivityLog for audit)."
        )

    institute.plan_tier = tier
    if entering_unlimited:
        institute.max_users = None
        institute.max_students = None
        institute.max_storage_gb = None
        institute.max_video_gb = None
    institute.updated_at = datetime.now(timezone.utc)
    session.add(institute)
    return institute
