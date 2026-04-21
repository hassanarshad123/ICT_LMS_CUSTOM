# Frappe-Driven Overdue Suspension — Implementation Plan

> **⚠️ SUPERSEDED 2026-04-21:** the spec evolved after Phases 1-5 of this
> plan shipped. The new requirement introduces (a) auto-creation of a Sales
> Invoice alongside the Sales Order, (b) payment-proof screenshots stored on
> the SI instead of the SO, (c) a 72-hour unconditional grace window on
> onboarding, and (d) SI-status-based suspension instead of SO-schedule-based.
> See `2026-04-21-si-first-flow-72h-grace.md` for the active plan. The
> structural elements already built from this plan (migration 044 for
> `users.suspension_reason`, the `fee_enforcement_service` skeleton, and the
> daily APScheduler job) are reused by the successor plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every 24 hours, for each institute with Frappe integration enabled, query Frappe for students whose Sales Order has an overdue unpaid installment. Auto-suspend those students in LMS (block login, kill sessions, notify them + their admissions officer). Re-activate students the job previously suspended once their overdue balance clears.

**Architecture:** New APScheduler job `enforce_overdue_access_revocation` that runs daily. Per-institute loop: `load_active_frappe_config` → skip if disabled → pull Sales Orders via REST with the `custom_zensbot_fee_plan_id` custom field and their `payment_schedule[]` child table → detect overdue rows → resolve LMS `FeePlan` → `User` → flip to `UserStatus.suspended` (new enum value) with `suspension_reason = "overdue_fees"` so the same job can auto-lift it later when Frappe confirms payment. Non-Frappe institutes are untouched; they keep using the existing HTTP 402 soft-lock middleware.

**Tech Stack:** APScheduler (already wired) · FastAPI + SQLModel + Alembic (existing) · httpx against Frappe REST API (existing `FrappeClient`).

**Branch:** `feat/frappe-overdue-suspension` (already created, off `upstream/main`).

---

## Team Assignments

| Phase | Scope | Primary Agent | Primary Skills | Review |
|-------|-------|---------------|----------------|--------|
| 1 | Schema: `users.suspension_reason` column + migration | `database-reviewer` | `database-migrations`, `postgres-patterns` | — |
| 2 | `FrappeClient.list_overdue_sales_orders` helper + DTO | `python-reviewer` | `backend-patterns`, `api-design` | — |
| 3 | `fee_enforcement_service` — suspend + lift logic, idempotent, per-institute | `python-reviewer` | `backend-patterns` | — |
| 4 | Scheduler job wiring + structured logging + activity log entries | `python-reviewer` | `backend-patterns` | — |
| 5 | Email templates: suspension notice + reactivation notice | `general-purpose` | `article-writing` (brand tone) | — |
| 6 | Admin dashboard chip: "Auto-suspended students (Frappe overdue)" with manual override | `general-purpose` | `frontend-design`, `shadcn` | — |
| 7 | Consolidated tests (unit + integration) + staging smoke + deploy | `e2e-runner` | `python-testing`, `deployment-patterns` | `security-reviewer` |

Per session feedback: implement phases 1-6 with no per-phase tests, consolidate tests in Phase 7. No `Co-Authored-By` trailer on commits.

---

## Grounded facts verified against `deverp.ict.net.pk`

1. **Sales Order payment_schedule shape** (from SAL-ORD-2026-00007):
   ```
   { "payment_term": "1st installment", "invoice_portion": 40.0,
     "payment_amount": 6000, "paid_amount": 0, "outstanding": 6000,
     "due_date": "2026-04-20", "mode_of_payment": "Cash" }
   ```
   We detect "overdue" as `due_date < today AND outstanding > 0`.
