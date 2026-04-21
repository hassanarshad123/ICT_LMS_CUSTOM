# Admissions Officer ↔ Frappe Sales Agent Linking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the admin `/[userId]/admissions-officers` page, let the admin pick an existing Frappe ERP Sales Agent from a live-fetched dropdown — LMS auto-stores the Employee ID (e.g. `MITT5037`) on the new User record so invoices/commissions reconcile against ERP without manual data entry.

**Architecture:** Pull-on-demand (no bi-directional sync). New admin-only endpoint `GET /api/v1/integrations/frappe/sales-persons` fans out to Frappe via the existing `FrappeClient.list_resource`, joins `Sales Person` with `Employee` in-memory, annotates which LMS Users already claim each `employee_id`. Frontend replaces free-text name/email/phone with a searchable combobox that prefills those fields + hidden `employee_id`. Falls back to the existing manual form when Frappe is not configured.

**Tech Stack:** FastAPI (Python 3.11) + SQLModel + Alembic + httpx (existing) · Next.js 13 App Router + shadcn/ui Combobox + Sonner toasts (existing) · Fernet-encrypted Frappe creds via `app/utils/encryption.py` (existing).

**Branch:** `feat/ao-frappe-sales-agent-link` (already created from `main`).

---

## Team Assignments

Each phase is executed by an agent + skill combo. Phase N starts only after Phase N-1 CHECKPOINT is verified (per `CLAUDE.md` — "Do not start Phase N until Phase N-1 is verified.").

| Phase | Scope | Primary Agent | Primary Skill(s) | Review Agent |
|-------|-------|---------------|------------------|--------------|
| 1 | Schema + migration | `database-reviewer` | `database-migrations`, `postgres-patterns` | `code-reviewer` |
| 2 | Frappe list endpoint | `python-reviewer` | `tdd-workflow`, `python-testing` | `security-reviewer` |
| 3 | User service wiring | `tdd-guide` | `tdd-workflow`, `backend-patterns` | `code-reviewer` |
| 4 | Frontend combobox | `general-purpose` | `frontend-design`, `shadcn` | `code-reviewer` |
| 5 | UX polish + badges | `general-purpose` | `frontend-patterns` | `code-reviewer` |
| 6 | E2E + deploy | `e2e-runner` | `e2e-testing`, `deployment-patterns` | `security-reviewer` |

Dispatch pattern: per `superpowers:subagent-driven-development`, each phase is handed to a fresh subagent with the phase's tasks pasted verbatim. Review happens inline between phases against the CHECKPOINT.

---

## File Structure

**Backend (7 files; 1 new migration, 6 modified)**
- `backend/migrations/versions/0XX_user_employee_id.py` — NEW — adds nullable `users.employee_id VARCHAR(64)` + partial unique index.
- `backend/app/models/user.py` — MODIFIED — add `employee_id` column.
- `backend/app/schemas/user.py` — MODIFIED — add `employee_id` to `UserCreate`/`UserOut`.
- `backend/app/services/user_service.py` — MODIFIED — accept + uniqueness-check `employee_id`.
- `backend/app/services/integration_service.py` — MODIFIED — add `fetch_sales_persons()` with 60s TTL cache.
- `backend/app/routers/integrations.py` — MODIFIED — add `GET /frappe/sales-persons`.
- `backend/app/schemas/integration.py` — MODIFIED — add DTOs `SalesPersonItem`, `SalesPersonListOut`.

**Backend tests (2 files; 1 new, 1 modified)**
- `backend/tests/unit/test_sales_person_fetch.py` — NEW — mocked FrappeClient paths.
- `backend/tests/integration_test.py` — MODIFIED — AO create-with-employee-id + duplicate cases.

**Frontend (3 files; all modified)**
- `frontend/lib/api/integrations.ts` — MODIFIED — add `listFrappeSalesPersons()` + types.
- `frontend/lib/api/users.ts` — MODIFIED — extend `CreateUserPayload`, `UserOut` with `employeeId`.
- `frontend/components/pages/admin/admissions-officers.tsx` — MODIFIED — replace form body with sales-person combobox + fallback.

**Docs (1 file; new)**
- `docs/claude/frappe-sales-person-link.md` — NEW — ops runbook: configure integration, reconcile drift, troubleshoot "Already linked" states.

---

## Phase 1 — Schema: add `employee_id` to User

**Team:** `database-reviewer` agent · `database-migrations` + `postgres-patterns` skills · reviewed by `code-reviewer`.

### Task 1.1: Write the Alembic migration

**Files:**
- Create: `backend/migrations/versions/0XX_user_employee_id.py`

- [ ] **Step 1: Read the most recent migration to find the parent revision id**

