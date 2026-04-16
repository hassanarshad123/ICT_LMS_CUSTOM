"""Unit tests for the billing_restriction middleware gate (PR 3).

THIS IS AN ICT-SAFETY TEST.

``check_billing_restriction`` is the middleware helper that blocks writes
on overdue v2-tier institutes. It MUST be a no-op for every grandfathered
tier (pro, free, starter, basic, enterprise), for all HTTP methods,
regardless of what value institute.billing_restriction might hold.

Even though grandfathered institutes will always have
billing_restriction=NULL in practice (the late-payment cron never touches
them), this test intentionally sets the flag to verify the tier gate
fires BEFORE any restriction logic is evaluated.
"""
import uuid
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.middleware.access_control import check_billing_restriction
from app.models.institute import Institute, InstituteStatus, PlanTier


def _make_institute(
    tier: PlanTier, billing_restriction: str | None = None,
) -> Institute:
    return Institute(
        id=uuid.uuid4(),
        name=f"I-{tier.value}",
        slug=f"i-{tier.value}",
        status=InstituteStatus.active,
        plan_tier=tier,
        max_users=100,
        max_students=100,
        max_storage_gb=10.0,
        max_video_gb=50.0,
        contact_email="a@b.com",
        billing_restriction=billing_restriction,
    )


class TestGrandfatheredTiersNeverBlocked:
    """ICT and all legacy tiers pass through even with a restriction flag set."""

    @pytest.mark.parametrize("tier", [
        PlanTier.pro,        # ICT — most important
        PlanTier.free,
        PlanTier.starter,
        PlanTier.basic,
        PlanTier.enterprise,
    ])
    @pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE", "GET"])
    @pytest.mark.parametrize("restriction", [None, "add_blocked", "read_only"])
    def test_all_grandfathered_tiers_never_blocked(self, tier, method, restriction):
        # Even with a restriction flag erroneously set (defense in depth),
        # grandfathered tiers are ALWAYS allowed.
        inst = _make_institute(tier, billing_restriction=restriction)
        check_billing_restriction(
            inst, method, is_student_add=True, is_upload=True,
        )
        # No exception raised = pass.


class TestV2TierNoRestrictionPassesThrough:
    @pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE", "GET"])
    def test_professional_with_null_restriction(self, method):
        inst = _make_institute(PlanTier.professional, billing_restriction=None)
        check_billing_restriction(inst, method, is_student_add=True, is_upload=True)

    @pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE", "GET"])
    def test_custom_with_null_restriction(self, method):
        inst = _make_institute(PlanTier.custom, billing_restriction=None)
        check_billing_restriction(inst, method, is_student_add=True, is_upload=True)


class TestV2TierAddBlocked:
    def test_student_add_is_blocked(self):
        inst = _make_institute(PlanTier.professional, billing_restriction="add_blocked")
        with pytest.raises(HTTPException) as exc:
            check_billing_restriction(inst, "POST", is_student_add=True)
        assert exc.value.status_code == 402
        assert exc.value.detail["code"] == "billing_add_blocked"

    def test_upload_is_blocked(self):
        inst = _make_institute(PlanTier.professional, billing_restriction="add_blocked")
        with pytest.raises(HTTPException) as exc:
            check_billing_restriction(inst, "POST", is_upload=True)
        assert exc.value.status_code == 402

    def test_other_writes_allowed(self):
        # Day 15 restriction blocks student-adds + uploads only. Other writes OK.
        inst = _make_institute(PlanTier.professional, billing_restriction="add_blocked")
        check_billing_restriction(inst, "POST", is_student_add=False, is_upload=False)
        check_billing_restriction(inst, "PATCH", is_student_add=False, is_upload=False)
        check_billing_restriction(inst, "DELETE", is_student_add=False, is_upload=False)

    def test_reads_always_allowed(self):
        inst = _make_institute(PlanTier.professional, billing_restriction="add_blocked")
        check_billing_restriction(inst, "GET", is_student_add=True, is_upload=True)


class TestV2TierReadOnly:
    @pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
    def test_all_writes_blocked(self, method):
        inst = _make_institute(PlanTier.professional, billing_restriction="read_only")
        with pytest.raises(HTTPException) as exc:
            check_billing_restriction(inst, method)
        assert exc.value.status_code == 402
        assert exc.value.detail["code"] == "billing_read_only"

    def test_reads_still_allowed(self):
        inst = _make_institute(PlanTier.professional, billing_restriction="read_only")
        check_billing_restriction(inst, "GET")
        check_billing_restriction(inst, "HEAD")
        check_billing_restriction(inst, "OPTIONS")
