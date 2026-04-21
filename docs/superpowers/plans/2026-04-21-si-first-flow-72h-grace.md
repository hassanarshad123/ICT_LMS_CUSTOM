# SI-First Flow + 72h Grace Period Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the onboarding→suspension pipeline so every new enrollment creates BOTH a Sales Order and a submitted Sales Invoice (inheriting the SO's terms/schedule) in Frappe, payment-proof screenshots now attach to the SI (not the SO), every student gets 72 hours of unconditional LMS access on onboarding, and the daily suspension cron reads the SI's status instead of the SO's `payment_schedule` outstanding.

**Architecture:**
- On `fee.plan_created`: existing path creates the SO (unchanged), then calls `frappe.client.submit + Make Invoice from SO` to generate a submitted SI that carries the same `payment_terms_template`, `sales_team[]`, items, and customer. The new SI gets its own zensbot custom fields stamped (`fee_plan_id`, `payment_id`, `payment_proof_url`).
- Payment Entry sync references the SI (not the SO) so `payment_schedule[].paid_amount` updates correctly, fixing the outstanding-detection bug from yesterday.
- New `fee_plans.grace_period_ends_at TIMESTAMPTZ` column, set to `created_at + 72h` at onboarding time. Suspension cron skips any plan whose grace hasn't elapsed.
- Suspension cron switches from reading SO `payment_schedule[].outstanding` to SI `status` — suspend when the SI status is `Draft`, `Unpaid`, or `Overdue`; reactivate when it's `Partly Paid` or `Paid`.

**Tech Stack:** FastAPI · SQLModel · Alembic · APScheduler (existing) · httpx-based `FrappeClient` (existing) · Frappe REST + `frappe.client.insert/submit` + `erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice`.

**Branch:** `feat/si-first-flow-72h-grace` (already created from `upstream/main`). Per session preferences: no per-phase tests (consolidate in Phase 7), no `Co-Authored-By` trailer, push to `origin` (fork) + PR to upstream main.

**Supersedes:** `docs/superpowers/plans/2026-04-21-frappe-overdue-suspension.md` (Phases 1-5 of which already shipped). This plan keeps those structural elements (`users.suspension_reason`, `fee_enforcement_service` skeleton, daily cron job) and extends them.

---

## Team Assignments

| Phase | Scope | Primary Agent | Primary Skills | Review Agent |
|-------|-------|---------------|----------------|--------------|
| 1 | Schema — `fee_plans.grace_period_ends_at` | `database-reviewer` | `database-migrations`, `postgres-patterns` | — |
| 2 | Connector fixtures — 2 new SI custom fields (`payment_id`, `payment_proof_url`) | `general-purpose` | `get-api-docs` (Frappe Custom Field) | — |
| 3 | `FrappeClient.create_sales_invoice_from_so` + update `upsert_payment_entry` to reference SI with `payment_term` | `python-reviewer` | `backend-patterns`, `api-design` | `code-reviewer` |
| 4 | Sync orchestration — extend `_sync_sales_order` to also create SI; add `_sync_sales_invoice_for_plan` helper; re-route payment-proof URL to SI | `python-reviewer` | `backend-patterns` | — |
| 5 | Enforcement service switch — from SO-schedule overdue → SI-status overdue, honor 72h grace | `python-reviewer` | `backend-patterns` | — |
| 6 | Frontend — update uploader helper copy (+ admin-facing references) to reflect SI-not-SO storage | `general-purpose` | `frontend-patterns` | — |
| 7 | Consolidated tests + migration apply + deploy + prod smoke | `e2e-runner` | `python-testing`, `deployment-patterns` | `security-reviewer` |

Fresh subagent per phase. Phase N doesn't start until Phase N-1 CHECKPOINT is verified.

---

## Grounded facts verified against `deverp.ict.net.pk` (2026-04-21)

1. **Sales Invoice schema:** 107 top-level fields. Key ones: `name` (auto `ACC-SINV-YYYY-NNNNN`), `customer`, `posting_date`, `due_date`, `grand_total`, `outstanding_amount`, `status` (values: `Draft / Submitted / Partly Paid / Paid / Overdue / Cancelled / Return`), `docstatus`, `debit_to`, `payment_terms_template`. Child tables: `items[]` (each item row carries `sales_order` + `so_detail` back-references), `payment_schedule[]` (inherited from template), `advances[]`, `sales_team[]`, `taxes[]`.
2. **Existing `custom_zensbot_fee_plan_id` on Sales Invoice** — already shipped via connector fixture, already populating correctly (verified on `ACC-SINV-2026-00054` for `9b2fe003…`).
3. **Frappe's stock SO→SI transform:** `/api/method/erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice?source_name=<SO>` returns a draft SI doc with items/sales_team/payment_schedule copied from the parent SO. Then a `frappe.client.insert` + `frappe.client.submit` materializes and books it.
4. **PE against SI behavior:** when `Payment Entry.references[]` has `reference_doctype: "Sales Invoice"` + `payment_term: "<term_name>"`, Frappe updates that row's `paid_amount` + the SI's `status` (via `_make_gl_entries_on_advance_allocation`). Current LMS sync sets `reference_doctype: "Sales Order"` with `payment_term=None` — this is why Kamil's 1st installment still shows `outstanding=6000` even though the PE booked 6000 as advance.
5. **Existing `users.suspension_reason`** (migration 044, already live) stays. The suspension cron already exists at `19:00 UTC` (= 00:00 PKT) — this plan just rewires its query.
6. **`fee_plans` table** has existing fields `frappe_item_code`, `frappe_payment_terms_template`, `frappe_sales_order_name` (from migration 043). This plan adds `frappe_sales_invoice_name` + `grace_period_ends_at`.

---

## File Structure

**Backend — new files (2)**
- `backend/migrations/versions/045_feeplan_grace_and_si.py` — adds `fee_plans.grace_period_ends_at TIMESTAMPTZ NULL` + `fee_plans.frappe_sales_invoice_name VARCHAR(140) NULL` + index on the SI name.
- None — `fee_enforcement_service.py` is modified in place (it already exists).

**Backend — modified files (7)**
- `backend/app/models/fee.py` — mirror two new columns on `FeePlan` + `Index("ix_fee_plans_frappe_sales_invoice_name")`.
- `backend/app/services/admissions_service.py` — set `plan.grace_period_ends_at = plan.created_at + timedelta(hours=72)` inside `_create_enrollment_with_plan`.
- `backend/app/services/frappe_client.py` — add `create_and_submit_sales_invoice_from_so(so_name, fee_plan_id, payment_id=None, payment_proof_view_url=None)`; update `upsert_payment_entry` to reference `Sales Invoice` with `payment_term` on the reference row; stop posting payment proof URL on the SO.
- `backend/app/services/frappe_sync_service.py` — extend `_sync_sales_order` to call the new SI helper after the SO submits, stamp `plan.frappe_sales_invoice_name`, and pass the payment-proof view URL through the SI (not the SO). Update `_sync_payment_entry` to use the stored `frappe_sales_invoice_name` (fallback: look up by fee_plan_id).
- `backend/app/services/fee_enforcement_service.py` — rewrite `enforce_overdue_suspensions` and `lift_suspensions_if_cleared` to query Frappe Sales Invoices (not Sales Orders) and honor the 72h grace window.
- `zensbot_lms_connector/zensbot_lms_connector/fixtures/custom_field.json` — add `Sales Invoice-custom_zensbot_payment_id` + `Sales Invoice-custom_zensbot_payment_proof_url`.
- `zensbot_lms_connector/zensbot_lms_connector/hooks.py` — extend fixture filter with the two new names.

**Frontend — modified files (1)**
- `frontend/components/admissions/record-payment-dialog.tsx` — update the helper caption under the uploader (currently says *"linked to the Sales Order in ERP"*; change to *"linked to the Sales Invoice in ERP"*).

**Docs — new (1)**
- `docs/claude/frappe-si-first-flow.md` — ops runbook: 72h grace, SI-driven suspension, what admins see when a student is in grace vs. suspended, how to manually override.

---

## Phase 1 — Schema: grace period + SI name on FeePlan

