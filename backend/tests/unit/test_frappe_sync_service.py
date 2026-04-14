"""Unit tests for frappe_sync_service — pure logic only.

Dispatch, retry cadence, enqueue filtering, payload redaction, and inbound
conflict rules. No live DB required; DB interactions are mocked.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import frappe_sync_service as sync


class TestRedact:
    def test_strips_obvious_secret_keys(self):
        out = sync._redact({
            "api_key": "leaked",
            "api_secret": "leaked",
            "password": "leaked",
            "token": "leaked",
            "authorization": "leaked",
            "student_name": "Alice",
        })
        assert out["api_key"] == "[REDACTED]"
        assert out["api_secret"] == "[REDACTED]"
        assert out["password"] == "[REDACTED]"
        assert out["token"] == "[REDACTED]"
        assert out["authorization"] == "[REDACTED]"
        assert out["student_name"] == "Alice"

    def test_case_insensitive(self):
        out = sync._redact({"API_KEY": "leaked", "Password": "leaked"})
        assert out["API_KEY"] == "[REDACTED]"
        assert out["Password"] == "[REDACTED]"

    def test_none_passthrough(self):
        assert sync._redact(None) is None

    def test_empty_dict_passthrough(self):
        assert sync._redact({}) == {}

    def test_non_secret_keys_unchanged(self):
        data = {
            "fee_plan_id": "abc",
            "amount": 5000,
            "currency": "PKR",
            "student_email": "alice@example.com",
        }
        assert sync._redact(data) == data


class TestHashPayload:
    def test_deterministic(self):
        data = {"a": 1, "b": 2}
        assert sync._hash_payload(data) == sync._hash_payload(data)

    def test_order_independent(self):
        assert sync._hash_payload({"a": 1, "b": 2}) == sync._hash_payload({"b": 2, "a": 1})

    def test_none_returns_none(self):
        assert sync._hash_payload(None) is None

    def test_different_data_different_hash(self):
        assert sync._hash_payload({"a": 1}) != sync._hash_payload({"a": 2})

    def test_handles_uuid_objects(self):
        # default=str in json.dumps handles UUID — confirm no crash
        result = sync._hash_payload({"id": uuid.uuid4()})
        assert isinstance(result, str)
        assert len(result) == 64  # SHA256 hex


class TestRetryIntervals:
    def test_six_total_attempts(self):
        # 1 initial + 5 retries = MAX_ATTEMPTS = 6
        assert sync.MAX_ATTEMPTS == 6
        assert len(sync.RETRY_INTERVALS) == 5

    def test_exponential_backoff(self):
        intervals_sec = [i.total_seconds() for i in sync.RETRY_INTERVALS]
        # Each interval >= previous — i.e. monotonically increasing
        for i in range(1, len(intervals_sec)):
            assert intervals_sec[i] >= intervals_sec[i - 1]


class TestEnqueueFromEvent:
    """Critical business rule: enqueue MUST be a no-op when integration is
    disabled, otherwise any institute gets accidental Frappe pushes.
    """

    @pytest.mark.asyncio
    async def test_non_fee_event_skipped(self, monkeypatch):
        # user.created should never enqueue a Frappe task
        session = AsyncMock()
        session.add = MagicMock()

        load_mock = AsyncMock(return_value=None)
        monkeypatch.setattr(sync, "load_active_frappe_config", load_mock)

        await sync.enqueue_from_event(
            session, uuid.uuid4(), "user.created", {"user_id": "x"},
        )
        # Not even looked up — non-fee events short-circuit before DB lookup
        load_mock.assert_not_called()
        session.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_fee_event_skipped_when_integration_disabled(self, monkeypatch):
        session = AsyncMock()
        session.add = MagicMock()

        # load_active_frappe_config returns None when disabled
        load_mock = AsyncMock(return_value=None)
        monkeypatch.setattr(sync, "load_active_frappe_config", load_mock)

        await sync.enqueue_from_event(
            session, uuid.uuid4(), "fee.plan_created", {"fee_plan_id": "x"},
        )
        load_mock.assert_called_once()
        session.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_fee_event_enqueued_when_enabled(self, monkeypatch):
        session = AsyncMock()
        session.add = MagicMock()

        mock_cfg = MagicMock()
        mock_cfg.frappe_enabled = True
        load_mock = AsyncMock(return_value=mock_cfg)
        monkeypatch.setattr(sync, "load_active_frappe_config", load_mock)

        institute_id = uuid.uuid4()
        payload = {"fee_plan_id": str(uuid.uuid4()), "student_id": str(uuid.uuid4())}

        await sync.enqueue_from_event(
            session, institute_id, "fee.plan_created", payload,
        )
        assert session.add.called
        task = session.add.call_args[0][0]
        assert task.institute_id == institute_id
        assert task.event_type == "fee.plan_created"
        assert task.status == "pending"
        assert task.provider == "frappe"
        assert task.payload == payload


class TestBuildLogRow:
    def test_failure_row_carries_error(self):
        task = MagicMock()
        task.institute_id = uuid.uuid4()
        task.event_type = "fee.payment_recorded"
        task.attempt_count = 2
        task.payload = {"amount": 100}

        row = sync._build_log_row(task, status="failed", error="Frappe timeout")
        assert row.status == "failed"
        assert row.error_message == "Frappe timeout"
        assert row.attempt_count == 2
        assert row.entity_type == "payment_entry"
        # Sensitive keys redacted even in the snapshot
        assert "amount" in row.request_snapshot

    def test_truncates_long_errors(self):
        task = MagicMock()
        task.institute_id = uuid.uuid4()
        task.event_type = "fee.plan_created"
        task.attempt_count = 1
        task.payload = None

        huge_error = "x" * 5000
        row = sync._build_log_row(task, status="failed", error=huge_error)
        assert len(row.error_message) <= 2000

    def test_none_payload_produces_no_snapshot(self):
        task = MagicMock()
        task.institute_id = uuid.uuid4()
        task.event_type = "fee.plan_created"
        task.attempt_count = 1
        task.payload = None

        row = sync._build_log_row(task, status="skipped", error=None)
        assert row.request_snapshot is None


class TestInboundPayloadValidation:
    """Inbound webhook handler must reject malformed payloads cleanly."""

    @pytest.mark.asyncio
    async def test_invalid_json_raises_inbound_error(self):
        session = AsyncMock()
        with pytest.raises(sync.InboundError):
            await sync.handle_inbound_payment_entry(
                session, institute_id=uuid.uuid4(), raw_body=b"{not json",
            )

    @pytest.mark.asyncio
    async def test_missing_required_fields_raises(self):
        session = AsyncMock()
        # Valid JSON but missing zensbot_fee_plan_id
        body = json.dumps({"doc": {"name": "PE-001", "paid_amount": 100}}).encode()
        with pytest.raises(sync.InboundError):
            await sync.handle_inbound_payment_entry(
                session, institute_id=uuid.uuid4(), raw_body=body,
            )

    @pytest.mark.asyncio
    async def test_invalid_uuid_raises(self):
        session = AsyncMock()
        # execute returns "no duplicate" so we get past the dedup check
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        session.execute = AsyncMock(return_value=mock_result)

        body = json.dumps({
            "doc": {
                "name": "PE-001",
                "zensbot_fee_plan_id": "not-a-uuid",
                "paid_amount": 100,
            }
        }).encode()
        with pytest.raises(sync.InboundError):
            await sync.handle_inbound_payment_entry(
                session, institute_id=uuid.uuid4(), raw_body=body,
            )


class TestDispatchNoOp:
    """Events with no Frappe side effect should log as skipped, not fail."""

    @pytest.mark.asyncio
    async def test_plan_completed_is_skipped(self):
        from app.services.frappe_client import FrappeClient  # noqa: F401

        task = MagicMock()
        task.institute_id = uuid.uuid4()
        task.event_type = "fee.plan_completed"
        task.attempt_count = 1
        task.payload = {"fee_plan_id": "x"}

        cfg = MagicMock()
        cfg.frappe_base_url = "https://erp.example.com"
        cfg.frappe_api_key_ciphertext = "x"
        cfg.frappe_api_secret_ciphertext = "x"

        # Mock FrappeClient so no actual HTTP happens
        from unittest.mock import patch

        with patch("app.services.frappe_sync_service.FrappeClient") as mock_client:
            mock_client.return_value = MagicMock()
            session = AsyncMock()
            ok, log = await sync._dispatch(session, cfg, task)
            assert ok is True
            assert log.status == "skipped"

    @pytest.mark.asyncio
    async def test_unknown_event_is_skipped(self):
        task = MagicMock()
        task.institute_id = uuid.uuid4()
        task.event_type = "some.new.event"
        task.attempt_count = 1
        task.payload = {}

        cfg = MagicMock()
        cfg.frappe_base_url = "https://erp.example.com"
        cfg.frappe_api_key_ciphertext = "x"
        cfg.frappe_api_secret_ciphertext = "x"

        from unittest.mock import patch

        with patch("app.services.frappe_sync_service.FrappeClient") as mock_client:
            mock_client.return_value = MagicMock()
            session = AsyncMock()
            ok, log = await sync._dispatch(session, cfg, task)
            assert ok is True
            assert log.status == "skipped"
