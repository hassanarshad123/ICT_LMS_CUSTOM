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
from datetime import datetime
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.models.integration import InstituteIntegration
from app.utils.encryption import decrypt

logger = logging.getLogger("ict_lms.frappe_client")

DEFAULT_TIMEOUT = httpx.Timeout(connect=5.0, read=15.0, write=15.0, pool=5.0)

FEE_PLAN_FIELD = "custom_zensbot_fee_plan_id"
PAYMENT_FIELD = "custom_zensbot_payment_id"


def _commission_to_number(rate: Optional[str]) -> float:
    """Normalize a commission rate string ('10%', '10.5', '', None) to a float.

    Frappe's commission fields accept numeric values; passing '10%' as a
    string can be rejected by stricter validators. Returns 0.0 when the
    input is empty/None/unparseable so the doc still submits cleanly.
    """
    if rate is None:
        return 0.0
    s = str(rate).strip().replace("%", "").strip()
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


# LMS uses snake_case ad-hoc payment-method strings (from the Record Payment
# dialog + the onboarding wizard). Frappe's Mode of Payment doctype has
# proper record names that must match exactly — otherwise the PE insert
# fails with LinkValidationError. Standard ERPNext ships with a small set:
# Bank, Bank Draft, Cash, Cheque, Credit Card, Wire Transfer. Pakistan-
# specific wallets (JazzCash, EasyPaisa) and generic "online" don't have
# matching Frappe records on most deployments, so we map them to the closest
# accounting bucket (usually Bank / Wire Transfer).
_LMS_TO_FRAPPE_MODE_OF_PAYMENT: dict[str, str] = {
    "cash": "Cash",
    "bank_transfer": "Bank",
    "jazzcash": "Bank",
    "easypaisa": "Bank",
    "cheque": "Cheque",
    "online": "Wire Transfer",
    # Pseudo-method used by admissions_service when an AO uploads a payment
    # screenshot during onboarding without picking a specific method. Fall
    # through to the institute's default (handled below).
    "onboarding_upload": "",
}


def _normalize_mode_of_payment(
    lms_value: Optional[str], institute_default: Optional[str],
) -> Optional[str]:
    """Map an LMS payment-method string to a Frappe Mode of Payment record
    name. Falls back to the institute's configured default when no mapping
    exists or the mapping is intentionally empty. Returns None when neither
    is set, which lets Frappe apply its own default during insert.
    """
    if lms_value:
        mapped = _LMS_TO_FRAPPE_MODE_OF_PAYMENT.get(lms_value.strip().lower())
        if mapped:
            return mapped
        if mapped == "":
            # Explicit empty in the table -> fall through to institute default
            pass
        else:
            # Unknown LMS value -- trust it; maybe the institute has a
            # custom Frappe record with exactly this name.
            return lms_value
    return institute_default or None


@dataclass(frozen=True)
class FrappeResult:
    ok: bool
    doc_name: Optional[str] = None
    status_code: Optional[int] = None
    response: Optional[dict] = None
    error: Optional[str] = None


@dataclass(frozen=True)
class OverdueInstallment:
    payment_term: str
    due_date: str              # ISO YYYY-MM-DD
    amount_due: int
    outstanding: int


@dataclass(frozen=True)
class OverdueSalesOrder:
    name: str                  # Frappe SO doc name, e.g. "SAL-ORD-2026-00007"
    fee_plan_id: str           # value of custom_zensbot_fee_plan_id (LMS FeePlan UUID as str)
    customer: str
    grand_total: int
    overdue_installments: list["OverdueInstallment"]


