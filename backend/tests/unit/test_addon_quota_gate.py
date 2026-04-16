"""Unit tests for the addon-aware storage quota gate (PR 2).

THIS IS THE CRITICAL ICT-SAFETY TEST.

institute_service._effective_storage_limit_gb extends the base storage
cap with active addon bonuses ONLY for v2 billing tiers. Grandfathered
institutes (especially ICT on 'pro') must return the bare max_*_gb
value without touching the institute_addons table at all.

If any regression here lets addon lookups run for grandfathered tiers,
it would:
  * Perform an unnecessary DB round-trip on every upload (perf regression).
  * Potentially grant ICT unintended capacity if a stray row existed.
  * Break the v2-tier isolation promise.

These tests use mocks so they run without a real database.
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.models.institute import Institute, PlanTier, InstituteStatus
from app.services.institute_service import _effective_storage_limit_gb


def _make_institute(tier: PlanTier, max_storage_gb=10.0, max_video_gb=50.0) -> Institute:
    """Construct a plausible Institute record (not persisted)."""
    return Institute(
        id=uuid4(),
        name=f"Test-{tier.value}",
        slug=f"test-{tier.value}",
        status=InstituteStatus.active,
        plan_tier=tier,
        max_users=100,
        max_students=100,
        max_storage_gb=max_storage_gb,
        max_video_gb=max_video_gb,
        contact_email="t@example.com",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


class TestGrandfatheredTiersSkipAddonLookup:
    """For every grandfathered tier, the addon service must NOT be called."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("tier", [
        PlanTier.pro,         # ICT — most important
        PlanTier.free,
        PlanTier.starter,
        PlanTier.basic,
        PlanTier.enterprise,
    ])
    async def test_docs_kind_does_not_call_addon_service(self, tier):
        institute = _make_institute(tier, max_storage_gb=50.0)
        session = AsyncMock()
        with patch(
            "app.services.addon_service.get_addon_storage_bonus",
            new=AsyncMock(return_value=(999.0, 999.0)),
        ) as mock_bonus:
            result = await _effective_storage_limit_gb(session, institute, "docs")

        mock_bonus.assert_not_called()
        # Bare base only — even though the mocked bonus would have been huge.
        assert result == 50.0

    @pytest.mark.asyncio
    @pytest.mark.parametrize("tier", [
        PlanTier.pro, PlanTier.free, PlanTier.starter,
        PlanTier.basic, PlanTier.enterprise,
    ])
    async def test_video_kind_does_not_call_addon_service(self, tier):
        institute = _make_institute(tier, max_video_gb=300.0)
        session = AsyncMock()
        with patch(
            "app.services.addon_service.get_addon_storage_bonus",
            new=AsyncMock(return_value=(999.0, 999.0)),
        ) as mock_bonus:
            result = await _effective_storage_limit_gb(session, institute, "video")

        mock_bonus.assert_not_called()
        assert result == 300.0


class TestV2TiersGetAddonBonus:
    """Professional and Custom DO query the addon service."""

    @pytest.mark.asyncio
    async def test_professional_docs_adds_docs_bonus(self):
        institute = _make_institute(PlanTier.professional, max_storage_gb=10.0)
        session = AsyncMock()
        with patch(
            "app.services.addon_service.get_addon_storage_bonus",
            new=AsyncMock(return_value=(20.0, 100.0)),
        ) as mock_bonus:
            result = await _effective_storage_limit_gb(session, institute, "docs")
        mock_bonus.assert_called_once()
        # Base 10 GB + 20 GB docs bonus = 30 GB. Video bonus ignored.
        assert result == 30.0

    @pytest.mark.asyncio
    async def test_professional_video_adds_video_bonus(self):
        institute = _make_institute(PlanTier.professional, max_video_gb=50.0)
        session = AsyncMock()
        with patch(
            "app.services.addon_service.get_addon_storage_bonus",
            new=AsyncMock(return_value=(20.0, 100.0)),
        ):
            result = await _effective_storage_limit_gb(session, institute, "video")
        # Base 50 + 100 video bonus = 150 GB. Docs bonus ignored.
        assert result == 150.0

    @pytest.mark.asyncio
    async def test_custom_tier_also_reads_addons(self):
        institute = _make_institute(PlanTier.custom, max_storage_gb=0.0)
        session = AsyncMock()
        with patch(
            "app.services.addon_service.get_addon_storage_bonus",
            new=AsyncMock(return_value=(50.0, 0.0)),
        ) as mock_bonus:
            result = await _effective_storage_limit_gb(session, institute, "docs")
        mock_bonus.assert_called_once()
        assert result == 50.0

    @pytest.mark.asyncio
    async def test_v2_tier_with_zero_addons_returns_base(self):
        institute = _make_institute(PlanTier.professional, max_storage_gb=10.0)
        session = AsyncMock()
        with patch(
            "app.services.addon_service.get_addon_storage_bonus",
            new=AsyncMock(return_value=(0.0, 0.0)),
        ):
            result = await _effective_storage_limit_gb(session, institute, "docs")
        assert result == 10.0


class TestInvalidKind:
    @pytest.mark.asyncio
    async def test_unknown_kind_raises(self):
        institute = _make_institute(PlanTier.professional)
        session = AsyncMock()
        with pytest.raises(ValueError, match="Unknown storage kind"):
            await _effective_storage_limit_gb(session, institute, "magic")