Run: `ls backend/migrations/versions/ | tail -5`
Capture the latest file's filename; open it; copy its `revision = "…"` string. That becomes `down_revision` in the new migration.

- [ ] **Step 2: Create the migration file**

Content (substitute `<DOWN_REV>` with the captured revision):

```python
"""add users.employee_id for Frappe Sales Person linking

Revision ID: 0XX_user_employee_id
Revises: <DOWN_REV>
Create Date: 2026-04-20

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0XX_user_employee_id"
down_revision = "<DOWN_REV>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("employee_id", sa.String(length=64), nullable=True),
    )
    # Partial unique index: enforce uniqueness of employee_id per institute,
    # but only for non-deleted rows with a non-null employee_id.
    op.create_index(
        "uq_user_employee_id_institute",
        "users",
        ["institute_id", "employee_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL AND employee_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_user_employee_id_institute", table_name="users")
    op.drop_column("users", "employee_id")
```

- [ ] **Step 3: Byte-compile to catch syntax errors**

Run: `cd backend && python -m py_compile migrations/versions/0XX_user_employee_id.py`
Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/versions/0XX_user_employee_id.py
git commit -m "feat(db): add users.employee_id column for Frappe linking"
```

### Task 1.2: Update the User model + schemas

**Files:**
- Modify: `backend/app/models/user.py:68` (after `locked_until` field)
- Modify: `backend/app/schemas/user.py` (all `UserCreate` + `UserOut` shapes)

- [ ] **Step 1: Add `employee_id` to the User SQLModel**

In `backend/app/models/user.py`, after the `locked_until` declaration (~line 68), add:

```python
    employee_id: Optional[str] = Field(
        default=None,
        max_length=64,
        sa_column=Column(sa.String(64), nullable=True),
    )
```

Ensure `import sqlalchemy as sa` is present at the top.

- [ ] **Step 2: Add the field to `UserCreate` and `UserOut` schemas**

Find the Pydantic models in `backend/app/schemas/user.py`. Add to both:

```python
    employee_id: Optional[str] = None
```

Use `Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")` on `UserCreate` to validate shape; `UserOut` stays plain Optional.

- [ ] **Step 3: Byte-compile**

Run: `cd backend && python -m compileall -q app/models/user.py app/schemas/user.py`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/user.py backend/app/schemas/user.py
git commit -m "feat(users): add employee_id field on User + schemas"
```

### PHASE 1 CHECKPOINT

**Deliverable:** Migration file + model change.

**Verification:**
- [ ] `cd backend && python -m compileall -q app/ migrations/` → clean.
- [ ] `cd backend && alembic upgrade head` on a local DB → applies cleanly.
- [ ] `psql -c "\d users" | grep employee_id` → column present.
- [ ] `psql -c "\di uq_user_employee_id_institute"` → index present.
- [ ] `alembic downgrade -1 && alembic upgrade head` → round-trip clean.

**Do NOT proceed to Phase 2 until every checkbox is green.**

---

## Phase 2 — Frappe sales-persons list endpoint

**Team:** `python-reviewer` agent · `tdd-workflow` + `python-testing` skills · reviewed by `security-reviewer`.

### Task 2.1: Write DTOs

**Files:**
- Modify: `backend/app/schemas/integration.py`

- [ ] **Step 1: Append DTOs**

```python
from typing import List, Optional
from pydantic import BaseModel


class SalesPersonItem(BaseModel):
    employee_id: str
    sales_person_name: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    commission_rate: Optional[str] = None
    hr_status: Optional[str] = None
    already_mapped: bool = False
    linked_officer_id: Optional[str] = None


