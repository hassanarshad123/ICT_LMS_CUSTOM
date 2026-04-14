"""Unit tests for the fee.* webhook events added in Phase 1.

Checks the event catalog — a missing event here means institutes can't
subscribe to it, which breaks the Frappe integration. Also verifies the
enqueue_from_event fan-out is wired into webhook_event_service.
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.webhook_service import ALLOWED_WEBHOOK_EVENTS


REQUIRED_FEE_EVENTS = [
    "fee.plan_created",
    "fee.payment_recorded",
    "fee.installment_overdue",
    "fee.plan_cancelled",
    "fee.plan_completed",
]


class TestFeeEventCatalog:
    @pytest.mark.parametrize("event", REQUIRED_FEE_EVENTS)
    def test_event_registered(self, event: str):
        assert event in ALLOWED_WEBHOOK_EVENTS, (
            f"Fee event {event!r} missing from ALLOWED_WEBHOOK_EVENTS — "
            f"Frappe integration depends on these"
        )

    def test_no_accidental_dedup(self):
        # Regression guard: duplicates would create double-delivery
        assert len(ALLOWED_WEBHOOK_EVENTS) == len(set(ALLOWED_WEBHOOK_EVENTS))


class TestExistingEventsPreserved:
    """Phase 1 was meant to be purely additive. If any of these are missing,
    we've broken backward compat with existing webhook subscribers.
    """

    @pytest.mark.parametrize("event", [
        "user.created",
        "user.updated",
        "enrollment.created",
        "certificate.issued",
        "class.scheduled",
        "attendance.recorded",
    ])
    def test_pre_phase_1_event_still_present(self, event: str):
        assert event in ALLOWED_WEBHOOK_EVENTS


class TestWebhookFanOutToFrappe:
    """webhook_event_service.queue_webhook_event is the single fan-out point.
    It must ALSO enqueue Frappe sync tasks for fee.* events when the
    integration is enabled.
    """

    @pytest.mark.asyncio
    async def test_queue_calls_frappe_enqueue(self, monkeypatch):
        from app.services import webhook_event_service

        session = AsyncMock()
        session.add = MagicMock()
        session.flush = AsyncMock()
        session.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))))

        enqueue_mock = AsyncMock()
        # The import lives inside the function; patch at the sync service layer
        from app.services import frappe_sync_service
        monkeypatch.setattr(frappe_sync_service, "enqueue_from_event", enqueue_mock)

        await webhook_event_service.queue_webhook_event(
            session, uuid.uuid4(), "fee.plan_created", {"fee_plan_id": "x"},
        )
        enqueue_mock.assert_called_once()

    @pytest.mark.asyncio
    async def test_frappe_enqueue_failure_does_not_break_webhook_delivery(
        self, monkeypatch
    ):
        """Critical: a broken Frappe sync must not stop customer webhooks from
        firing. Any exception from enqueue_from_event must be swallowed.
        """
        from app.services import webhook_event_service

        session = AsyncMock()
        session.add = MagicMock()
        session.flush = AsyncMock()
        session.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))))

        from app.services import frappe_sync_service

        async def _boom(*args, **kwargs):
            raise RuntimeError("simulated Frappe enqueue crash")

        monkeypatch.setattr(frappe_sync_service, "enqueue_from_event", _boom)

        # Must NOT raise
        await webhook_event_service.queue_webhook_event(
            session, uuid.uuid4(), "fee.payment_recorded", {"payment_id": "x"},
        )
        # Flush still called — existing webhook delivery path unaffected
        session.flush.assert_called_once()
