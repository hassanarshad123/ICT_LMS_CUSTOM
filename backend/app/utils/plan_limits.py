"""Free-tier creation limits. Paid plans (basic/pro/enterprise) have NO limits."""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.institute import Institute, PlanTier

# Limits for free-tier institutes. 0 = feature disabled. None = no limit.
FREE_PLAN_LIMITS: dict[str, int] = {
    "courses": 5,
    "batches": 10,
    "quizzes": 5,
    "announcements_per_day": 10,
    "api_keys": 0,
    "webhooks": 0,
    "zoom_classes": 0,
}

_PAID_TIERS = frozenset({PlanTier.basic, PlanTier.pro, PlanTier.enterprise})


async def check_creation_limit(
    session: AsyncSession,
    institute_id: uuid.UUID,
    entity_type: str,
) -> None:
    """Check if a free-tier institute has hit its creation limit.

    For paid tiers (basic/pro/enterprise): returns immediately, no check.
    Raises ValueError if the limit is reached or the feature is disabled.
    """
    inst = await session.get(Institute, institute_id)
    if not inst or inst.plan_tier in _PAID_TIERS:
        return

    limit = FREE_PLAN_LIMITS.get(entity_type)
    if limit is None:
        return

    label = entity_type.replace("_per_day", "").replace("_", " ")

    if limit == 0:
        raise ValueError(
            f"{label.title()} are available on paid plans. Please upgrade."
        )

    count = await _count_entities(session, institute_id, entity_type)
    if count >= limit:
        raise ValueError(
            f"Free plan limit reached: maximum {limit} {label}. Please upgrade."
        )


async def _count_entities(
    session: AsyncSession,
    institute_id: uuid.UUID,
    entity_type: str,
) -> int:
    """Count existing entities for an institute."""
    if entity_type == "courses":
        from app.models.course import Course
        stmt = select(func.count(Course.id)).where(
            Course.institute_id == institute_id,
            Course.deleted_at.is_(None),
        )
    elif entity_type == "batches":
        from app.models.batch import Batch
        stmt = select(func.count(Batch.id)).where(
            Batch.institute_id == institute_id,
            Batch.deleted_at.is_(None),
        )
    elif entity_type == "quizzes":
        from app.models.quiz import Quiz
        stmt = select(func.count(Quiz.id)).where(
            Quiz.institute_id == institute_id,
            Quiz.deleted_at.is_(None),
        )
    elif entity_type == "announcements_per_day":
        from app.models.announcement import Announcement
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0,
        )
        stmt = select(func.count(Announcement.id)).where(
            Announcement.institute_id == institute_id,
            Announcement.deleted_at.is_(None),
            Announcement.created_at >= today_start,
        )
    elif entity_type == "api_keys":
        from app.models.api_integration import ApiKey
        stmt = select(func.count(ApiKey.id)).where(
            ApiKey.institute_id == institute_id,
            ApiKey.is_active == True,
            ApiKey.revoked_at.is_(None),
        )
    elif entity_type == "webhooks":
        from app.models.api_integration import WebhookEndpoint
        stmt = select(func.count(WebhookEndpoint.id)).where(
            WebhookEndpoint.institute_id == institute_id,
            WebhookEndpoint.deleted_at.is_(None),
        )
    else:
        return 0

    result = await session.execute(stmt)
    return result.scalar_one()
