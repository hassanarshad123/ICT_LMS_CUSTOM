# Sales Order on AO Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an Admissions Officer onboards a student in the LMS, atomically create a **Submitted (not Draft) Sales Order** in the institute's Frappe ERP with all required details — customer/items/contact person/payment terms/schedule/sales_team credit — and persist a screenshot of the payment proof to both LMS S3 and the Frappe Sales Order record.

**Architecture:**
- New admin-only LMS endpoints that proxy live Frappe reads for the three dropdowns the onboarding wizard needs: **Items** (service SKUs), **Payment Terms Templates** (installment schedules), and the existing **Sales Persons** picker (already built in the prior branch).
- New Sales Order creation path in `FrappeClient` + outbound sync: on `fee.plan_created`, replace the current Sales Invoice creation with a Sales Order that is **submitted in the same request** (docstatus 0 → 1), with `sales_team[0]` populated from the AO's linked Sales Person (`User.employee_id` → `Sales Person.employee`).
- Payment screenshot: LMS-side multi-tenant S3 upload (reuses `app/utils/s3.py`), URL saved on the `FeePayment` row, and mirrored into a new `custom_zensbot_payment_proof_url` custom field on the Frappe Sales Order so ERP users can view it inline.
- Connector app (`zensbot_lms_connector/`) gets three new Sales Order custom fields shipped as fixtures so institutes can install them with a single `bench migrate`.

**Tech Stack:** FastAPI + SQLModel + Alembic + httpx + boto3 (all existing) · Next.js 13 App Router + shadcn Command/Select/Popover + Sonner (all existing) · Frappe v15 REST API with `token key:secret` auth.

**Branch:** `feat/ao-frappe-sales-order-onboarding` — already created, branched off `feat/ao-frappe-sales-agent-link` which has the `employee_id` column and the Sales Person picker. **This plan depends on that branch's work; it does not rebuild it.**

---

## Grounded assumptions (verified against deverp.ict.net.pk today)

- **Payment Terms Template** doctype exposes one row per template with a `terms[]` child table:
  ```json
  { "name": "3 installments", "template_name": "3 installments",
    "allocate_payment_based_on_payment_terms": 0,
    "terms": [
      { "payment_term": "1st installment", "invoice_portion": 40.0,
        "credit_days": 0,  "mode_of_payment": "Cash", "due_date_based_on": "Day(s) after invoice date" },
      { "payment_term": "2nd installment", "invoice_portion": 20.0, "credit_days": 30, ... },
      { "payment_term": "3rd Installment", "invoice_portion": 40.0, "credit_days": 60, ... }
    ]
  }
  ```
  `invoice_portion` is a percentage — the three rows must sum to 100. `credit_days` drives the due date relative to the invoice date.
- **Item** doctype's Services have `item_name`, `item_group = "Services"`, `standard_rate` (0 on most today — institute uses per-enrollment pricing). 30 active service items today.
- **Sales Order** already accepts:
  - `items[]` with `item_code`, `qty`, `rate`, `delivery_date`.
  - `sales_team[]` with `sales_person`, `allocated_percentage`, `commission_rate`.
  - `payment_terms_template` — when set, Frappe auto-populates `payment_schedule[]` on submit.
  - `contact_person` — optional; auto-created when `customer_name` + `contact_email` are passed.
  - `order_type = "Sales"` — the default.
  - `docstatus` — set via `frappe.client.submit` endpoint to flip 0 → 1 in the same request; this is what makes it "Active" rather than Draft.
- **S3 infrastructure is live** at `app/utils/s3.py` — multi-tenant key prefixing with `institute_id/` already done. Just need a new helper for payment-proof uploads.

---

## Team Assignments

Each phase has a primary implementer, required skills, and a reviewer. Per prior session feedback, **testing is consolidated at the end (Phase 7)** — phases 1-6 implement, commit, and move on without per-phase test loops.

| Phase | Scope | Primary Agent | Primary Skills | Review Agent |
|-------|-------|---------------|----------------|--------------|
| 1 | Frappe dropdown endpoints (items + payment-terms-templates) | `python-reviewer` | `backend-patterns`, `api-design` | `code-reviewer` |
| 2 | Connector fixtures — Sales Order custom fields | `general-purpose` | `get-api-docs` (Frappe custom fields) | `security-reviewer` |
| 3 | FeePlan schema additions + payment_proof column | `database-reviewer` | `database-migrations`, `postgres-patterns` | `code-reviewer` |
| 4 | Payment screenshot upload route + S3 util | `tdd-guide` | `backend-patterns` | `security-reviewer` |
| 5 | FrappeClient `submit_sales_order` + sync dispatch refactor | `python-reviewer` | `backend-patterns`, `api-design` | `code-reviewer` |
| 6 | Frontend OnboardWizard — item picker + PTT dropdown + screenshot upload | `general-purpose` | `frontend-design`, `shadcn` | `code-reviewer` |
| 7 | Consolidated tests (unit + integration + E2E), migrations, deploy | `e2e-runner` | `e2e-testing`, `python-testing`, `deployment-patterns` | `security-reviewer` |

Fresh subagent per phase. No co-author trailer in any commit.

---

## File Structure

**Backend — new files (3)**
- `backend/migrations/versions/043_feeplan_frappe_fields.py` — adds 3 columns to `fee_plans` + 1 to `fee_payments`.
- `backend/app/routers/payment_proof.py` — `POST /admissions/payment-proof/upload-url`, `POST /admissions/payment-proof/confirm` (two-step signed-URL flow).
- `backend/tests/unit/test_sales_order_build.py` — unit tests for the new `FrappeClient.submit_sales_order` payload builder.

