"""Unit tests for unlimited-tier null-safe quota enforcement.

Exercises the null-handling guards added in Phase 2 so unlimited-tier
institutes (NULL max_* columns) don't crash quota checks or invoice
line-item calculation.

No DB required — mocks AsyncSession + Institute via dataclasses.
"""
from __future__ import annotations

import asyncio
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.institute import PlanTier  # noqa: E402
from app.services.institute_service import (  # noqa: E402
    _effective_storage_limit_gb,
)


# ──────────────────────────────────────────────────────────────────
# Fakes
# ──────────────────────────────────────────────────────────────────

@dataclass
class _FakeInstitute:
    plan_tier: PlanTier
    id: Any = "00000000-0000-0000-0000-000000000001"
    max_users: int | None = 100
    max_students: int | None = 50
    max_storage_gb: float | None = 10.0
    max_video_gb: float | None = 50.0
    deleted_at: Any = None
    name: str = "Fake Inst"
    contact_email: str = "x@y.z"


class _FakeSession:
    """Minimal stand-in that satisfies the call surface used by the
    helpers under test. `.execute()` is not called by
    ``_effective_storage_limit_gb`` in the non-v2 path."""

    def __init__(self) -> None:
        self.added: list = []

    def add(self, obj) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        return None


# ──────────────────────────────────────────────────────────────────
# _effective_storage_limit_gb
# ──────────────────────────────────────────────────────────────────

def test_effective_storage_limit_returns_none_for_unlimited_docs():
    """Unlimited tier with NULL max_storage_gb → None (no enforcement)."""
    inst = _FakeInstitute(
        plan_tier=PlanTier.unlimited,
        max_storage_gb=None,
        max_video_gb=None,
    )
    result = asyncio.run(
        _effective_storage_limit_gb(_FakeSession(), inst, "docs")
    )
    assert result is None


def test_effective_storage_limit_returns_none_for_unlimited_video():
    inst = _FakeInstitute(
        plan_tier=PlanTier.unlimited,
        max_storage_gb=None,
        max_video_gb=None,
    )
    result = asyncio.run(
        _effective_storage_limit_gb(_FakeSession(), inst, "video")
    )
    assert result is None


def test_effective_storage_limit_returns_base_for_legacy_tier():
    """Legacy 'pro' institute: returns the raw max_storage_gb with
    no addon lookup (ICT-protection invariant)."""
    inst = _FakeInstitute(
        plan_tier=PlanTier.pro,
        max_storage_gb=50.0,
        max_video_gb=300.0,
    )
    docs = asyncio.run(
        _effective_storage_limit_gb(_FakeSession(), inst, "docs")
    )
    video = asyncio.run(
        _effective_storage_limit_gb(_FakeSession(), inst, "video")
    )
    assert docs == 50.0
    assert video == 300.0


def test_effective_storage_limit_rejects_unknown_kind():
    inst = _FakeInstitute(plan_tier=PlanTier.free)
    try:
        asyncio.run(
            _effective_storage_limit_gb(_FakeSession(), inst, "garbage")
        )
    except ValueError as e:
        assert "unknown storage kind" in str(e).lower()
        return
    raise AssertionError("Expected ValueError for unknown kind")


# ──────────────────────────────────────────────────────────────────
# _auto_calculate_line_items — tested via pure-logic branches.
# Full DB-backed coverage lives in integration_test.py.
# ──────────────────────────────────────────────────────────────────