@dataclass(frozen=True)
class UnpaidSalesInvoice:
    """Sales Invoice whose status indicates no payment has cleared yet.

    The SI-based suspension cron uses this shape; a row is emitted whenever
    status is NOT in Partly Paid / Paid / Cancelled / Return / Credit Note
    Issued. Any other value (Draft, Unpaid, Overdue, Submitted, ...) is
    treated as "customer hasn't paid anything yet".
    """
    name: str                  # e.g. "ACC-SINV-2026-00054"
    fee_plan_id: str           # custom_zensbot_fee_plan_id value
    customer: str
    grand_total: int
    outstanding_amount: int
    status: str                # Frappe's SI status label


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

    async def submit_sales_order(
        self,
        *,
        fee_plan_id: str,
        payment_id: Optional[str],
        customer_name: str,
        contact_email: Optional[str],
        posting_date: str,
        delivery_date: str,
        currency: str,
        item_code: str,
        item_description: str,
        rate: int,
        sales_person: Optional[str],
        commission_rate: Optional[str],
        payment_terms_template: Optional[str],
        payment_proof_view_url: Optional[str],
        batch_name: Optional[str] = None,
        cnic_no: Optional[str] = None,
        father_name: Optional[str] = None,
    ) -> FrappeResult:
        """Create AND submit (docstatus 0 -> 1) a Sales Order in one request.

        Idempotent by custom_zensbot_fee_plan_id: a second call with the same
        fee_plan_id returns the existing document without re-inserting or
        re-submitting. Callers should treat doc_name as the stable identifier.

        sales_person is the Frappe Sales Person name (resolved by the sync
        layer from User.employee_id -> Sales Person.employee). When None,
        the Sales Order is created without a sales_team row -- acceptable for
        admin-created fee plans that bypass the AO flow.
        """
        # 1. Idempotency check -- a Sales Order with this fee_plan_id may already
        #    exist from a prior attempt. We must inspect its docstatus to decide:
        #      0 (Draft)     -> a previous attempt inserted but submit failed;
        #                       resume by submitting it now.
        #      1 (Submitted) -> done, return as-is.
        #      2 (Cancelled) -> terminal state; return as-is (re-opening requires
        #                       manual intervention in Frappe).
        existing = await self._find_by_zensbot_id("Sales Order", fee_plan_id)
        if not existing.ok and existing.status_code not in (None, 200, 404):
            # Lookup itself failed with a non-404 error — transient, let retry fire.
            return existing
        if existing.ok and existing.doc_name:
            detail = await self.get_single("Sales Order", existing.doc_name)
            if not detail.ok:
                # Couldn't read the existing doc; treat as transient.
                return FrappeResult(
                    ok=False,
                    status_code=detail.status_code,
                    doc_name=existing.doc_name,
                    error=f"Found Sales Order {existing.doc_name} but could not fetch detail",
                )
            existing_doc = (detail.response or {}).get("data") or {}
            existing_docstatus = int(existing_doc.get("docstatus", 0))
            if existing_docstatus != 0:
                # Already submitted (1) or cancelled (2) — nothing to do.
                return FrappeResult(
                    ok=True,
                    status_code=200,
                    doc_name=existing.doc_name,
                    response={"data": existing_doc},
                )
            # docstatus == 0: resume the submit step below with this doc.
            return await self._submit_existing_sales_order(existing.doc_name, existing_doc)

        # 2. Assemble the doc.
        item_row: dict[str, Any] = {
            "item_code": item_code,
            "item_name": item_code,
            "description": item_description,
            "qty": 1,
            "rate": rate,
            "delivery_date": delivery_date,
        }
        if batch_name:
            item_row["custom_batch"] = batch_name
        if self.cfg.default_warehouse:
            item_row["warehouse"] = self.cfg.default_warehouse
        if self.cfg.default_cost_center:
            item_row["cost_center"] = self.cfg.default_cost_center

        body: dict[str, Any] = {
            "doctype": "Sales Order",
            "customer": customer_name,
            "transaction_date": posting_date,
            "delivery_date": delivery_date,
            "order_type": "Sales",
            "currency": currency,
            FEE_PLAN_FIELD: fee_plan_id,
            "items": [item_row],
        }
        if self.cfg.default_company:
            body["company"] = self.cfg.default_company
        if batch_name:
            body["custom_batch"] = batch_name
        if cnic_no:
            body["custom_cnic_no"] = cnic_no
        if father_name:
            body["custom_father_name"] = father_name
        if contact_email:
            body["contact_email"] = contact_email
        if payment_terms_template:
            body["payment_terms_template"] = payment_terms_template
        if sales_person:
            # Header-level commission mirrors the sales_team row so Frappe's
            # total_commission / amount_eligible_for_commission rollups are
            # populated even in edge cases where the row-level value gets
            # lost in a transform.
            _rate_num = _commission_to_number(commission_rate)
            body["sales_team"] = [{
                "sales_person": sales_person,
                "allocated_percentage": 100.0,
                "commission_rate": _rate_num,
            }]
            body["commission_rate"] = _rate_num
        if payment_id:
            body[PAYMENT_FIELD] = payment_id
        if payment_proof_view_url:
            body["custom_zensbot_payment_proof_url"] = payment_proof_view_url

        # 3. Insert.
        insert_url = f"{self.base_url}/api/method/frappe.client.insert"
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                ins = await client.post(
                    insert_url,
                    json={"doc": body},
                    headers=self._auth_header,
                )
        except httpx.RequestError as e:
            return FrappeResult(ok=False, error=f"Network error (insert): {type(e).__name__}")

        if ins.status_code not in (200, 201):
            return FrappeResult(
                ok=False,
                status_code=ins.status_code,
                error=f"Insert failed: {ins.text[:1000]}",
            )

        created = (ins.json() or {}).get("message") or {}
        so_name = created.get("name")
        if not so_name:
            return FrappeResult(
                ok=False,
                status_code=ins.status_code,
                error=f"Frappe did not return a doc name: {ins.text[:500]}",
            )

        # 4. Submit -- flips docstatus 0 -> 1. Delegates to the shared helper so
        #    the resume-existing-Draft path (step 1) and the just-inserted path
        #    both run the exact same submit logic.
        return await self._submit_existing_sales_order(so_name, created)

    async def _submit_existing_sales_order(
        self,
        so_name: str,
        doc: dict,
    ) -> FrappeResult:
        """Run the submit step (docstatus 0 -> 1) on an already-inserted doc.

        Returns doc_name on every path (including failure) so the caller can
        persist it for idempotent retries.
        """
        submit_url = f"{self.base_url}/api/method/frappe.client.submit"
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                sub = await client.post(
                    submit_url,
                    json={"doc": doc},
                    headers=self._auth_header,
                )
        except httpx.RequestError as e:
            return FrappeResult(
                ok=False,
                doc_name=so_name,
                error=f"Submit failed (network): {type(e).__name__}",
            )

        if sub.status_code not in (200, 201):
            return FrappeResult(
                ok=False,
                status_code=sub.status_code,
                doc_name=so_name,
                error=f"Submit failed: {sub.text[:1000]}",
            )

        submitted = (sub.json() or {}).get("message") or doc
        return FrappeResult(
            ok=True,
            status_code=200,
            doc_name=so_name,
            response={"data": submitted},
        )


    async def create_and_submit_sales_invoice_from_so(
        self,
        *,
        so_name: str,
        fee_plan_id: str,
        payment_id: Optional[str] = None,
        payment_proof_view_url: Optional[str] = None,
        sales_person: Optional[str] = None,
        commission_rate: Optional[str] = None,
    ) -> FrappeResult:
        """Generate + submit a Sales Invoice from an existing Sales Order.

        Uses ERPNext's stock transform
        ``erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice``
        to get a draft doc, stamps our custom fields, then inserts + submits
        in the same request cycle. Idempotent via
        ``custom_zensbot_fee_plan_id`` -- if an SI with that fee_plan_id
        already exists, it's returned as-is (regardless of docstatus); a
        Draft found in that state is submitted.
        """
        # 1. Idempotency check
        existing = await self._find_by_zensbot_id("Sales Invoice", fee_plan_id)
        if not existing.ok and existing.status_code not in (None, 200, 404):
            return existing
        if existing.ok and existing.doc_name:
            detail = await self.get_single("Sales Invoice", existing.doc_name)
            if not detail.ok:
                return FrappeResult(
                    ok=False,
                    status_code=detail.status_code,
                    doc_name=existing.doc_name,
                    error=f"Found SI {existing.doc_name} but detail fetch failed",
                )
            existing_doc = (detail.response or {}).get("data") or {}
            if int(existing_doc.get("docstatus", 0)) != 0:
                return FrappeResult(
                    ok=True,
                    status_code=200,
                    doc_name=existing.doc_name,
                    response={"data": existing_doc},
                )
            # Draft found -- stamp missing fields and submit.
            return await self._stamp_and_submit_sales_invoice(
                existing_doc, fee_plan_id, payment_id, payment_proof_view_url,
                sales_person, commission_rate,
            )

        # 2. Ask Frappe to build a draft SI from the SO.
        transform_url = (
            f"{self.base_url}/api/method/erpnext.selling.doctype.sales_order."
            f"sales_order.make_sales_invoice"
        )
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.get(
                    transform_url,
                    params={"source_name": so_name},
                    headers=self._auth_header,
                )
        except httpx.RequestError as e:
            return FrappeResult(
                ok=False,
                error=f"Network error (make_sales_invoice): {type(e).__name__}",
            )
        if resp.status_code != 200:
            return FrappeResult(
                ok=False,
                status_code=resp.status_code,
                error=f"make_sales_invoice failed: {resp.text[:800]}",
            )
        draft = (resp.json() or {}).get("message") or {}
        if not draft:
            return FrappeResult(
                ok=False,
                status_code=resp.status_code,
                error="make_sales_invoice returned empty doc",
            )

        # 3. Stamp + submit.
        return await self._stamp_and_submit_sales_invoice(
            draft, fee_plan_id, payment_id, payment_proof_view_url,
            sales_person, commission_rate,
        )

    async def _stamp_and_submit_sales_invoice(
        self,
        draft: dict,
        fee_plan_id: str,
        payment_id: Optional[str],
        payment_proof_view_url: Optional[str],
        sales_person: Optional[str] = None,
        commission_rate: Optional[str] = None,
    ) -> FrappeResult:
        """Stamp zensbot custom fields + commission onto a draft SI dict,
        insert (if no name yet), then submit. Shared by the create path and
        the resume-existing-Draft path.

        Commission handling: ``make_sales_invoice`` copies ``sales_team``
        from the source SO, but we still stamp it explicitly here so the
        commission survives every edge case (partial transforms, Frappe
        version drift). Also mirrors the rate at the header level via
        ``commission_rate`` so Frappe's total_commission rollup is populated.
        """
        draft[FEE_PLAN_FIELD] = fee_plan_id
        if payment_id:
            draft["custom_zensbot_payment_id"] = payment_id
        if payment_proof_view_url:
            draft["custom_zensbot_payment_proof_url"] = payment_proof_view_url

        # Commission: stamp sales_team + header commission_rate. When
        # sales_person is not known (admin bypassing the AO flow), leave
        # whatever the transform copied across untouched.
        if sales_person:
            _rate_num = _commission_to_number(commission_rate)
            draft["sales_team"] = [{
                "sales_person": sales_person,
                "allocated_percentage": 100.0,
                "commission_rate": _rate_num,
            }]
            draft["commission_rate"] = _rate_num

        has_name = bool(draft.get("name"))

        if not has_name:
            insert_url = f"{self.base_url}/api/method/frappe.client.insert"
            try:
                async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                    ins = await client.post(
                        insert_url,
                        json={"doc": draft},
                        headers=self._auth_header,
                    )
            except httpx.RequestError as e:
                return FrappeResult(
                    ok=False,
                    error=f"Network error (SI insert): {type(e).__name__}",
                )
            if ins.status_code not in (200, 201):
                return FrappeResult(
                    ok=False,
                    status_code=ins.status_code,
                    error=f"SI insert failed: {ins.text[:800]}",
                )
            created = (ins.json() or {}).get("message") or {}
            si_name = created.get("name")
            if not si_name:
                return FrappeResult(
                    ok=False,
                    status_code=ins.status_code,
                    error=f"SI insert returned no name: {ins.text[:400]}",
                )
            draft = created

        submit_url = f"{self.base_url}/api/method/frappe.client.submit"
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                sub = await client.post(
                    submit_url,
                    json={"doc": draft},
                    headers=self._auth_header,
                )
        except httpx.RequestError as e:
            return FrappeResult(
                ok=False,
                doc_name=draft.get("name"),
                error=f"SI submit failed (network): {type(e).__name__}",
            )
        if sub.status_code not in (200, 201):
            return FrappeResult(
                ok=False,
                status_code=sub.status_code,
                doc_name=draft.get("name"),
                error=f"SI submit failed: {sub.text[:800]}",
            )
        submitted = (sub.json() or {}).get("message") or draft
        return FrappeResult(
            ok=True,
            status_code=200,
            doc_name=draft.get("name") or submitted.get("name"),
            response={"data": submitted},
        )

    async def list_overdue_sales_orders(self) -> list[OverdueSalesOrder]:
        """Enumerate Sales Orders in this institute's Frappe that have at least
        one payment_schedule row with due_date < today AND outstanding > 0.

        Two-step fetch:
          1. GET /api/resource/Sales Order filtered to submitted (docstatus=1),
             non-cancelled, and with custom_zensbot_fee_plan_id set.
          2. For each hit, GET the full doc to inspect the payment_schedule
             child table (not returned by list queries).

        Returns [] on any Frappe error -- the caller treats that as "nothing to
        enforce this run" rather than aborting the whole batch.
        """
        today = datetime.utcnow().date().isoformat()
        listing = await self.list_resource(
            "Sales Order",
            fields=["name", FEE_PLAN_FIELD, "customer", "grand_total"],
            filters=[
                [FEE_PLAN_FIELD, "is", "set"],
                ["docstatus", "=", 1],
                ["status", "not in", ["Closed", "Cancelled"]],
            ],
            limit=5000,
        )
        if not listing.ok:
            logger.warning(
                "Failed to list Sales Orders for overdue check: %s", listing.error,
            )
            return []

        rows = (listing.response or {}).get("data") or []
        out: list[OverdueSalesOrder] = []

        for row in rows:
            detail = await self.get_single("Sales Order", row["name"])
            if not detail.ok:
                logger.warning(
                    "Failed to fetch Sales Order %s for overdue inspection: %s",
                    row.get("name"), detail.error,
                )
                continue
            doc = (detail.response or {}).get("data") or {}
            schedule = doc.get("payment_schedule") or []
            overdue_rows: list[OverdueInstallment] = []
            for sched in schedule:
                due = sched.get("due_date") or ""
                outstanding = float(sched.get("outstanding") or 0)
                if due and due < today and outstanding > 0:
                    overdue_rows.append(OverdueInstallment(
                        payment_term=sched.get("payment_term", "") or "",
                        due_date=due,
                        amount_due=int(float(sched.get("payment_amount") or 0)),
                        outstanding=int(outstanding),
                    ))
            if overdue_rows:
                fee_plan_id_value = doc.get(FEE_PLAN_FIELD) or row.get(FEE_PLAN_FIELD) or ""
                out.append(OverdueSalesOrder(
                    name=doc["name"],
                    fee_plan_id=str(fee_plan_id_value),
                    customer=doc.get("customer") or "",
                    grand_total=int(float(doc.get("grand_total") or 0)),
                    overdue_installments=overdue_rows,
                ))
        return out

    async def list_unpaid_sales_invoices(self) -> list[UnpaidSalesInvoice]:
        """Find zensbot-linked Sales Invoices whose status is not Paid or
        Partly Paid.

        Used by the SI-based suspension cron: the moment an SI flips to
        Partly Paid (first installment cleared) or Paid (fully cleared),
        this query stops returning it — the cron then lifts the suspension
        on its next pass.
        """
        res = await self.list_resource(
            "Sales Invoice",
            fields=[
                "name", FEE_PLAN_FIELD, "customer", "grand_total",
                "outstanding_amount", "status",
            ],
            filters=[
                [FEE_PLAN_FIELD, "is", "set"],
                ["status", "not in", [
                    "Partly Paid", "Paid", "Cancelled",
                    "Return", "Credit Note Issued",
                ]],
            ],
            limit=5000,
        )
        if not res.ok:
            logger.warning(
                "Failed to list unpaid Sales Invoices: %s", res.error,
            )
            return []
        out: list[UnpaidSalesInvoice] = []
        for row in (res.response or {}).get("data") or []:
            fp_id = row.get(FEE_PLAN_FIELD)
            if not fp_id:
                continue
            out.append(UnpaidSalesInvoice(
                name=row["name"],
                fee_plan_id=str(fp_id),
                customer=row.get("customer") or "",
                grand_total=int(float(row.get("grand_total") or 0)),
                outstanding_amount=int(float(row.get("outstanding_amount") or 0)),
                status=row.get("status") or "",
            ))
        return out

    async def get_payment_entry_status(self, pe_name: str) -> FrappeResult:
        """Fetch a Payment Entry and return its docstatus-derived erp_status.

        Returns FrappeResult with .response = {"erp_status": "pending" |
        "confirmed" | "cancelled"} on success. 404 (Frappe doesn't know the
        doc, e.g. it was deleted) is reported as erp_status="unknown" so
        the caller can flag the LMS row and stop polling.
        """
        detail = await self.get_single("Payment Entry", pe_name)
        if not detail.ok:
            if detail.status_code == 404:
                return FrappeResult(
                    ok=True,
                    status_code=404,
                    response={"erp_status": "unknown"},
                )
            return detail
        doc = (detail.response or {}).get("data") or {}
        docstatus = int(doc.get("docstatus", 0))
        mapped = {0: "pending", 1: "confirmed", 2: "cancelled"}.get(docstatus, "unknown")
        return FrappeResult(
            ok=True,
            status_code=200,
            doc_name=pe_name,
            response={"erp_status": mapped, "docstatus": docstatus},
        )

    async def get_sales_invoice_status(self, si_name: str) -> Optional[str]:
        """Return the Sales Invoice's status string or None if unreachable."""
        detail = await self.get_single("Sales Invoice", si_name)
        if not detail.ok:
            return None
        doc = (detail.response or {}).get("data") or {}
        status = doc.get("status")
        return str(status) if status else None

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
        payment_term: Optional[str] = None,
        cnic_no: Optional[str] = None,
        father_name: Optional[str] = None,
    ) -> FrappeResult:
        existing = await self._find_by_zensbot_id("Payment Entry", payment_id, custom_field=PAYMENT_FIELD)
        if not existing.ok and existing.status_code not in (None, 200, 404):
            return existing

        # paid_to must be a balance-sheet asset (bank/cash). Fall back to the
        # income account only for legacy rows that predate default_bank_account —
        # Frappe will reject the posting but we avoid crashing on missing field.
        paid_to = self.cfg.default_bank_account or self.cfg.default_income_account
        body: dict[str, Any] = {
            # Land as Draft — accounting reviews the proof screenshot
            # (custom_zensbot_payment_proof_url) in Frappe, then submits.
            # Only after the admin submit does the SI's payment_schedule
            # row's paid_amount update and the LMS cron reactivate the
            # student.
            "docstatus": 0,
            "payment_type": "Receive",
            "party_type": "Customer",
            "party": customer_name,
            "posting_date": posting_date,
            "paid_amount": amount,
            "received_amount": amount,
            "paid_from": self.cfg.default_receivable_account,
            "paid_to": paid_to,
            "mode_of_payment": _normalize_mode_of_payment(
                mode_of_payment, self.cfg.default_mode_of_payment,
            ),
            "reference_no": reference_no,
            "reference_date": posting_date,
            PAYMENT_FIELD: payment_id,
            FEE_PLAN_FIELD: fee_plan_id,
        }
        if self.cfg.default_company:
            body["company"] = self.cfg.default_company
        if self.cfg.default_cost_center:
            body["cost_center"] = self.cfg.default_cost_center
        if cnic_no:
            body["custom_cnic_no"] = cnic_no
        if father_name:
            body["custom_father_name"] = father_name
        if invoice_name:
            ref: dict[str, Any] = {
                "reference_doctype": "Sales Invoice",
                "reference_name": invoice_name,
                "allocated_amount": amount,
            }
            if payment_term:
                ref["payment_term"] = payment_term
            body["references"] = [ref]

        if existing.ok and existing.doc_name:
            return await self._put_resource("Payment Entry", existing.doc_name, body)
        return await self._post_resource("Payment Entry", body)

    async def attach_file_to_doc(
        self,
        *,
        doctype: str,
        docname: str,
        file_bytes: bytes,
        file_name: str,
        content_type: str = "application/octet-stream",
        is_private: bool = True,
    ) -> FrappeResult:
        """Attach a binary file to any Frappe doc via ``/api/method/upload_file``.

        Idempotent: if a File record with the same ``file_name`` is already
        attached to (doctype, docname), return ok without re-uploading. This
        matters because the PE sync may retry after a transient failure; we
        don't want a new attachment on every retry.

        Defaults to private files — the payment screenshot carries customer
        bank / payment-slip details and should not be world-readable.
        """
        list_res = await self.list_resource(
            "File",
            fields=["name", "file_name"],
            filters=[
                ["attached_to_doctype", "=", doctype],
                ["attached_to_name", "=", docname],
            ],
            limit=50,
        )
        if list_res.ok:
            for row in (list_res.response or {}).get("data") or []:
                if row.get("file_name") == file_name:
                    return FrappeResult(
                        ok=True,
                        status_code=200,
                        doc_name=row.get("name"),
                        response={"skipped": True},
                    )

        url = f"{self.base_url}/api/method/upload_file"
        files = {"file": (file_name, file_bytes, content_type)}
        data = {
            "doctype": doctype,
            "docname": docname,
            "is_private": "1" if is_private else "0",
            "folder": "Home/Attachments",
        }
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.post(
                    url, data=data, files=files, headers=self._auth_header,
                )
        except httpx.RequestError as e:
            return FrappeResult(
                ok=False, error=f"Network error (attach): {type(e).__name__}",
            )

        if resp.status_code not in (200, 201):
            return FrappeResult(
                ok=False,
                status_code=resp.status_code,
                error=f"Attach failed: {resp.text[:500]}",
            )
        created = (resp.json() or {}).get("message") or {}
        return FrappeResult(
            ok=True,
            status_code=resp.status_code,
            doc_name=created.get("name"),
            response=created,
        )

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

    async def get_single(self, doctype: str, name: str) -> FrappeResult:
        """GET /api/resource/{doctype}/{name} — full document including child tables.

        Used for cases where you need the nested detail (e.g. Payment Terms
        Template with its terms[]), which list_resource can't return.
        """
        from urllib.parse import quote
        url = f"{self.base_url}/api/resource/{quote(doctype)}/{quote(name)}"
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.get(url, headers=self._auth_header)
        except httpx.RequestError as e:
            return FrappeResult(ok=False, error=f"Network error: {type(e).__name__}")
        if resp.status_code != 200:
            return FrappeResult(ok=False, status_code=resp.status_code, error=resp.text[:500])
        return FrappeResult(ok=True, status_code=200, response=resp.json())

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
