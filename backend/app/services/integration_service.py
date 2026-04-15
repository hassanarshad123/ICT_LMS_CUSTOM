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
    if payload.auto_create_customers is not None:
        row.auto_create_customers = payload.auto_create_customers
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


# ── Tier 2: wizard helpers (introspection, auto-setup, dry-run) ──

_DROPDOWN_MAP = {
    # resource → (doctype, extra filters factory)
    "companies": ("Company", lambda _: []),
    "modes-of-payment": ("Mode of Payment", lambda _: []),
    "cost-centers": ("Cost Center", lambda ctx: (
        [["company", "=", ctx["company"]]] if ctx.get("company") else []
    )),
    "accounts": ("Account", lambda ctx: (
        [
            ["is_group", "=", 0],
            *([["company", "=", ctx["company"]]] if ctx.get("company") else []),
            *([["account_type", "=", ctx["account_type"]]] if ctx.get("account_type") else []),
        ]
    )),
}


async def _load_cfg_for_introspection(
    session: AsyncSession, institute_id: uuid.UUID,
) -> InstituteIntegration:
    row = await _get_or_create(session, institute_id)
    if not (row.frappe_base_url
            and row.frappe_api_key_ciphertext
            and row.frappe_api_secret_ciphertext):
        raise IntegrationError(
            "Frappe URL and credentials must be saved before you can browse Frappe data"
        )
    return row


async def introspect_resource(
    session: AsyncSession,
    institute_id: uuid.UUID,
    *,
    resource: str,
    company: Optional[str] = None,
    account_type: Optional[str] = None,
    refresh: bool = False,
) -> dict:
    """Proxy a Frappe listing for the wizard dropdowns. Cached 5 minutes."""
    from app.core.cache import cache
    from app.services.frappe_client import FrappeClient

    if resource not in _DROPDOWN_MAP:
        raise IntegrationError(f"Unknown introspection resource: {resource}")

    row = await _load_cfg_for_introspection(session, institute_id)

    doctype, filter_factory = _DROPDOWN_MAP[resource]
    ctx = {"company": company, "account_type": account_type}
    filters = filter_factory(ctx)

    cache_key = (
        f"frappe:introspect:{institute_id}:{resource}"
        f":{company or '-'}:{account_type or '-'}"
    )
    if refresh:
        await cache.delete(cache_key)

    cached_hit = False
    cached = await cache.get(cache_key)
    if cached is not None:
        cached_hit = True
        return {"items": cached, "cached": True}

    client = FrappeClient(row)
    result = await client.list_resource(doctype, filters=filters)
    if not result.ok:
        raise IntegrationError(
            f"Frappe rejected the request: {result.error or 'HTTP ' + str(result.status_code)}"
        )
    items = [{"name": r["name"]} for r in (result.response or {}).get("data", [])]
    await cache.set(cache_key, items, ttl=300)
    return {"items": items, "cached": cached_hit}


_CUSTOM_FIELDS_SPEC = [
    ("Sales Invoice", "custom_zensbot_fee_plan_id", "Zensbot Fee Plan ID"),
    ("Payment Entry", "custom_zensbot_fee_plan_id", "Zensbot Fee Plan ID"),
    ("Payment Entry", "custom_zensbot_payment_id", "Zensbot Payment ID"),
]


async def install_custom_fields(
    session: AsyncSession, institute_id: uuid.UUID,
) -> dict:
    from app.services.frappe_client import FrappeClient

    row = await _load_cfg_for_introspection(session, institute_id)
    client = FrappeClient(row)

    installed, skipped, failures = [], [], []
    for doctype, fieldname, label in _CUSTOM_FIELDS_SPEC:
        existing = await client.get_custom_field(doctype, fieldname)
        if not existing.ok:
            failures.append({"doctype": doctype, "fieldname": fieldname,
                             "error": existing.error or f"HTTP {existing.status_code}"})
            continue
        if existing.doc_name:
            skipped.append({"doctype": doctype, "fieldname": fieldname})
            continue
        result = await client.create_custom_field(
            doctype=doctype, fieldname=fieldname, label=label,
        )
        if result.ok:
            installed.append({"doctype": doctype, "fieldname": fieldname})
        else:
            failures.append({"doctype": doctype, "fieldname": fieldname,
                             "error": result.error or f"HTTP {result.status_code}"})

    if failures:
        raise IntegrationError(
            f"Installed {len(installed)}, skipped {len(skipped)}, "
            f"failed {len(failures)}: {failures[0]['error']}"
        )
    return {
        "ok": True,
        "installed": installed,
        "skipped": skipped,
        "message": (
            f"Custom fields ready: {len(installed)} created, {len(skipped)} already existed"
        ),
    }


def _lms_webhook_url(institute_id: uuid.UUID) -> str:
    from app.config import get_settings
    base = (get_settings().PUBLIC_API_BASE_URL or "https://apiict.zensbot.site").rstrip("/")
    return f"{base}/api/v1/integrations/frappe/webhook?institute_id={institute_id}"