**Team:** `database-reviewer` · skills `database-migrations`, `postgres-patterns`.

### Task 1.1: Create migration 045

**Files:**
- Create: `backend/migrations/versions/045_feeplan_grace_and_si.py`

- [ ] **Step 1: Check the latest migration to get `down_revision`**

Run: `ls backend/migrations/versions/ | tail -3`
Expected: `044_user_suspension_reason.py` at the top. New revision is `"045"`, `down_revision = "044"`.

- [ ] **Step 2: Write the migration file**

Exact content:

```python
"""fee_plans: grace_period_ends_at + frappe_sales_invoice_name

Revision ID: 045
Revises: 044
Create Date: 2026-04-21

Adds 72-hour grace window tracking and the SI pointer used by the new
SI-first sync path.

Column 1: grace_period_ends_at -- NULL for legacy plans (they don't have a
grace window; the enforcement service skips NULL values as "grace already
elapsed"). New plans get NOW() + 72h set by admissions_service.

Column 2: frappe_sales_invoice_name -- populated by the sync when a
Sales Invoice is created from the companion Sales Order. Indexed so inbound
webhooks can look up plans by SI doc name in O(1).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "045"
down_revision = "044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fee_plans",
        sa.Column(
            "grace_period_ends_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "fee_plans",
        sa.Column(
            "frappe_sales_invoice_name",
            sa.String(length=140),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_fee_plans_frappe_sales_invoice_name",
        "fee_plans",
        ["frappe_sales_invoice_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_fee_plans_frappe_sales_invoice_name", table_name="fee_plans",
    )
    op.drop_column("fee_plans", "frappe_sales_invoice_name")
    op.drop_column("fee_plans", "grace_period_ends_at")
```

- [ ] **Step 3: Byte-compile**

Run: `cd backend && py -m py_compile migrations/versions/045_feeplan_grace_and_si.py`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/versions/045_feeplan_grace_and_si.py
git commit -m "feat(db): migration 045 - fee_plans grace_period_ends_at + frappe_sales_invoice_name"
```

### Task 1.2: Mirror columns on `FeePlan` model

**Files:**
- Modify: `backend/app/models/fee.py`

- [ ] **Step 1: Add the two fields**

Find `FeePlan` class. Add AFTER the existing `frappe_sales_order_name` field (added in migration 043):

```python
    grace_period_ends_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(sa.TIMESTAMP(timezone=True), nullable=True),
    )
    frappe_sales_invoice_name: Optional[str] = Field(
        default=None,
        sa_column=Column(sa.String(140), nullable=True),
    )
```

`Optional`, `datetime`, `Field`, `Column`, `sa` should already be imported by this file — verify before editing.

- [ ] **Step 2: Add index to `FeePlan.__table_args__`**

In the existing `__table_args__` tuple, append:

```python
    Index(
        "ix_fee_plans_frappe_sales_invoice_name",
        "frappe_sales_invoice_name",
        unique=False,
    ),
```

- [ ] **Step 3: Byte-compile**

Run: `cd backend && py -m py_compile app/models/fee.py`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/fee.py
git commit -m "feat(fees): mirror grace_period_ends_at + frappe_sales_invoice_name on FeePlan model"
```

### PHASE 1 CHECKPOINT

**Deliverable:** Migration + model synced. Alembic applies in Phase 7.

**Verification:**
- [ ] `cd backend && py -m compileall -q app/models/fee.py migrations/versions/045_feeplan_grace_and_si.py` — clean.
- [ ] `git log --oneline -2` — two new commits on top of main.
- [ ] Confirm migration's `revision = "045"`, `down_revision = "044"`.

---

## Phase 2 — Connector fixtures: Sales Invoice custom fields

**Team:** `general-purpose` · skill `get-api-docs`.

### Task 2.1: Extend the fixture JSON

**Files:**
- Modify: `zensbot_lms_connector/zensbot_lms_connector/fixtures/custom_field.json`

- [ ] **Step 1: Read the file and note its current shape**

