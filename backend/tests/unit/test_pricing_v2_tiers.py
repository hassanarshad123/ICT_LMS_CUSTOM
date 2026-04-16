"""Unit tests for Pricing v2 tiers (PR 1).

Verifies:
  1. PlanTier enum has 'professional' and 'custom' values.
  2. Legacy tiers (free/starter/basic/pro/enterprise) are still present.
  3. PLAN_LIMITS has the expected shape for the new tiers.
  4. TIER_LABELS has human-readable labels for the new tiers.
  5. get_limit() and has_feature() return the spec'd values.
  6. The V2_BILLING_TIERS set + is_v2_billing_tier() helper correctly
     separate v2 tiers from grandfathered ones — this is the critical
     gate that protects ICT.ZENSBOT.ONLINE.
  7. InstituteBilling model exposes the new v2 columns.
"""
from app.models.institute import PlanTier
from app.models.billing import InstituteBilling
from app.utils.plan_limits import (
    PLAN_LIMITS,
    TIER_LABELS,
    V2_BILLING_TIERS,
    get_limit,
    has_feature,
    is_v2_billing_tier,
)


class TestPlanTierEnum:
    def test_new_v2_tiers_exist(self):
        assert PlanTier.professional.value == "professional"
        assert PlanTier.custom.value == "custom"

    def test_legacy_tiers_preserved(self):
        # Grandfathered tiers must remain — ICT and other paying institutes
        # rely on these values being present.
        assert PlanTier.free.value == "free"
        assert PlanTier.starter.value == "starter"
        assert PlanTier.basic.value == "basic"
        assert PlanTier.pro.value == "pro"
        assert PlanTier.enterprise.value == "enterprise"

    def test_all_seven_tiers_present(self):
        values = {tier.value for tier in PlanTier}
        assert values == {
            "professional", "custom",
            "free", "starter", "basic", "pro", "enterprise",
        }


class TestPlanLimitsProfessional:
    def test_professional_is_in_plan_limits(self):
        assert PlanTier.professional in PLAN_LIMITS

    def test_professional_students_is_unlimited_hard_cap(self):
        # Unlimited here = billing engine handles overage; no hard cap on
        # creation. The 10-included + Rs 80/extra rule lives in
        # InstituteBilling (free_users_included + extra_user_rate), not here.
        assert get_limit(PlanTier.professional, "students") is None

    def test_professional_storage_is_10gb_docs_50gb_video(self):
        assert get_limit(PlanTier.professional, "storage_gb") == 10.0
        assert get_limit(PlanTier.professional, "video_gb") == 50.0

    def test_professional_unlocks_full_product(self):
        # Per the spec, Professional has "everything the LMS offers".
        assert get_limit(PlanTier.professional, "courses") is None
        assert get_limit(PlanTier.professional, "batches") is None
        assert get_limit(PlanTier.professional, "quizzes") is None
        assert get_limit(PlanTier.professional, "api_keys") is None
        assert get_limit(PlanTier.professional, "webhooks") is None
        assert get_limit(PlanTier.professional, "zoom_classes") is None
        assert has_feature(PlanTier.professional, "ai_tools") is True

    def test_professional_does_not_unlock_custom_domain(self):
        # Custom domain is a Custom-tier differentiator.
        assert has_feature(PlanTier.professional, "custom_domain") is False


class TestPlanLimitsCustom:
    def test_custom_is_in_plan_limits(self):
        assert PlanTier.custom in PLAN_LIMITS

    def test_custom_has_no_hard_caps(self):
        # Everything is negotiated per deal; the billing engine (not
        # PLAN_LIMITS) is authoritative for Custom.
        assert get_limit(PlanTier.custom, "students") is None
        assert get_limit(PlanTier.custom, "storage_gb") is None
        assert get_limit(PlanTier.custom, "video_gb") is None
        assert get_limit(PlanTier.custom, "announcements_per_day") is None

    def test_custom_unlocks_everything(self):
        assert has_feature(PlanTier.custom, "ai_tools") is True
        assert has_feature(PlanTier.custom, "custom_domain") is True


class TestTierLabels:
    def test_v2_tiers_have_labels(self):
        assert TIER_LABELS[PlanTier.professional] == "Professional"
        assert TIER_LABELS[PlanTier.custom] == "Custom"

    def test_legacy_tiers_still_have_labels(self):
        assert TIER_LABELS[PlanTier.free] == "Free Trial"
        assert TIER_LABELS[PlanTier.pro] == "Pro"

    def test_every_tier_has_a_label(self):
        for tier in PlanTier:
            assert tier in TIER_LABELS, f"Missing label for {tier}"


class TestV2BillingGate:
    """The tier-based filter that protects ICT.ZENSBOT.ONLINE from v2 billing.

    Every v2 billing code path (monthly cron, addon storage extension,
    late-payment enforcement) must consult this gate before touching an
    institute. If this regresses, grandfathered institutes could be
    incorrectly billed or restricted.
    """

    def test_professional_uses_v2_billing(self):
        assert is_v2_billing_tier(PlanTier.professional) is True

    def test_custom_uses_v2_billing(self):
        assert is_v2_billing_tier(PlanTier.custom) is True

    def test_legacy_tiers_are_excluded_from_v2_billing(self):
        # ICT is on 'pro' — this is the single most important assertion.
        assert is_v2_billing_tier(PlanTier.pro) is False
        # All other grandfathered tiers must also be excluded.
        assert is_v2_billing_tier(PlanTier.free) is False
        assert is_v2_billing_tier(PlanTier.starter) is False
        assert is_v2_billing_tier(PlanTier.basic) is False
        assert is_v2_billing_tier(PlanTier.enterprise) is False

    def test_v2_billing_tiers_set_is_exactly_two(self):
        assert V2_BILLING_TIERS == frozenset({PlanTier.professional, PlanTier.custom})


class TestInstituteBillingV2Columns:
    def test_model_has_free_users_included_column(self):
        # Model introspection via SQLModel / SQLAlchemy — the column must
        # exist on the table so migrations pick it up and ORM queries work.
        assert "free_users_included" in InstituteBilling.__table__.columns

    def test_free_users_included_is_not_null(self):
        col = InstituteBilling.__table__.columns["free_users_included"]
        assert col.nullable is False

    def test_free_users_included_python_default_is_zero(self):
        # Python-side default from SQLModel Field(default=0). The matching
        # DB-side server_default='0' lives in the alembic migration (037).
        billing = InstituteBilling(institute_id=__import__("uuid").uuid4())
        assert billing.free_users_included == 0

    def test_model_has_custom_pricing_config_column(self):
        assert "custom_pricing_config" in InstituteBilling.__table__.columns

    def test_custom_pricing_config_is_nullable_jsonb(self):
        col = InstituteBilling.__table__.columns["custom_pricing_config"]
        assert col.nullable is True
        # Type check: postgresql JSONB
        assert col.type.__class__.__name__ == "JSONB"
