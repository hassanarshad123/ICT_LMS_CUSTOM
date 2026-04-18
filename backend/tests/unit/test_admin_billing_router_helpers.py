"""Unit tests for the pure helpers in the admin billing router (PR 4).

The router itself talks to the DB and depends on auth middleware, so its
end-to-end behaviour is covered by integration tests. The helpers below
— ``_addon_to_out`` and ``_addon_catalogue`` — are pure transforms and
can be exercised without spinning up an HTTP server.
"""
import uuid
from datetime import datetime, timezone

from app.models.institute_addon import InstituteAddon
from app.routers.billing import _addon_catalogue, _addon_to_out
from app.schemas.billing import AddonOut, AddonPackOut
from app.utils.plan_limits import ADDON_PRICING


class TestAddonToOut:
    def test_maps_orm_to_schema(self):
        addon = InstituteAddon(
            id=uuid.uuid4(),
            institute_id=uuid.uuid4(),
            addon_type="video_50gb",
            quantity=3,
            unit_price_pkr=3_000,
            storage_bonus_gb=50.0,
            storage_bonus_kind="video",
            activated_at=datetime.now(timezone.utc),
        )
        out = _addon_to_out(addon)
        assert isinstance(out, AddonOut)
        assert out.id == addon.id
        assert out.addon_type == "video_50gb"
        assert out.quantity == 3
        assert out.unit_price_pkr == 3_000

    def test_monthly_total_is_unit_times_quantity(self):
        # Derived convenience field — tells the UI what to show on the
        # "Cancel" button ("Rs 9,000/mo will be removed end of month").
        addon = InstituteAddon(
            id=uuid.uuid4(),
            institute_id=uuid.uuid4(),
            addon_type="video_50gb",
            quantity=3,
            unit_price_pkr=3_000,
            storage_bonus_gb=50.0,
            storage_bonus_kind="video",
            activated_at=datetime.now(timezone.utc),
        )
        out = _addon_to_out(addon)
        assert out.monthly_total_pkr == 9_000

    def test_includes_cancellation_fields(self):
        cancelled_at = datetime.now(timezone.utc)
        addon = InstituteAddon(
            id=uuid.uuid4(),
            institute_id=uuid.uuid4(),
            addon_type="docs_10gb",
            quantity=1,
            unit_price_pkr=1_000,
            storage_bonus_gb=10.0,
            storage_bonus_kind="docs",
            activated_at=datetime.now(timezone.utc),
            cancelled_at=cancelled_at,
            cancelled_effective_at=cancelled_at,
        )
        out = _addon_to_out(addon)
        assert out.cancelled_at == cancelled_at
        assert out.cancelled_effective_at == cancelled_at


class TestAddonCatalogue:
    def test_returns_every_addon_in_pricing_table(self):
        catalogue = _addon_catalogue()
        assert len(catalogue) == len(ADDON_PRICING)
        exposed_types = {pack.addon_type for pack in catalogue}
        assert exposed_types == set(ADDON_PRICING.keys())

    def test_each_pack_has_matching_price(self):
        for pack in _addon_catalogue():
            assert isinstance(pack, AddonPackOut)
            expected = ADDON_PRICING[pack.addon_type]
            assert pack.price_pkr == expected["price_pkr"]
            assert pack.bonus_gb == expected["bonus_gb"]
            assert pack.kind == expected["kind"]

    def test_video_50gb_pack_exists(self):
        # Smoke test — the "Rs 3,000 / 50 GB video" pack is the most
        # commonly-activated one per the spec. Must always be offered.
        catalogue = _addon_catalogue()
        vid = next((p for p in catalogue if p.addon_type == "video_50gb"), None)
        assert vid is not None
        assert vid.price_pkr == 3_000
        assert vid.bonus_gb == 50.0
        assert vid.kind == "video"