**Backend — modified files (8)**
- `backend/app/models/fee.py` — add `frappe_payment_terms_template`, `frappe_item_code`, `frappe_sales_order_name` to `FeePlan`; `payment_proof_url`, `payment_proof_key` to `FeePayment`.
- `backend/app/schemas/fee.py` — extend `OnboardStudentRequest` + `FeePlanCreate` with the new fields + `PaymentProofAttachment`.
- `backend/app/schemas/integration.py` — add `FrappeItemItem`, `FrappeItemListOut`, `PaymentTermsTemplateItem`, `PaymentTermsTemplateListOut`, `PaymentTermsTemplateDetail`.
- `backend/app/services/integration_service.py` — add `fetch_items`, `fetch_payment_terms_templates`, `fetch_payment_terms_template_detail`, each with 60s TTL cache; extend existing Sales Person cache to invalidate on AO create.
- `backend/app/services/frappe_client.py` — add `submit_sales_order` method and the Payment Term / Item list helpers (already covered by generic `list_resource`; just add convenience wrappers).
- `backend/app/services/frappe_sync_service.py` — change `_dispatch` so `fee.plan_created` routes to `_sync_sales_order` (new) instead of `_sync_sales_invoice`; keep `_sync_sales_invoice` as a fallback for institutes on a legacy flag.
- `backend/app/services/admissions_service.py` — thread `frappe_item_code`, `frappe_payment_terms_template`, `payment_proof` fields through `onboard_student`.
- `backend/app/routers/integrations.py` — add `GET /frappe/items`, `GET /frappe/payment-terms-templates`, `GET /frappe/payment-terms-templates/{name}`.

**Backend — tests modified (1)**
- `backend/tests/integration_test.py` — add onboarding + sales order flow tests in Phase 7.

**Frontend — modified files (4)**
- `frontend/lib/api/integrations.ts` — add `listFrappeItems`, `listFrappePaymentTermsTemplates`, `getFrappePaymentTermsTemplate`.
- `frontend/lib/api/admissions.ts` — extend `OnboardStudentRequest` type + add `uploadPaymentProof`.
- `frontend/components/admissions/onboard-wizard.tsx` — new item/template pickers; replace existing fee-plan-type step with Frappe-template-driven step; add payment-screenshot upload step.
- `frontend/components/admissions/payment-proof-uploader.tsx` — NEW — drag-and-drop/click uploader with preview, two-step signed-URL flow.

**Connector app — modified (2)**
- `zensbot_lms_connector/zensbot_lms_connector/hooks.py` — extend the Custom Field fixture list with 3 new Sales Order fields.
- `zensbot_lms_connector/zensbot_lms_connector/fixtures/custom_field.json` — regenerated with the new entries.

**Docs — new (1)**
- `docs/claude/frappe-sales-order-onboarding.md` — end-to-end runbook including connector reinstall.

---

## Phase 1 — Frappe dropdown endpoints

**Team:** `python-reviewer` · skills `backend-patterns`, `api-design`.

### Task 1.1 — Items endpoint

**Files:**
- Modify: `backend/app/schemas/integration.py`
- Modify: `backend/app/services/integration_service.py`
- Modify: `backend/app/routers/integrations.py`

- [ ] **Step 1: Add DTOs.**

Append to `backend/app/schemas/integration.py`:

```python
class FrappeItemItem(BaseModel):
    item_code: str
    item_name: str
    item_group: Optional[str] = None
    standard_rate: Optional[float] = None
    stock_uom: Optional[str] = None


class FrappeItemListOut(BaseModel):
    enabled: bool
    cached_at: Optional[str] = None
    error: Optional[str] = None
    items: List[FrappeItemItem] = []
```

- [ ] **Step 2: Add service fn with 60s TTL cache.**

In `backend/app/services/integration_service.py`, append (follows the pattern of `fetch_sales_persons`):

```python
_ITEMS_CACHE: Dict[uuid.UUID, Tuple[float, FrappeItemListOut]] = {}
_ITEMS_TTL_SECONDS = 60


async def fetch_items(
    session: AsyncSession,
    institute_id: uuid.UUID,
    item_group: str = "Services",
) -> FrappeItemListOut:
    now = time.time()
    cache_key = institute_id
    cached = _ITEMS_CACHE.get(cache_key)
    if cached and cached[0] > now:
        return cached[1]

    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        out = FrappeItemListOut(enabled=False)
        _ITEMS_CACHE[cache_key] = (now + _ITEMS_TTL_SECONDS, out)
        return out

    client = FrappeClient(cfg)
    res = await client.list_resource(
        "Item",
        fields=["name", "item_name", "item_group", "standard_rate", "stock_uom"],
        filters=[["item_group", "=", item_group], ["disabled", "=", 0]],
        limit=500,
    )
    if not res.ok:
        out = FrappeItemListOut(enabled=True, error=res.error or "Frappe error")
        _ITEMS_CACHE[cache_key] = (now + 30, out)
        return out

    rows = (res.response or {}).get("data") or []
    items = [
        FrappeItemItem(
            item_code=r["name"],
            item_name=r.get("item_name") or r["name"],
            item_group=r.get("item_group"),
            standard_rate=float(r["standard_rate"]) if r.get("standard_rate") is not None else None,
            stock_uom=r.get("stock_uom"),
        )
        for r in rows
    ]
    items.sort(key=lambda x: x.item_name.lower())
    out = FrappeItemListOut(
        enabled=True,
        cached_at=datetime.now(timezone.utc).isoformat(),
        items=items,
    )
    _ITEMS_CACHE[cache_key] = (now + _ITEMS_TTL_SECONDS, out)
    return out
```

- [ ] **Step 3: Add the route in `backend/app/routers/integrations.py`.**

```python
@router.get("/frappe/items", response_model=FrappeItemListOut)
@limiter.limit("20/minute")
async def list_frappe_items(
    request: Request,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await integration_service.fetch_items(session, current_user.institute_id)
```

Add `FrappeItemListOut` to imports.

- [ ] **Step 4: Compile check.**

```bash
cd backend && py -m compileall -q app/schemas/integration.py app/services/integration_service.py app/routers/integrations.py
```

- [ ] **Step 5: Commit.**

```bash
git add backend/app/schemas/integration.py \
        backend/app/services/integration_service.py \
        backend/app/routers/integrations.py
git commit -m "feat(integrations): GET /frappe/items admin endpoint for AO wizard"
```