def test_auto_line_items_unlimited_produces_no_overage_lines():
    """Mock out the SQL + billing fetch so we only exercise the
    null-cap branches added in Phase 2. The institute has null
    caps (unlimited) and high usage — we expect zero overage
    lines, only the base fee (if configured)."""
    from app.services import sa_billing_service as svc
    from types import SimpleNamespace

    inst = _FakeInstitute(
        plan_tier=PlanTier.unlimited,
        max_users=None, max_students=None,
        max_storage_gb=None, max_video_gb=None,
    )
    billing = SimpleNamespace(
        base_amount=5000,
        billing_cycle="monthly",
        extra_user_rate=80,
        extra_storage_rate=100,
        extra_video_rate=50,
    )

    class _FakeResult:
        def one_or_none(self):
            # current_users, current_storage_bytes, current_video_bytes
            return (999, 10 * 1024**3, 500 * 1024**3)

    class _FakeSessionWithExec(_FakeSession):
        async def execute(self, stmt, params=None):
            return _FakeResult()

        async def get(self, model, pk):
            return inst

    # Swap get_or_create_billing to avoid its DB path.
    original = svc.get_or_create_billing

    async def _fake_get_or_create_billing(session, institute_id):
        return billing

    svc.get_or_create_billing = _fake_get_or_create_billing
    try:
        line_items, out_inst, out_billing = asyncio.run(
            svc._auto_calculate_line_items(
                _FakeSessionWithExec(), inst.id,
            )
        )
    finally:
        svc.get_or_create_billing = original

    # Only the base fee should be present — no overage lines.
    assert len(line_items) == 1
    assert line_items[0]["amount"] == 5000
    assert "Base plan fee" in line_items[0]["description"]


def test_auto_line_items_legacy_tier_still_bills_overage():
    """Legacy tier with a concrete max_users cap and overage usage:
    overage lines DO appear. Regression guard for Phase 2 not
    accidentally suppressing legacy billing."""
    from app.services import sa_billing_service as svc
    from types import SimpleNamespace

    inst = _FakeInstitute(
        plan_tier=PlanTier.pro,
        max_users=100, max_students=1000,
        max_storage_gb=50.0, max_video_gb=300.0,
    )
    billing = SimpleNamespace(
        base_amount=15000,
        billing_cycle="monthly",
        extra_user_rate=200,
        extra_storage_rate=100,
        extra_video_rate=50,
    )

    class _FakeResult:
        def one_or_none(self):
            # 120 users → 20 over cap; storage + video within.
            return (120, 10 * 1024**3, 100 * 1024**3)

    class _FakeSessionWithExec(_FakeSession):
        async def execute(self, stmt, params=None):
            return _FakeResult()

        async def get(self, model, pk):
            return inst

    original = svc.get_or_create_billing

    async def _fake_get_or_create_billing(session, institute_id):
        return billing

    svc.get_or_create_billing = _fake_get_or_create_billing
    try:
        line_items, _, _ = asyncio.run(
            svc._auto_calculate_line_items(
                _FakeSessionWithExec(), inst.id,
            )
        )
    finally:
        svc.get_or_create_billing = original

    # Base fee + 1 overage line for extra users. Storage/video are
    # within cap so no extra lines there.
    assert len(line_items) == 2
    codes = [li["description"] for li in line_items]
    assert any("Base plan fee" in c for c in codes)
    assert any("Extra users" in c for c in codes)


# ──────────────────────────────────────────────────────────────────
# get_billing_config — 404 instead of silent "Unknown".
# ──────────────────────────────────────────────────────────────────

def test_get_billing_config_raises_on_missing_institute():
    from app.services import sa_billing_service as svc

    class _FakeSessionNotFound(_FakeSession):
        async def get(self, model, pk):
            return None

    try:
        asyncio.run(
            svc.get_billing_config(
                _FakeSessionNotFound(),
                "00000000-0000-0000-0000-000000000001",
            )
        )
    except ValueError as e:
        assert "not found" in str(e).lower()
        return
    raise AssertionError("Expected ValueError when institute missing")


def test_get_billing_config_raises_on_soft_deleted_institute():
    from app.services import sa_billing_service as svc
    from datetime import datetime, timezone

    inst = _FakeInstitute(
        plan_tier=PlanTier.pro,
        deleted_at=datetime.now(timezone.utc),
    )

    class _FakeSessionDeleted(_FakeSession):
        async def get(self, model, pk):
            return inst

    try:
        asyncio.run(
            svc.get_billing_config(
                _FakeSessionDeleted(),
                "00000000-0000-0000-0000-000000000001",
            )
        )
    except ValueError as e:
        assert "not found" in str(e).lower()
        return
    raise AssertionError("Expected ValueError for soft-deleted institute")
