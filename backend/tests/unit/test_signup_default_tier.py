"""Unit tests for the pricing-v2 signup tier flip (PR 4).

Tests the pure helpers in ``app.services.signup_service`` that translate
the ``SIGNUP_DEFAULT_TIER`` env value into Institute kwargs + an
InstituteBilling row. These helpers run before any DB writes, so they
can be tested without a live database.

ICT safety: the helpers must not accidentally activate v2-billing
semantics for a grandfathered tier. Trial tiers must keep their 14-day
expiry. Professional signups must produce a usable InstituteBilling row.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.models.billing import InstituteBilling
from app.models.institute import InstituteStatus, PlanTier
from app.services.signup_service import (
    _PROFESSIONAL_EXTRA_USER_RATE_PKR,
    _PROFESSIONAL_FREE_USERS_INCLUDED,
    _UNLIMITED_SENTINEL_INT,
    _initial_billing_for_tier,
    _institute_kwargs_for_tier,
    _resolve_signup_tier,
)


class TestResolveSignupTier:
    def test_valid_professional(self):
        assert _resolve_signup_tier("professional") is PlanTier.professional

    def test_valid_custom(self):
        assert _resolve_signup_tier("custom") is PlanTier.custom

    def test_legacy_free_still_works(self):
        # Rollback safety: setting SIGNUP_DEFAULT_TIER=free must re-enter
        # the legacy trial flow exactly as before.
        assert _resolve_signup_tier("free") is PlanTier.free

    def test_unknown_tier_falls_back_to_free(self):
        # A typo in the env var must not break signups — fall back silently.
        assert _resolve_signup_tier("Premium") is PlanTier.free
        assert _resolve_signup_tier("") is PlanTier.free
        assert _resolve_signup_tier("NULL") is PlanTier.free


class TestInstituteKwargsForProfessional:
    def test_status_is_active_not_trial(self):
        kw = _institute_kwargs_for_tier(PlanTier.professional)
        assert kw["status"] is InstituteStatus.active

    def test_expires_at_is_none(self):
        # Free forever — no auto-suspend, no 14-day clock.
        kw = _institute_kwargs_for_tier(PlanTier.professional)
        assert kw["expires_at"] is None

    def test_plan_tier_matches(self):
        kw = _institute_kwargs_for_tier(PlanTier.professional)
        assert kw["plan_tier"] is PlanTier.professional

    def test_max_students_is_soft_unlimited(self):
        # Hard cap replaced by overage billing (Rs 80/student). Setting a
        # huge sentinel keeps the quota helper happy without introducing
        # nullable plumbing.
        kw = _institute_kwargs_for_tier(PlanTier.professional)
        assert kw["max_students"] == _UNLIMITED_SENTINEL_INT

    def test_storage_matches_plan_limits(self):
        # Base = 10 GB docs, 50 GB video (add-ons extend these separately).
        kw = _institute_kwargs_for_tier(PlanTier.professional)
        assert kw["max_storage_gb"] == 10.0
        assert kw["max_video_gb"] == 50.0

    def test_max_users_is_soft_unlimited(self):
        kw = _institute_kwargs_for_tier(PlanTier.professional)
        assert kw["max_users"] == _UNLIMITED_SENTINEL_INT


class TestInstituteKwargsForCustom:
    def test_status_is_active(self):
        kw = _institute_kwargs_for_tier(PlanTier.custom)
        assert kw["status"] is InstituteStatus.active

    def test_all_caps_are_soft_unlimited(self):
        # Custom has no caps in PLAN_LIMITS — helper must substitute the
        # sentinel for both storage dimensions and max_students.
        kw = _institute_kwargs_for_tier(PlanTier.custom)
        assert kw["max_students"] == _UNLIMITED_SENTINEL_INT
        assert kw["max_storage_gb"] == float(_UNLIMITED_SENTINEL_INT)
        assert kw["max_video_gb"] == float(_UNLIMITED_SENTINEL_INT)


class TestInstituteKwargsForLegacyTrial:
    """Regression guard: SIGNUP_DEFAULT_TIER=free must behave as before."""

    def test_status_is_trial(self):
        kw = _institute_kwargs_for_tier(PlanTier.free)
        assert kw["status"] is InstituteStatus.trial

    def test_expires_at_is_set(self):
        kw = _institute_kwargs_for_tier(PlanTier.free)
        assert kw["expires_at"] is not None
        assert isinstance(kw["expires_at"], datetime)
        # Expiry is in the future (trial starts counting now).
        assert kw["expires_at"] > datetime.now(timezone.utc)

    def test_hard_caps_from_plan_limits(self):
        # Trial: 15 students, 1 GB docs, 3 GB video. These are the exact
        # values ICT dashboards and fee logic have been tested against.
        kw = _institute_kwargs_for_tier(PlanTier.free)
        assert kw["max_students"] == 15
        assert kw["max_storage_gb"] == 1.0
        assert kw["max_video_gb"] == 3.0


class TestInitialBillingForTier:
    def test_professional_gets_standard_row(self):
        import uuid
        billing = _initial_billing_for_tier(uuid.uuid4(), PlanTier.professional)
        assert isinstance(billing, InstituteBilling)
        assert billing.base_amount == 0
        assert billing.currency == "PKR"
        assert billing.billing_cycle == "monthly"
        assert billing.extra_user_rate == _PROFESSIONAL_EXTRA_USER_RATE_PKR
        assert billing.free_users_included == _PROFESSIONAL_FREE_USERS_INCLUDED

    def test_custom_gets_zero_rate_pending_sa_quote(self):
        # SA fills in extra_user_rate + custom_pricing_config post-signup.
        # Default to 0 so nothing is accidentally billed before the deal
        # is finalised.
        import uuid
        billing = _initial_billing_for_tier(uuid.uuid4(), PlanTier.custom)
        assert isinstance(billing, InstituteBilling)
        assert billing.extra_user_rate == 0
        assert billing.free_users_included == 0

    def test_free_tier_returns_none(self):
        # Legacy trial has no v2 billing row — the monthly cron filters
        # to v2 tiers only, so an InstituteBilling row would be dead data.
        import uuid
        billing = _initial_billing_for_tier(uuid.uuid4(), PlanTier.free)
        assert billing is None

    def test_grandfathered_pro_returns_none(self):
        # ICT safety: if someone hand-runs signup with SIGNUP_DEFAULT_TIER=pro
        # (unlikely, but defensive), no v2 billing row is created.
        import uuid
        billing = _initial_billing_for_tier(uuid.uuid4(), PlanTier.pro)
        assert billing is None

    def test_grandfathered_enterprise_returns_none(self):
        import uuid
        for tier in (PlanTier.starter, PlanTier.basic, PlanTier.enterprise):
            billing = _initial_billing_for_tier(uuid.uuid4(), tier)
            assert billing is None, f"unexpected billing row for {tier.value}"