2. **Filtering by custom field works** after PR #71 — `custom_zensbot_fee_plan_id` is a queryable filter.
3. **APScheduler** runs `process_frappe_sync_tasks` every 30s in `backend/main.py:83`; new job plugs in right next to `send_fee_reminders` (line 86, also `hours=24`).
4. **`UserStatus` enum** has `active`, `inactive`, `suspended`, `banned` values (need to verify — if `suspended` doesn't exist yet, reuse `inactive` with a `suspension_reason` column acting as the gate for auto-lift).
5. **Existing `suspend_student`** (`admissions_service.py:502`) sets `UserStatus.inactive` + calls `revoke_all_sessions(user_id)`. We reuse this helper but add a `reason` kwarg.
6. **HTTP 402 soft-lock** in `middleware/access_control.py` stays in place — it's the in-session kill-switch. The new suspension is a login-time hard block (session won't refresh).

---

## File Structure

**Backend — new files (2)**
- `backend/migrations/versions/044_user_suspension_reason.py` — adds nullable `users.suspension_reason VARCHAR(64)` + index on it.
- `backend/app/services/fee_enforcement_service.py` — two entry points:
  `enforce_overdue_suspensions(session, institute_id)` and
  `lift_suspensions_if_cleared(session, institute_id)`.

**Backend — modified files (7)**
- `backend/app/models/user.py` — add `suspension_reason: Optional[str]` column (mirrors migration).
- `backend/app/services/frappe_client.py` — add `list_overdue_sales_orders(institute_id) -> list[OverdueSalesOrderItem]`; internal, uses `list_resource` + `get_single` for the `payment_schedule` child table.
- `backend/app/services/admissions_service.py` — extend `suspend_student` / `reactivate_student` signatures with `reason: Optional[str] = None`; persist on the User row.
- `backend/app/scheduler/jobs.py` — add `enforce_overdue_access_revocation()` async job that loops institutes with `frappe_enabled=true` and calls the two enforcement service fns.
- `backend/main.py` — register the job: `scheduler.add_job(enforce_overdue_access_revocation, "interval", hours=24, id="frappe_overdue_suspension")`.
- `backend/app/utils/email_templates.py` — add `overdue_suspension_email()` + `overdue_reactivation_email()` with the existing branded template style.
- `backend/app/routers/admissions.py` — new endpoint `GET /admissions/auto-suspended` admin-only roll-up (list students currently suspended with `reason="overdue_fees"`).

**Backend — tests modified (1)** — Phase 7 only.
- `backend/tests/unit/test_fee_enforcement_service.py` — new file, covers the cron logic with mocked Frappe.

**Frontend — modified files (1)**
- `frontend/components/pages/admin/admissions-officers.tsx` OR a new panel on the admin dashboard — count + quick-view for "auto-suspended (overdue)" students. (Exact placement TBD in Phase 6 — it can also go on `[userId]/admissions-team/page.tsx`.)

**Docs — new (1)**
- `docs/claude/frappe-overdue-suspension.md` — ops runbook: how to disable the job for a single institute, how to manually lift a suspension, expected daily log shape.

---

## Phase 1 — Schema: `users.suspension_reason`

**Team:** `database-reviewer` · skills `database-migrations`, `postgres-patterns`.

### Task 1.1 — Migration 044

**Files:**
- Create: `backend/migrations/versions/044_user_suspension_reason.py`

- [ ] **Step 1:** Confirm latest migration is 043 (`043_feeplan_frappe_fields.py` from the earlier SO feature). Your new one is 044 with `down_revision = "043"`.

- [ ] **Step 2:** Write the migration:

```python
"""users.suspension_reason for Frappe-driven auto-suspension tracking

Revision ID: 044
Revises: 043
Create Date: 2026-04-21

Adds a nullable suspension_reason string so the auto-suspension job can
identify which suspensions it created (reason="overdue_fees") and lift
them when Frappe confirms payment. A manual admin-initiated suspend has
reason=None (or a human-readable reason) so the cron won't auto-lift it.
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "044"
down_revision = "043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("suspension_reason", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_users_suspension_reason",
        "users",
        ["suspension_reason"],
        unique=False,
        postgresql_where=sa.text("suspension_reason IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_users_suspension_reason", table_name="users")
    op.drop_column("users", "suspension_reason")
```

