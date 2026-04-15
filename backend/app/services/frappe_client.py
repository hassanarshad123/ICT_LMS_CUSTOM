"""Low-level HTTP client for Frappe/ERPNext REST API.

Stateless. Given a decrypted credential bundle + base URL, upserts Sales
Invoice / Payment Entry rows in the institute's Frappe instance with our
``custom_zensbot_fee_plan_id`` custom field as the idempotency key.

All methods return a ``FrappeResult`` dataclass — tuple of (ok, doc_name,
http_status, response_json_or_error). Never raises on network/HTTP errors
— the caller (frappe_sync_service) decides whether to retry.

Frappe REST docs referenced:
  GET  /api/resource/{DocType}?filters=[["fieldname","=","value"]]
  POST /api/resource/{DocType}
  PUT  /api/resource/{DocType}/{name}

Fieldname note: Frappe v15+ auto-prefixes user-created custom fields with
``custom_``. The reference connector app (fixture-installed) uses the bare
names, but manual UI-installed fields carry the prefix. We default to the
prefixed form because that's what admins actually end up with when they
follow the quickest setup path.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.models.integration import InstituteIntegration
from app.utils.encryption import decrypt

logger = logging.getLogger("ict_lms.frappe_client")

DEFAULT_TIMEOUT = httpx.Timeout(connect=5.0, read=15.0, write=15.0, pool=5.0)

FEE_PLAN_FIELD = "custom_zensbot_fee_plan_id"
PAYMENT_FIELD = "custom_zensbot_payment_id"


@dataclass(frozen=True)
class FrappeResult:
    ok: bool
    doc_name: Optional[str] = None
    status_code: Optional[int] = None
    response: Optional[dict] = None
    error: Optional[str] = None


class FrappeClient:
    """Per-institute Frappe API client. Short-lived — build one per sync run."""

    def __init__(self, cfg: InstituteIntegration) -> None:
        if not (cfg.frappe_base_url
                and cfg.frappe_api_key_ciphertext
                and cfg.frappe_api_secret_ciphertext):
            raise ValueError("FrappeClient requires base_url + key + secret")
        self.base_url = cfg.frappe_base_url.rstrip("/")
        self.cfg = cfg
        self._api_key = decrypt(cfg.frappe_api_key_ciphertext)
        self._api_secret = decrypt(cfg.frappe_api_secret_ciphertext)

    # ── public ops ─────────────────────────────────────────────────

    async def upsert_sales_invoice(
        self,
        *,
        fee_plan_id: str,
        customer_name: str,
        posting_date: str,
        due_date: Optional[str],
        amount: int,
        currency: str,
        description: str,
    ) -> FrappeResult:
        """Create or update a Sales Invoice matching ``fee_plan_id``.

        Uses our custom field ``custom_zensbot_fee_plan_id`` as the
        idempotency key — install the reference connector app or add the
        custom field manually before calling.
        """
        existing = await self._find_by_zensbot_id("Sales Invoice", fee_plan_id)
        if not existing.ok and existing.status_code not in (None, 200, 404):
            return existing

        body: dict[str, Any] = {
            "customer": customer_name,
            "posting_date": posting_date,
            "currency": currency,
            FEE_PLAN_FIELD: fee_plan_id,
            "items": [{
                "item_name": description,
                "description": description,
                "qty": 1,
                "rate": amount,
                "income_account": self.cfg.default_income_account,
            }],
            "debit_to": self.cfg.default_receivable_account,
        }
        if self.cfg.default_company:
            body["company"] = self.cfg.default_company
        if self.cfg.default_cost_center:
            body["cost_center"] = self.cfg.default_cost_center
        if due_date:
            body["due_date"] = due_date

        if existing.ok and existing.doc_name:
            return await self._put_resource("Sales Invoice", existing.doc_name, body)
        return await self._post_resource("Sales Invoice", body)

    async def upsert_payment_entry(
        self,
        *,
        payment_id: str,
        fee_plan_id: str,
        invoice_name: Optional[str],
        customer_name: str,
        posting_date: str,
        amount: int,
        currency: str,
        mode_of_payment: Optional[str],
        reference_no: Optional[str],
    ) -> FrappeResult:
        existing = await self._find_by_zensbot_id("Payment Entry", payment_id, custom_field=PAYMENT_FIELD)
        if not existing.ok and existing.status_code not in (None, 200, 404):
            return existing

        # paid_to must be a balance-sheet asset (bank/cash). Fall back to the
        # income account only for legacy rows that predate default_bank_account —
        # Frappe will reject the posting but we avoid crashing on missing field.
        paid_to = self.cfg.default_bank_account or self.cfg.default_income_account
        body: dict[str, Any] = {
            "payment_type": "Receive",
            "party_type": "Customer",
            "party": customer_name,
            "posting_date": posting_date,
            "paid_amount": amount,
            "received_amount": amount,
            "paid_from": self.cfg.default_receivable_account,
            "paid_to": paid_to,
            "mode_of_payment": mode_of_payment or self.cfg.default_mode_of_payment,
            "reference_no": reference_no,
            "reference_date": posting_date,
            PAYMENT_FIELD: payment_id,
            FEE_PLAN_FIELD: fee_plan_id,
        }
        if self.cfg.default_company:
            body["company"] = self.cfg.default_company
        if self.cfg.default_cost_center:
            body["cost_center"] = self.cfg.default_cost_center
        if invoice_name:
            body["references"] = [{
                "reference_doctype": "Sales Invoice",
                "reference_name": invoice_name,
                "allocated_amount": amount,
            }]

        if existing.ok and existing.doc_name:
            return await self._put_resource("Payment Entry", existing.doc_name, body)
        return await self._post_resource("Payment Entry", body)

    async def cancel_sales_invoice(self, *, fee_plan_id: str) -> FrappeResult:
        existing = await self._find_by_zensbot_id("Sales Invoice", fee_plan_id)
        if not existing.ok or not existing.doc_name:
            return existing
        return await self._put_resource(
            "Sales Invoice", existing.doc_name, {"status": "Cancelled", "docstatus": 2},
        )

    # ── introspection (Tier 2: dropdown population) ────────────────

    async def list_resource(
        self,
        doctype: str,
        *,
        fields: Optional[list[str]] = None,
        filters: Optional[list[list]] = None,
        limit: int = 200,
    ) -> FrappeResult:
        """Generic ``GET /api/resource/{doctype}`` helper.

        Used by the wizard's dropdowns. Never mutates. Trims ``fields`` to
        ``["name"]`` by default to keep payloads small — dropdowns only need
        the name.
        """
        url = f"{self.base_url}/api/resource/{doctype}"
        params: dict[str, Any] = {
            "fields": json.dumps(fields or ["name"]),
            "limit_page_length": limit,
        }
        if filters:
            params["filters"] = json.dumps(filters)
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.get(url, params=params, headers=self._auth_header)
        except httpx.RequestError as e:
            return FrappeResult(ok=False, error=f"Network error: {type(e).__name__}")

        if resp.status_code != 200:
            return FrappeResult(ok=False, status_code=resp.status_code, error=resp.text[:500])

        data = resp.json().get("data") or []
        return FrappeResult(ok=True, status_code=200, response={"data": data})

    # ── schema setup (Tier 2: auto-install fields + webhook) ──────

    async def get_custom_field(self, doctype: str, fieldname: str) -> FrappeResult:
        """Return ok=True + doc_name if the custom field already exists.

        Used for idempotency before ``create_custom_field``.
        """
        url = f"{self.base_url}/api/resource/Custom Field"
        params = {
            "filters": json.dumps([["dt", "=", doctype], ["fieldname", "=", fieldname]]),
            "fields": json.dumps(["name"]),
            "limit_page_length": 1,
        }
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.get(url, params=params, headers=self._auth_header)
        except httpx.RequestError as e:
            return FrappeResult(ok=False, error=f"Network error: {type(e).__name__}")

        if resp.status_code != 200:
            return FrappeResult(ok=False, status_code=resp.status_code, error=resp.text[:500])
        data = resp.json().get("data") or []
        if not data:
            return FrappeResult(ok=True, status_code=200, doc_name=None)
        return FrappeResult(ok=True, status_code=200, doc_name=data[0]["name"])

    async def create_custom_field(
        self,
        *,
        doctype: str,
        fieldname: str,
        label: str,
        fieldtype: str = "Data",
        insert_after: str = "amended_from",
    ) -> FrappeResult:
        """Create (if absent) a Custom Field in Frappe.

        Frappe v15 auto-prefixes fieldnames with ``custom_``; callers should
        pass the final desired name (e.g. ``custom_zensbot_fee_plan_id``) and
        Frappe will use it as-is when it already starts with ``custom_``.
        """
        existing = await self.get_custom_field(doctype, fieldname)
        if existing.ok and existing.doc_name:
            return FrappeResult(ok=True, status_code=200, doc_name=existing.doc_name)
        body = {
            "dt": doctype,
            "fieldname": fieldname,
            "label": label,
            "fieldtype": fieldtype,
            "insert_after": insert_after,
        }
        return await self._post_resource("Custom Field", body)

    async def get_webhook(self, name: str) -> FrappeResult:
        """Look up a Webhook record by its name."""
        url = f"{self.base_url}/api/resource/Webhook/{name}"
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.get(url, headers=self._auth_header)
        except httpx.RequestError as e:
            return FrappeResult(ok=False, error=f"Network error: {type(e).__name__}")
        if resp.status_code == 404:
            return FrappeResult(ok=True, status_code=404, doc_name=None)
        if resp.status_code != 200:
            return FrappeResult(ok=False, status_code=resp.status_code, error=resp.text[:500])
        return FrappeResult(ok=True, status_code=200, doc_name=name, response=resp.json())

    async def upsert_webhook(
        self,
        *,
        webhook_name: str,
        request_url: str,
        secret: str,
        doctype: str = "Payment Entry",
        docevent: str = "after_insert",
    ) -> FrappeResult:
        """Create or update the LMS Payment Entry webhook in Frappe.

        Uses Frappe's native ``enable_security=1`` so Frappe signs the body
        with HMAC-SHA256 using the stored ``webhook_secret`` — matching the
        LMS inbound endpoint signature expectation.
        """
        body: dict[str, Any] = {
            "webhook_doctype": doctype,
            "webhook_docevent": docevent,
            "request_url": request_url,
            "request_method": "POST",
            "request_structure": "JSON",
            "enabled": 1,
            "enable_security": 1,
            "webhook_secret": secret,
            "timeout": 5,
            "webhook_headers": [
                {"key": "Content-Type", "value": "application/json"},
            ],
            "webhook_json": (
                '{\n  "doc": {\n'
                '    "name": "{{ doc.name }}",\n'
                '    "custom_zensbot_fee_plan_id": "{{ doc.custom_zensbot_fee_plan_id or \'\' }}",\n'
                '    "custom_zensbot_payment_id": "{{ doc.custom_zensbot_payment_id or \'\' }}",\n'
                '    "paid_amount": {{ doc.paid_amount or 0 }},\n'
                '    "received_amount": {{ doc.received_amount or 0 }},\n'
                '    "posting_date": "{{ doc.posting_date }}",\n'
                '    "mode_of_payment": "{{ doc.mode_of_payment or \'\' }}",\n'
                '    "reference_no": "{{ doc.reference_no or \'\' }}"\n'
                '  }\n}'
            ),
        }
        existing = await self.get_webhook(webhook_name)
        if existing.ok and existing.doc_name:
            return await self._put_resource("Webhook", existing.doc_name, body)
        # Frappe auto-generates webhook name — pass it explicitly.
        body["name"] = webhook_name
        return await self._post_resource("Webhook", body)

    # ── customer auto-create (Tier 2: v1 gap closure) ─────────────

    async def find_customer(self, customer_name: str) -> FrappeResult:
        """Look up a Customer by exact name (Frappe's primary key)."""
        url = f"{self.base_url}/api/resource/Customer/{customer_name}"
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.get(url, headers=self._auth_header)
        except httpx.RequestError as e:
            return FrappeResult(ok=False, error=f"Network error: {type(e).__name__}")
        if resp.status_code == 404:
            return FrappeResult(ok=True, status_code=404, doc_name=None)
        if resp.status_code != 200:
            return FrappeResult(ok=False, status_code=resp.status_code, error=resp.text[:500])
        return FrappeResult(ok=True, status_code=200, doc_name=customer_name)

    async def create_customer(
        self,
        *,
        customer_name: str,
        email: Optional[str] = None,
        customer_group: str = "Individual",
        territory: str = "All Territories",
    ) -> FrappeResult:
        """Create a Customer in Frappe. Idempotent — returns ok if already exists."""
        existing = await self.find_customer(customer_name)
        if existing.ok and existing.doc_name:
            return FrappeResult(ok=True, status_code=200, doc_name=existing.doc_name)
        body: dict[str, Any] = {
            "customer_name": customer_name,
            "customer_type": "Individual",
            "customer_group": customer_group,
            "territory": territory,
        }
        if email:
            body["email_id"] = email
        return await self._post_resource("Customer", body)

    # ── internals ──────────────────────────────────────────────────

    @property
    def _auth_header(self) -> dict[str, str]:
        return {"Authorization": f"token {self._api_key}:{self._api_secret}"}

    async def _find_by_zensbot_id(
        self,
        doctype: str,
        zensbot_id: str,
        *,
        custom_field: str = FEE_PLAN_FIELD,
    ) -> FrappeResult:
        url = f"{self.base_url}/api/resource/{doctype}"
        params = {
            "filters": json.dumps([[custom_field, "=", zensbot_id]]),
            "fields": json.dumps(["name"]),
            "limit_page_length": 1,
        }
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.get(url, params=params, headers=self._auth_header)
        except httpx.RequestError as e:
            return FrappeResult(ok=False, error=f"Network error: {type(e).__name__}")

        if resp.status_code != 200:
            return FrappeResult(ok=False, status_code=resp.status_code, error=resp.text[:500])

        data = resp.json().get("data") or []
        if not data:
            return FrappeResult(ok=True, status_code=200, doc_name=None)
        return FrappeResult(ok=True, status_code=200, doc_name=data[0]["name"])

    async def _post_resource(self, doctype: str, body: dict) -> FrappeResult:
        url = f"{self.base_url}/api/resource/{doctype}"
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.post(url, json=body, headers=self._auth_header)
        except httpx.RequestError as e:
            return FrappeResult(ok=False, error=f"Network error: {type(e).__name__}")

        return self._wrap_response(resp)

    async def _put_resource(self, doctype: str, doc_name: str, body: dict) -> FrappeResult:
        url = f"{self.base_url}/api/resource/{doctype}/{doc_name}"
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.put(url, json=body, headers=self._auth_header)
        except httpx.RequestError as e:
            return FrappeResult(ok=False, error=f"Network error: {type(e).__name__}")

        return self._wrap_response(resp)

    @staticmethod
    def _wrap_response(resp: httpx.Response) -> FrappeResult:
        if 200 <= resp.status_code < 300:
            try:
                payload = resp.json()
            except Exception:
                payload = {"raw": resp.text[:500]}
            doc_name = None
            if isinstance(payload.get("data"), dict):
                doc_name = payload["data"].get("name")
            return FrappeResult(
                ok=True, doc_name=doc_name, status_code=resp.status_code, response=payload,
            )
        return FrappeResult(
            ok=False,
            status_code=resp.status_code,
            error=resp.text[:500],
        )
