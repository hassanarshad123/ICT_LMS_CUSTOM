"""Unit tests for pricing v2 billing calculation (PR 3).

Tests pure computation functions. No DB required.
"""
import uuid
from unittest.mock import AsyncMock

import pytest

from app.models.billing import InstituteBilling
from app.models.institute import Institute, PlanTier, InstituteStatus
from app.services.billing_calc import (
    _apply_tiered_rates,
    build_line_items,
    compute_student_overage_pkr,
    is_v2_billable,
)


def _make_billing(
    free_included: int = 10,
    extra_user_rate: int = 80,
    base_amount: int = 0,
    custom_pricing_config: dict | None = None,
) -> InstituteBilling:
    return InstituteBilling(
        institute_id=uuid.uuid4(),
        base_amount=base_amount,
        currency="PKR",
        billing_cycle="monthly",
        extra_user_rate=extra_user_rate,
        extra_storage_rate=0,
        extra_video_rate=0,
        free_users_included=free_included,
        custom_pricing_config=custom_pricing_config,
    )


def _make_institute(tier: PlanTier, status: InstituteStatus = InstituteStatus.active) -> Institute:
    return Institute(
        id=uuid.uuid4(),
        name=f"I-{tier.value}",
        slug=f"i-{tier.value}",
        status=status,
        plan_tier=tier,
        max_users=100,
        max_students=100,
        max_storage_gb=10.0,
        max_video_gb=50.0,
        contact_email="a@b.com",
    )


class TestStudentOveragePro:
    """Professional tier: flat rate."""

    def test_below_free_threshold_no_charge(self):
        billing = _make_billing(free_included=10, extra_user_rate=80)
        count, amt = compute_student_overage_pkr(8, billing, tier_is_custom=False)
        assert count == 0
        assert amt == 0

    def test_at_free_threshold_no_charge(self):
        billing = _make_billing(free_included=10, extra_user_rate=80)
        count, amt = compute_student_overage_pkr(10, billing, tier_is_custom=False)
        assert count == 0
        assert amt == 0

    def test_11_students_is_1_overage(self):
        billing = _make_billing(free_included=10, extra_user_rate=80)
        count, amt = compute_student_overage_pkr(11, billing, tier_is_custom=False)
        assert count == 1
        assert amt == 80

    def test_100_students_is_90_overage(self):
        billing = _make_billing(free_included=10, extra_user_rate=80)
        count, amt = compute_student_overage_pkr(100, billing, tier_is_custom=False)
        assert count == 90
        assert amt == 90 * 80

    def test_zero_rate_means_zero_charge(self):
        # Grandfathered billing configs have extra_user_rate=0; even if somehow
        # called, overage amount should be 0 (no charge for legacy institutes).
        billing = _make_billing(free_included=0, extra_user_rate=0)
        count, amt = compute_student_overage_pkr(500, billing, tier_is_custom=False)
        assert count == 500
        assert amt == 0


class TestTieredRates:
    """Custom tier: walk volume-discount brackets."""

    def test_default_tiers_under_first_bracket(self):
        # 50 students, free=10 → 40 billed @ Rs 80 = 3,200
        tiers = [
            {"from": 0, "to": 500, "rate_pkr": 80},
            {"from": 500, "to": 1000, "rate_pkr": 50},
            {"from": 1000, "to": None, "rate_pkr": 40},
        ]
        total = _apply_tiered_rates(50, 10, tiers)
        assert total == 40 * 80

    def test_spans_two_brackets(self):
        # 600 students, free=10 → students 10..499 (490 @ 80) + 500..599 (100 @ 50)
        tiers = [
            {"from": 0, "to": 500, "rate_pkr": 80},
            {"from": 500, "to": 1000, "rate_pkr": 50},
        ]
        total = _apply_tiered_rates(600, 10, tiers)
        assert total == 490 * 80 + 100 * 50

    def test_unbounded_top_bracket(self):
        # 1500 students, free=10
        # 10..499 → 490 × 80 = 39200
        # 500..999 → 500 × 50 = 25000
        # 1000..1499 → 500 × 40 = 20000
        tiers = [
            {"from": 0, "to": 500, "rate_pkr": 80},
            {"from": 500, "to": 1000, "rate_pkr": 50},
            {"from": 1000, "to": None, "rate_pkr": 40},
        ]
        total = _apply_tiered_rates(1500, 10, tiers)
        assert total == 490 * 80 + 500 * 50 + 500 * 40