- [ ] **Step 3:** Byte-compile: `cd backend && py -m py_compile migrations/versions/044_user_suspension_reason.py`.

- [ ] **Step 4:** Update `backend/app/models/user.py`: add `suspension_reason: Optional[str]` column after `suspended_at` (or at the end of existing fields). Mirror the index in `__table_args__` using `sa.text("suspension_reason IS NOT NULL")`.

- [ ] **Step 5:** Commit: `feat(db): migration 044 — users.suspension_reason for auto-suspend tracking`.

### PHASE 1 CHECKPOINT

Migration + model compile. Verify manually in Phase 7 with `alembic upgrade head`.

---

## Phase 2 — Frappe query helper

**Team:** `python-reviewer` · skills `backend-patterns`, `api-design`.

### Task 2.1 — `FrappeClient.list_overdue_sales_orders`

**Files:**
- Modify: `backend/app/services/frappe_client.py`

- [ ] **Step 1:** Add a DTO at module top (next to `FrappeResult`):

```python
@dataclass(frozen=True)
class OverdueInstallment:
    payment_term: str
    due_date: str  # ISO
    amount_due: int
    outstanding: int


@dataclass(frozen=True)
class OverdueSalesOrder:
    name: str                # Frappe SO doc name, e.g. "SAL-ORD-2026-00007"
    fee_plan_id: str         # custom_zensbot_fee_plan_id
    customer: str
    grand_total: int
    overdue_installments: list[OverdueInstallment]
```

- [ ] **Step 2:** Add method `list_overdue_sales_orders`:

```python
async def list_overdue_sales_orders(self) -> list[OverdueSalesOrder]:
    """Find Sales Orders whose payment_schedule has at least one row with
    due_date < today AND outstanding > 0.

    Strategy: SQL-level filtering for due_date + outstanding isn't
    available on the parent SO via the REST API (payment_schedule is a
    child table). So we:
      1. List all non-cancelled SOs with a non-null custom_zensbot_fee_plan_id.
      2. For each, GET the full doc to inspect payment_schedule.
      3. Collect the ones with overdue rows.

    This is O(open-SOs) per institute per day. Acceptable for institutes
    with < 1000 active enrollments; can be optimized via a direct
    ``frappe.client.get_list`` on ``Payment Schedule`` if needed.
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
        logger.warning("Failed to list Sales Orders for overdue check: %s", listing.error)
        return []

    rows = (listing.response or {}).get("data") or []
    out: list[OverdueSalesOrder] = []
    for row in rows:
        detail = await self.get_single("Sales Order", row["name"])
        if not detail.ok:
            continue
        doc = (detail.response or {}).get("data") or {}
        schedule = doc.get("payment_schedule") or []
        overdue = []
        for sched in schedule:
            due = (sched.get("due_date") or "")
            outstanding = float(sched.get("outstanding") or 0)
            if due and due < today and outstanding > 0:
                overdue.append(OverdueInstallment(
                    payment_term=sched.get("payment_term", ""),
                    due_date=due,
                    amount_due=int(sched.get("payment_amount") or 0),
                    outstanding=int(outstanding),
                ))
        if overdue:
            out.append(OverdueSalesOrder(
                name=doc["name"],
                fee_plan_id=str(doc.get(FEE_PLAN_FIELD) or ""),
                customer=doc.get("customer") or "",
                grand_total=int(doc.get("grand_total") or 0),
                overdue_installments=overdue,
            ))
    return out
```

- [ ] **Step 3:** Commit: `feat(frappe-client): list_overdue_sales_orders helper`.

### PHASE 2 CHECKPOINT