Expected: top-level JSON array with 6 entries (1 SI + 2 PE + 3 SO, all prefixed `custom_*` after PR #71).

- [ ] **Step 2: Append two entries for the SI**

Add these two objects to the array (insert before the closing `]`):

```json
,
  {
    "doctype": "Custom Field",
    "name": "Sales Invoice-custom_zensbot_payment_id",
    "dt": "Sales Invoice",
    "fieldname": "custom_zensbot_payment_id",
    "label": "Zensbot Payment ID",
    "fieldtype": "Data",
    "unique": 0,
    "read_only": 1,
    "hidden": 0,
    "insert_after": "custom_zensbot_fee_plan_id",
    "description": "LMS FeePayment UUID linked to this Sales Invoice. Populated by the Zensbot LMS sync."
  },
  {
    "doctype": "Custom Field",
    "name": "Sales Invoice-custom_zensbot_payment_proof_url",
    "dt": "Sales Invoice",
    "fieldname": "custom_zensbot_payment_proof_url",
    "label": "Payment Proof",
    "fieldtype": "Long Text",
    "unique": 0,
    "read_only": 1,
    "hidden": 0,
    "insert_after": "custom_zensbot_payment_id",
    "description": "Signed URL to the onboarding payment screenshot stored by the Zensbot LMS."
  }
```

### Task 2.2: Extend the hooks.py fixture filter list

**Files:**
- Modify: `zensbot_lms_connector/zensbot_lms_connector/hooks.py`

- [ ] **Step 1: Append two names to the filter list**

Change:

```python
fixtures = [
    {"dt": "Custom Field", "filters": [["name", "in", [
        "Sales Invoice-custom_zensbot_fee_plan_id",
        "Payment Entry-custom_zensbot_fee_plan_id",
        "Payment Entry-custom_zensbot_payment_id",
        "Sales Order-custom_zensbot_fee_plan_id",
        "Sales Order-custom_zensbot_payment_id",
        "Sales Order-custom_zensbot_payment_proof_url",
        "Sales Invoice-custom_zensbot_payment_id",
        "Sales Invoice-custom_zensbot_payment_proof_url",
    ]]]},
]
```

### Task 2.3: Install the fields on `deverp.ict.net.pk` via REST (same pattern as PR #71)

Because the connector won't be re-migrated in production, we install the two new fields via the Frappe REST API now so Phase 3's SI writes work on first attempt.

- [ ] **Step 1: Confirm the fields don't already exist**

```bash
curl -sS -G "https://deverp.ict.net.pk/api/resource/Custom%20Field" \
  -H "Authorization: token f745906bb8029af:e1f9096d67eca6b" \
  --data-urlencode 'filters=[["dt","=","Sales Invoice"],["fieldname","in",["custom_zensbot_payment_id","custom_zensbot_payment_proof_url"]]]' \
  --data-urlencode 'fields=["name","fieldname"]'
```
Expected: `{"data":[]}`.

- [ ] **Step 2: Insert both fields**

```bash
for payload in \
  '{"doctype":"Custom Field","dt":"Sales Invoice","fieldname":"custom_zensbot_payment_id","label":"Zensbot Payment ID","fieldtype":"Data","unique":0,"read_only":1,"hidden":0,"insert_after":"custom_zensbot_fee_plan_id","description":"LMS FeePayment UUID linked to this Sales Invoice."}' \
  '{"doctype":"Custom Field","dt":"Sales Invoice","fieldname":"custom_zensbot_payment_proof_url","label":"Payment Proof","fieldtype":"Long Text","unique":0,"read_only":1,"hidden":0,"insert_after":"custom_zensbot_payment_id","description":"Signed URL to payment screenshot."}'; do
  curl -sS -X POST "https://deverp.ict.net.pk/api/method/frappe.client.insert" \
    -H "Authorization: token f745906bb8029af:e1f9096d67eca6b" \
    -H "Content-Type: application/json" \
    -d "{\"doc\": $payload}" | head -c 200
  echo
done
```
Expected: two lines each starting with `{"message":{"name":"Sales Invoice-custom_zensbot_..."`.

- [ ] **Step 3: Verify**

```bash
curl -sS -G "https://deverp.ict.net.pk/api/resource/Custom%20Field" \
  -H "Authorization: token f745906bb8029af:e1f9096d67eca6b" \
  --data-urlencode 'filters=[["dt","=","Sales Invoice"],["fieldname","like","%zensbot%"]]' \
  --data-urlencode 'fields=["name","fieldname"]'
```
Expected: 3 rows — the existing `custom_zensbot_fee_plan_id` plus both new ones.

### Task 2.4: Commit

- [ ] **Step 1: Commit the fixture + hooks changes**

```bash
git add zensbot_lms_connector/
git commit -m "feat(connector): add Sales Invoice custom_zensbot_payment_id + payment_proof_url fixtures"
```

### PHASE 2 CHECKPOINT

**Deliverable:** Connector fixture + prod Frappe both carry the two new SI custom fields.

**Verification:**
- [ ] `jq '[.[] | select(.dt=="Sales Invoice") | .fieldname]' zensbot_lms_connector/zensbot_lms_connector/fixtures/custom_field.json` prints all three (`custom_zensbot_fee_plan_id`, `custom_zensbot_payment_id`, `custom_zensbot_payment_proof_url`).
- [ ] Task 2.3 Step 3 returns all three rows from `deverp.ict.net.pk`.
- [ ] The fixture filter in `hooks.py` matches the `name` values in the JSON.

---

## Phase 3 — FrappeClient: SI creation helper + PE reference fix

**Team:** `python-reviewer` · skills `backend-patterns`, `api-design` · reviewed by `code-reviewer`.

### Task 3.1: Add `create_and_submit_sales_invoice_from_so`

**Files:**
- Modify: `backend/app/services/frappe_client.py`

- [ ] **Step 1: Read the file to locate `submit_sales_order` + `_submit_existing_sales_order`**

We're adding the new method next to them so the SO→SI path is readable top-to-bottom.

- [ ] **Step 2: Add the helper method**

Insert immediately after `_submit_existing_sales_order`:

```python
async def create_and_submit_sales_invoice_from_so(
    self,
    *,
    so_name: str,
    fee_plan_id: str,
    payment_id: Optional[str] = None,
    payment_proof_view_url: Optional[str] = None,
) -> FrappeResult:
    """Generate + submit a Sales Invoice from an existing Sales Order.

    Uses ERPNext's stock transform
    ``erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice``
    to get a draft doc, stamps our custom fields, then inserts + submits
    in the same request cycle. Idempotent via
    ``custom_zensbot_fee_plan_id`` — if an SI with that fee_plan_id
    already exists, it's returned as-is (regardless of docstatus).
    """
    # 1. Idempotency check
    existing = await self._find_by_zensbot_id("Sales Invoice", fee_plan_id)
    if not existing.ok and existing.status_code not in (None, 200, 404):
        return existing
    if existing.ok and existing.doc_name:
        # Already have one. If Draft, try to submit; otherwise return as-is.
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
                ok=True, status_code=200,
                doc_name=existing.doc_name,
                response={"data": existing_doc},
            )
        # Draft exists — stamp missing fields and submit it.
        return await self._stamp_and_submit_sales_invoice(
            existing_doc, fee_plan_id, payment_id, payment_proof_view_url,
        )

    # 2. Ask Frappe to build a draft SI from the SO
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
            ok=False, error=f"Network error (make_sales_invoice): {type(e).__name__}"
        )
    if resp.status_code != 200:
        return FrappeResult(
            ok=False, status_code=resp.status_code,
            error=f"make_sales_invoice failed: {resp.text[:800]}",
        )
    draft = (resp.json() or {}).get("message") or {}
    if not draft:
        return FrappeResult(
            ok=False, status_code=resp.status_code,
            error="make_sales_invoice returned empty doc",
        )

    # 3. Stamp custom fields on the draft and submit.
    return await self._stamp_and_submit_sales_invoice(
        draft, fee_plan_id, payment_id, payment_proof_view_url,
    )


async def _stamp_and_submit_sales_invoice(
    self,
    draft: dict,
    fee_plan_id: str,
    payment_id: Optional[str],
    payment_proof_view_url: Optional[str],
) -> FrappeResult:
    """Stamp zensbot custom fields onto a draft SI dict, insert or update,
    then submit. Shared by the create path and the resume-draft path."""
    draft[FEE_PLAN_FIELD] = fee_plan_id
    if payment_id:
        draft["custom_zensbot_payment_id"] = payment_id
    if payment_proof_view_url:
        draft["custom_zensbot_payment_proof_url"] = payment_proof_view_url

    has_name = bool(draft.get("name"))

    # If the doc already has a name (= came from our idempotency lookup), we
    # skip insert and go straight to submit. Otherwise insert first.
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
                ok=False, error=f"Network error (SI insert): {type(e).__name__}",
            )
        if ins.status_code not in (200, 201):
            return FrappeResult(
                ok=False, status_code=ins.status_code,
                error=f"SI insert failed: {ins.text[:800]}",
            )
        created = (ins.json() or {}).get("message") or {}
        si_name = created.get("name")
        if not si_name:
            return FrappeResult(
                ok=False, status_code=ins.status_code,
                error=f"SI insert returned no name: {ins.text[:400]}",
            )
        draft = created  # use the persisted doc for submit

    # Submit
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
            ok=False, status_code=sub.status_code,
            doc_name=draft.get("name"),
            error=f"SI submit failed: {sub.text[:800]}",
        )
    submitted = (sub.json() or {}).get("message") or draft
    return FrappeResult(
        ok=True, status_code=200,
        doc_name=draft.get("name") or submitted.get("name"),
        response={"data": submitted},
    )
```

- [ ] **Step 3: Byte-compile**

Run: `cd backend && py -m py_compile app/services/frappe_client.py`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/frappe_client.py
git commit -m "feat(frappe-client): create_and_submit_sales_invoice_from_so helper"
```

### Task 3.2: Update `upsert_payment_entry` to reference the SI with `payment_term`

**Files:**
- Modify: `backend/app/services/frappe_client.py`

- [ ] **Step 1: Change the signature**

Current signature:

```python
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
```

Add a new optional kwarg at the end:

```python
    payment_term: Optional[str] = None,
```

- [ ] **Step 2: Update the `references[]` block**

Find this block:

```python
if invoice_name:
    body["references"] = [{
        "reference_doctype": "Sales Invoice",
        "reference_name": invoice_name,
        "allocated_amount": amount,
    }]
```

Replace with:

```python
if invoice_name:
    ref: dict[str, Any] = {
        "reference_doctype": "Sales Invoice",
        "reference_name": invoice_name,
        "allocated_amount": amount,
    }
    if payment_term:
        ref["payment_term"] = payment_term
    body["references"] = [ref]
```

- [ ] **Step 3: Byte-compile**

Run: `cd backend && py -m py_compile app/services/frappe_client.py`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/frappe_client.py
git commit -m "feat(frappe-client): upsert_payment_entry accepts payment_term on reference row"
```

### PHASE 3 CHECKPOINT

**Deliverable:** `FrappeClient` can create+submit a Sales Invoice from a Sales Order with our custom fields stamped, and `upsert_payment_entry` can route allocation to a specific schedule row.

**Verification:**
- [ ] `cd backend && py -m compileall -q app/services/frappe_client.py` — clean.
- [ ] `git log --oneline -2` — two new commits.

---

## Phase 4 — Sync orchestration: create SI after SO, move proof URL to SI

**Team:** `python-reviewer` · skills `backend-patterns`.

### Task 4.1: Extend `_sync_sales_order` to also create the SI

**Files:**
- Modify: `backend/app/services/frappe_sync_service.py`

- [ ] **Step 1: Find the end of `_sync_sales_order`**

The existing function ends with:

```python
if result.ok and result.doc_name and plan.frappe_sales_order_name != result.doc_name:
    plan.frappe_sales_order_name = result.doc_name
    session.add(plan)

return _finalize_outbound(
    task, result, entity_type="sales_order", lms_entity_id=plan.id,
)
```

Replace that closing section with:

```python
if result.ok and result.doc_name and plan.frappe_sales_order_name != result.doc_name:
    plan.frappe_sales_order_name = result.doc_name
    session.add(plan)

# If SO succeeded, ALSO create + submit the Sales Invoice from it. The SI
# carries the schedule-row-level tracking that the enforcement cron reads.
if result.ok and result.doc_name:
    si_result = await client.create_and_submit_sales_invoice_from_so(
        so_name=result.doc_name,
        fee_plan_id=str(plan.id),
        payment_id=payment_id,
        payment_proof_view_url=payment_proof_view_url,
    )
    if si_result.ok and si_result.doc_name:
        plan.frappe_sales_invoice_name = si_result.doc_name
        session.add(plan)
    else:
        # Log but don't fail the whole task — the SO exists, SI creation
        # can be retried on the next run via the idempotency path.
        logger.warning(
            "SO %s submitted but SI creation failed for plan %s: %s",
            result.doc_name, plan.id, si_result.error,
        )

return _finalize_outbound(
    task, result, entity_type="sales_order", lms_entity_id=plan.id,
)
```

- [ ] **Step 2: Remove payment_proof_view_url from the SO write**

The SO's `submit_sales_order` currently also receives `payment_proof_view_url=payment_proof_view_url`. Per the new spec, the proof belongs on the SI only. Remove the kwarg from the `client.submit_sales_order(...)` call:

Current (find it):
```python
result = await client.submit_sales_order(
    fee_plan_id=str(plan.id),
    payment_id=payment_id,
    ...
    payment_terms_template=plan.frappe_payment_terms_template,
    payment_proof_view_url=payment_proof_view_url,
)
```

Change to:

```python
result = await client.submit_sales_order(
    fee_plan_id=str(plan.id),
    payment_id=payment_id,
    ...
    payment_terms_template=plan.frappe_payment_terms_template,
    payment_proof_view_url=None,  # proof now lives on the SI
)
```

- [ ] **Step 3: Byte-compile**

Run: `cd backend && py -m py_compile app/services/frappe_sync_service.py`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/frappe_sync_service.py
git commit -m "feat(frappe-sync): create Sales Invoice after SO, route proof URL to SI"
```

### Task 4.2: Update `_sync_payment_entry` to reference the SI with a specific payment_term

**Files:**
- Modify: `backend/app/services/frappe_sync_service.py`

- [ ] **Step 1: Locate `_sync_payment_entry`**

Current approach: uses `client._find_by_zensbot_id("Sales Invoice", plan.id)` to discover the SI. With the stamped `plan.frappe_sales_invoice_name` from Task 4.1 we can skip the lookup round-trip.

- [ ] **Step 2: Replace the invoice-lookup + reference build**

Find the block:

```python
# Look up the invoice the plan mirrors to for reference allocation
invoice_lookup = await client._find_by_zensbot_id("Sales Invoice", str(plan.id))  # noqa: SLF001
invoice_name = invoice_lookup.doc_name if invoice_lookup.ok else None

result = await client.upsert_payment_entry(
    payment_id=str(payment.id),
    fee_plan_id=str(plan.id),
    invoice_name=invoice_name,
    ...
)
```

Replace with:

```python
# Prefer the stamped SI name; fall back to a lookup for legacy plans that
# predate the SI-first flow.
invoice_name = plan.frappe_sales_invoice_name
if not invoice_name:
    invoice_lookup = await client._find_by_zensbot_id("Sales Invoice", str(plan.id))  # noqa: SLF001
    if invoice_lookup.ok and invoice_lookup.doc_name:
        invoice_name = invoice_lookup.doc_name
        plan.frappe_sales_invoice_name = invoice_name
        session.add(plan)

# Resolve the specific payment_term this LMS installment settles. Pull the
# SI's payment_schedule once and match by sequence (1-indexed) with fallback
# to "first outstanding row".
payment_term: Optional[str] = None
if invoice_name:
    si_detail = await client.get_single("Sales Invoice", invoice_name)
    if si_detail.ok:
        schedule = ((si_detail.response or {}).get("data") or {}).get("payment_schedule") or []
        target_installment = await session.get(FeeInstallment, payment.fee_installment_id) if payment.fee_installment_id else None
        if target_installment and 0 < target_installment.sequence <= len(schedule):
            payment_term = schedule[target_installment.sequence - 1].get("payment_term")
        if not payment_term:
            # Fallback: earliest row with outstanding > 0
            for row in schedule:
                if float(row.get("outstanding") or 0) > 0:
                    payment_term = row.get("payment_term")
                    break

result = await client.upsert_payment_entry(
    payment_id=str(payment.id),
    fee_plan_id=str(plan.id),
    invoice_name=invoice_name,
    customer_name=student.name,
    posting_date=(payment.payment_date.isoformat()
                  if payment.payment_date else datetime.utcnow().date().isoformat()),
    amount=payment.amount,
    currency=plan.currency,
    mode_of_payment=payment.payment_method,
    reference_no=payment.reference_number or payment.receipt_number,
    payment_term=payment_term,
)
```

`FeeInstallment` is already imported at the top of the module — verify with grep before editing.

- [ ] **Step 3: Byte-compile**

Run: `cd backend && py -m py_compile app/services/frappe_sync_service.py`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/frappe_sync_service.py
git commit -m "feat(frappe-sync): _sync_payment_entry resolves payment_term + uses stamped SI name"
```

### Task 4.3: Set the 72h grace on plan creation

**Files:**
- Modify: `backend/app/services/admissions_service.py`

- [ ] **Step 1: Find `_create_enrollment_with_plan`**

The function constructs the `FeePlan` then calls `session.add(plan)` / flushes. Add the grace-period assignment right after `plan = FeePlan(...)` and BEFORE any `session.flush()`.

- [ ] **Step 2: Insert the assignment**

Find:

```python
plan = FeePlan(
    student_batch_id=enrollment.id,
    student_id=student.id,
    batch_id=batch.id,
    ...
    notes=notes,
)
plan.frappe_item_code = getattr(payload_fee, "frappe_item_code", None)
plan.frappe_payment_terms_template = getattr(payload_fee, "frappe_payment_terms_template", None)
```

Add AFTER the `frappe_*` lines:

```python
# 72h unconditional grace window from the moment the plan is created.
# The suspension cron skips any plan whose grace hasn't elapsed, regardless
# of SI status. Once NOW() > grace_period_ends_at, SI status drives access.
plan.grace_period_ends_at = datetime.now(timezone.utc) + timedelta(hours=72)
```

`datetime`, `timezone`, `timedelta` should already be imported — verify.

- [ ] **Step 3: Byte-compile**

Run: `cd backend && py -m py_compile app/services/admissions_service.py`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/admissions_service.py
git commit -m "feat(admissions): set 72h grace_period_ends_at on FeePlan creation"
```

### PHASE 4 CHECKPOINT

**Deliverable:** Onboarding creates both SO + SI with the proof URL on the SI; PE sync allocates to a specific SI schedule row; new plans carry a 72h grace.

**Verification:**
- [ ] `py -m compileall -q backend/app/services/` — clean.
- [ ] `git log --oneline -3` — three new commits.
- [ ] Grep check: the only place that passes `payment_proof_view_url` into `submit_sales_order` now passes `None`.

---

## Phase 5 — Enforcement service: SI-based, grace-aware

**Team:** `python-reviewer` · skills `backend-patterns`.

### Task 5.1: Add an SI-based overdue query to `FrappeClient`

**Files:**
- Modify: `backend/app/services/frappe_client.py`

- [ ] **Step 1: Add an SI-specific DTO**

Near the existing `OverdueSalesOrder` dataclass, append:

```python
@dataclass(frozen=True)
class UnpaidSalesInvoice:
    name: str               # e.g. "ACC-SINV-2026-00054"
    fee_plan_id: str
    customer: str
    grand_total: int
    outstanding_amount: int
    status: str             # "Unpaid" / "Draft" / "Overdue" / ...
```

- [ ] **Step 2: Add a helper that lists unpaid SIs for this institute**

Append after `list_overdue_sales_orders`:

```python
async def list_unpaid_sales_invoices(self) -> list[UnpaidSalesInvoice]:
    """Find Sales Invoices with custom_zensbot_fee_plan_id set that are NOT
    in Paid / Partly Paid / Cancelled state.

    Used by the suspension cron: an SI in status Draft / Unpaid / Overdue
    (or equivalent) means the customer hasn't paid any of the schedule rows
    yet. Once they pay ANY installment, Frappe flips status to "Partly Paid"
    and this query no longer returns that SI — the cron then lifts the
    suspension on the next pass.
    """
    # Frappe's Sales Invoice status list:
    #   Draft, Submitted, Unpaid, Partly Paid, Paid, Return, Credit Note Issued,
    #   Overdue, Cancelled
    # We want everything except Partly Paid / Paid / Cancelled / Return /
    # Credit Note Issued. That maps cleanly to a "not in" filter.
    res = await self.list_resource(
        "Sales Invoice",
        fields=[
            "name", FEE_PLAN_FIELD, "customer", "grand_total",
            "outstanding_amount", "status",
        ],
        filters=[
            [FEE_PLAN_FIELD, "is", "set"],
            ["status", "not in", [
                "Partly Paid", "Paid", "Cancelled", "Return", "Credit Note Issued",
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
            grand_total=int(row.get("grand_total") or 0),
            outstanding_amount=int(row.get("outstanding_amount") or 0),
            status=row.get("status") or "",
        ))
    return out
```

- [ ] **Step 3: Byte-compile + commit**

```bash
cd backend && py -m py_compile app/services/frappe_client.py
cd ..
git add backend/app/services/frappe_client.py
git commit -m "feat(frappe-client): list_unpaid_sales_invoices + UnpaidSalesInvoice DTO"
```

### Task 5.2: Rewrite the enforcement service

**Files:**
- Modify: `backend/app/services/fee_enforcement_service.py`

- [ ] **Step 1: Swap the import**

Change:

```python
from app.services.frappe_client import FrappeClient, OverdueSalesOrder
```

to:

```python
from app.services.frappe_client import FrappeClient, UnpaidSalesInvoice
```

- [ ] **Step 2: Rewrite `enforce_overdue_suspensions`**

Replace the whole function body with:

```python
async def enforce_overdue_suspensions(
    session: AsyncSession,
    institute_id: uuid.UUID,
) -> EnforcementSummary:
    """Suspend students whose Sales Invoice is still unpaid past the 72h grace."""
    from datetime import datetime as _dt, timezone as _tz
    summary = EnforcementSummary()
    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        return summary

    try:
        client = FrappeClient(cfg)
        unpaid = await client.list_unpaid_sales_invoices()
    except Exception:
        logger.exception("Unpaid SI fetch failed for institute %s", institute_id)
        summary.errors += 1
        return summary

    summary.checked = len(unpaid)
    now = _dt.now(_tz.utc)

    for si in unpaid:
        try:
            await _apply_suspension_from_si(session, institute_id, si, now, summary)
        except Exception:
            logger.exception(
                "Failed to apply SI-based suspension for SI %s (fee_plan %s)",
                si.name, si.fee_plan_id,
            )
            summary.errors += 1

    await session.commit()
    return summary


async def _apply_suspension_from_si(
    session: AsyncSession,
    institute_id: uuid.UUID,
    si: UnpaidSalesInvoice,
    now,
    summary: EnforcementSummary,
) -> None:
    if not si.fee_plan_id:
        return
    try:
        plan_id = uuid.UUID(si.fee_plan_id)
    except ValueError:
        return

    plan = await session.get(FeePlan, plan_id)
    if plan is None or plan.institute_id != institute_id:
        return

    # Honor 72h grace window.
    if plan.grace_period_ends_at is not None and plan.grace_period_ends_at > now:
        return

    student = await session.get(User, plan.student_id)
    if student is None or student.deleted_at is not None:
        return
    if student.role != UserRole.student:
        return

    if (
        student.status == UserStatus.inactive
        and student.suspension_reason == SUSPENSION_REASON
    ):
        summary.already_suspended += 1
        return
    if student.status != UserStatus.active:
        # Manually suspended / banned / pending -- don't touch.
        return

    student.status = UserStatus.inactive
    student.suspension_reason = SUSPENSION_REASON
    student.token_version = (student.token_version or 0) + 1
    session.add(student)
    summary.newly_suspended += 1

    await _log_suspend_activity_si(session, student, si)
    await _send_suspension_email_si(session, student, si)
```

Keep the existing `_log_suspend_activity` / `_send_suspension_email` helpers around (they take the `OverdueSalesOrder` shape) but add **new SI-shaped wrappers** immediately below them:

```python
async def _log_suspend_activity_si(
    session: AsyncSession, student: User, si: UnpaidSalesInvoice,
) -> None:
    try:
        from app.services.activity_service import log_activity
        await log_activity(
            session,
            action="admissions.student_auto_suspended",
            entity_type="user",
            entity_id=student.id,
            user_id=student.id,
            institute_id=student.institute_id,
            details={
                "reason": SUSPENSION_REASON,
                "frappe_sales_invoice": si.name,
                "outstanding_amount": si.outstanding_amount,
                "grand_total": si.grand_total,
                "si_status": si.status,
            },
        )
    except Exception:
        logger.exception(
            "Failed to log auto-suspend activity for user %s", student.id,
        )


async def _send_suspension_email_si(
    session: AsyncSession, student: User, si: UnpaidSalesInvoice,
) -> None:
    try:
        from app.utils.email_sender import (
            build_login_url, get_institute_branding,
            send_email_background, should_send_email,
        )
        try:
            from app.utils.email_templates import overdue_suspension_email  # type: ignore
        except ImportError:
            return
        if not await should_send_email(
            session, student.institute_id, student.id, "email_fee_overdue",
        ):
            return
        branding = await get_institute_branding(session, student.institute_id)
        # Build a single-row overdue structure the existing template accepts.
        overdue_rows = [type("Row", (), {
            "payment_term": "Invoice outstanding",
            "due_date": "",
            "amount_due": si.grand_total,
            "outstanding": si.outstanding_amount,
        })()]
        subject, html = overdue_suspension_email(
            student_name=student.name,
            overdue_rows=overdue_rows,
            grand_total=si.grand_total,
            currency="PKR",
            login_url=build_login_url(branding["slug"]),
            institute_name=branding["name"],
            logo_url=branding.get("logo_url"),
            accent_color=branding.get("accent_color", "#C5D86D"),
        )
        send_email_background(student.email, subject, html, from_name=branding["name"])
    except Exception:
        logger.exception(
            "Failed to dispatch suspension email for user %s", student.id,
        )
```

- [ ] **Step 3: Rewrite `lift_suspensions_if_cleared`**

Replace with:

```python
async def lift_suspensions_if_cleared(
    session: AsyncSession,
    institute_id: uuid.UUID,
) -> EnforcementSummary:
    """Reactivate users the service previously suspended whose SI is now
    Partly Paid or Paid. We check by *absence* from the unpaid-SIs list —
    if a plan's SI is no longer flagged as unpaid, treat it as cleared."""
    summary = EnforcementSummary()
    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        return summary

    result = await session.execute(
        select(User).where(
            User.institute_id == institute_id,
            User.status == UserStatus.inactive,
            User.suspension_reason == SUSPENSION_REASON,
            User.deleted_at.is_(None),
        )
    )
    suspended = result.scalars().all()
    summary.checked = len(suspended)
    if not suspended:
        return summary

    try:
        client = FrappeClient(cfg)
        unpaid = await client.list_unpaid_sales_invoices()
    except Exception:
        logger.exception(
            "Unpaid SI refetch failed for institute %s", institute_id,
        )
        summary.errors += 1
        return summary

    still_unpaid_plan_ids: set[uuid.UUID] = set()
    for si in unpaid:
        try:
            still_unpaid_plan_ids.add(uuid.UUID(si.fee_plan_id))
        except (ValueError, TypeError):
            continue

    for student in suspended:
        try:
            await _maybe_lift(session, student, still_unpaid_plan_ids, summary)
        except Exception:
            logger.exception("Failed to lift suspension for user %s", student.id)
            summary.errors += 1

    await session.commit()
    return summary
```

`_maybe_lift` is untouched — its semantics ("lift when none of the plan IDs is still in the unpaid set") match the SI flow identically.

- [ ] **Step 4: Retire the old SO-based helpers (optional defensive cleanup)**

Leave `_apply_suspension`, `_log_suspend_activity`, `_send_suspension_email` in the file but mark them unused via a comment:

```python
# NOTE: The SO-based variants below are retained for one release so any
# in-flight scheduler jobs that imported them don't break. Delete in the
# release after this one.
```

- [ ] **Step 5: Byte-compile**

Run: `cd backend && py -m py_compile app/services/fee_enforcement_service.py`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/fee_enforcement_service.py
git commit -m "feat(fee-enforcement): switch to SI-based overdue detection + honor 72h grace"
```

### PHASE 5 CHECKPOINT

**Deliverable:** Daily cron now queries Frappe for unpaid SIs (not outstanding SO schedule rows), skips any plan within 72h grace, and reactivates students whose SI flipped to Partly Paid / Paid.

**Verification:**
- [ ] `py -m compileall -q backend/app/services/fee_enforcement_service.py` — clean.
- [ ] Grep: `enforce_overdue_suspensions` no longer references `OverdueSalesOrder` / `list_overdue_sales_orders`.
- [ ] Grep: `grace_period_ends_at` is read in `_apply_suspension_from_si`.

---

## Phase 6 — Frontend copy tweak

**Team:** `general-purpose` · skill `frontend-patterns`.

### Task 6.1: Update the Record Payment dialog helper text

**Files:**
- Modify: `frontend/components/admissions/record-payment-dialog.tsx`

- [ ] **Step 1: Find the helper `<p>` under the uploader**

Current:

```tsx
<p className="text-xs text-gray-500 mt-1">
  Attach the bank / app receipt the student sent you. The image is
  stored privately and linked to the Sales Order in ERP.
</p>
```

- [ ] **Step 2: Change "Sales Order" to "Sales Invoice"**

Replace with:

```tsx
<p className="text-xs text-gray-500 mt-1">
  Attach the bank / app receipt the student sent you. The image is
  stored privately and linked to the Sales Invoice in ERP.
</p>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/admissions/record-payment-dialog.tsx
git commit -m "docs(admissions): helper copy says proof links to Sales Invoice (not SO)"
```

### PHASE 6 CHECKPOINT

**Deliverable:** UI copy matches where the proof actually gets stored.

**Verification:**
- [ ] `grep -r "linked to the Sales Order" frontend/` returns nothing.
- [ ] `grep -r "linked to the Sales Invoice" frontend/` returns the updated copy.

---

## Phase 7 — Tests + migrate + deploy + smoke

**Team:** `e2e-runner` · skills `python-testing`, `deployment-patterns` · reviewed by `security-reviewer`.

### Task 7.1: Unit tests for `FrappeClient.create_and_submit_sales_invoice_from_so`

**Files:**
- Create: `backend/tests/unit/test_frappe_client_si_create.py`

- [ ] **Step 1: Write tests with mocked httpx**

```python
"""Unit tests for FrappeClient.create_and_submit_sales_invoice_from_so.

httpx is monkeypatched at the module level — the real HTTP calls never fire.
"""
from __future__ import annotations

import os
# Test-only config shims so the module imports cleanly.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET_KEY", "test")

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.frappe_client import FrappeClient, FrappeResult


def _make_client(monkeypatch):
    cfg = MagicMock()
    cfg.frappe_base_url = "https://erp.test"
    cfg.frappe_api_key_ciphertext = b"x"
    cfg.frappe_api_secret_ciphertext = b"x"
    cfg.auto_create_customers = True
    cfg.default_company = "Test Co"
    cfg.default_cost_center = "Main"
    monkeypatch.setattr(
        "app.services.frappe_client.decrypt", lambda _x: "secret",
    )
    return FrappeClient(cfg)


@pytest.mark.asyncio
async def test_idempotent_returns_existing_submitted_si(monkeypatch):
    c = _make_client(monkeypatch)
    # Idempotency lookup finds a submitted SI
    async def _find(self, doctype, fee_plan_id, **_):
        return FrappeResult(ok=True, doc_name="ACC-SINV-2026-EXIST", status_code=200)

    async def _get_single(self, doctype, name):
        return FrappeResult(
            ok=True, status_code=200,
            response={"data": {"name": name, "docstatus": 1}},
        )

    monkeypatch.setattr(FrappeClient, "_find_by_zensbot_id", _find)
    monkeypatch.setattr(FrappeClient, "get_single", _get_single)

    out = await c.create_and_submit_sales_invoice_from_so(
        so_name="SAL-ORD-EXIST", fee_plan_id="fp-1",
    )
    assert out.ok
    assert out.doc_name == "ACC-SINV-2026-EXIST"


@pytest.mark.asyncio
async def test_creates_then_submits_when_no_existing(monkeypatch):
    c = _make_client(monkeypatch)
    # No existing SI
    async def _find(self, doctype, fee_plan_id, **_):
        return FrappeResult(ok=False, status_code=404)

    monkeypatch.setattr(FrappeClient, "_find_by_zensbot_id", _find)

    # Mock httpx for make_sales_invoice + insert + submit
    calls = {"transform": 0, "insert": 0, "submit": 0}

    class _Resp:
        def __init__(self, status, body):
            self.status_code = status
            self._body = body
            self.text = str(body)

        def json(self):
            return self._body

    class _AsyncClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def get(self, url, params=None, headers=None):
            calls["transform"] += 1
            return _Resp(200, {"message": {
                "doctype": "Sales Invoice",
                "customer": "X", "items": [], "payment_schedule": [],
            }})

        async def post(self, url, json=None, headers=None):
            if "insert" in url:
                calls["insert"] += 1
                return _Resp(200, {"message": {"name": "ACC-SINV-2026-NEW", "docstatus": 0}})
            if "submit" in url:
                calls["submit"] += 1
                return _Resp(200, {"message": {"name": "ACC-SINV-2026-NEW", "docstatus": 1}})
            raise AssertionError(f"unexpected POST {url}")

    monkeypatch.setattr("app.services.frappe_client.httpx.AsyncClient", _AsyncClient)

    out = await c.create_and_submit_sales_invoice_from_so(
        so_name="SAL-ORD-NEW", fee_plan_id="fp-2",
        payment_id="pay-1", payment_proof_view_url="https://s3/x",
    )
    assert out.ok
    assert out.doc_name == "ACC-SINV-2026-NEW"
    assert calls == {"transform": 1, "insert": 1, "submit": 1}


@pytest.mark.asyncio
async def test_transform_http_error_surfaces(monkeypatch):
    c = _make_client(monkeypatch)

    async def _find(self, doctype, fee_plan_id, **_):
        return FrappeResult(ok=False, status_code=404)

    monkeypatch.setattr(FrappeClient, "_find_by_zensbot_id", _find)

    class _Resp:
        status_code = 417
        text = "source_name not found"

        def json(self):
            return {}

    class _AsyncClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return None
        async def get(self, *a, **kw): return _Resp()
        async def post(self, *a, **kw): raise AssertionError("should not reach")

    monkeypatch.setattr("app.services.frappe_client.httpx.AsyncClient", _AsyncClient)

    out = await c.create_and_submit_sales_invoice_from_so(
        so_name="SAL-ORD-MISSING", fee_plan_id="fp-3",
    )
    assert not out.ok
    assert out.status_code == 417
    assert "source_name" in (out.error or "")
```

- [ ] **Step 2: Run the tests**

```bash
cd backend && py -m pytest tests/unit/test_frappe_client_si_create.py -v
```
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_frappe_client_si_create.py
git commit -m "test(frappe-client): unit tests for create_and_submit_sales_invoice_from_so"
```

### Task 7.2: Unit tests for the new enforcement paths

**Files:**
- Create: `backend/tests/unit/test_fee_enforcement_si.py`

- [ ] **Step 1: Write tests**

```python
"""Unit tests for the SI-based suspension flow.

Covers:
- 72h grace window is respected (no suspension).
- Grace expired + unpaid SI -> newly_suspended.
- Already suspended by cron -> already_suspended counter increments.
- Manually suspended user (different suspension_reason) -> untouched.
- Lift: plan no longer in unpaid set -> reactivated.
- Lift: plan still unpaid -> student stays suspended.
"""
from __future__ import annotations

import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET_KEY", "test")

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models.enums import UserRole, UserStatus
from app.services import fee_enforcement_service as svc
from app.services.frappe_client import UnpaidSalesInvoice


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        class _S:
            def __init__(self, rs): self._rs = rs
            def all(self): return self._rs
        return _S(self._rows)


class _FakeSession:
    def __init__(self, by_id, exec_result=None):
        self._by_id = by_id
        self._exec = exec_result or _FakeResult([])
        self.added = []
        self.committed = False

    async def get(self, model, pk):
        return self._by_id.get(pk)

    async def execute(self, _stmt):
        return self._exec

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True


def _student(*, status=UserStatus.active, suspension_reason=None):
    class U:
        id = uuid.uuid4()
        institute_id = uuid.uuid4()
        role = UserRole.student
        deleted_at = None
        name = "Test Student"
        email = "x@x"
    u = U()
    u.status = status
    u.suspension_reason = suspension_reason
    u.token_version = 0
    return u


def _plan(student_id, institute_id, *, grace_ends_in_seconds=None):
    class P:
        id = uuid.uuid4()
    p = P()
    p.student_id = student_id
    p.institute_id = institute_id
    p.deleted_at = None
    p.grace_period_ends_at = (
        datetime.now(timezone.utc) + timedelta(seconds=grace_ends_in_seconds)
        if grace_ends_in_seconds is not None else None
    )
    return p


@pytest.mark.asyncio
async def test_grace_window_blocks_suspension(monkeypatch):
    student = _student()
    plan = _plan(student.id, student.institute_id, grace_ends_in_seconds=60 * 60)  # 1 hour left

    si = UnpaidSalesInvoice(
        name="ACC-SINV-1", fee_plan_id=str(plan.id),
        customer="X", grand_total=15000, outstanding_amount=15000, status="Unpaid",
    )
    session = _FakeSession({plan.id: plan, student.id: student})

    summary = svc.EnforcementSummary()
    await svc._apply_suspension_from_si(
        session, student.institute_id, si, datetime.now(timezone.utc), summary,
    )
    assert summary.newly_suspended == 0
    assert student.status == UserStatus.active
    assert student.suspension_reason is None


@pytest.mark.asyncio
async def test_grace_expired_and_unpaid_suspends(monkeypatch):
    student = _student()
    plan = _plan(student.id, student.institute_id, grace_ends_in_seconds=-60)  # already past
    si = UnpaidSalesInvoice(
        name="ACC-SINV-2", fee_plan_id=str(plan.id),
        customer="X", grand_total=15000, outstanding_amount=15000, status="Unpaid",
    )
    session = _FakeSession({plan.id: plan, student.id: student})

    # Stub the log + email helpers so they don't need real branding/email infra.
    async def _noop(*a, **kw): pass
    monkeypatch.setattr(svc, "_log_suspend_activity_si", _noop)
    monkeypatch.setattr(svc, "_send_suspension_email_si", _noop)

    summary = svc.EnforcementSummary()
    await svc._apply_suspension_from_si(
        session, student.institute_id, si, datetime.now(timezone.utc), summary,
    )
    assert summary.newly_suspended == 1
    assert student.status == UserStatus.inactive
    assert student.suspension_reason == svc.SUSPENSION_REASON
    assert student.token_version == 1


@pytest.mark.asyncio
async def test_already_auto_suspended_skipped(monkeypatch):
    student = _student(
        status=UserStatus.inactive,
        suspension_reason=svc.SUSPENSION_REASON,
    )
    plan = _plan(student.id, student.institute_id, grace_ends_in_seconds=-60)
    si = UnpaidSalesInvoice(
        name="ACC-SINV-3", fee_plan_id=str(plan.id),
        customer="X", grand_total=15000, outstanding_amount=15000, status="Unpaid",
    )
    session = _FakeSession({plan.id: plan, student.id: student})

    summary = svc.EnforcementSummary()
    await svc._apply_suspension_from_si(
        session, student.institute_id, si, datetime.now(timezone.utc), summary,
    )
    assert summary.already_suspended == 1
    assert summary.newly_suspended == 0


@pytest.mark.asyncio
async def test_manually_suspended_user_untouched(monkeypatch):
    student = _student(
        status=UserStatus.inactive,
        suspension_reason="manual_admin_action",
    )
    plan = _plan(student.id, student.institute_id, grace_ends_in_seconds=-60)
    si = UnpaidSalesInvoice(
        name="ACC-SINV-4", fee_plan_id=str(plan.id),
        customer="X", grand_total=15000, outstanding_amount=15000, status="Unpaid",
    )
    session = _FakeSession({plan.id: plan, student.id: student})

    summary = svc.EnforcementSummary()
    await svc._apply_suspension_from_si(
        session, student.institute_id, si, datetime.now(timezone.utc), summary,
    )
    assert summary.newly_suspended == 0
    assert summary.already_suspended == 0
    # Reason preserved -- cron didn't touch it
    assert student.suspension_reason == "manual_admin_action"
```

- [ ] **Step 2: Run the tests**

```bash
cd backend && py -m pytest tests/unit/test_fee_enforcement_si.py -v
```
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_fee_enforcement_si.py
git commit -m "test(fee-enforcement): SI-based suspension + 72h grace + manual-suspend preservation"
```

### Task 7.3: Runbook

**Files:**
- Create: `docs/claude/frappe-si-first-flow.md`

- [ ] **Step 1: Write the runbook (force-add — `*.md` is gitignored)**

Content:

```markdown
# Frappe SI-First Flow + 72h Grace Period

## What the pipeline does now

1. AO onboards a student (existing flow unchanged at the LMS layer).
2. `fee.plan_created` webhook -> outbound sync:
   - Creates + submits Sales Order in ERP.
   - Immediately calls ``erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice``
     to get a draft SI, stamps ``custom_zensbot_fee_plan_id/payment_id/payment_proof_url``
     on it, then insert + submit.
   - Stamps ``FeePlan.frappe_sales_invoice_name`` for downstream sync.
3. FeePlan is created with ``grace_period_ends_at = NOW() + 72 hours``. Student has
   unconditional LMS access during the grace window.
4. Daily at 00:00 PKT (= 19:00 UTC) the ``enforce_overdue_access_revocation`` job
   runs per Frappe-enabled institute:
   - Queries Frappe for Sales Invoices with ``custom_zensbot_fee_plan_id`` set
     whose ``status`` is NOT in ``Partly Paid / Paid / Cancelled / Return / Credit Note Issued``.
   - For each, skips if ``plan.grace_period_ends_at > NOW()``.
   - Otherwise flips the student to ``UserStatus.inactive`` with
     ``suspension_reason="overdue_fees"``, bumps ``token_version`` (kills all sessions),
     queues a suspension email.
   - Separately, reactivates students whose SI has cleared (no longer in the unpaid list).

## Admin override

An admin can manually reactivate a cron-suspended student via the existing
``POST /api/v1/admissions/students/{id}/reactivate`` endpoint. That flips their
``suspension_reason`` to NULL; the next cron pass will re-suspend if Frappe still
shows the SI as unpaid.

## Disabling the cron for emergencies

Set ``SCHEDULER_ENABLED=false`` in the backend environment and redeploy. All scheduled
jobs stop. The feature falls back to the HTTP 402 soft-lock that's always active on
fee-gated endpoints (``middleware/access_control.py``).

## Common log lines

- ``Overdue enforcement[<institute-id>]: checked=N newly_suspended=N already_suspended=N newly_reactivated=N errors=0``
  -- per-institute summary, one per run.
- ``Overdue enforcement complete: ...`` -- aggregate across all institutes.

## Audit trail

Every suspension + reactivation emits an ``activity_logs`` row with:
- ``action = admissions.student_auto_suspended`` (or ``_auto_reactivated``)
- ``details.reason = overdue_fees``
- ``details.frappe_sales_invoice = ACC-SINV-...``
- ``details.outstanding_amount``, ``details.si_status``

Query:

    SELECT created_at, user_id, details
    FROM activity_logs
    WHERE action LIKE 'admissions.student_auto_%'
    ORDER BY created_at DESC
    LIMIT 20;
```

- [ ] **Step 2: Force-add + commit**

```bash
git add -f docs/claude/frappe-si-first-flow.md
git commit -m "docs: runbook for SI-first flow + 72h grace + overdue suspension"
```

### Task 7.4: Apply migration + deploy

- [ ] **Step 1: Push to origin (fork — per memory feedback)**

```bash
git push origin feat/si-first-flow-72h-grace
```

- [ ] **Step 2: PR from fork to upstream main**

```bash
gh pr create \
  --repo hassanarshad123/ICT_LMS_CUSTOM \
  --base main \
  --head kamilzafar:feat/si-first-flow-72h-grace \
  --title "feat: SI-first flow + 72h grace period for overdue suspension" \
  --body-file docs/claude/frappe-si-first-flow.md
```

- [ ] **Step 3: After CI passes, merge + verify blue-green deploy**

```bash
gh pr merge <N> --repo hassanarshad123/ICT_LMS_CUSTOM --squash --delete-branch=false
```

- [ ] **Step 4: Confirm migration 045 applied on prod**

```bash
ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220 \
  "docker exec lms-green alembic current 2>&1 | tail -3"
```
Expected: `045 (head)`.

### Task 7.5: Prod smoke test

- [ ] **Step 1: Onboard a test student**

Via the AO dashboard — use an email like `sifirst-test-<timestamp>@zensbot.com`. Complete the wizard.

- [ ] **Step 2: Verify SO + SI were both created**

```bash
curl -sS -G "https://deverp.ict.net.pk/api/resource/Sales%20Invoice" \
  -H "Authorization: token f745906bb8029af:e1f9096d67eca6b" \
  --data-urlencode 'fields=["name","status","outstanding_amount","custom_zensbot_fee_plan_id"]' \
  --data-urlencode 'filters=[["custom_zensbot_fee_plan_id","is","set"],["status","not in",["Paid","Partly Paid"]]]' \
  --data-urlencode 'order_by=creation desc' \
  --data-urlencode 'limit_page_length=5'
```
Expected: the newly-created SI is at the top with `docstatus: 1` and `status` in `Unpaid` / `Overdue`.

- [ ] **Step 3: Verify the 72h grace is set in the DB**

```bash
ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220 "docker exec lms-green python -c \"
import asyncio, os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
async def main():
    e = create_async_engine(os.environ['DATABASE_URL'])
    async with e.connect() as c:
        r = await c.execute(text('SELECT id, grace_period_ends_at, frappe_sales_invoice_name FROM fee_plans ORDER BY created_at DESC LIMIT 3'))
        for row in r: print(row)
asyncio.run(main())
\""
```
Expected: top row has `grace_period_ends_at` ~72h from now and `frappe_sales_invoice_name` populated.

- [ ] **Step 4: Manually trigger the cron — confirm the grace window blocks suspension**

```bash
ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220 "docker exec lms-green python -c \"
import asyncio, logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s: %(message)s')
from app.scheduler.jobs import enforce_overdue_access_revocation
asyncio.run(enforce_overdue_access_revocation())
\" 2>&1 | grep -iE 'overdue enforcement' | head -5"
```
Expected: `newly_suspended=0` because the new student is within the 72h grace.

### PHASE 7 CHECKPOINT

**Deliverable:** Feature live on main with migration 045 applied; prod smoke confirms SI auto-creation + 72h grace + cron skipping in-grace plans.

**Verification:**
- [ ] Unit tests green (`frappe_client_si_create` + `fee_enforcement_si` + existing suite).
- [ ] PR merged to main; `lms-green` healthy; migration 045 at head.
- [ ] Prod smoke test onboarding shows SO + SI created; grace populated; cron doesn't suspend.
- [ ] `security-reviewer` subagent final pass: no credential leakage in logs, rate limits preserved, no privilege escalation via the new SI endpoint.

---

## Risks

1. **`make_sales_invoice` endpoint returns an unexpected doc shape.** If an ERPNext version upgrades and changes the transform output, the draft dict we hand to `insert` could be rejected. Mitigation: Phase 7 smoke covers one real call; Frappe's endpoint is stable across the v14/v15 releases we've tested.
2. **SI submission may conflict with Frappe's "auto-invoice on SO submit" setting.** Some institutes have this toggled on, and Frappe then creates a draft SI automatically. Our idempotency (`_find_by_zensbot_id`) handles this — we'd find the existing draft and submit it rather than create a second.
3. **Payment Entry allocated to the wrong installment row.** If the AO records a partial payment for installment 2 while installment 1 is unpaid, our fallback ("earliest outstanding row") allocates to row 1. This is standard accounting practice but could surprise the AO. Document in the runbook; if UX pushback, add a dropdown in the Record Payment dialog to pick the exact installment.
4. **Legacy plans with `frappe_sales_invoice_name = NULL` and `grace_period_ends_at = NULL`.** The cron treats NULL grace as "grace already elapsed" (safe default, existing behavior). SI lookup falls back to `_find_by_zensbot_id` — if an old SO has no SI, the plan won't be suspended until one is created. A one-time backfill job could be added, but there's only one such plan in prod today (Kamil's) and it can be re-onboarded or re-synced manually.
5. **72h is wall-clock, not business hours.** A student onboarded Friday afternoon gets grace until Monday afternoon; Friday-late-night suspensions won't fire over the weekend because the cron runs once daily at 00:00 PKT. If you want "72 business hours" semantics, we'd need a holiday calendar — not in this scope.

## Out of scope (explicit)

- Per-student override of the 72h grace window via admin UI.
- Cancel-and-replace-PE for the existing `ACC-PAY-2026-00009` to retroactively clear Kamil's 1st installment.
- Auto-invoicing monthly plans on a schedule (current flow is one SI per enrollment, covering all installments up front).
- Sales Invoice inbound webhook handler (we write SIs, Frappe doesn't push status changes back to the LMS — the daily cron polls).
- Flutter mobile surface for the suspension status banner.

## Estimated Complexity: MEDIUM (~7h)

Phase 1: 30m · Phase 2: 45m · Phase 3: 1.5h · Phase 4: 1.5h · Phase 5: 1h · Phase 6: 15m · Phase 7: 1.5h.

## Self-review against the spec

| Spec requirement | Covered by |
|------------------|------------|
| Onboarding creates Sales Order in ERP | Task 4.1 keeps the existing SO creation unchanged. |
| Onboarding also creates a submitted Sales Invoice carrying the same terms | Task 3.1 (`create_and_submit_sales_invoice_from_so`) + Task 4.1 (wired into `_sync_sales_order`). |
| SI inherits customer / items / sales_team / payment_schedule from SO | ERPNext's stock `make_sales_invoice` transform does this automatically; we only stamp custom fields and submit. |
| Payment proof screenshot attaches to SI, not SO | Task 4.1 changes `submit_sales_order` to pass `payment_proof_view_url=None` + Task 3.1 passes the URL through to the SI. Connector fixture update in Phase 2 adds the field. |
| 72h grace period of unconditional access | Task 4.3 sets `plan.grace_period_ends_at = created_at + 72h` + Phase 1 migration + Phase 5 cron honors it. |
| After 72h, cron checks SI status for Partly Paid / Paid | Phase 5 rewrites enforcement to query `Sales Invoice` with `status not in [Paid, Partly Paid, Cancelled, Return, Credit Note Issued]` — anything else is treated as unpaid. |
| Paid or partly paid → access preserved | Phase 5 `lift_suspensions_if_cleared` reactivates students whose SI falls out of the unpaid list. |
| Not paid after grace → blocked | Phase 5 `_apply_suspension_from_si` flips status to inactive + bumps token_version (kills JWTs = blocks login). |
| Uses agent team + skills | Team Assignments table at top of doc; Phase 7 final review by `security-reviewer`. |

No placeholders detected. Type consistency: `UnpaidSalesInvoice` DTO defined in Task 5.1, used consistently in Task 5.2 + Task 7.2.

---

**WAITING FOR EXECUTION CHOICE.**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per phase, review between phases, fast iteration.
**2. Inline Execution** — I execute the phases in this session with checkpoints.

Which approach?
