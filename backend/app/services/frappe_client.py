"""Low-level HTTP client for Frappe/ERPNext REST API.

Stateless. Given a decrypted credential bundle + base URL, upserts Sales
Invoice / Payment Entry rows in the institute's Frappe instance with our
``zensbot_fee_plan_id`` custom field as the idempotency key.

All methods return a ``FrappeResult`` dataclass — tuple of (ok, doc_name,
http_status, response_json_or_error). Never raises on network/HTTP errors
— the caller (frappe_sync_service) decides whether to retry.

Frappe REST docs referenced:
  GET  /api/resource/{DocType}?filters=[["fieldname","=","value"]]
  POST /api/resource/{DocType}
  PUT  /api/resource/{DocType}/{name}
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

        Uses our custom field ``zensbot_fee_plan_id`` as the idempotency key
        — install the reference connector app or add the custom field
        manually before calling.
        """
        existing = await self._find_by_zensbot_id("Sales Invoice", fee_plan_id)
        if not existing.ok and existing.status_code not in (None, 200, 404):
            return existing

        body: dict[str, Any] = {
            "customer": customer_name,
            "posting_date": posting_date,
            "currency": currency,
            "zensbot_fee_plan_id": fee_plan_id,
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
        existing = await self._find_by_zensbot_id("Payment Entry", payment_id, custom_field="zensbot_payment_id")
        if not existing.ok and existing.status_code not in (None, 200, 404):
            return existing

        body: dict[str, Any] = {
            "payment_type": "Receive",
            "party_type": "Customer",
            "party": customer_name,
            "posting_date": posting_date,
            "paid_amount": amount,
            "received_amount": amount,
            "paid_from": self.cfg.default_receivable_account,
            "paid_to": self.cfg.default_income_account,
            "mode_of_payment": mode_of_payment or self.cfg.default_mode_of_payment,
            "reference_no": reference_no,
            "reference_date": posting_date,
            "zensbot_payment_id": payment_id,
            "zensbot_fee_plan_id": fee_plan_id,
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

    # ── internals ──────────────────────────────────────────────────

    @property
    def _auth_header(self) -> dict[str, str]:
        return {"Authorization": f"token {self._api_key}:{self._api_secret}"}

    async def _find_by_zensbot_id(
        self,
        doctype: str,
        zensbot_id: str,
        *,
        custom_field: str = "zensbot_fee_plan_id",
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