`FrappeClient` can enumerate overdue SOs for any institute. Tested against live ERP in Phase 7.

---

## Phase 3 — Enforcement service

**Team:** `python-reviewer` · skills `backend-patterns`.

### Task 3.1 — Create `fee_enforcement_service.py`

**Files:**
- Create: `backend/app/services/fee_enforcement_service.py`

- [ ] **Step 1:** Write the service:

```python
"""Frappe-driven overdue suspension enforcement.

Daily cron for each institute with frappe_enabled=true:

  1. enforce_overdue_suspensions(session, institute_id):
       pulls Frappe SOs with overdue payment_schedule rows → maps to
       LMS User via FeePlan.onboarded_by_user_id → suspends user
       (status=inactive, suspension_reason="overdue_fees"), kills
       sessions, queues suspension email. Idempotent: already-suspended
       users are skipped.

  2. lift_suspensions_if_cleared(session, institute_id):
       finds users suspended with reason="overdue_fees" whose FeePlan's
       Frappe SO no longer has an overdue row → reactivates them
       (status=active, suspension_reason=None), queues reactivation
       email. Idempotent.

Non-Frappe institutes see no side effects; the cron short-circuits on
load_active_frappe_config returning None.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.user import User
from app.models.enums import UserStatus, UserRole
from app.models.fee import FeePlan
from app.services.frappe_client import FrappeClient, OverdueSalesOrder
from app.services.integration_service import load_active_frappe_config

logger = logging.getLogger("ict_lms.fee_enforcement")

SUSPENSION_REASON = "overdue_fees"


@dataclass
class EnforcementSummary:
    checked: int
    newly_suspended: int
    already_suspended: int
    newly_reactivated: int
    errors: int


async def enforce_overdue_suspensions(
    session: AsyncSession,
    institute_id: uuid.UUID,
) -> EnforcementSummary:
    summary = EnforcementSummary(0, 0, 0, 0, 0)
    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        return summary

    client = FrappeClient(cfg)
    try:
        overdue = await client.list_overdue_sales_orders()
    except Exception as e:
        logger.exception("Overdue SO fetch failed for institute %s: %s", institute_id, e)
        summary.errors += 1
        return summary

    summary.checked = len(overdue)

    for so in overdue:
        if not so.fee_plan_id:
            continue
        try:
            plan_id = uuid.UUID(so.fee_plan_id)
        except ValueError:
            continue

        plan = await session.get(FeePlan, plan_id)
        if plan is None or plan.institute_id != institute_id:
            continue

        student = await session.get(User, plan.student_id)
        if student is None or student.deleted_at is not None:
            continue
        if student.role != UserRole.student:
            continue

        if (
            student.status == UserStatus.inactive
            and student.suspension_reason == SUSPENSION_REASON
        ):
            summary.already_suspended += 1
            continue
        if student.status != UserStatus.active:
            # Manually suspended / banned — don't touch.
            continue

        student.status = UserStatus.inactive
        student.suspension_reason = SUSPENSION_REASON
        student.token_version = (student.token_version or 0) + 1
        session.add(student)
        summary.newly_suspended += 1

        # Activity log + email dispatched below, per-row, so a failed email
        # on row N doesn't block row N+1.
        await _log_and_notify_suspend(session, student, so)

    await session.commit()
    return summary


async def lift_suspensions_if_cleared(
    session: AsyncSession,
    institute_id: uuid.UUID,
) -> EnforcementSummary:
    summary = EnforcementSummary(0, 0, 0, 0, 0)
    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        return summary

    # Load all currently-auto-suspended students in this institute.
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

    client = FrappeClient(cfg)
    try:
        overdue = await client.list_overdue_sales_orders()
    except Exception as e:
        logger.exception("Overdue SO refetch failed for institute %s: %s", institute_id, e)
        summary.errors += 1
        return summary

    # Build set of student IDs still overdue.
    still_overdue_plan_ids: set[uuid.UUID] = set()
    for so in overdue:
        try:
            still_overdue_plan_ids.add(uuid.UUID(so.fee_plan_id))
        except (ValueError, TypeError):
            continue

    # Map each suspended student to their fee plans; if NONE of their plans
    # are in the overdue set, we lift the suspension.
    for student in suspended:
        plans_q = await session.execute(
            select(FeePlan.id).where(
                FeePlan.student_id == student.id,
                FeePlan.deleted_at.is_(None),
            )
        )
        student_plan_ids = {row[0] for row in plans_q.all()}
        if student_plan_ids & still_overdue_plan_ids:
            # Still overdue on at least one plan.
            continue
        student.status = UserStatus.active
        student.suspension_reason = None
        student.token_version = (student.token_version or 0) + 1
        session.add(student)
        summary.newly_reactivated += 1
        await _log_and_notify_reactivate(session, student)

    await session.commit()
    return summary


async def _log_and_notify_suspend(
    session: AsyncSession, student: User, so: OverdueSalesOrder,
) -> None:
    """Fire-and-forget activity log + email. Errors in either are swallowed
    so a failure on one row doesn't abort the batch."""
    try:
        from app.services.activity_service import log_activity
        await log_activity(
            session,
            user_id=student.id,
            institute_id=student.institute_id,
            action="admissions.student_auto_suspended",
            entity_type="user",
            entity_id=student.id,
            metadata={
                "reason": SUSPENSION_REASON,
                "frappe_sales_order": so.name,
                "overdue_installments": [
                    {"payment_term": o.payment_term, "due_date": o.due_date,
                     "outstanding": o.outstanding}
                    for o in so.overdue_installments
                ],
            },
        )
    except Exception:
        logger.exception("Failed to log auto-suspend activity for %s", student.id)

    try:
        from app.utils.email_sender import send_email_background, should_send_email
        from app.utils.email_templates import overdue_suspension_email
        if await should_send_email(session, student.institute_id, student.id, "email_fee_overdue"):
            subject, html = overdue_suspension_email(
                student_name=student.name,
                institute_id=student.institute_id,
                overdue_rows=so.overdue_installments,
                grand_total=so.grand_total,
            )
            send_email_background(student.email, subject, html)
    except Exception:
        logger.exception("Failed to dispatch suspension email for %s", student.id)


async def _log_and_notify_reactivate(session: AsyncSession, student: User) -> None:
    try:
        from app.services.activity_service import log_activity
        await log_activity(
            session,
            user_id=student.id,
            institute_id=student.institute_id,
            action="admissions.student_auto_reactivated",
            entity_type="user",
            entity_id=student.id,
            metadata={"reason": SUSPENSION_REASON},
        )
    except Exception:
        logger.exception("Failed to log reactivation activity for %s", student.id)

    try:
        from app.utils.email_sender import send_email_background, should_send_email
        from app.utils.email_templates import overdue_reactivation_email
        if await should_send_email(session, student.institute_id, student.id, "email_fee_overdue"):
            subject, html = overdue_reactivation_email(
                student_name=student.name,
                institute_id=student.institute_id,
            )
            send_email_background(student.email, subject, html)
    except Exception:
        logger.exception("Failed to dispatch reactivation email for %s", student.id)
```