### Task 1.2 — Payment Terms Templates (list + detail)

**Files:** same three as above.

- [ ] **Step 1: Add DTOs (append).**

```python
class PaymentTermsTemplateItem(BaseModel):
    name: str
    template_name: str
    term_count: int  # rolled up on the LIST endpoint for UX preview


class PaymentTermsTemplateTermRow(BaseModel):
    payment_term: str
    invoice_portion: float  # percent of total
    credit_days: int
    credit_months: int
    mode_of_payment: Optional[str] = None
    due_date_based_on: Optional[str] = None


class PaymentTermsTemplateDetail(BaseModel):
    name: str
    template_name: str
    allocate_payment_based_on_payment_terms: bool
    terms: List[PaymentTermsTemplateTermRow] = []


class PaymentTermsTemplateListOut(BaseModel):
    enabled: bool
    cached_at: Optional[str] = None
    error: Optional[str] = None
    templates: List[PaymentTermsTemplateItem] = []
```

- [ ] **Step 2: Service functions.**

```python
_PTT_LIST_CACHE: Dict[uuid.UUID, Tuple[float, PaymentTermsTemplateListOut]] = {}
_PTT_DETAIL_CACHE: Dict[Tuple[uuid.UUID, str], Tuple[float, PaymentTermsTemplateDetail]] = {}


async def fetch_payment_terms_templates(
    session: AsyncSession,
    institute_id: uuid.UUID,
) -> PaymentTermsTemplateListOut:
    now = time.time()
    cached = _PTT_LIST_CACHE.get(institute_id)
    if cached and cached[0] > now:
        return cached[1]

    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        out = PaymentTermsTemplateListOut(enabled=False)
        _PTT_LIST_CACHE[institute_id] = (now + _ITEMS_TTL_SECONDS, out)
        return out

    client = FrappeClient(cfg)
    res = await client.list_resource(
        "Payment Terms Template",
        fields=["name", "template_name"],
        limit=200,
    )
    if not res.ok:
        out = PaymentTermsTemplateListOut(enabled=True, error=res.error or "Frappe error")
        _PTT_LIST_CACHE[institute_id] = (now + 30, out)
        return out

    rows = (res.response or {}).get("data") or []
    # Note: term_count isn't returned by the list API — we default to 0 and the
    # UI only displays it when the detail endpoint is hit on selection.
    templates = [
        PaymentTermsTemplateItem(
            name=r["name"],
            template_name=r.get("template_name") or r["name"],
            term_count=0,
        )
        for r in rows
    ]
    templates.sort(key=lambda x: x.template_name.lower())
    out = PaymentTermsTemplateListOut(
        enabled=True,
        cached_at=datetime.now(timezone.utc).isoformat(),
        templates=templates,
    )
    _PTT_LIST_CACHE[institute_id] = (now + _ITEMS_TTL_SECONDS, out)
    return out


async def fetch_payment_terms_template_detail(
    session: AsyncSession,
    institute_id: uuid.UUID,
    template_name: str,
) -> Optional[PaymentTermsTemplateDetail]:
    """Return full schedule for a template. None when Frappe disabled."""
    now = time.time()
    key = (institute_id, template_name)
    cached = _PTT_DETAIL_CACHE.get(key)
    if cached and cached[0] > now:
        return cached[1]

    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        return None

    client = FrappeClient(cfg)
    # GET /api/resource/Payment Terms Template/{name} returns full doc w/ terms
    url = f"{client.base_url}/api/resource/Payment Terms Template/{template_name}"
    # Reuse client._auth_header via a direct call because list_resource doesn't
    # serve single-doc fetches. Add a new client method in the same PR.
    res = await client.get_single("Payment Terms Template", template_name)
    if not res.ok:
        return None

    doc = (res.response or {}).get("data") or {}
    terms = [
        PaymentTermsTemplateTermRow(
            payment_term=t.get("payment_term", ""),
            invoice_portion=float(t.get("invoice_portion", 0)),
            credit_days=int(t.get("credit_days", 0)),
            credit_months=int(t.get("credit_months", 0)),
            mode_of_payment=t.get("mode_of_payment"),
            due_date_based_on=t.get("due_date_based_on"),
        )
        for t in doc.get("terms", [])
    ]
    detail = PaymentTermsTemplateDetail(
        name=doc.get("name", template_name),
        template_name=doc.get("template_name", template_name),
        allocate_payment_based_on_payment_terms=bool(
            doc.get("allocate_payment_based_on_payment_terms", 0)
        ),
        terms=terms,
    )
    _PTT_DETAIL_CACHE[key] = (now + _ITEMS_TTL_SECONDS, detail)
    return detail
```

- [ ] **Step 3: Add `get_single` to `FrappeClient`.**

In `backend/app/services/frappe_client.py`, alongside `list_resource`:

```python
async def get_single(self, doctype: str, name: str) -> FrappeResult:
    """GET /api/resource/{doctype}/{name} — full document with child tables."""
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
```

- [ ] **Step 4: Routes.**

```python
@router.get("/frappe/payment-terms-templates", response_model=PaymentTermsTemplateListOut)
@limiter.limit("20/minute")
async def list_ptt(
    request: Request,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await integration_service.fetch_payment_terms_templates(
        session, current_user.institute_id,
    )


@router.get("/frappe/payment-terms-templates/{name}", response_model=PaymentTermsTemplateDetail)
@limiter.limit("40/minute")
async def get_ptt(
    request: Request,
    name: str,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    detail = await integration_service.fetch_payment_terms_template_detail(
        session, current_user.institute_id, name,
    )
    if detail is None:
        raise HTTPException(status_code=404, detail="Template not found or Frappe disabled")
    return detail
```

- [ ] **Step 5: Compile + commit.**

```bash
cd backend && py -m compileall -q app/
git add backend/app/schemas/integration.py \
        backend/app/services/integration_service.py \
        backend/app/services/frappe_client.py \
        backend/app/routers/integrations.py
git commit -m "feat(integrations): payment terms templates list + detail endpoints"
```

