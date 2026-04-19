"""Per-tier creation limits for the Zensbot LMS pricing model.

v2 canonical tiers (see docs/pricing-model-v2.md):
  professional — Free forever — 10 students + 10 GB docs + 50 GB video included;
                 Rs 80/mo per extra student; add-on storage packs available.
                 Billing enforced via the v2 engine (InstituteBilling +
                 monthly invoice cron). `students` key is None here because
                 overage is billed, not hard-capped.
  custom       — Quoted per deal — everything in Professional plus volume
                 discount, dedicated infra, SLA, white-label app, custom
                 domain. Rate table stored in institute.custom_pricing_config.

Grandfathered tiers (kept intact so existing live institutes like
ICT.ZENSBOT.ONLINE are not affected by the v2 rollout):
  free        — 14-day trial    — 15 students,   1 GB storage,  3 GB video
  starter     — Rs 2,500/mo     — 50 students,   3 GB storage, 15 GB video
  basic       — Rs 5,000/mo     — 250 students, 10 GB storage, 75 GB video
  pro         — Rs 15,000/mo    — 1000 students, 50 GB storage, 300 GB video
  enterprise  — from Rs 50k/mo  — unlimited everything

Keys in each tier dict:
  students         — max students (int) or None for unlimited / overage-billed
  storage_gb       — max document storage in GB (float) or None
  video_gb         — max video storage in GB (float) or None
  courses          — None (unlimited on all v2 + paid legacy tiers; 5 on free trial)
  batches          — None (unlimited on all v2 + paid legacy tiers; 10 on free trial)
  quizzes          — None (unlimited on all v2 + paid legacy tiers; 5 on free trial)
  announcements_per_day — soft per-day limit to prevent abuse
  api_keys         — 0 (disabled) on free/starter/basic; None on pro/enterprise/professional/custom
  webhooks         — 0 (disabled) on free/starter/basic; None on pro/enterprise/professional/custom
  zoom_classes     — None (unlimited) on all tiers — Zoom is part of the core product
  ai_tools         — True on pro/enterprise/professional/custom; False on free/starter/basic
  custom_domain    — True only on enterprise and custom
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.institute import Institute, PlanTier


# Canonical per-tier limits. Source of truth for all enforcement.
# None = unlimited. 0 = feature disabled entirely.
PLAN_LIMITS: dict[PlanTier, dict] = {
    PlanTier.professional: {
        # Free forever. "students: None" means no hard cap — overage billing
        # (Rs 80/mo per student above 10) handles growth via InstituteBilling.
        "students": None,
        "storage_gb": 10.0,   # base; extensible via institute_addons (PR 2)
        "video_gb": 50.0,     # base; extensible via institute_addons (PR 2)
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
    PlanTier.custom: {
        # Negotiated per deal. Rates + overrides stored in
        # institutes.custom_pricing_config (JSONB, added in PR 1 migration).
        # Hard caps are None here so the billing engine is authoritative.
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
    PlanTier.unlimited: {
        # SA-assigned comped tier. No quotas, no billing, no soft-lock.
        # Usage is still tracked via InstituteUsage for monitoring. White-label
        # stays off — unlimited institutes are branded as normal Zensbot tenants.
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
    # v2 tiers
    PlanTier.professional: "Professional",
    PlanTier.custom: "Custom",
    # Internal comped tier (SA-only)
    PlanTier.unlimited: "Unlimited",
    # Grandfathered tiers
    PlanTier.free: "Free Trial",
    PlanTier.starter: "Starter",
    PlanTier.basic: "Basic",
    PlanTier.pro: "Pro",
    PlanTier.enterprise: "Enterprise",
}


# Tiers that use the v2 billing engine (monthly cron, per-student overage,
# storage addons, late-payment enforcement). Everything NOT in this set is
# grandfathered and explicitly skipped by the v2 billing code paths.
#
# Call sites should import and check: `if inst.plan_tier in V2_BILLING_TIERS`
V2_BILLING_TIERS: frozenset[PlanTier] = frozenset({
    PlanTier.professional,
    PlanTier.custom,
})


def is_v2_billing_tier(tier: PlanTier) -> bool:
    """True if the tier uses the v2 billing engine.

    Grandfathered institutes (free/starter/basic/pro/enterprise) return
    False and must never be touched by v2 billing crons, addon quota
    extensions, or late-payment enforcement.
    """
    return tier in V2_BILLING_TIERS


# ──────────────────────────────────────────────────────────────────────
# Storage add-on packs (pricing-model-v2).
#
# Professional and Custom institutes can buy these monthly-recurring
# packs to extend their base 10 GB docs / 50 GB video allowance. Each
# key below is a stable string identifier stored in
# institute_addons.addon_type — adding a new pack means adding a key
# here, not running a DB migration.
#
# Prices are the approved "premium" tier from pricing discussions.
# Shape:
#   "price_pkr": int  — monthly charge per one pack
#   "bonus_gb":  float — storage added per one pack
#   "kind":      "docs" | "video" — which bucket the bonus applies to
#
# Addon state is snapshotted on activation into the InstituteAddon row
# (unit_price_pkr, storage_bonus_gb, storage_bonus_kind) so price changes
# here do NOT retroactively change active subscriptions.
# ──────────────────────────────────────────────────────────────────────
ADDON_PRICING: dict[str, dict] = {
    "docs_10gb": {
        "price_pkr": 1_000,
        "bonus_gb": 10.0,
        "kind": "docs",
    },
    "video_50gb": {
        "price_pkr": 3_000,
        "bonus_gb": 50.0,
        "kind": "video",
    },
    "video_100gb": {
        "price_pkr": 5_000,
        "bonus_gb": 100.0,
        "kind": "video",
    },
    "video_500gb": {
        "price_pkr": 20_000,
        "bonus_gb": 500.0,
        "kind": "video",
    },
}


def get_addon_pricing(addon_type: str) -> dict | None:
    """Look up the canonical config for an addon type. Returns None if unknown."""
    return ADDON_PRICING.get(addon_type)


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
