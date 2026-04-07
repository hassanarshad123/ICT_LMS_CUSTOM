"""Per-tier creation limits for the 5-tier PKR pricing model.

Tier overview (values in PLAN_LIMITS below are authoritative):
  free        — 14-day trial    — 15 students,   1 GB storage,  3 GB video
  starter     — Rs 2,500/mo     — 50 students,   3 GB storage, 15 GB video
  basic       — Rs 5,000/mo     — 250 students, 10 GB storage, 75 GB video
  pro         — Rs 15,000/mo    — 1000 students, 50 GB storage, 300 GB video
  enterprise  — from Rs 50k/mo  — unlimited everything

Keys in each tier dict:
  students         — max students (int) or None for unlimited
  storage_gb       — max document storage in GB (float) or None
  video_gb         — max video storage in GB (float) or None
  courses          — None (unlimited on all paid tiers; 5 on free trial)
  batches          — None (unlimited on all paid tiers; 10 on free trial)
  quizzes          — None (unlimited on all paid tiers; 5 on free trial)
  announcements_per_day — soft per-day limit to prevent abuse, same on all
  api_keys         — 0 (disabled) on free/starter/basic; None (unlimited) on pro+
  webhooks         — 0 (disabled) on free/starter/basic; None (unlimited) on pro+
  zoom_classes     — None (unlimited) on all tiers — Zoom is part of the core product
  ai_tools         — False on free/starter/basic; True on pro/enterprise
  custom_domain    — False except enterprise
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.institute import Institute, PlanTier


# Canonical per-tier limits. Source of truth for all enforcement.
# None = unlimited. 0 = feature disabled entirely.
PLAN_LIMITS: dict[PlanTier, dict] = {
    PlanTier.free: {  # 14-day trial
        "students": 15,
        "storage_gb": 1.0,
        "video_gb": 3.0,
        "courses": 5,
        "batches": 10,
        "quizzes": 5,
        "announcements_per_day": 10,
        "api_keys": 0,
        "webhooks": 0,
        "zoom_classes": None,  # Zoom available during trial so admins can test it
        "ai_tools": False,
        "custom_domain": False,
    },
    PlanTier.starter: {
        "students": 50,
        "storage_gb": 3.0,
        "video_gb": 15.0,
        "courses": None,
        "batches": None,
        "quizzes": None,
        "announcements_per_day": 20,
        "api_keys": 0,
        "webhooks": 0,
        "zoom_classes": None,
        "ai_tools": False,
        "custom_domain": False,
    },
    PlanTier.basic: {
        "students": 250,
        "storage_gb": 10.0,
        "video_gb": 75.0,
        "courses": None,
        "batches": None,
        "quizzes": None,
        "announcements_per_day": 50,
        "api_keys": 0,
        "webhooks": 0,
        "zoom_classes": None,
        "ai_tools": False,
        "custom_domain": False,
    },
    PlanTier.pro: {
        "students": 1000,
        "storage_gb": 50.0,
        "video_gb": 300.0,
        "courses": None,
        "batches": None,
        "quizzes": None,
        "announcements_per_day": 100,
        "api_keys": None,
        "webhooks": None,
        "zoom_classes": None,
        "ai_tools": True,
        "custom_domain": False,
    },
    PlanTier.enterprise: {
        "students": None,
        "storage_gb": None,
        "video_gb": None,
        "courses": None,
        "batches": None,
        "quizzes": None,
        "announcements_per_day": None,
        "api_keys": None,
        "webhooks": None,
        "zoom_classes": None,
        "ai_tools": True,
        "custom_domain": True,
    },
}


# Human-readable tier labels for error messages and UI copy.
TIER_LABELS: dict[PlanTier, str] = {
    PlanTier.free: "Free Trial",
    PlanTier.starter: "Starter",
    PlanTier.basic: "Basic",
    PlanTier.pro: "Pro",
    PlanTier.enterprise: "Enterprise",
}


def get_limit(tier: PlanTier, key: str):
    """Return the configured limit for a tier + key. None means unlimited."""
    return PLAN_LIMITS.get(tier, {}).get(key)


def has_feature(tier: PlanTier, feature: str) -> bool:
    """True if the tier unlocks a boolean feature (ai_tools, custom_domain)."""
    return PLAN_LIMITS.get(tier, {}).get(feature, False) is True


async def check_creation_limit(
    session: AsyncSession,
    institute_id: uuid.UUID,
    entity_type: str,
) -> None:
    """Check if an institute can create another entity of the given type.

    Looks up the per-tier limit in PLAN_LIMITS:
      - None  → unlimited, return immediately
      - 0     → feature is disabled, raise ValueError with upgrade message
      - N > 0 → count existing entities and raise if N reached

    Raises ValueError if the limit is reached or the feature is disabled.
    """
    inst = await session.get(Institute, institute_id)
    if not inst:
        return

    limit = get_limit(inst.plan_tier, entity_type)
    if limit is None:
        # Unlimited on this tier — or key is unrecognized (permissive default).
        return

    label = entity_type.replace("_per_day", "").replace("_", " ")
    tier_label = TIER_LABELS.get(inst.plan_tier, inst.plan_tier.value)

    if limit == 0:
        raise ValueError(
            f"{label.title()} are available on Pro and Enterprise plans. "
            f"You're currently on {tier_label}. Please upgrade."
        )

    count = await _count_entities(session, institute_id, entity_type)
    if count >= limit:
        raise ValueError(
            f"{tier_label} plan limit reached: maximum {limit} {label}. "
            f"Please upgrade to add more."
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
            ApiKey.is_active == True,  # noqa: E712
            ApiKey.revoked_at.is_(None),
        )
    elif entity_type == "webhooks":
        from app.models.api_integration import WebhookEndpoint
        stmt = select(func.count(WebhookEndpoint.id)).where(
            WebhookEndpoint.institute_id == institute_id,
            WebhookEndpoint.deleted_at.is_(None),
        )
    elif entity_type == "zoom_classes":
        from app.models.zoom import ZoomClass
        stmt = select(func.count(ZoomClass.id)).where(
            ZoomClass.institute_id == institute_id,
            ZoomClass.deleted_at.is_(None),
        )
    else:
        return 0

    result = await session.execute(stmt)
    return result.scalar_one()