### PHASE 1 CHECKPOINT

**Deliverable:** Three new admin endpoints return live Frappe data for their institute; cache works; disabled-Frappe falls back cleanly.

**Verification:**
- [ ] Byte-compile clean.
- [ ] Manual curl returns 30 items / 1 PTT against dev ERP.
- [ ] `enabled=false` path returns empty list when institute's Frappe is off.

---

## Phase 2 — Connector fixture: Sales Order custom fields

**Team:** `general-purpose` with `get-api-docs` skill (for Frappe custom-field docs).

### Task 2.1 — Extend fixtures

**Files:**
- Modify: `zensbot_lms_connector/zensbot_lms_connector/hooks.py`
- Modify: `zensbot_lms_connector/zensbot_lms_connector/fixtures/custom_field.json`

- [ ] **Step 1: Update hooks.py fixture filter list.**

Change:
```python
fixtures = [
    {"dt": "Custom Field", "filters": [["name", "in", [
        "Sales Invoice-zensbot_fee_plan_id",
        "Payment Entry-zensbot_fee_plan_id",
        "Payment Entry-zensbot_payment_id",
        "Sales Order-zensbot_fee_plan_id",
        "Sales Order-zensbot_payment_id",
        "Sales Order-zensbot_payment_proof_url",
    ]]]},
]
```

- [ ] **Step 2: Regenerate `fixtures/custom_field.json` by appending three entries.**

Append three objects (use existing entries as a template, change `dt` to `Sales Order` and the `fieldname`/`label` accordingly). Fieldname suggestions:

```json
{
  "doctype": "Custom Field",
  "dt": "Sales Order",
  "fieldname": "zensbot_fee_plan_id",
  "label": "Zensbot Fee Plan ID",
  "fieldtype": "Data",
  "insert_after": "naming_series",
  "read_only": 1,
  "unique": 1,
  "translatable": 0,
  "hidden": 0,
  "no_copy": 1,
  "in_global_search": 1,
  "description": "LMS FeePlan UUID — populated by Zensbot LMS; do not edit."
},
{
  "doctype": "Custom Field",
  "dt": "Sales Order",
  "fieldname": "zensbot_payment_id",
  "label": "Zensbot Payment ID",
  "fieldtype": "Data",
  "insert_after": "zensbot_fee_plan_id",
  "read_only": 1,
  "no_copy": 1,
  "description": "LMS FeePayment UUID — populated by Zensbot LMS; do not edit."
},
{
  "doctype": "Custom Field",
  "dt": "Sales Order",
  "fieldname": "zensbot_payment_proof_url",
  "label": "Payment Proof",
  "fieldtype": "Long Text",
  "insert_after": "zensbot_payment_id",
  "read_only": 1,
  "no_copy": 1,
  "description": "Signed URL to the onboarding payment screenshot stored by Zensbot LMS."
}
```

Note: `Long Text` lets the URL fit comfortably; Frappe renders it as clickable text in the Sales Order view.

- [ ] **Step 3: Write re-install instructions into the runbook (Phase 7 finalizes the doc; stub it now).**

Create `docs/claude/frappe-sales-order-onboarding.md` (force-add — `*.md` is gitignored):

```markdown
# Sales Order Onboarding — Connector Upgrade

When this feature ships, every institute running `zensbot_lms_connector` must
reinstall the app to pick up the 3 new Sales Order custom fields:

    bench --site <site> migrate

After migrate, confirm the 3 fields exist in Sales Order:
- Zensbot Fee Plan ID  (Data)
- Zensbot Payment ID   (Data)
- Payment Proof        (Long Text)
```

- [ ] **Step 4: Commit.**

```bash
git add zensbot_lms_connector/
git add -f docs/claude/frappe-sales-order-onboarding.md
git commit -m "feat(connector): add Sales Order custom fields (fee_plan_id, payment_id, payment_proof_url)"
```

### PHASE 2 CHECKPOINT

**Deliverable:** Fixture file updated; deploying the connector will install three new Sales Order custom fields.

**Verification:**
- [ ] `jq '.[] | select(.dt=="Sales Order") | .fieldname' zensbot_lms_connector/zensbot_lms_connector/fixtures/custom_field.json` prints the three names.
- [ ] The `hooks.py` filter list matches.

---

## Phase 3 — Schema additions

**Team:** `database-reviewer` · skills `database-migrations`, `postgres-patterns`.

### Task 3.1 — Migration 043

**Files:**
- Create: `backend/migrations/versions/043_feeplan_frappe_fields.py`

- [ ] **Step 1: Inspect latest migration.**

```bash
ls backend/migrations/versions/ | tail -3
# expected: 042_user_employee_id.py
```

Capture `down_revision = "042"`.

- [ ] **Step 2: Create the migration.**

```python
"""fee_plan Frappe fields + fee_payment proof URL

Revision ID: 043
Revises: 042
Create Date: 2026-04-20

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "043"
down_revision = "042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fee_plans", sa.Column("frappe_item_code", sa.String(140), nullable=True))
    op.add_column("fee_plans", sa.Column("frappe_payment_terms_template", sa.String(140), nullable=True))
    op.add_column("fee_plans", sa.Column("frappe_sales_order_name", sa.String(140), nullable=True))

    op.add_column("fee_payments", sa.Column("payment_proof_url", sa.Text, nullable=True))
    op.add_column("fee_payments", sa.Column("payment_proof_key", sa.Text, nullable=True))

    # Index so the sync handler can find the SO name in O(1)
    op.create_index(
        "ix_fee_plans_frappe_sales_order_name",
        "fee_plans",
        ["frappe_sales_order_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_fee_plans_frappe_sales_order_name", table_name="fee_plans")
    op.drop_column("fee_payments", "payment_proof_key")
    op.drop_column("fee_payments", "payment_proof_url")
    op.drop_column("fee_plans", "frappe_sales_order_name")
    op.drop_column("fee_plans", "frappe_payment_terms_template")
    op.drop_column("fee_plans", "frappe_item_code")
```

