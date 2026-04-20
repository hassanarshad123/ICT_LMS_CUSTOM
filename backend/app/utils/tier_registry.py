"""Canonical plan-tier registry for SA surface.

Single source of truth for "what tiers exist and how are they grouped?".
Call sites (SA analytics, revenue, billing cron, UI filters) must import
from here instead of hardcoding tier name lists — otherwise every new
PlanTier enum value requires editing N files.

Grouping semantics:
  V2_TIERS             — professional, custom. Billed by the v2 engine.
  SA_COMPED_TIERS      — unlimited. SA-assigned, never billed.
  LEGACY_TIERS         — free, starter, basic, pro, enterprise. Pre-v2
                         tiers kept intact for grandfathered institutes
                         (e.g., ICT was on 'pro' before migrating to
                         'unlimited' in PR #61).
  ALL_TIERS            — all of the above, in a stable presentation order.

Helpers:
  default_distribution_dict() — every tier mapped to zero. Use as the
    base for any response dict keyed by tier name.
  is_v2_billing_tier(tier)    — True iff tier is in V2_TIERS.
  is_sa_comped_tier(tier)     — True iff tier is in SA_COMPED_TIERS.

This module re-exports the existing helpers from ``plan_limits`` to
keep a single import path for new code. Old imports of
``plan_limits.is_v2_billing_tier`` / ``TIER_LABELS`` still work.
"""
from __future__ import annotations

from app.models.institute import PlanTier
from app.utils.plan_limits import (  # re-exports
    PLAN_LIMITS,
    TIER_LABELS,
    V2_BILLING_TIERS,
    is_v2_billing_tier,
)


V2_TIERS: frozenset[PlanTier] = V2_BILLING_TIERS  # alias — more general name

SA_COMPED_TIERS: frozenset[PlanTier] = frozenset({PlanTier.unlimited})

LEGACY_TIERS: frozenset[PlanTier] = frozenset({
    PlanTier.free,
    PlanTier.starter,
    PlanTier.basic,
    PlanTier.pro,
    PlanTier.enterprise,
})

# Stable presentation order: v2 first (current), SA-comped, then legacy
# from oldest to newest. Used anywhere the UI shows tiers in a list.
ALL_TIERS: tuple[PlanTier, ...] = (
    PlanTier.professional,
    PlanTier.custom,
    PlanTier.unlimited,
    PlanTier.free,
    PlanTier.starter,
    PlanTier.basic,
    PlanTier.pro,
    PlanTier.enterprise,
)


def default_distribution_dict() -> dict[str, int]:
    """Every tier name mapped to 0. Seed for any by-tier aggregate response."""
    return {tier.value: 0 for tier in ALL_TIERS}


def is_sa_comped_tier(tier: PlanTier) -> bool:
    """True iff the tier is SA-assigned / comped (never billed)."""
    return tier in SA_COMPED_TIERS


__all__ = [
    "PlanTier",
    "ALL_TIERS",
    "V2_TIERS",
    "SA_COMPED_TIERS",
    "LEGACY_TIERS",
    "PLAN_LIMITS",
    "TIER_LABELS",
    "default_distribution_dict",
    "is_v2_billing_tier",
    "is_sa_comped_tier",
]
