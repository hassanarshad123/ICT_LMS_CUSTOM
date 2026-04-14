"""Unit tests for the integration schemas + service (Phase 2 of Frappe sync).

Focus: pure logic — URL/SSRF validation, enable-gate guards, serialization.
DB-touching paths are covered by the E2E smoke test and the pilot rollout.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from app.schemas.integration import (
    FrappeConfigIn,
    FrappeConfigOut,
    SyncLogItem,
    SyncLogKPIs,
)


class TestFrappeUrlValidation:
    """The URL guard is the first line of SSRF defense. These must never regress."""

    def test_https_url_accepted(self):
        cfg = FrappeConfigIn(frappe_base_url="https://erp.example.com")
        assert cfg.frappe_base_url == "https://erp.example.com"

    def test_trailing_slash_stripped(self):
        cfg = FrappeConfigIn(frappe_base_url="https://erp.example.com/")
        assert cfg.frappe_base_url == "https://erp.example.com"

    def test_plaintext_http_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            FrappeConfigIn(frappe_base_url="http://erp.example.com")
        assert "https" in str(exc_info.value).lower()

    def test_localhost_allowed_for_dev(self):
        # Dev ergonomics — allow http://localhost during local testing
        cfg = FrappeConfigIn(frappe_base_url="http://localhost:8001")
        assert cfg.frappe_base_url == "http://localhost:8001"

    @pytest.mark.parametrize("private_ip", [
        "https://10.0.0.1",
        "https://10.10.10.10",
        "https://192.168.1.1",
        "https://172.16.0.1",
        "https://172.20.5.5",
        "https://172.31.255.254",
        "https://169.254.169.254",  # AWS metadata — the classic SSRF target
    ])
    def test_private_networks_rejected(self, private_ip: str):
        with pytest.raises(ValidationError) as exc_info:
            FrappeConfigIn(frappe_base_url=private_ip)
        assert "private" in str(exc_info.value).lower()

    def test_public_ip_allowed(self):
        # A deployed Frappe might legitimately have an Elastic IP
        cfg = FrappeConfigIn(frappe_base_url="https://54.200.1.1")
        assert cfg.frappe_base_url == "https://54.200.1.1"

    def test_empty_url_allowed_for_clearing(self):
        # Empty/None should pass validation so admins can clear the field
        cfg = FrappeConfigIn(frappe_base_url=None)
        assert cfg.frappe_base_url is None
        cfg2 = FrappeConfigIn(frappe_base_url="")
        assert cfg2.frappe_base_url is None


class TestFrappeConfigInDefaults:
    def test_disabled_by_default(self):
        cfg = FrappeConfigIn()
        assert cfg.frappe_enabled is False

    def test_all_optional_fields_default_none(self):
        cfg = FrappeConfigIn()
        assert cfg.api_key is None
        assert cfg.api_secret is None
        assert cfg.default_income_account is None

    def test_api_key_min_length(self):
        # Block obvious typos/truncations
        with pytest.raises(ValidationError):
            FrappeConfigIn(api_key="abc")

    def test_api_key_max_length(self):
        # Prevent DoS via 10MB "api key"
        with pytest.raises(ValidationError):
            FrappeConfigIn(api_key="x" * 300)


class TestFrappeConfigOutSerialization:
    def test_out_never_exposes_ciphertext(self):
        """Production safety: FrappeConfigOut must not carry encrypted secrets."""
        fields = FrappeConfigOut.model_fields
        for name in fields:
            assert "ciphertext" not in name, (
                f"FrappeConfigOut exposes a ciphertext field: {name}"
            )
            # Must not expose plaintext either
            assert name not in ("api_key", "api_secret", "inbound_secret"), (
                f"FrappeConfigOut should not expose plaintext secret: {name}"
            )

    def test_out_exposes_only_booleans_for_secret_presence(self):
        fields = FrappeConfigOut.model_fields
        assert "api_key_set" in fields
        assert "api_secret_set" in fields
        assert "inbound_secret_set" in fields


class TestSyncLogItem:
    def test_roundtrip(self):
        row = SyncLogItem(
            id="abc",
            direction="outbound",
            entity_type="sales_invoice",
            event_type="fee.plan_created",
            lms_entity_id=None,
            frappe_doc_name="SINV-00001",
            status="success",
            status_code=200,
            error_message=None,
            attempt_count=1,
            next_retry_at=None,
            created_at=datetime.now(timezone.utc),
        )
        assert row.status == "success"
        assert row.attempt_count == 1


class TestSyncLogKPIs:
    def test_perfect_sync_reports_100_percent(self):
        kpis = SyncLogKPIs(
            success_rate_24h=100.0,
            success_count_24h=50,
            failure_count_24h=0,
            pending_retries=0,
            failures_7d=0,
        )
        assert kpis.success_rate_24h == 100.0


class TestUpdateFrappeConfigEnableGate:
    """The enable-gate is business-critical: it must refuse to flip
    frappe_enabled=True when credentials aren't set. Tested via AsyncMock so
    we don't need a live DB.
    """

    @pytest.mark.asyncio
    async def test_cannot_enable_without_url(self):
        from app.services import integration_service
        from app.services.integration_service import IntegrationError

        session = AsyncMock()
        session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
        session.flush = AsyncMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()
        session.add = MagicMock()

        payload = FrappeConfigIn(
            frappe_enabled=True,
            frappe_base_url=None,
            api_key="test_key_123",
            api_secret="test_secret_456",
        )

        with pytest.raises(IntegrationError) as exc_info:
            await integration_service.update_frappe_config(
                session, uuid.uuid4(), payload
            )
        assert "URL" in str(exc_info.value) or "url" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_cannot_enable_without_account_defaults(self):
        from app.services import integration_service
        from app.services.integration_service import IntegrationError
        from app.models.integration import InstituteIntegration

        # Row already has URL + secrets but no account defaults
        existing = InstituteIntegration(
            institute_id=uuid.uuid4(),
            frappe_enabled=False,
            frappe_base_url="https://erp.example.com",
            frappe_api_key_ciphertext="ciphertext_key",
            frappe_api_secret_ciphertext="ciphertext_secret",
        )

        session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=existing)
        session.execute = AsyncMock(return_value=mock_result)
        session.flush = AsyncMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()
        session.add = MagicMock()

        # No default_income_account, default_receivable_account, etc.
        payload = FrappeConfigIn(frappe_enabled=True)

        with pytest.raises(IntegrationError) as exc_info:
            await integration_service.update_frappe_config(
                session, existing.institute_id, payload
            )
        msg = str(exc_info.value).lower()
        assert "income" in msg or "receivable" in msg or "company" in msg