- [ ] **Step 3: Compile check.**

```bash
cd backend && py -m py_compile migrations/versions/043_feeplan_frappe_fields.py
```

- [ ] **Step 4: Update the SQLModel.**

In `backend/app/models/fee.py`, add to `FeePlan`:

```python
    frappe_item_code: Optional[str] = Field(default=None, sa_column=Column(sa.String(140), nullable=True))
    frappe_payment_terms_template: Optional[str] = Field(default=None, sa_column=Column(sa.String(140), nullable=True))
    frappe_sales_order_name: Optional[str] = Field(default=None, sa_column=Column(sa.String(140), nullable=True))
```

And to `FeePayment`:

```python
    payment_proof_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    payment_proof_key: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
```

Ensure `Text` is imported. Add an `Index` declaration to the `__table_args__` of `FeePlan` to mirror the migration (same pattern as Phase 1 of the prior branch):

```python
    Index(
        "ix_fee_plans_frappe_sales_order_name",
        "frappe_sales_order_name",
        unique=False,
    ),
```

- [ ] **Step 5: Compile check + commit.**

```bash
cd backend && py -m compileall -q app/models/fee.py migrations/versions/
git add backend/app/models/fee.py backend/migrations/versions/043_feeplan_frappe_fields.py
git commit -m "feat(db): add fee_plan Frappe fields + fee_payment proof URL columns"
```

### PHASE 3 CHECKPOINT

**Deliverable:** Migration 043 + model updates ready. Applied in Phase 7.

---

## Phase 4 — Payment screenshot upload

**Team:** `tdd-guide` · skills `backend-patterns`.

### Task 4.1 — S3 helper for payment proofs

**File:** `backend/app/utils/s3.py`

- [ ] **Step 1: Add a new helper that mirrors `generate_upload_url` but for admissions.**

```python
def generate_payment_proof_upload_url(
    file_name: str,
    content_type: str,
    institute_id: uuid.UUID,
    fee_plan_id: uuid.UUID,
    expires_in: int = 3600,
) -> tuple[str, str]:
    """Return (presigned_put_url, object_key) for a payment-proof image."""
    client = _get_client()
    safe_name = file_name.replace("/", "_")[:80]
    object_key = _prefix(
        institute_id,
        f"admissions/payment-proof/{fee_plan_id}/{uuid.uuid4()}_{safe_name}",
    )
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    return url, object_key


def generate_payment_proof_view_url(
    object_key: str, expires_in_seconds: int = 7 * 24 * 3600,
) -> str:
    """Return a presigned GET URL (7-day default) for embedding in the Frappe SO."""
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": object_key},
        ExpiresIn=expires_in_seconds,
    )
```

7-day view URL is fine for v1 — Sales Orders stay referenced by ERP users during the enrollment cycle. A shorter-lived approach is a Phase-2 improvement.

- [ ] **Step 2: Commit.**

```bash
git add backend/app/utils/s3.py
git commit -m "feat(s3): add payment-proof upload + view URL helpers"
```

### Task 4.2 — Route: two-step signed-URL upload

**File:** Create `backend/app/routers/payment_proof.py`.

Use the two-step pattern: client asks for a signed PUT URL, uploads directly to S3, then confirms the upload back to LMS so we record the key. Keeps the LMS backend out of the data path.

- [ ] **Step 1: Write the router.**

```python
"""Payment proof upload endpoints for the admissions onboarding wizard.

Two-step signed-URL flow:
  1. POST /upload-url  → returns (url, key) to PUT to S3
  2. PUT  <url>         → uploaded by the browser directly
  3. POST /confirm     → LMS records the key on the FeePayment row
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.utils.s3 import (
    generate_payment_proof_upload_url,
    generate_payment_proof_view_url,
)

router = APIRouter()

AdminOrAO = Annotated[User, Depends(require_roles("admin", "admissions_officer"))]


class UploadUrlRequest(BaseModel):
    file_name: str
    content_type: str
    fee_plan_id: uuid.UUID


class UploadUrlResponse(BaseModel):
    upload_url: str
    object_key: str
    view_url: str


@router.post("/payment-proof/upload-url", response_model=UploadUrlResponse)
async def get_payment_proof_upload_url(
    body: UploadUrlRequest,
    current_user: AdminOrAO,
):
    if current_user.institute_id is None:
        raise HTTPException(status_code=403, detail="No institute")
    ct = body.content_type.lower()
    if not (ct.startswith("image/") or ct == "application/pdf"):
        raise HTTPException(
            status_code=400,
            detail="content_type must be image/* or application/pdf",
        )
    put_url, key = generate_payment_proof_upload_url(
        file_name=body.file_name,
        content_type=body.content_type,
        institute_id=current_user.institute_id,
        fee_plan_id=body.fee_plan_id,
    )
    view_url = generate_payment_proof_view_url(key)
    return UploadUrlResponse(upload_url=put_url, object_key=key, view_url=view_url)
```

Note: we return a `view_url` pre-baked so the frontend can preview without a second call. The key is what we persist.

- [ ] **Step 2: Register router in `backend/app/main.py`.**

Find the existing `admissions` router mount. Add next to it:

```python
from app.routers import payment_proof
app.include_router(
    payment_proof.router,
    prefix="/api/v1/admissions",
    tags=["Admissions — payment proof"],
)
```

- [ ] **Step 3: Compile + commit.**

```bash
cd backend && py -m py_compile app/routers/payment_proof.py app/main.py
git add backend/app/routers/payment_proof.py backend/app/main.py
git commit -m "feat(admissions): two-step signed-URL upload for payment proof screenshots"
```

### PHASE 4 CHECKPOINT

**Deliverable:** `POST /admissions/payment-proof/upload-url` returns a signed S3 PUT URL + the object key for the frontend.

---

## Phase 5 — Sales Order creation + sync dispatch refactor

