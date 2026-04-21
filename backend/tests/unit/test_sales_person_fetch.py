"""Unit tests for integration_service.fetch_sales_persons.

FrappeClient is mocked — these tests verify the join + alreadyMapped logic,
not the HTTP shape (covered by FrappeClient's own tests).
"""
from __future__ import annotations

import os
import uuid

# Provide the minimum env vars required by app.config.Settings so the module
# import chain (integration_service -> encryption -> get_settings) succeeds
# without a real .env file.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")

import pytest

from app.services import integration_service
from app.services.frappe_client import FrappeResult


class _StubSession:
    """Minimal AsyncSession stub — only needed for the employee_id lookup."""

    def __init__(self, mapped_ids: dict[str, uuid.UUID]):
        self._mapped_ids = mapped_ids

    async def execute(self, _stmt):  # noqa: D401
        class _R:
            def __init__(self, rows):
                self._rows = rows

            def all(self):
                return self._rows

        return _R(list(self._mapped_ids.items()))


@pytest.mark.asyncio
async def test_returns_disabled_when_integration_off(monkeypatch):
    async def _fake_load(_session, _institute_id):
        return None

    monkeypatch.setattr(integration_service, "load_active_frappe_config", _fake_load)

    out = await integration_service.fetch_sales_persons(
        _StubSession({}), institute_id=uuid.uuid4()
    )
    assert out.enabled is False
    assert out.sales_persons == []


@pytest.mark.asyncio
async def test_joins_sales_person_with_employee(monkeypatch):
    async def _fake_load(_session, _institute_id):
        class _Cfg:
            frappe_base_url = "https://example.invalid"
            frappe_api_key_ciphertext = b"x"
            frappe_api_secret_ciphertext = b"x"
        return _Cfg()

    async def _fake_list(_self, doctype, **_kwargs):
        if doctype == "Sales Person":
            return FrappeResult(ok=True, status_code=200, response={"data": [
                {"name": "Abdul Qayyum", "sales_person_name": "Abdul Qayyum",
                 "employee": "MITT5037", "enabled": 1, "commission_rate": "10%"},
            ]})
        if doctype == "Employee":
            return FrappeResult(ok=True, status_code=200, response={"data": [
                {"name": "MITT5037", "employee_name": "Abdul Quyyum",
                 "prefered_email": "q@example.com", "cell_number": "030",
                 "status": "Active"},
            ]})
        raise AssertionError(f"Unexpected doctype {doctype}")

    monkeypatch.setattr(integration_service, "load_active_frappe_config", _fake_load)
    monkeypatch.setattr(
        "app.services.frappe_client.FrappeClient.__init__",
        lambda self, cfg: None,
    )
    monkeypatch.setattr(
        "app.services.frappe_client.FrappeClient.list_resource", _fake_list,
    )

    out = await integration_service.fetch_sales_persons(
        _StubSession({}), institute_id=uuid.uuid4()
    )
    assert out.enabled is True
    assert len(out.sales_persons) == 1
    sp = out.sales_persons[0]
    assert sp.employee_id == "MITT5037"
    assert sp.email == "q@example.com"
    assert sp.commission_rate == "10%"
    assert sp.already_mapped is False


@pytest.mark.asyncio
async def test_marks_already_mapped(monkeypatch):
    officer_id = uuid.uuid4()

    async def _fake_load(_session, _institute_id):
        class _Cfg:
            frappe_base_url = "https://example.invalid"
            frappe_api_key_ciphertext = b"x"
            frappe_api_secret_ciphertext = b"x"
        return _Cfg()

    async def _fake_list(_self, doctype, **_kwargs):
        if doctype == "Sales Person":
            return FrappeResult(ok=True, status_code=200, response={"data": [
                {"name": "X", "sales_person_name": "X", "employee": "MITT5037",
                 "enabled": 1},
            ]})
        return FrappeResult(ok=True, status_code=200, response={"data": [
            {"name": "MITT5037", "employee_name": "X",
             "prefered_email": "x@x", "status": "Active"},
        ]})

    monkeypatch.setattr(integration_service, "load_active_frappe_config", _fake_load)
    monkeypatch.setattr(
        "app.services.frappe_client.FrappeClient.__init__",
        lambda self, cfg: None,
    )
    monkeypatch.setattr(
        "app.services.frappe_client.FrappeClient.list_resource", _fake_list,
    )

    out = await integration_service.fetch_sales_persons(
        _StubSession({"MITT5037": officer_id}), institute_id=uuid.uuid4()
    )
    assert out.sales_persons[0].already_mapped is True
    assert out.sales_persons[0].linked_officer_id == str(officer_id)


@pytest.mark.asyncio
async def test_frappe_down_returns_error(monkeypatch):
    async def _fake_load(_session, _institute_id):
        class _Cfg:
            frappe_base_url = "https://example.invalid"
            frappe_api_key_ciphertext = b"x"
            frappe_api_secret_ciphertext = b"x"
        return _Cfg()

    async def _fake_list(_self, doctype, **_kwargs):
        return FrappeResult(ok=False, status_code=502, error="Bad gateway")

    monkeypatch.setattr(integration_service, "load_active_frappe_config", _fake_load)
    monkeypatch.setattr(
        "app.services.frappe_client.FrappeClient.__init__",
        lambda self, cfg: None,
    )
    monkeypatch.setattr(
        "app.services.frappe_client.FrappeClient.list_resource", _fake_list,
    )

    out = await integration_service.fetch_sales_persons(
        _StubSession({}), institute_id=uuid.uuid4()
    )
    assert out.enabled is True
    assert out.error is not None
    assert out.sales_persons == []
