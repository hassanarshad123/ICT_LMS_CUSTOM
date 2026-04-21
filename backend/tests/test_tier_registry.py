"""Tests for the canonical plan-tier registry.

The registry is the single source of truth for which tiers exist and
how they're grouped. Every PlanTier enum value MUST appear in exactly
one of V2_TIERS / SA_COMPED_TIERS / LEGACY_TIERS — otherwise the
SA analytics / billing code will silently drop it.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make `backend/` importable when running this file directly.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.institute import PlanTier  # noqa: E402
from app.utils.tier_registry import (  # noqa: E402
    ALL_TIERS,
    V2_TIERS,
    SA_COMPED_TIERS,
    LEGACY_TIERS,
    default_distribution_dict,
    is_sa_comped_tier,
    is_v2_billing_tier,
)


def test_all_tiers_covers_every_enum_value():
    """ALL_TIERS must be a complete enumeration of PlanTier."""
    assert set(ALL_TIERS) == set(PlanTier), (
        f"ALL_TIERS missing: {set(PlanTier) - set(ALL_TIERS)}; "
        f"extra: {set(ALL_TIERS) - set(PlanTier)}"
    )


def test_tier_groups_are_mutually_exclusive_and_exhaustive():
    """Every tier appears in exactly one of V2 / SA_COMPED / LEGACY."""
    v2 = set(V2_TIERS)
    comped = set(SA_COMPED_TIERS)
    legacy = set(LEGACY_TIERS)

    # No overlaps
    assert not (v2 & comped), f"V2 overlaps SA_COMPED: {v2 & comped}"
    assert not (v2 & legacy), f"V2 overlaps LEGACY: {v2 & legacy}"
    assert not (comped & legacy), f"SA_COMPED overlaps LEGACY: {comped & legacy}"

    # Union covers the enum
    assert v2 | comped | legacy == set(PlanTier), (
        f"Tiers not assigned to any group: "
        f"{set(PlanTier) - (v2 | comped | legacy)}"
    )


def test_v2_tiers_match_billing_cron_intent():
    """Only 'professional' and 'custom' are billed by the v2 engine."""
    assert V2_TIERS == frozenset({PlanTier.professional, PlanTier.custom})
    assert is_v2_billing_tier(PlanTier.professional)
    assert is_v2_billing_tier(PlanTier.custom)
    assert not is_v2_billing_tier(PlanTier.unlimited)
    assert not is_v2_billing_tier(PlanTier.pro)


def test_unlimited_is_sa_comped_only():
    """'unlimited' is the SA-assigned comp tier and is never billed."""
    assert SA_COMPED_TIERS == frozenset({PlanTier.unlimited})
    assert is_sa_comped_tier(PlanTier.unlimited)
    assert not is_sa_comped_tier(PlanTier.custom)


def test_default_distribution_dict_zero_seeds_every_tier():
    """default_distribution_dict() returns one zero-valued key per tier."""
    dist = default_distribution_dict()
    assert set(dist.keys()) == {tier.value for tier in PlanTier}
    assert all(v == 0 for v in dist.values())


def test_distribution_dict_is_fresh_copy_per_call():
    """Returned dict must be independent so callers can mutate safely."""
    a = default_distribution_dict()
    b = default_distribution_dict()
    a["free"] = 99
    assert b["free"] == 0


def test_presentation_order_puts_v2_first():
    """ALL_TIERS order: v2 tiers first, then SA-comped, then legacy."""
    order = list(ALL_TIERS)
    assert order[0] == PlanTier.professional
    assert order[1] == PlanTier.custom
    assert order[2] == PlanTier.unlimited
    # Remaining are legacy
    assert set(order[3:]) == set(LEGACY_TIERS)