**Team:** `python-reviewer` · skills `backend-patterns`, `api-design`.

### Task 5.1 — `FrappeClient.submit_sales_order`

**File:** `backend/app/services/frappe_client.py`

- [ ] **Step 1: Add the method.**

```python
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
    commission_rate: Optional[str],  # percent string like "10"
    payment_terms_template: Optional[str],
    payment_proof_view_url: Optional[str],
) -> FrappeResult:
    """Create AND submit (docstatus 0→1) a Sales Order in one request.

    Idempotent via custom_zensbot_fee_plan_id — a second call with the same
    fee_plan_id either finds the existing doc (and returns ok=True) or
    creates a new one (and submits).
    """
    # 1. Look up existing by fee_plan_id custom field
    existing = await self._find_by_zensbot_id("Sales Order", fee_plan_id)
    if existing.ok and existing.doc_name:
        return existing  # already created + submitted on a prior call

    # 2. Build the doc
    body: dict[str, Any] = {
        "doctype": "Sales Order",
        "customer": customer_name,
        "transaction_date": posting_date,
        "delivery_date": delivery_date,
        "order_type": "Sales",
        "currency": currency,
        FEE_PLAN_FIELD: fee_plan_id,
        "items": [{
            "item_code": item_code,
            "item_name": item_code,
            "description": item_description,
            "qty": 1,
            "rate": rate,
            "delivery_date": delivery_date,
        }],
    }
    if self.cfg.default_company:
        body["company"] = self.cfg.default_company
    if self.cfg.default_cost_center:
        body["items"][0]["cost_center"] = self.cfg.default_cost_center
    if contact_email:
        body["contact_email"] = contact_email
    if payment_terms_template:
        body["payment_terms_template"] = payment_terms_template
    if sales_person:
        body["sales_team"] = [{
            "sales_person": sales_person,
            "allocated_percentage": 100.0,
            "commission_rate": commission_rate or "0",
        }]
    if payment_id:
        body["custom_zensbot_payment_id"] = payment_id
    if payment_proof_view_url:
        body["custom_zensbot_payment_proof_url"] = payment_proof_view_url

    # 3. Create via frappe.client.insert (accepts full doc dict)
    insert_url = f"{self.base_url}/api/method/frappe.client.insert"
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            resp = await client.post(
                insert_url,
                json={"doc": body},
                headers=self._auth_header,
            )
    except httpx.RequestError as e:
        return FrappeResult(ok=False, error=f"Network error: {type(e).__name__}")

    if resp.status_code not in (200, 201):
        return FrappeResult(
            ok=False, status_code=resp.status_code, error=resp.text[:1000],
        )

    created = resp.json().get("message") or {}
    so_name = created.get("name")
    if not so_name:
        return FrappeResult(
            ok=False, status_code=resp.status_code,
            error=f"Frappe did not return a name: {resp.text[:500]}",
        )

    # 4. Submit — flips docstatus 0 → 1 ("active", not "draft")
    submit_url = f"{self.base_url}/api/method/frappe.client.submit"
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            sres = await client.post(
                submit_url,
                json={"doc": created},
                headers=self._auth_header,
            )
    except httpx.RequestError as e:
        return FrappeResult(
            ok=False, status_code=resp.status_code,
            doc_name=so_name,
            error=f"Inserted but submit failed (network): {type(e).__name__}",
        )

    if sres.status_code not in (200, 201):
        return FrappeResult(
            ok=False, status_code=sres.status_code,
            doc_name=so_name,
            error=f"Inserted but submit failed: {sres.text[:500]}",
        )

    return FrappeResult(
        ok=True, status_code=200, doc_name=so_name,
        response={"data": sres.json().get("message") or created},
    )
```

- [ ] **Step 2: Commit.**

```bash
git add backend/app/services/frappe_client.py
git commit -m "feat(frappe-client): add submit_sales_order (create+submit, idempotent)"
```

### Task 5.2 — Dispatch `fee.plan_created` to Sales Order

**File:** `backend/app/services/frappe_sync_service.py`

- [ ] **Step 1: Add `_sync_sales_order` handler.**

Near the existing `_sync_sales_invoice`:

```python
async def _sync_sales_order(
    session: AsyncSession,
    client: FrappeClient,
    task: IntegrationSyncTask,
    payload: dict,
) -> tuple[bool, IntegrationSyncLog]:
    fee_plan_id_str = payload.get("fee_plan_id")
    student_id_str = payload.get("student_id")
    if not (fee_plan_id_str and student_id_str):
        return False, _build_log_row(task, status="failed", error="Missing fee_plan_id or student_id")

    plan = await session.get(FeePlan, uuid.UUID(fee_plan_id_str))
    student = await session.get(User, uuid.UUID(student_id_str))
    batch = await session.get(Batch, plan.batch_id) if plan else None
    if plan is None or student is None or batch is None:
        return False, _build_log_row(task, status="failed", error="Fee plan / student / batch missing")

    if getattr(client.cfg, "auto_create_customers", True):
        await client.create_customer(customer_name=student.name, email=student.email)

    # Sales Person from the onboarding officer's employee_id
    sales_person = None
    commission_rate = None
    officer = await session.get(User, plan.onboarded_by_user_id)
    if officer and officer.employee_id:
        # Look up Sales Person where employee == employee_id
        sp_lookup = await client.list_resource(
            "Sales Person",
            fields=["name", "commission_rate"],
            filters=[["employee", "=", officer.employee_id], ["enabled", "=", 1]],
            limit=1,
        )
        if sp_lookup.ok:
            sp_rows = (sp_lookup.response or {}).get("data") or []
            if sp_rows:
                sales_person = sp_rows[0]["name"]
                commission_rate = sp_rows[0].get("commission_rate") or None

    # Payment proof view URL (if an attached FeePayment has one)
    payment_proof_view_url: Optional[str] = None
    payment_id: Optional[str] = None
    if plan.frappe_sales_order_name is None:  # only on initial create path
        from app.utils.s3 import generate_payment_proof_view_url
        from sqlmodel import select
        first_payment_q = select(FeePayment).where(
            FeePayment.fee_plan_id == plan.id,
            FeePayment.deleted_at.is_(None),
        ).order_by(FeePayment.created_at.asc()).limit(1)
        first_payment = (await session.execute(first_payment_q)).scalar_one_or_none()
        if first_payment:
            payment_id = str(first_payment.id)
            if first_payment.payment_proof_key:
                payment_proof_view_url = generate_payment_proof_view_url(
                    first_payment.payment_proof_key,
                )

    result = await client.submit_sales_order(
        fee_plan_id=str(plan.id),
        payment_id=payment_id,
        customer_name=student.name,
        contact_email=student.email,
        posting_date=plan.created_at.date().isoformat() if plan.created_at else datetime.utcnow().date().isoformat(),
        delivery_date=plan.created_at.date().isoformat() if plan.created_at else datetime.utcnow().date().isoformat(),
        currency=plan.currency,
        item_code=plan.frappe_item_code or batch.name,
        item_description=f"{batch.name} — {plan.plan_type}",
        rate=plan.final_amount,
        sales_person=sales_person,
        commission_rate=_commission_rate_value(commission_rate),
        payment_terms_template=plan.frappe_payment_terms_template,
        payment_proof_view_url=payment_proof_view_url,
    )
    if result.ok and result.doc_name:
        plan.frappe_sales_order_name = result.doc_name
        session.add(plan)

    return _finalize_outbound(task, result, entity_type="sales_order", lms_entity_id=plan.id)


def _commission_rate_value(raw: Optional[str]) -> Optional[str]:
    """Frappe stores commission_rate as e.g. "10%" or "10" — normalize to numeric string."""
    if raw is None:
        return None
    s = str(raw).strip().replace("%", "")
    return s if s else None
```