- [ ] **Step 2:** Commit: `feat(fee-enforcement): suspension + reactivation service for Frappe overdue`.

### PHASE 3 CHECKPOINT

Service compiles; idempotent by design (already-suspended users skipped, manual suspensions preserved).

---

## Phase 4 — Scheduler job + logging

**Team:** `python-reviewer` · skills `backend-patterns`.

### Task 4.1 — Add job to `backend/app/scheduler/jobs.py`

- [ ] **Step 1:** Append:

```python
async def enforce_overdue_access_revocation() -> None:
    """Daily: for each institute with Frappe integration, auto-suspend
    students with overdue invoices and lift prior auto-suspensions whose
    overdue balance has cleared."""
    from app.models.institute import Institute
    from app.models.integration import InstituteIntegration
    from app.services import fee_enforcement_service
    from sqlmodel import select

    async for session in get_session_iter():  # existing helper in this module
        # All institutes with frappe_enabled=true
        result = await session.execute(
            select(InstituteIntegration.institute_id).where(
                InstituteIntegration.frappe_enabled.is_(True),
            )
        )
        institute_ids = [row[0] for row in result.all()]
        logger.info("Overdue enforcement: %d Frappe-enabled institutes", len(institute_ids))

        for institute_id in institute_ids:
            try:
                s1 = await fee_enforcement_service.enforce_overdue_suspensions(session, institute_id)
                s2 = await fee_enforcement_service.lift_suspensions_if_cleared(session, institute_id)
                logger.info(
                    "Overdue enforcement for %s: "
                    "checked=%d newly_suspended=%d already_suspended=%d "
                    "newly_reactivated=%d errors=%d",
                    institute_id,
                    s1.checked, s1.newly_suspended, s1.already_suspended,
                    s2.newly_reactivated, s1.errors + s2.errors,
                )
            except Exception:
                logger.exception("Overdue enforcement crashed for institute %s", institute_id)
        break  # session generator — we only want one iteration
```

