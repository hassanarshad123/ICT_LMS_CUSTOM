"""Unit tests for Pricing v2 addon configuration (PR 2).

Does NOT require a DB — tests pure functions and ADDON_PRICING structure.
Runtime service behavior (activate_addon, cancel_addon, get_addon_storage_bonus)
is exercised by integration tests against a real DB.
"""
import pytest

from app.utils.plan_limits import (
    ADDON_PRICING,
    get_addon_pricing,
    is_v2_billing_tier,
)
from app.models.institute import PlanTier
from app.models.institute_addon import InstituteAddon


class TestAddonPricingCatalog:
    def test_four_packs_exist(self):
        assert set(ADDON_PRICING.keys()) == {
            "docs_10gb", "video_50gb", "video_100gb", "video_500gb",
        }

    @pytest.mark.parametrize("addon_type,expected_price,expected_gb,expected_kind", [
        ("docs_10gb",   1_000,  10.0,  "docs"),
        ("video_50gb",  3_000,  50.0,  "video"),
        ("video_100gb", 5_000,  100.0, "video"),
        ("video_500gb", 20_000, 500.0, "video"),
    ])
    def test_pack_contents(self, addon_type, expected_price, expected_gb, expected_kind):
        pack = ADDON_PRICING[addon_type]
        assert pack["price_pkr"] == expected_price
        assert pack["bonus_gb"] == expected_gb
        assert pack["kind"] == expected_kind

    def test_video_100gb_is_cheaper_per_gb_than_video_50gb(self):
        # Marketing invariant: bigger packs give better unit pricing.
        pack_50 = ADDON_PRICING["video_50gb"]
        pack_100 = ADDON_PRICING["video_100gb"]
        price_per_gb_50 = pack_50["price_pkr"] / pack_50["bonus_gb"]
        price_per_gb_100 = pack_100["price_pkr"] / pack_100["bonus_gb"]
        assert price_per_gb_100 < price_per_gb_50

    def test_video_500gb_is_cheapest_per_gb(self):
        pack_500 = ADDON_PRICING["video_500gb"]
        assert pack_500["price_pkr"] / pack_500["bonus_gb"] == 40.0

    def test_all_kinds_are_docs_or_video(self):
        for pack in ADDON_PRICING.values():
            assert pack["kind"] in {"docs", "video"}


class TestGetAddonPricing:
    def test_known_type_returns_pack(self):
        pack = get_addon_pricing("video_50gb")
        assert pack is not None
        assert pack["price_pkr"] == 3_000

    def test_unknown_type_returns_none(self):
        assert get_addon_pricing("docs_9999gb") is None

    def test_empty_type_returns_none(self):
        assert get_addon_pricing("") is None


class TestInstituteAddonModel:
    def test_table_has_expected_columns(self):
        cols = InstituteAddon.__table__.columns
        expected = {
            "id", "institute_id", "addon_type", "quantity", "unit_price_pkr",
            "storage_bonus_gb", "storage_bonus_kind", "activated_at",
            "cancelled_at", "cancelled_effective_at",
            "created_at", "updated_at",
        }
        assert expected.issubset(set(cols.keys()))

    def test_addon_type_is_string_not_enum(self):
        col = InstituteAddon.__table__.columns["addon_type"]
        assert col.type.__class__.__name__ == "String"

    def test_quantity_default_is_one(self):
        a = InstituteAddon(
            institute_id=__import__("uuid").uuid4(),
            addon_type="video_50gb",
            unit_price_pkr=3_000,
            storage_bonus_gb=50.0,
            storage_bonus_kind="video",
            activated_at=__import__("datetime").datetime.now(),
        )
        assert a.quantity == 1

    def test_cancelled_fields_nullable(self):
        cancelled_at_col = InstituteAddon.__table__.columns["cancelled_at"]
        cancelled_eff_col = InstituteAddon.__table__.columns["cancelled_effective_at"]
        assert cancelled_at_col.nullable is True
        assert cancelled_eff_col.nullable is True


class TestAddonTierGate:
    """Integration-of-rules check: addon functionality must be limited to
    v2 billing tiers. The addon_service.activate_addon function re-checks
    this as defense-in-depth, and get_addon_storage_bonus is only
    consulted for v2 tiers by institute_service._effective_storage_limit_gb.
    """

    def test_pro_tier_is_not_v2(self):
        # The single most important test: ICT's tier does NOT see addons.
        assert is_v2_billing_tier(PlanTier.pro) is False

    def test_professional_tier_is_v2(self):
        assert is_v2_billing_tier(PlanTier.professional) is True

    def test_custom_tier_is_v2(self):
        assert is_v2_billing_tier(PlanTier.custom) is True


class TestEndOfMonthUtc:
    """_end_of_month_utc is used by cancel_addon to set cancelled_effective_at."""

    def test_january_ends_on_31st(self):
        from datetime import datetime, timezone
        from app.services.addon_service import _end_of_month_utc
        when = datetime(2026, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        eom = _end_of_month_utc(when)
        assert eom.year == 2026
        assert eom.month == 1
        assert eom.day == 31
        assert eom.hour == 23
        assert eom.minute == 59

    def test_february_non_leap_ends_on_28th(self):
        from datetime import datetime, timezone
        from app.services.addon_service import _end_of_month_utc
        when = datetime(2026, 2, 1, 0, 0, 0, tzinfo=timezone.utc)
        eom = _end_of_month_utc(when)
        assert eom.day == 28

    def test_february_leap_ends_on_29th(self):
        from datetime import datetime, timezone
        from app.services.addon_service import _end_of_month_utc
        when = datetime(2028, 2, 1, 0, 0, 0, tzinfo=timezone.utc)
        eom = _end_of_month_utc(when)
        assert eom.day == 29

    def test_april_ends_on_30th(self):
        from datetime import datetime, timezone
        from app.services.addon_service import _end_of_month_utc
        when = datetime(2026, 4, 17, 10, 30, 0, tzinfo=timezone.utc)
        eom = _end_of_month_utc(when)
        assert eom.day == 30

    def test_returns_utc_aware(self):
        from datetime import datetime, timezone
        from app.services.addon_service import _end_of_month_utc
        eom = _end_of_month_utc(datetime(2026, 4, 1, tzinfo=timezone.utc))
        assert eom.tzinfo is timezone.utc