class SalesPersonListOut(BaseModel):
    enabled: bool
    cached_at: Optional[str] = None
    error: Optional[str] = None
    sales_persons: List[SalesPersonItem] = []
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/integration.py
git commit -m "feat(integrations): add SalesPersonItem + SalesPersonListOut DTOs"
```

### Task 2.2: Write the failing unit test

**Files:**
- Create: `backend/tests/unit/test_sales_person_fetch.py`

- [ ] **Step 1: Write the test file**

```python
"""Unit tests for integration_service.fetch_sales_persons.

FrappeClient is mocked — these tests verify the join + alreadyMapped logic,
not the HTTP shape (covered by FrappeClient's own tests).
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

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
        class _Cfg: pass
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
        class _Cfg: pass
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
        class _Cfg: pass
        return _Cfg()

    async def _fake_list(_self, doctype, **_kwargs):
        return FrappeResult(ok=False, status_code=502, error="Bad gateway")

    monkeypatch.setattr(integration_service, "load_active_frappe_config", _fake_load)
    monkeypatch.setattr(
        "app.services.frappe_client.FrappeClient.list_resource", _fake_list,
    )

    out = await integration_service.fetch_sales_persons(
        _StubSession({}), institute_id=uuid.uuid4()
    )
    assert out.enabled is True
    assert out.error is not None
    assert out.sales_persons == []
```

- [ ] **Step 2: Run the test — expect failure**

Run: `cd backend && pytest tests/unit/test_sales_person_fetch.py -v`
Expected: FAIL — `AttributeError: module 'app.services.integration_service' has no attribute 'fetch_sales_persons'`.

- [ ] **Step 3: Commit the failing test**

```bash
git add backend/tests/unit/test_sales_person_fetch.py
git commit -m "test(integrations): add failing test for fetch_sales_persons"
```

### Task 2.3: Implement `fetch_sales_persons`

**Files:**
- Modify: `backend/app/services/integration_service.py`

- [ ] **Step 1: Add imports + module-level cache at the top**

```python
import time
from typing import Dict, Tuple
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.integration import SalesPersonItem, SalesPersonListOut
from app.services.frappe_client import FrappeClient

# Per-institute in-process cache: {institute_id: (expires_epoch, SalesPersonListOut)}
_SALES_PERSON_CACHE: Dict[uuid.UUID, Tuple[float, SalesPersonListOut]] = {}
_SALES_PERSON_TTL_SECONDS = 60
```

- [ ] **Step 2: Add the function at the end of the module**

```python
async def fetch_sales_persons(
    session: AsyncSession,
    institute_id: uuid.UUID,
) -> SalesPersonListOut:
    """List Frappe Sales Persons joined with Employee details.

    - Disabled integration → enabled=False, sales_persons=[].
    - Frappe unreachable → enabled=True, error=<msg>, sales_persons=[].
    - Caches per institute for 60s.
    """
    now = time.time()
    cached = _SALES_PERSON_CACHE.get(institute_id)
    if cached and cached[0] > now:
        return cached[1]

    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        out = SalesPersonListOut(enabled=False)
        _SALES_PERSON_CACHE[institute_id] = (now + _SALES_PERSON_TTL_SECONDS, out)
        return out

    client = FrappeClient(cfg)
    sp_res = await client.list_resource(
        "Sales Person",
        fields=["name", "sales_person_name", "employee", "enabled", "commission_rate"],
        filters=[["enabled", "=", 1]],
        limit=500,
    )
    if not sp_res.ok:
        out = SalesPersonListOut(enabled=True, error=sp_res.error or "Frappe error")
        _SALES_PERSON_CACHE[institute_id] = (now + 30, out)
        return out

    rows = (sp_res.response or {}).get("data") or []
    employee_ids = [r.get("employee") for r in rows if r.get("employee")]
    employees_by_id: dict[str, dict] = {}
    if employee_ids:
        emp_res = await client.list_resource(
            "Employee",
            fields=["name", "employee_name", "prefered_email",
                    "company_email", "personal_email",
                    "cell_number", "status"],
            filters=[["name", "in", employee_ids]],
            limit=500,
        )
        if emp_res.ok:
            for e in (emp_res.response or {}).get("data") or []:
                employees_by_id[e["name"]] = e

    # Fetch existing LMS mappings for this institute
    result = await session.execute(
        select(User.employee_id, User.id).where(
            User.institute_id == institute_id,
            User.role == UserRole.admissions_officer,
            User.deleted_at.is_(None),
            User.employee_id.is_not(None),
        )
    )
    mapped = {eid: uid for eid, uid in result.all()}

    items: list[SalesPersonItem] = []
    for r in rows:
        emp_id = r.get("employee")
        if not emp_id:
            continue
        emp = employees_by_id.get(emp_id, {})
        email = (emp.get("prefered_email")
                 or emp.get("personal_email")
                 or emp.get("company_email"))
        items.append(SalesPersonItem(
            employee_id=emp_id,
            sales_person_name=r.get("sales_person_name") or r.get("name"),
            full_name=emp.get("employee_name") or r.get("sales_person_name") or "",
            email=email,
            phone=(emp.get("cell_number") or "").strip() or None,
            commission_rate=(r.get("commission_rate") or None),
            hr_status=emp.get("status"),
            already_mapped=emp_id in mapped,
            linked_officer_id=str(mapped[emp_id]) if emp_id in mapped else None,
        ))

    # Deterministic ordering (name ascending) for stable UI.
    items.sort(key=lambda x: x.full_name.lower())

    from datetime import datetime, timezone
    out = SalesPersonListOut(
        enabled=True,
        cached_at=datetime.now(timezone.utc).isoformat(),
        sales_persons=items,
    )
    _SALES_PERSON_CACHE[institute_id] = (now + _SALES_PERSON_TTL_SECONDS, out)
    return out
```

If `load_active_frappe_config` doesn't exist yet, it does — it's imported by `frappe_sync_service.py:35`. Use the same import.

- [ ] **Step 3: Run the tests — expect PASS**

Run: `cd backend && pytest tests/unit/test_sales_person_fetch.py -v`
Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/integration_service.py
git commit -m "feat(integrations): implement fetch_sales_persons with 60s TTL cache"
```

### Task 2.4: Add the HTTP route

**Files:**
- Modify: `backend/app/routers/integrations.py`

- [ ] **Step 1: Add import + route**

At the imports, add:

```python
from app.schemas.integration import SalesPersonListOut
```

At the end of the file (before any final line), add:

```python
@router.get("/frappe/sales-persons", response_model=SalesPersonListOut)
@limiter.limit("20/minute")
async def list_frappe_sales_persons(
    request: Request,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """List active Frappe Sales Persons for the AO onboarding dropdown."""
    return await integration_service.fetch_sales_persons(
        session, current_user.institute_id,
    )
```

- [ ] **Step 2: Compile check**

Run: `cd backend && python -m py_compile app/routers/integrations.py`
Expected: no output.

- [ ] **Step 3: Manually smoke-test against dev Frappe**

Prerequisite: local backend running, logged in as institute admin, institute has Frappe configured pointing at `deverp.ict.net.pk` with the keys provided.

Run:
```bash
curl -s -H "Authorization: Bearer <ADMIN_JWT>" \
  http://localhost:8000/api/v1/integrations/frappe/sales-persons | jq '.sales_persons | length'
```
Expected: `19` (the count of active agents we confirmed today).

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/integrations.py
git commit -m "feat(integrations): expose GET /frappe/sales-persons admin endpoint"
```

### PHASE 2 CHECKPOINT

**Deliverable:** Reachable `/api/v1/integrations/frappe/sales-persons` returning 19 real agents with emails/commissions, and `/tests/unit/test_sales_person_fetch.py` green (4/4).

**Verification:**
- [ ] `pytest tests/unit/test_sales_person_fetch.py -v` — 4 passed.
- [ ] Manual `curl` returns non-empty `sales_persons` array.
- [ ] Second `curl` within 60s is served from cache (check `cached_at` matches).
- [ ] Temporarily set `frappe_enabled=false` in DB → endpoint returns `{enabled:false, sales_persons:[]}`.
- [ ] `security-reviewer` agent confirms: no credential leakage in response, rate limit applied (hammer with 25 reqs → see 429).

---

## Phase 3 — Backend AO creation accepts `employee_id`

**Team:** `tdd-guide` agent · `tdd-workflow` + `backend-patterns` skills · reviewed by `code-reviewer`.

### Task 3.1: Write failing integration test

**Files:**
- Modify: `backend/tests/integration_test.py`

- [ ] **Step 1: Add two test cases**

Find the existing admin-session section. Add (adjust helpers to match the file's patterns):

```python
def test_create_admissions_officer_with_employee_id(admin_client):
    body = {
        "name": "Sales Agent One",
        "email": "agent1+pytest@example.com",
        "phone": "03000000001",
        "password": "TempP4ss!",
        "role": "admissions-officer",
        "employee_id": "MITT9001",
    }
    r = admin_client.post("/api/v1/users", json=body)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["employeeId"] == "MITT9001"


def test_reject_duplicate_employee_id_same_institute(admin_client):
    base = {
        "name": "Agent A", "email": "agenta+pytest@example.com",
        "phone": "03000000002", "password": "TempP4ss!",
        "role": "admissions-officer", "employee_id": "MITT9002",
    }
    r1 = admin_client.post("/api/v1/users", json=base)
    assert r1.status_code == 201

    r2 = admin_client.post("/api/v1/users", json={
        **base, "email": "agentb+pytest@example.com", "name": "Agent B",
    })
    assert r2.status_code in (400, 409)
    assert "Employee ID" in r2.text or "employee_id" in r2.text
```

- [ ] **Step 2: Run — expect fail**

Run (backend must be running — per `CLAUDE.md` integration tests require a live server):
```bash
cd backend && TEST_BASE_URL=http://localhost:8000 \
  TEST_ADMIN_EMAIL=admin@test.com TEST_ADMIN_PASSWORD=changeme \
  python tests/integration_test.py
```
Expected: FAIL — the endpoint silently ignores `employee_id`; assertion on `data["employeeId"]` fails.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration_test.py
git commit -m "test(users): add failing tests for AO employee_id create + uniqueness"
```

### Task 3.2: Wire `employee_id` through `user_service.create_user`

**Files:**
- Modify: `backend/app/services/user_service.py`

- [ ] **Step 1: Inspect current signature**

Read the current `create_user` definition. Goal: add `employee_id: Optional[str] = None` parameter, persist it on the User row, and add a pre-flight uniqueness check for the `(institute_id, employee_id)` combo among non-deleted admissions_officer users.

- [ ] **Step 2: Add uniqueness helper (above `create_user`)**

```python
async def _ensure_employee_id_unique(
    session: AsyncSession,
    institute_id: Optional[uuid.UUID],
    employee_id: str,
) -> None:
    if institute_id is None:
        raise ValueError("Cannot link employee_id without an institute")
    existing = await session.execute(
        select(User.id).where(
            User.institute_id == institute_id,
            User.employee_id == employee_id,
            User.deleted_at.is_(None),
        ).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError(
            f"Employee ID '{employee_id}' is already linked to another officer"
        )
```

- [ ] **Step 3: Extend `create_user` signature + body**

Add `employee_id: Optional[str] = None` to the signature. Before the `session.add(user)` call, insert:

```python
    if employee_id:
        await _ensure_employee_id_unique(session, institute_id, employee_id)
```

And assign `user.employee_id = employee_id` where the User row is constructed.

- [ ] **Step 4: Update the router handler**

In `backend/app/routers/users.py`, find the `POST /users` handler; pass `employee_id=body.employee_id` into `create_user(...)`. The schema already carries it after Phase 1 Task 1.2.

- [ ] **Step 5: Compile + re-run tests**

```bash
cd backend && python -m compileall -q app/
TEST_BASE_URL=http://localhost:8000 \
  TEST_ADMIN_EMAIL=admin@test.com TEST_ADMIN_PASSWORD=changeme \
  python tests/integration_test.py
```
Expected: both new tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/user_service.py backend/app/routers/users.py
git commit -m "feat(users): accept + uniqueness-check employee_id on create"
```

### Task 3.3: Surface `employee_id` on GET /users

**Files:**
- Modify: `backend/app/routers/users.py` (the list + detail responses)

- [ ] **Step 1: Check if the list handler serializes via `UserOut`**

Read the `GET /users` handler. If it already uses `UserOut` from schemas (which Phase 1 Task 1.2 updated), nothing more is needed — verify by calling the endpoint and grep for `employeeId` in the response.

- [ ] **Step 2: If list handler bypasses `UserOut`, patch it**

Add `employee_id=user.employee_id` in the dict/model construction. Do the same for `GET /users/{id}` detail.

- [ ] **Step 3: Manually verify**

```bash
curl -s -H "Authorization: Bearer <ADMIN_JWT>" \
  "http://localhost:8000/api/v1/users?role=admissions-officer" \
  | jq '.data[] | {name, email, employeeId}'
```
Expected: each officer has `employeeId` (null for legacy rows, the ERP ID for new ones).

- [ ] **Step 4: Commit (only if code changed)**

```bash
git add backend/app/routers/users.py
git commit -m "feat(users): include employee_id in GET /users responses"
```

### PHASE 3 CHECKPOINT

**Deliverable:** `POST /users` + `GET /users` fully plumb `employee_id`.

**Verification:**
- [ ] All three new integration tests green.
- [ ] `GET /users?role=admissions-officer` returns `employeeId` on every row.
- [ ] Duplicate submission returns a clean error (not a 500).
- [ ] `code-reviewer` agent: no SQL-injection / casing bugs / missing RBAC (endpoint stays admin-only).

---

## Phase 4 — Frontend combobox in Add AO form

**Team:** `general-purpose` agent · `frontend-design` + `shadcn` skills · reviewed by `code-reviewer`.

### Task 4.1: Add the API client

**Files:**
- Modify: `frontend/lib/api/integrations.ts`

- [ ] **Step 1: Inspect the file for existing pattern**

Read the file; note how other integration calls are structured (return shape, `apiClient` usage, camelCase conversion).

- [ ] **Step 2: Append types + function**

```typescript
export interface SalesPersonItem {
  employeeId: string;
  salesPersonName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  commissionRate: string | null;
  hrStatus: string | null;
  alreadyMapped: boolean;
  linkedOfficerId: string | null;
}

export interface SalesPersonListResponse {
  enabled: boolean;
  cachedAt: string | null;
  error: string | null;
  salesPersons: SalesPersonItem[];
}

export async function listFrappeSalesPersons(): Promise<SalesPersonListResponse> {
  return apiClient.get<SalesPersonListResponse>(
    "/integrations/frappe/sales-persons",
  );
}
```

If the existing `apiClient` signature differs, match it exactly — don't hand-roll `fetch`.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/api/integrations.ts
git commit -m "feat(frontend): add listFrappeSalesPersons API client"
```

### Task 4.2: Extend users API types

**Files:**
- Modify: `frontend/lib/api/users.ts`

- [ ] **Step 1: Add `employeeId` to `CreateUserPayload` and `UserOut`**

```typescript
export interface CreateUserPayload {
  // …existing fields
  employeeId?: string;
}

export interface UserOut {
  // …existing fields
  employeeId: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/api/users.ts
git commit -m "feat(frontend): add employeeId to user payload + output types"
```

### Task 4.3: Replace the form with the sales-person combobox

**Files:**
- Modify: `frontend/components/pages/admin/admissions-officers.tsx`

- [ ] **Step 1: Add imports + state**

Near the top, add:

```typescript
import { listFrappeSalesPersons, type SalesPersonItem } from '@/lib/api/integrations';
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
```

If any of those components aren't installed yet, run:
```bash
cd frontend && npx shadcn@latest add command popover badge
```

- [ ] **Step 2: Add `selectedAgent` + Frappe list state**

Inside the component (top of function body):

```typescript
const [selectedAgent, setSelectedAgent] = useState<SalesPersonItem | null>(null);
const [manualMode, setManualMode] = useState(false);
const [agentPickerOpen, setAgentPickerOpen] = useState(false);
const { data: frappeData, loading: agentsLoading, refetch: refetchAgents } =
  useApi(() => listFrappeSalesPersons(), []);
```

- [ ] **Step 3: Derive `formData.employeeId` from selection**

Change `formData` initial state to:

```typescript
const [formData, setFormData] = useState({
  name: '', email: '', phone: '', password: '', employeeId: '',
});
```

- [ ] **Step 4: Render the combobox when Frappe is enabled + not in manual mode**

Inside the `{showForm && (...)}` block, BEFORE the name/email/phone inputs, add:

```tsx
{frappeData?.enabled && !manualMode && (
  <div className="sm:col-span-2 lg:col-span-3 mb-2">
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      Select Sales Agent from ERP
    </label>
    <Popover open={agentPickerOpen} onOpenChange={setAgentPickerOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 hover:bg-gray-100"
        >
          {selectedAgent
            ? `${selectedAgent.fullName} · ${selectedAgent.employeeId}`
            : agentsLoading ? 'Loading sales agents…' : 'Pick a sales agent…'}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name or employee ID…" />
          <CommandList>
            <CommandEmpty>No agents found.</CommandEmpty>
            <CommandGroup>
              {(frappeData?.salesPersons ?? []).map((sp) => (
                <CommandItem
                  key={sp.employeeId}
                  value={`${sp.fullName} ${sp.employeeId}`}
                  disabled={sp.alreadyMapped}
                  onSelect={() => {
                    setSelectedAgent(sp);
                    setFormData({
                      name: sp.fullName,
                      email: sp.email ?? '',
                      phone: sp.phone ?? '',
                      password: formData.password,
                      employeeId: sp.employeeId,
                    });
                    setAgentPickerOpen(false);
                  }}
                >
                  <Check className={cn(
                    "mr-2 h-4 w-4",
                    selectedAgent?.employeeId === sp.employeeId
                      ? "opacity-100" : "opacity-0",
                  )} />
                  <div className="flex-1">
                    <div className="font-medium">{sp.fullName}</div>
                    <div className="text-xs text-gray-500">
                      {sp.employeeId} · {sp.email ?? 'no email'}
                      {sp.commissionRate ? ` · ${sp.commissionRate}` : ''}
                    </div>
                  </div>
                  {sp.alreadyMapped && (
                    <Badge variant="secondary" className="ml-2">Already linked</Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    <button
      type="button"
      onClick={() => { setManualMode(true); setSelectedAgent(null); }}
      className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
    >
      Can't find them? Enter manually
    </button>
  </div>
)}

{frappeData && !frappeData.enabled && (
  <div className="sm:col-span-2 lg:col-span-3 mb-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm flex items-start gap-2">
    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
    <div>
      Frappe ERP not connected. Enter the officer's details manually below.
      <a href="integrations" className="ml-1 text-amber-800 underline">Configure Frappe →</a>
    </div>
  </div>
)}
```

- [ ] **Step 5: Pass `employee_id` on submit**

In `handleAdd`, change the `doCreate(...)` call to:

```typescript
await doCreate({
  name: formData.name,
  email: formData.email,
  phone: formData.phone,
  role: 'admissions-officer',
  password: formData.password,
  employeeId: formData.employeeId || undefined,
});
```

Reset `selectedAgent` + `employeeId` on success alongside `formData`.

- [ ] **Step 6: Refresh the picker list on success**

After `refetch()` for officers, call `refetchAgents()` so the newly linked agent flips to `alreadyMapped:true`.

- [ ] **Step 7: Run typecheck + dev server**

```bash
cd frontend && npm run typecheck
```
Expected: no errors. Then:
```bash
cd frontend && npm run dev
```
Navigate to `/<admin-userId>/admissions-officers` → **Add Admissions Officer** → pick a sales agent → fields should populate; submit should create the officer. Per `CLAUDE.md`, UI changes MUST be exercised in a browser, not just tsc-passed.

- [ ] **Step 8: Commit**

```bash
git add frontend/components/pages/admin/admissions-officers.tsx
git commit -m "feat(admissions): add Frappe Sales Agent picker to AO onboarding"
```

### PHASE 4 CHECKPOINT

**Deliverable:** Admin form shows live-fetched sales agents; selecting one prefills name/email/phone + saves `employee_id` on create.

**Verification (all in browser):**
- [ ] Picker opens, shows 19 active agents, each with name + employee ID + email.
- [ ] Selecting an agent fills the three fields.
- [ ] `alreadyMapped` agents are disabled and show a "Already linked" badge.
- [ ] Submit creates an officer; DB check → `employee_id` column has the expected value.
- [ ] "Enter manually" toggle reveals the classic form.
- [ ] Disable the institute's Frappe integration → amber banner appears + only manual form renders.
- [ ] Duplicate employee_id surfaces a toast (no 500).
- [ ] `code-reviewer` agent: no stale state, no double-fetch, accessibility (keyboard nav, aria-expanded) on the combobox.

---

## Phase 5 — UX polish: surface Employee ID on existing officers

**Team:** `general-purpose` agent · `frontend-patterns` skill · reviewed by `code-reviewer`.

### Task 5.1: Add Employee ID badge on officer cards

**Files:**
- Modify: `frontend/components/pages/admin/admissions-officers.tsx`

- [ ] **Step 1: Inside each officer card, near the email + phone block**

Add (only when `officer.employeeId` is present):

```tsx
{officer.employeeId && (
  <p className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-mono">
    {officer.employeeId}
  </p>
)}
```

- [ ] **Step 2: Typecheck + visual check**

```bash
cd frontend && npm run typecheck
```
Navigate to the page, confirm new officers show the badge, old ones don't.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/pages/admin/admissions-officers.tsx
git commit -m "feat(admissions): show Employee ID badge on officer cards"
```

### Task 5.2: Add Employee ID column to admissions-team performance page

**Files:**
- Modify: `frontend/app/[userId]/admissions-team/page.tsx`
- Modify: `frontend/lib/api/admissions.ts` (add `employeeId` to the row type)
- Modify: `backend/app/services/admissions_service.py` (include `employee_id` in stats rows)

- [ ] **Step 1: Backend — extend the stats roll-up**

In the existing `admin_stats` service function (or wherever `officers` rows are built), select `User.employee_id` and include it in each row as `employee_id`.

- [ ] **Step 2: Frontend — add the column in the CSV export + table**

In `admissions-team/page.tsx`:

- Add `'Employee ID'` to the CSV header and `o.employeeId ?? ''` to each row.
- Add `<th>Employee ID</th>` between Officer and Status.
- Render `<td className="px-4 py-3 font-mono text-xs text-gray-600">{o.employeeId ?? '—'}</td>`.

- [ ] **Step 3: Type extension**

In `frontend/lib/api/admissions.ts`, add `employeeId: string | null` to the officer row interface.

- [ ] **Step 4: Typecheck + visual check**

```bash
cd frontend && npm run typecheck
cd backend && python -m compileall -q app/services/admissions_service.py
```
Browse the Admissions Team page — new column visible; CSV export includes it.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/admissions_service.py \
        frontend/lib/api/admissions.ts \
        frontend/app/\[userId\]/admissions-team/page.tsx
git commit -m "feat(admissions): surface employee_id on team performance view + CSV"
```

### PHASE 5 CHECKPOINT

**Deliverable:** Employee ID is visible everywhere an officer is shown — card, team performance table, CSV export.

**Verification:**
- [ ] Browser: badge renders only for mapped officers; never empty-space for legacy ones.
- [ ] CSV export opens in Excel with the new column populated.
- [ ] `code-reviewer` agent: no layout shift, no prop-drilling regressions.

---

## Phase 6 — E2E + deploy

**Team:** `e2e-runner` agent · `e2e-testing` + `deployment-patterns` skills · reviewed by `security-reviewer`.

### Task 6.1: Playwright test for the happy path

**Files:**
- Create: `frontend/tests/e2e/admissions-officer-create-from-frappe.spec.ts`

- [ ] **Step 1: Draft the spec**

```typescript
import { test, expect } from '@playwright/test';

test('admin creates AO by picking a Frappe sales agent', async ({ page }) => {
  // Assumes seeded admin + Frappe configured in the test env.
  await page.goto('/login');
  await page.fill('[name=email]', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('[name=password]', process.env.TEST_ADMIN_PASSWORD!);
  await page.click('button[type=submit]');

  await page.goto(`/${process.env.TEST_ADMIN_USER_ID}/admissions-officers`);
  await page.click('text=Add Admissions Officer');
  await page.click('text=Pick a sales agent');

  // Type a known fixture name
  await page.fill('input[placeholder*="Search"]', 'Abdul');
  await page.click('text=Abdul Qayyum');

  // Fields should be prefilled
  await expect(page.locator('input[name=name]')).toHaveValue(/Abdul/);

  await page.fill('input[name=password]', 'TempP4ss!');
  await page.click('button:has-text("Add Admissions Officer")');

  await expect(page.locator('text=created successfully')).toBeVisible();
  await expect(page.locator('text=MITT5037')).toBeVisible();
});
```

- [ ] **Step 2: Run it**

```bash
cd frontend && npx playwright test tests/e2e/admissions-officer-create-from-frappe.spec.ts
```
Expected: pass. If env vars missing, add them to `.env.test` first.

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/e2e/admissions-officer-create-from-frappe.spec.ts
git commit -m "test(e2e): cover AO creation from Frappe sales agent picker"
```

### Task 6.2: Docs + runbook

**Files:**
- Create: `docs/claude/frappe-sales-person-link.md`

- [ ] **Step 1: Write the runbook (force-add since `*.md` is gitignored)**

Content:
```markdown
# Admissions Officer ↔ Frappe Sales Person Linking

## What it does
Admin creates an AO by picking from live-fetched Frappe Sales Persons.
LMS stores `users.employee_id` so LMS activity reconciles against ERP commissions.

## Endpoints
- `GET /api/v1/integrations/frappe/sales-persons` (admin, 20/min, 60s cache)
- `POST /api/v1/users` now accepts `employee_id` (admissions-officer role)

## Operational notes
- Cache is per-institute, in-process, 60s. Blue-green restart flushes it.
- If Frappe is down, picker shows "Loading..." then falls back to the banner.
- If a Sales Person is disabled in Frappe, it no longer appears — but already-linked LMS officers keep their employee_id (no retroactive cleanup).

## Troubleshooting
- "Already linked" on everyone → run `SELECT employee_id FROM users WHERE role='admissions_officer' AND institute_id='<iid>';` to reconcile.
- Empty list → check `InstituteIntegration.frappe_enabled = true` and API creds.
- 429 → picker opened 20+ times in a minute; throttle or bump the limit.
```

- [ ] **Step 2: Force-add + commit**

```bash
git add -f docs/claude/frappe-sales-person-link.md
git commit -m "docs: runbook for AO ↔ Frappe Sales Person linking"
```

### Task 6.3: Deploy to production (blue-green)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/ao-frappe-sales-agent-link
```

- [ ] **Step 2: Open PR + run CI**

```bash
gh pr create --title "feat(admissions): link AO to Frappe sales agent on create" \
  --body "See docs/superpowers/plans/2026-04-20-ao-frappe-sales-agent-link.md"
```

- [ ] **Step 3: Merge after review; deploy-bg picks up automatically**

Per `docs/Deployment.md`, the GitHub Actions deploy workflow runs blue-green. Watch `/var/log/lms/deploy-*.log` for green health.

- [ ] **Step 4: Post-deploy smoke**

SSH to EC2:
```bash
ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220
docker logs lms-green --tail 200 | grep -iE 'frappe/sales-persons|employee_id|ERROR'
```
Expected: one or two 200 hits on `/frappe/sales-persons` after the first admin opens the form; no errors.

### PHASE 6 CHECKPOINT

**Deliverable:** Feature is live on production for the ICT institute; at least one AO created via the new picker.

**Verification:**
- [ ] E2E spec green locally + in CI.
- [ ] Prod smoke: create one real AO linked to a known sales agent; confirm DB row.
- [ ] No new errors in `lms-green` logs (`docker logs lms-green --since 1h | grep -i error`).
- [ ] `security-reviewer` agent final pass: response redaction, rate limits honored, no creds in logs, no privilege escalation from the new endpoint.

---

## Dependencies & Tooling

- **No new Python deps.**
- **Frontend:** `shadcn` Command + Popover + Badge components (install if missing — one-time).
- **Env:** `TEST_ADMIN_USER_ID` added to `.env.test` for Playwright.

## Out of Scope (documented for follow-ups)

- Bi-directional sync (Frappe → LMS auto-create on new Sales Person).
- Re-linking an already-existing AO to a different sales agent (read-only today; edit deferred).
- Commission calculation driven by the linked agent — most commission rates in ERP are null; cleanup required first.
- Flutter mobile support for the admin AO page.

## Estimated Complexity: MEDIUM (~9h)

Phase 1: 30m · Phase 2: 2h · Phase 3: 1h · Phase 4: 3h · Phase 5: 1h · Phase 6: 1.5h.