- [ ] **Step 2: Route `fee.plan_created` → `_sync_sales_order` in `_dispatch`.**

Replace:
```python
if task.event_type == "fee.plan_created":
    return await _sync_sales_invoice(session, client, task, payload)
```
With:
```python
if task.event_type == "fee.plan_created":
    return await _sync_sales_order(session, client, task, payload)
```

`_sync_sales_invoice` stays in the module for backward-compat but is no longer called from `_dispatch`. Do NOT delete it — a future "also emit Sales Invoice" hook is likely.

- [ ] **Step 3: Compile + commit.**

```bash
cd backend && py -m compileall -q app/services/
git add backend/app/services/frappe_sync_service.py
git commit -m "feat(frappe-sync): dispatch fee.plan_created to Sales Order (submitted) path"
```

### Task 5.3 — Thread new fields through `onboard_student`

**File:** `backend/app/services/admissions_service.py` + `backend/app/schemas/fee.py`.

- [ ] **Step 1: Extend `OnboardStudentRequest`.**

In `backend/app/schemas/fee.py`, add to `OnboardStudentRequest` (or wherever the onboarding Pydantic model is):

```python
    frappe_item_code: Optional[str] = Field(default=None, max_length=140)
    frappe_payment_terms_template: Optional[str] = Field(default=None, max_length=140)
    payment_proof_object_key: Optional[str] = Field(default=None, max_length=1024)
    initial_payment_amount: Optional[int] = None
```

- [ ] **Step 2: Persist on FeePlan + FeePayment in `onboard_student`.**

Where the `FeePlan` is created, set:

```python
    plan.frappe_item_code = payload.frappe_item_code
    plan.frappe_payment_terms_template = payload.frappe_payment_terms_template
```

After the plan is committed, if `payload.payment_proof_object_key` is set, create an initial `FeePayment` row:

```python
    if payload.payment_proof_object_key:
        initial_payment = FeePayment(
            fee_plan_id=plan.id,
            institute_id=officer.institute_id,
            amount=payload.initial_payment_amount or 0,
            payment_method="onboarding_upload",
            payment_date=date.today(),
            payment_proof_key=payload.payment_proof_object_key,
            payment_proof_url=None,  # signed URL regenerated on demand via helper
            status="confirmed",
            # receipt_number etc. — use existing fee_service helper
        )
        session.add(initial_payment)
        await session.flush()
```

Use `fee_service.record_payment` if the existing helper does all of this — match the existing pattern; don't invent a second payment-creation path.

- [ ] **Step 3: Commit.**

```bash
git add backend/app/schemas/fee.py backend/app/services/admissions_service.py
git commit -m "feat(admissions): thread Frappe item/template + payment proof through onboard"
```

### PHASE 5 CHECKPOINT

**Deliverable:** When `fee.plan_created` webhook fires, the sync job posts a **submitted** Sales Order to Frappe with correct customer, items, contact, sales_team, payment_terms_template, and payment_proof_url.

---

## Phase 6 — Frontend OnboardWizard

**Team:** `general-purpose` · skills `frontend-design`, `shadcn`.

### Task 6.1 — API client additions

**File:** `frontend/lib/api/integrations.ts`

- [ ] **Step 1: Append types + functions.**

```typescript
export interface FrappeItem {
  itemCode: string;
  itemName: string;
  itemGroup: string | null;
  standardRate: number | null;
  stockUom: string | null;
}

export interface FrappeItemListResponse {
  enabled: boolean;
  cachedAt: string | null;
  error: string | null;
  items: FrappeItem[];
}

export interface PaymentTermsTemplate {
  name: string;
  templateName: string;
  termCount: number;
}

export interface PaymentTermsTemplateListResponse {
  enabled: boolean;
  cachedAt: string | null;
  error: string | null;
  templates: PaymentTermsTemplate[];
}

export interface PaymentTermsTemplateTermRow {
  paymentTerm: string;
  invoicePortion: number;
  creditDays: number;
  creditMonths: number;
  modeOfPayment: string | null;
  dueDateBasedOn: string | null;
}

export interface PaymentTermsTemplateDetail {
  name: string;
  templateName: string;
  allocatePaymentBasedOnPaymentTerms: boolean;
  terms: PaymentTermsTemplateTermRow[];
}

export async function listFrappeItems(): Promise<FrappeItemListResponse> {
  return apiClient('/integrations/frappe/items');
}
export async function listFrappePaymentTermsTemplates(): Promise<PaymentTermsTemplateListResponse> {
  return apiClient('/integrations/frappe/payment-terms-templates');
}
export async function getFrappePaymentTermsTemplate(name: string): Promise<PaymentTermsTemplateDetail> {
  return apiClient(`/integrations/frappe/payment-terms-templates/${encodeURIComponent(name)}`);
}
```

