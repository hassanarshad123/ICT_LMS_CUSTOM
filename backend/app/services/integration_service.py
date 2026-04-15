"""CRUD + test-connection for per-institute ERP integrations (Frappe v1).

The read/write/test triplet consumed by ``app.routers.integrations``. Secrets
are Fernet-encrypted via ``app.utils.encryption``; the decrypted value only
ever leaves this module when the outbound Frappe client explicitly asks for it
(Phase 3). Reads into ``FrappeConfigOut`` never expose ciphertext.
"""
from __future__ import annotations

import logging
import secrets as _secrets
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.integration import InstituteIntegration
from app.schemas.integration import FrappeConfigIn, FrappeConfigOut, FrappeTestConnectionOut
from app.utils.encryption import decrypt, encrypt

logger = logging.getLogger("ict_lms.integrations")


class IntegrationError(ValueError):
    """Surface-level validation failure — router maps to HTTP 400."""


async def _get_or_create(
    session: AsyncSession, institute_id: uuid.UUID
) -> InstituteIntegration:
    result = await session.execute(
        select(InstituteIntegration).where(
            InstituteIntegration.institute_id == institute_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = InstituteIntegration(institute_id=institute_id, frappe_enabled=False)
        session.add(row)
        await session.flush()
    return row


async def get_frappe_config(
    session: AsyncSession, institute_id: uuid.UUID
) -> FrappeConfigOut:
    row = await _get_or_create(session, institute_id)
    return _serialize(row)


async def update_frappe_config(
    session: AsyncSession,
    institute_id: uuid.UUID,
    payload: FrappeConfigIn,
) -> FrappeConfigOut:
    """Update config. Omitted secrets preserve the existing ciphertext.

    If ``frappe_enabled=True`` is requested without a base URL + creds ever
    being set, rejects with :class:`IntegrationError`.
    """
    row = await _get_or_create(session, institute_id)

    # Base fields (always accept even if None — clears the field)
    if payload.frappe_base_url is not None:
        row.frappe_base_url = payload.frappe_base_url or None
    if payload.default_income_account is not None:
        row.default_income_account = payload.default_income_account or None
    if payload.default_receivable_account is not None:
        row.default_receivable_account = payload.default_receivable_account or None
    if payload.default_bank_account is not None:
        row.default_bank_account = payload.default_bank_account or None
    if payload.default_mode_of_payment is not None:
        row.default_mode_of_payment = payload.default_mode_of_payment or None
    if payload.default_cost_center is not None:
        row.default_cost_center = payload.default_cost_center or None
    if payload.default_company is not None:
        row.default_company = payload.default_company or None

    # Secrets — only overwrite when provided
    if payload.api_key:
        row.frappe_api_key_ciphertext = encrypt(payload.api_key)
    if payload.api_secret:
        row.frappe_api_secret_ciphertext = encrypt(payload.api_secret)

    # Guard: can't enable without URL + both secrets
    if payload.frappe_enabled:
        if not (row.frappe_base_url
                and row.frappe_api_key_ciphertext
                and row.frappe_api_secret_ciphertext):
            raise IntegrationError(
                "Cannot enable Frappe sync until URL, API key, and API secret are all set"
            )
        if not (row.default_income_account and row.default_receivable_account
                and row.default_bank_account and row.default_mode_of_payment
                and row.default_company):
            raise IntegrationError(
                "Cannot enable Frappe sync until Income Account, Receivable "
                "Account, Bank Account, Mode of Payment, and Company are all "
                "configured"
            )

    row.frappe_enabled = payload.frappe_enabled
    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _serialize(row)


async def rotate_inbound_secret(
    session: AsyncSession, institute_id: uuid.UUID
) -> str:
    """Generate a new inbound webhook secret and return the plaintext ONCE.

    Called by the admin UI "Regenerate inbound secret" button. The plaintext
    is never persisted — only the Fernet ciphertext.
    """
    row = await _get_or_create(session, institute_id)
    new_secret = _secrets.token_urlsafe(32)
    row.frappe_inbound_secret_ciphertext = encrypt(new_secret)
    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    await session.commit()
    return new_secret


async def test_frappe_connection(
    session: AsyncSession, institute_id: uuid.UUID
) -> FrappeTestConnectionOut:
    """Ping the institute's Frappe with stored creds. Populates last_test_*."""
    row = await _get_or_create(session, institute_id)

    if not (row.frappe_base_url and row.frappe_api_key_ciphertext and row.frappe_api_secret_ciphertext):
        return FrappeTestConnectionOut(
            ok=False, message="Frappe URL and credentials must be set first"
        )

    api_key = decrypt(row.frappe_api_key_ciphertext)
    api_secret = decrypt(row.frappe_api_secret_ciphertext)
    url = f"{row.frappe_base_url}/api/method/frappe.auth.get_logged_user"

    started = time.perf_counter()
    ok, message, frappe_user = False, "Unknown error", None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"token {api_key}:{api_secret}"},
            )
        if resp.status_code == 200:
            data = resp.json()
            frappe_user = data.get("message")
            ok = True
            message = "Connected"
        else:
            message = f"Frappe returned HTTP {resp.status_code}"
    except httpx.TimeoutException:
        message = "Connection timed out (10s)"
    except httpx.RequestError as e:
        message = f"Network error: {type(e).__name__}"
    except Exception as e:  # noqa: BLE001 — surface any unexpected failure safely
        logger.exception("test_frappe_connection unexpected error")
        message = f"Unexpected error: {type(e).__name__}"

    latency_ms = int((time.perf_counter() - started) * 1000)

    # Persist telemetry
    row.last_test_at = datetime.now(timezone.utc)
    row.last_test_status = "success" if ok else "failed"
    row.last_test_error = None if ok else message
    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    await session.commit()

    return FrappeTestConnectionOut(
        ok=ok, message=message, frappe_user=frappe_user, latency_ms=latency_ms,
    )


# ── Helpers used by the Phase 3 outbound client ───────────────────

async def load_active_frappe_config(
    session: AsyncSession, institute_id: uuid.UUID
) -> Optional[InstituteIntegration]:
    """Return the row IFF frappe_enabled=True and credentials are present.
    Otherwise None — caller should short-circuit.
    """
    result = await session.execute(
        select(InstituteIntegration).where(
            InstituteIntegration.institute_id == institute_id,
            InstituteIntegration.frappe_enabled.is_(True),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    if not (row.frappe_base_url
            and row.frappe_api_key_ciphertext
            and row.frappe_api_secret_ciphertext):
        return None
    return row


def _serialize(row: InstituteIntegration) -> FrappeConfigOut:
    return FrappeConfigOut(
        frappe_enabled=row.frappe_enabled,
        frappe_base_url=row.frappe_base_url,
        api_key_set=bool(row.frappe_api_key_ciphertext),
        api_secret_set=bool(row.frappe_api_secret_ciphertext),
        inbound_secret_set=bool(row.frappe_inbound_secret_ciphertext),
        default_income_account=row.default_income_account,
        default_receivable_account=row.default_receivable_account,
        default_bank_account=row.default_bank_account,
        default_mode_of_payment=row.default_mode_of_payment,
        default_cost_center=row.default_cost_center,
        default_company=row.default_company,
        last_test_at=row.last_test_at,
        last_test_status=row.last_test_status,
        last_test_error=row.last_test_error,
        updated_at=row.updated_at,
    )