(If `get_session_iter` doesn't exist, reuse whatever pattern `send_fee_reminders` and other daily jobs use in the same file.)

### Task 4.2 — Register the job in `backend/main.py`

- [ ] **Step 1:** Add to the APScheduler block (near `send_fee_reminders`, line 86):

```python
from app.scheduler.jobs import enforce_overdue_access_revocation
scheduler.add_job(
    enforce_overdue_access_revocation,
    "interval",
    hours=24,
    id="frappe_overdue_suspension",
)
```

- [ ] **Step 2:** Commit: `feat(scheduler): register enforce_overdue_access_revocation daily job`.

### PHASE 4 CHECKPOINT

Job wired into scheduler; `id="frappe_overdue_suspension"` visible in APScheduler logs after restart.

---

## Phase 5 — Email templates

**Team:** `general-purpose` · skill `article-writing`.

### Task 5.1 — Add `overdue_suspension_email` and `overdue_reactivation_email`

**File:** `backend/app/utils/email_templates.py`

- [ ] Mirror the style of the existing `fee_due_soon_email()` and `fee_overdue_email()` in the same file. Use the institute's branding colors, the student's name, and a per-row breakdown of overdue installments.
- [ ] Suspension email subject: `"Your [Institute] portal access has been paused — overdue fees"`. Body includes the overdue rows and a contact CTA pointing at the admissions officer.
- [ ] Reactivation email subject: `"Welcome back — your [Institute] access is restored"`.

- [ ] Commit: `feat(email): overdue suspension + reactivation templates`.

---

## Phase 6 — Admin visibility

**Team:** `general-purpose` · skill `frontend-design`.

### Task 6.1 — Admin endpoint + dashboard chip

**Files:**
- Modify: `backend/app/routers/admissions.py` — add `GET /admissions/auto-suspended` returning paginated list of currently-overdue-suspended students with their FeePlan + overdue amount.
- Modify: `frontend/app/[userId]/admissions-team/page.tsx` — add a red "Auto-suspended (X)" card at the top of the page; clicking opens a drawer with the list + "Manually reactivate" button per row.

### PHASE 6 CHECKPOINT

Admin sees at-a-glance who is auto-suspended; can manually override if needed.

---

## Phase 7 — Tests + deploy

**Team:** `e2e-runner` · skills `python-testing`, `deployment-patterns` · review `security-reviewer`.

### Tasks

1. `backend/tests/unit/test_fee_enforcement_service.py` — mocked `FrappeClient.list_overdue_sales_orders`; verify idempotency, student-only scope, suspension_reason filter for lift.
2. `backend/tests/integration_test.py` — extend with end-to-end case: create overdue FeePlan via DB, mock Frappe to return it as overdue, run `enforce_overdue_access_revocation` manually, assert student is `UserStatus.inactive` with `suspension_reason="overdue_fees"`, assert subsequent run with non-overdue mock reactivates.
3. Apply migration in staging: `alembic upgrade head`.
4. Blue-green deploy.
5. Post-deploy smoke: log into ICT as a Frappe-enabled institute admin, confirm the scheduler is registered (`docker logs lms-green | grep frappe_overdue_suspension`), optionally trigger the job manually via Python REPL, verify a test overdue student gets suspended.

### PHASE 7 CHECKPOINT

- [ ] Unit + integration tests green.
- [ ] Prod smoke: job runs at 02:00 UTC, logs summary per institute, no errors.
- [ ] Manual test: create an overdue SO in Frappe, wait 24h or trigger job → student can't log in + gets email.
- [ ] Pay the overdue installment in Frappe → next run lifts the suspension.

---

## Risks

1. **O(open-SOs) query per institute per day.** For an institute with 5000 active enrollments, this is 5000 single-doc fetches over HTTPS. Phase 1 acceptable; optimize via a direct `Payment Schedule` doctype query in v2.
2. **Frappe unreachable during the job.** Service short-circuits cleanly — existing suspensions stay, no new ones added. Errors logged but swallowed so one institute's Frappe outage doesn't abort the batch for others.
3. **Student has multiple FeePlans, one overdue one paid.** Current logic: suspend if ANY plan is overdue; reactivate only when NONE are. Matches the HTTP 402 soft-lock's semantics.
4. **Manual admin-initiated suspension.** Those have `suspension_reason=None` (or a different value), so the cron's lift step won't touch them.
5. **Race: student pays at 02:00 UTC while the job is running.** Worst case: one-cycle delay (up to 24h) before reactivation. Acceptable for v1; a `POST /admissions/students/{id}/refresh-access` admin button can force the check.
6. **Email spam.** Every day the same student appears in the "already_suspended" bucket; we DO NOT re-email them. Only transitions (`active → suspended` and `suspended → active`) trigger emails.
7. **Multi-institute student.** Not supported in this LMS (institute_id is a single FK on User); no risk.

## Estimated Complexity: MEDIUM (~8h)

Phase 1: 30m · Phase 2: 1.5h · Phase 3: 2h · Phase 4: 45m · Phase 5: 45m · Phase 6: 1.5h · Phase 7: 1.5h.

## Out of scope (explicit)

- Partial-payment soft-lock (already handled by existing HTTP 402 middleware for per-endpoint gating).
- Notifying the admissions officer (only the student; officer notification can be added in v2 by logging to their dashboard).
- Tiered suspension (e.g. 7-day warning then full suspend at 14 days). Current behavior is immediate suspension on due_date pass.
- Automatic payment ingestion — we ONLY check overdue, we don't sync payment_schedule.paid_amount back into LMS installments. That path still relies on existing `_sync_payment_entry` and `handle_inbound_payment_entry`.
- Webhook-triggered instant enforcement — 24h cron is the v1 trigger. Webhook path can be added later by listening for Frappe's Sales Invoice "overdue" event.

**WAITING FOR CONFIRMATION.** Reply `yes` / `proceed` to start Phase 1 with the subagent pipeline, or `modify: …` with changes. A few things worth deciding before I start:

1. **24h cadence OK?** Or do you want it more aggressive (every 12h, 6h)?
2. **Suspension at due_date + 0 days**, or do you want a grace period (e.g. due_date + 7 days)?
3. **Who gets the email** — student only, or also their admissions officer so they can chase the payment?
4. **Can admins manually reactivate a cron-suspended student?** (I've planned this as "yes via the dashboard chip in Phase 6" — confirm.)