async def register_webhook(
    session: AsyncSession, institute_id: uuid.UUID,
) -> dict:
    """Create (or update) the Payment Entry webhook in Frappe with the LMS
    inbound secret pre-populated. Generates a secret first if needed.
    """
    from app.services.frappe_client import FrappeClient

    row = await _load_cfg_for_introspection(session, institute_id)

    # Generate inbound secret if absent — avoids an extra round-trip in the UI.
    if not row.frappe_inbound_secret_ciphertext:
        new_secret = _secrets.token_urlsafe(32)
        row.frappe_inbound_secret_ciphertext = encrypt(new_secret)
        session.add(row)
        await session.flush()
        secret_plaintext = new_secret
    else:
        secret_plaintext = decrypt(row.frappe_inbound_secret_ciphertext)

    client = FrappeClient(row)
    result = await client.upsert_webhook(
        webhook_name="zensbot_lms_payment_entry_sync",
        request_url=_lms_webhook_url(institute_id),
        secret=secret_plaintext,
    )
    if not result.ok:
        raise IntegrationError(
            f"Frappe refused to register the webhook: {result.error or 'HTTP ' + str(result.status_code)}"
        )
    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    await session.commit()
    return {
        "ok": True,
        "webhook_name": result.doc_name or "zensbot_lms_payment_entry_sync",
        "message": "Webhook registered in Frappe with signature security enabled",
    }


async def run_dry_run(
    session: AsyncSession, institute_id: uuid.UUID,
) -> dict:
    """Create + immediately cancel a test Sales Invoice to verify account
    mappings end-to-end. Uses a namespaced customer to avoid leaking into
    real records.
    """
    from app.services.frappe_client import FrappeClient

    row = await _load_cfg_for_introspection(session, institute_id)
    if not (row.default_company and row.default_income_account
            and row.default_receivable_account):
        raise IntegrationError(
            "Dry-run needs Company, Income Account, and Receivable Account set"
        )

    client = FrappeClient(row)

    # 1. Ensure the test Customer exists.
    test_customer = f"zensbot_test_{institute_id.hex[:8]}"
    cust = await client.create_customer(customer_name=test_customer)
    if not cust.ok:
        return {
            "ok": False,
            "message": f"Couldn't create test Customer: {cust.error or cust.status_code}",
        }

    # 2. Create a ₨1 test Sales Invoice with a fake fee_plan_id.
    from uuid import uuid4 as _uuid4
    fake_fee_plan_id = str(_uuid4())
    inv = await client.upsert_sales_invoice(
        fee_plan_id=fake_fee_plan_id,
        customer_name=test_customer,
        posting_date=datetime.now(timezone.utc).date().isoformat(),
        due_date=None,
        amount=1,
        currency="PKR",
        description="Zensbot LMS dry-run (automatically cancelled)",
    )
    if not inv.ok or not inv.doc_name:
        return {
            "ok": False,
            "message": f"Frappe rejected the test Sales Invoice: {inv.error or inv.status_code}",
            "detail": (inv.response or {}).get("exception") if isinstance(inv.response, dict) else None,
        }

    # 3. Immediately cancel.
    cancel = await client.cancel_sales_invoice(fee_plan_id=fake_fee_plan_id)

    return {
        "ok": True,
        "invoice_name": inv.doc_name,
        "cancelled": bool(cancel.ok and cancel.doc_name),
        "message": (
            f"Dry-run succeeded — test invoice {inv.doc_name} created and "
            f"{'cancelled' if cancel.ok else 'NOT cancelled (please cancel manually)'}"
        ),
    }


async def get_setup_status(
    session: AsyncSession, institute_id: uuid.UUID,
) -> dict:
    """Cheap summary of which setup steps the admin has completed.

    Does NOT call Frappe — reads only local DB state. The wizard uses this
    to resume at the right step on mount.
    """
    row = await _get_or_create(session, institute_id)
    connection = (
        "ok" if row.last_test_status == "success"
        else ("missing" if not (row.frappe_base_url
                                and row.frappe_api_key_ciphertext
                                and row.frappe_api_secret_ciphertext)
              else "unknown")
    )
    accounts_mapped = "ok" if (
        row.default_company and row.default_income_account
        and row.default_receivable_account and row.default_bank_account
        and row.default_mode_of_payment
    ) else "missing"
    return {
        "connection": connection,
        "accounts_mapped": accounts_mapped,
        "custom_fields_installed": "unknown",  # verified by /setup/custom-fields call
        "webhook_registered": "unknown",        # verified by /setup/webhook call
        "inbound_secret_shared": "ok" if row.frappe_inbound_secret_ciphertext else "missing",
    }


async def set_auto_create_customers(
    session: AsyncSession, institute_id: uuid.UUID, enabled: bool,
) -> dict:
    row = await _get_or_create(session, institute_id)
    row.auto_create_customers = enabled
    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    await session.commit()
    return {"auto_create_customers": enabled}


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
        auto_create_customers=bool(row.auto_create_customers),
        default_mode_of_payment=row.default_mode_of_payment,
        default_cost_center=row.default_cost_center,
        default_company=row.default_company,
        last_test_at=row.last_test_at,
        last_test_status=row.last_test_status,
        last_test_error=row.last_test_error,
        updated_at=row.updated_at,
    )