### Task 6.2 — Payment proof uploader component

**File:** Create `frontend/components/admissions/payment-proof-uploader.tsx`.

- [ ] Two-step upload: request signed URL → PUT directly to S3 → call onUploaded(key, viewUrl). Show thumbnail preview. ~150 lines.

### Task 6.3 — Rework OnboardWizard

**File:** `frontend/components/admissions/onboard-wizard.tsx`

- [ ] Replace the existing fee-plan-type step with a **Payment Terms Template dropdown** (fetched live) + a schedule preview table (fetched via detail endpoint when a template is selected).
- [ ] Add an **Item code dropdown** (new step) — searchable Combobox fetched from `listFrappeItems()`. If Frappe disabled, fall back to a free-text input (same fallback pattern as the Sales Person picker in the prior branch).
- [ ] Add a **Payment Proof Upload step** at the end — optional; if skipped, the Sales Order is created without the proof URL field.
- [ ] Submit payload must include `frappeItemCode`, `frappePaymentTermsTemplate`, `paymentProofObjectKey`, `initialPaymentAmount`.

### Task 6.4 — Commit

```bash
cd frontend && npm run typecheck  # if node_modules present, else skip
cd ..
git add frontend/components/admissions/onboard-wizard.tsx \
        frontend/components/admissions/payment-proof-uploader.tsx \
        frontend/lib/api/integrations.ts \
        frontend/lib/api/admissions.ts
git commit -m "feat(admissions): wizard adds Item + PTT + payment screenshot steps"
```

### PHASE 6 CHECKPOINT

**Deliverable:** AO opens wizard → picks Item + PTT → sees schedule preview → uploads screenshot → submits → backend creates submitted SO in Frappe.

---

## Phase 7 — Tests, migrations, deploy (CONSOLIDATED)

**Team:** `e2e-runner` · skills `e2e-testing`, `python-testing`, `deployment-patterns` · reviewed by `security-reviewer`.

### Task 7.1 — Unit tests

- `test_sales_order_build.py` — mocks FrappeClient, asserts payload shape for happy path + no-sales-person path + no-PTT path.
- Extend `test_sales_person_fetch.py` with items + PTT cases.

### Task 7.2 — Integration tests

- Add onboarding-with-SO flow to `tests/integration_test.py`: creates a plan, asserts `frappe_sales_order_name` eventually populated, and the sync log row is `direction=outbound entity_type=sales_order status=success`.

### Task 7.3 — E2E

- Playwright spec: admin onboards a student end-to-end including screenshot upload; verify DB state + fake Frappe response.

### Task 7.4 — DB migration apply

```bash
cd backend && alembic upgrade head
```
Expected: `043 -> applied`.

### Task 7.5 — Connector reinstall in Frappe

Per runbook:
```bash
bench --site deverp.ict.net.pk migrate
```
Verify 3 new Sales Order custom fields exist.

### Task 7.6 — Blue-green deploy

Push branch → PR → CI → merge → `deploy-bg.sh` picks up the new migration + routes.

### Task 7.7 — Post-deploy smoke

Real admin onboards one test student + uploads a screenshot. Verify:
- LMS: FeePlan has `frappe_sales_order_name` populated.
- Frappe: `SAL-ORD-2026-XXXXX` is **docstatus=1** (not draft), `sales_team[0].sales_person` matches the AO's linked agent, `custom_zensbot_payment_proof_url` links to the S3 image.

### PHASE 7 CHECKPOINT

**Deliverable:** Feature live on production. Every onboarding creates a submitted Sales Order in the institute's Frappe with sales_team credit + payment proof.

---

## Risks (concise — full analysis in session, not repeated here)

1. **PTT invoice_portion sums to 99 or 101 due to admin error** → Frappe will still accept the SO but `payment_schedule` may not add up. Validate on the LMS before submit: sum percentages across the selected template's terms; warn if not 100.
2. **Customer auto-create race** — if two admins onboard two different students with overlapping names, `create_customer` could hit a uniqueness error in Frappe. Use `email` as the disambiguator (already in `create_customer`).
3. **Sales Person disabled between picker-open and submit** → commission row's `sales_person` points to a disabled record. Frappe accepts this; the Sales Person report will show them with an "(Disabled)" suffix. Acceptable for v1.
4. **Payment proof view URL expires (7 days) — Frappe row keeps the now-stale URL** → add a scheduled job in a future phase that regenerates + PUTs the updated URL onto the SO. Out of scope for v1.
5. **Uploaded screenshot exceeds S3 object size limit / fails virus-scan** — Phase 4 does no MIME sniffing beyond content-type. Add a ClamAV or S3 event Lambda scan in a follow-up.

## Out of scope (explicit)

- Sales Invoice auto-generation from the SO — Frappe has a built-in button for this; we don't trigger it yet.
- Payment Entry sync already exists in `_sync_payment_entry` — unchanged by this plan.
- Sales Partner (external) attribution — unused today.
- Editing an AO's linked Sales Person after creation.
- Flutter support for the onboarding wizard (web-only).

## Estimated Complexity: MEDIUM-HIGH (~14h)

Phase 1: 2h · Phase 2: 1h · Phase 3: 1h · Phase 4: 2h · Phase 5: 3h · Phase 6: 3h · Phase 7: 2h.

**WAITING FOR CONFIRMATION.** Reply `yes` / `proceed` to start Phase 1 with the subagent pipeline, or `modify: …` with changes.
