"""Unit tests for the Unlimited-tier helper + PlanTier enum wiring.

These tests don't hit a database — they mock Institute + AsyncSession and
exercise the validation logic of `change_institute_tier`. Full integration
coverage (ActivityLog row insert, PATCH endpoint) lives in the separate
integration_test.py suite and runs in Phase 6.
"""
from __future__ import annotations

import asyncio
import sys
import types
from dataclasses import dataclass
from pathlib import Path

# Make `backend/` importable when running this file directly.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.institute import PlanTier  # noqa: E402
from app.utils.plan_limits import (  # noqa: E402
    PLAN_LIMITS,
    TIER_LABELS,
    V2_BILLING_TIERS,
    get_limit,
    is_v2_billing_tier,
)
from app.services.institute_service import change_institute_tier  # noqa: E402


@dataclass
class _FakeInstitute:
    plan_tier: PlanTier
    max_users: int | None = 100
    max_students: int | None = 50
    max_storage_gb: float | None = 10.0
    max_video_gb: float | None = 50.0
    updated_at: object = None


class _FakeSession:
    def __init__(self) -> None:
        self.added: list = []

    def add(self, obj) -> None:
        self.added.append(obj)


def test_enum_has_unlimited():
    assert PlanTier.unlimited.value == "unlimited"


def test_plan_limits_all_none_for_unlimited():
    for key in (
        "students", "storage_gb", "video_gb", "courses", "batches",
        "quizzes", "announcements_per_day", "api_keys", "webhooks",
        "zoom_classes",
    ):
        assert get_limit(PlanTier.unlimited, key) is None, f"{key} should be None"
    assert PLAN_LIMITS[PlanTier.unlimited]["ai_tools"] is True
    assert PLAN_LIMITS[PlanTier.unlimited]["custom_domain"] is True


def test_unlimited_label():
    assert TIER_LABELS[PlanTier.unlimited] == "Unlimited"


def test_unlimited_excluded_from_v2_billing():
    assert PlanTier.unlimited not in V2_BILLING_TIERS
    assert is_v2_billing_tier(PlanTier.unlimited) is False
    # v2 tiers that ARE billable — sanity check.
    assert is_v2_billing_tier(PlanTier.professional) is True
    assert is_v2_billing_tier(PlanTier.custom) is True


def test_assign_unlimited_requires_reason():
    inst = _FakeInstitute(plan_tier=PlanTier.enterprise)
    session = _FakeSession()
    try:
        asyncio.run(
            change_institute_tier(
                session, institute=inst, new_tier=PlanTier.unlimited, reason=None,
            )
        )
    except ValueError as e:
        assert "reason is required" in str(e).lower()
        return
    raise AssertionError("Expected ValueError when assigning unlimited with no reason")


def test_assign_unlimited_with_reason_nulls_caps():
    inst = _FakeInstitute(plan_tier=PlanTier.enterprise)
    session = _FakeSession()
    asyncio.run(
        change_institute_tier(
            session,
            institute=inst,
            new_tier=PlanTier.unlimited,
            reason="Founding partner comp — approved by Hassan 2026-04-20",
        )
    )
    assert inst.plan_tier == PlanTier.unlimited
    assert inst.max_users is None
    assert inst.max_students is None
    assert inst.max_storage_gb is None
    assert inst.max_video_gb is None
    assert session.added == [inst]


def test_downgrade_from_unlimited_requires_reason():
    inst = _FakeInstitute(
        plan_tier=PlanTier.unlimited,
        max_users=None, max_students=None,
        max_storage_gb=None, max_video_gb=None,
    )
    session = _FakeSession()
    try:
        asyncio.run(
            change_institute_tier(
                session, institute=inst, new_tier=PlanTier.pro, reason="  ",
            )
        )
    except ValueError as e:
        assert "reason is required" in str(e).lower()
        return
    raise AssertionError("Expected ValueError when leaving unlimited without reason")


def test_plain_tier_swap_allows_empty_reason():
    # Changing between two non-unlimited tiers: no reason needed.
    inst = _FakeInstitute(plan_tier=PlanTier.pro)
    session = _FakeSession()
    asyncio.run(
        change_institute_tier(
            session, institute=inst, new_tier=PlanTier.enterprise, reason=None,
        )
    )
    assert inst.plan_tier == PlanTier.enterprise
    # Caps are NOT auto-adjusted for plain swaps (caller sets explicitly).
    assert inst.max_users == 100


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  ok  {name}")
    print("all tests passed")