class TestComputeStudentOverageCustom:
    def test_uses_tiered_rates_when_configured(self):
        billing = _make_billing(
            free_included=10,
            extra_user_rate=80,
            custom_pricing_config={
                "tiered_student_rates": [
                    {"from": 0, "to": 500, "rate_pkr": 80},
                    {"from": 500, "to": None, "rate_pkr": 50},
                ],
            },
        )
        count, amt = compute_student_overage_pkr(600, billing, tier_is_custom=True)
        assert count == 590
        assert amt == 490 * 80 + 100 * 50

    def test_falls_back_to_flat_when_no_config(self):
        billing = _make_billing(
            free_included=10, extra_user_rate=80, custom_pricing_config=None,
        )
        count, amt = compute_student_overage_pkr(100, billing, tier_is_custom=True)
        assert count == 90
        assert amt == 90 * 80

    def test_custom_ignored_on_pro_tier(self):
        # Professional never reads custom_pricing_config even if present.
        billing = _make_billing(
            free_included=10,
            extra_user_rate=80,
            custom_pricing_config={"tiered_student_rates": [{"from": 0, "to": None, "rate_pkr": 999}]},
        )
        count, amt = compute_student_overage_pkr(100, billing, tier_is_custom=False)
        assert amt == 90 * 80  # flat, not the config's 999


class TestBuildLineItems:
    def test_no_items_when_no_charges(self):
        items = build_line_items(0, 0, 0, [], unit_user_rate_pkr=80)
        assert items == []

    def test_base_fee_only(self):
        items = build_line_items(0, 0, 50_000, [], unit_user_rate_pkr=80)
        assert len(items) == 1
        assert items[0]["code"] == "base_fee"
        assert items[0]["amount"] == 50_000

    def test_student_overage_only(self):
        items = build_line_items(5, 400, 0, [], unit_user_rate_pkr=80)
        assert len(items) == 1
        assert items[0]["code"] == "student_overage"
        assert items[0]["qty"] == 5
        assert items[0]["unit_pkr"] == 80
        assert items[0]["amount"] == 400

    def test_addons_included(self):
        from app.models.institute_addon import InstituteAddon
        from datetime import datetime, timezone
        addon = InstituteAddon(
            institute_id=uuid.uuid4(),
            addon_type="video_50gb",
            quantity=2,
            unit_price_pkr=3_000,
            storage_bonus_gb=50.0,
            storage_bonus_kind="video",
            activated_at=datetime.now(timezone.utc),
        )
        items = build_line_items(0, 0, 0, [addon], unit_user_rate_pkr=80)
        assert len(items) == 1
        assert items[0]["code"] == "addon_video_50gb"
        assert items[0]["qty"] == 2
        assert items[0]["unit_pkr"] == 3_000
        assert items[0]["amount"] == 6_000

    def test_order_is_base_overage_addons(self):
        from app.models.institute_addon import InstituteAddon
        from datetime import datetime, timezone
        addon = InstituteAddon(
            institute_id=uuid.uuid4(),
            addon_type="docs_10gb", quantity=1, unit_price_pkr=1_000,
            storage_bonus_gb=10.0, storage_bonus_kind="docs",
            activated_at=datetime.now(timezone.utc),
        )
        items = build_line_items(3, 240, 50_000, [addon], unit_user_rate_pkr=80)
        codes = [i["code"] for i in items]
        assert codes == ["base_fee", "student_overage", "addon_docs_10gb"]


class TestIsV2Billable:
    def test_professional_active_is_billable(self):
        inst = _make_institute(PlanTier.professional, InstituteStatus.active)
        assert is_v2_billable(inst) is True

    def test_custom_active_is_billable(self):
        inst = _make_institute(PlanTier.custom, InstituteStatus.active)
        assert is_v2_billable(inst) is True

    @pytest.mark.parametrize("legacy", [
        PlanTier.pro, PlanTier.free, PlanTier.starter, PlanTier.basic, PlanTier.enterprise,
    ])
    def test_grandfathered_tiers_not_billable(self, legacy):
        # ICT on 'pro' must always fail this check.
        inst = _make_institute(legacy, InstituteStatus.active)
        assert is_v2_billable(inst) is False

    def test_suspended_professional_not_billable(self):
        inst = _make_institute(PlanTier.professional, InstituteStatus.suspended)
        assert is_v2_billable(inst) is False

    def test_trial_professional_not_billable(self):
        # If somehow a professional institute was set to 'trial' status,
        # we skip billing. Status must be 'active' for billing to fire.
        inst = _make_institute(PlanTier.professional, InstituteStatus.trial)
        assert is_v2_billable(inst) is False
