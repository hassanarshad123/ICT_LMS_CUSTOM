# Admissions Officer Portal

The admissions portal lets a dedicated staff role (`admissions_officer`) onboard
paying students, set up fee plans, record offline payments, and keep access
gated behind fee status. This doc is the single reference for devs working on
any of these features.

## TL;DR

- **Role:** `admissions_officer` (UserRole enum). Stored as snake_case; API/UI uses `admissions-officer` kebab-case.
- **Who creates them:** institute admin only (existing `POST /users` accepts the new role).
- **What they do:** create a paying student, pick a batch, set a one-time / monthly / installment fee plan, record payments, download receipts.
- **Access control:** officers see only students they have at least one active FeePlan for. Admin bypasses.
- **Enforcement:** overdue installments soft-lock lectures, quizzes, Zoom, certificates, and materials for the student via HTTP 402.

## Core models (`app/models/fee.py`)

| Model | Purpose |
|-------|---------|
| `FeePlan` | One per active enrollment. Holds total/discount/final amount, currency, plan_type, onboarded_by_user_id, status (active/completed/cancelled). Partial unique index: at most one non-deleted plan per `student_batch_id`. |
| `FeeInstallment` | Schedule rows. `(fee_plan_id, sequence)` is unique. Fields: amount_due, amount_paid, due_date, status (pending/partially_paid/paid/overdue/waived), label. |
| `FeePayment` | Money-received events. Links to `fee_plan_id` + optional `fee_installment_id`. Has `receipt_number` (institute-sequential). |
| `ReceiptCounter` | Per-institute sequence for receipt numbering. |

Enums live in `app/models/enums.py`: `FeePlanType`, `FeePlanStatus`, `FeeInstallmentStatus`, `FeeDiscountType`.

## API surface (`app/routers/admissions.py`)

Prefix: `/api/v1/admissions`

| Method | Path | Role | Notes |
|--------|------|------|-------|
| POST | `/students` | admin, admissions_officer | Transactional onboarding: creates user + enrollment + fee plan + installments in one commit |
| GET | `/students` | admin, admissions_officer | Roster; officer scope auto-filtered to own rows |
| GET | `/students/{user_id}` | admin, admissions_officer | Detail with plans + installments + next due date + overdue flag |
| PATCH | `/students/{user_id}` | admin, admissions_officer | Update name/email/phone |
| POST | `/students/{user_id}/suspend` | admin, admissions_officer | Sets UserStatus.inactive + revokes sessions |
| POST | `/students/{user_id}/reactivate` | admin, admissions_officer | Flips UserStatus.active back |
| DELETE | `/students/{user_id}` | admin, admissions_officer | Soft-delete user + cancel all their fee plans |
| POST | `/students/{user_id}/enrollments` | admin, admissions_officer | Add the student to another batch with its own fee plan |
| DELETE | `/students/{user_id}/enrollments/{student_batch_id}` | admin, admissions_officer | Soft-remove enrollment + cancel its fee plan |
| POST | `/students/{user_id}/payments` | admin, admissions_officer | Record offline payment; auto-numbers receipt, updates installment + plan state, extends monthly expiry |
| GET | `/students/{user_id}/payments` | admin, admissions_officer | Payment history |
| GET | `/payments/{payment_id}/receipt.pdf` | admin, admissions_officer, student (their own) | Branded PDF receipt |
| GET | `/me/fees` | any authenticated user | Student's own aggregate + per-plan detail (summary + installments + payments) |
| GET | `/admin/stats` | admin only | Per-officer performance roll-up with `date_from` / `date_to` filters |

## Services

### `services/admissions_service.py`
- `onboard_student(session, officer, payload)` — entry point for the wizard
- `update_student_profile`, `suspend_student`, `reactivate_student`, `soft_delete_student` — control panel actions
- `add_enrollment`, `remove_enrollment` — multi-batch mgmt
- `list_officer_students` — roster query (scope-aware)
- `get_student_detail` — single student view with plan aggregates
- Helpers:
  - `_ensure_officer_owns_student()` — role-scoped access check (admin bypass)
  - `_create_enrollment_with_plan()` — shared by onboarding + add-enrollment
  - `compute_final_amount()` — discount math (percent / flat)
  - `_build_monthly_installments()` / `_build_installment_drafts()` — schedule generation

### `services/fee_service.py`
- `record_payment(session, actor, student, fee_plan, payload)` — updates installment, assigns receipt number, extends monthly expiry, flips plan to completed when done
- `build_receipt_content(session, payment)` — constructs `ReceiptContent` for the PDF generator
- `is_plan_overdue`, `has_overdue_fees_for_batch` — used by access_control middleware
- `load_payment_for_actor`, `load_fee_plan_for_actor`, `load_fee_plan_for_student` — ownership-aware loaders

## Soft-lock enforcement (`app/middleware/access_control.py`)

`verify_batch_access(..., check_fee_overdue=True)` and
`check_student_batch_expiry(..., check_fee_overdue=True)` call
`_raise_if_fee_overdue()` which returns **HTTP 402** with:

```json
{
  "detail": {
    "code": "fee_overdue",
    "message": "Your fees are overdue — please contact your admissions officer",
    "batch_id": "...",
    "fee_plan_id": "...",
    "overdue_installment_id": "...",
    "overdue_since": "2026-04-01",
    "amount_due": 5000,
    "currency": "PKR"
  }
}
```

Applied on:
- `POST /lectures/{id}/signed-url` — video playback
- `GET /materials/{id}/download-url`
- `GET /zoom/classes/{id}/start-url` — live join
- `GET /zoom/recordings/{id}/signed-url`
- Quiz start/submit (`routers/quizzes.py`)
- `POST /certificates/request`

Listing endpoints deliberately do NOT lock — student can still browse the UI and their fee page.

## Frontend

Key files:
- `frontend/components/dashboards/admissions-officer-dashboard.tsx` — roster + KPI cards
- `frontend/components/admissions/onboard-wizard.tsx` — 5-step onboarding
- `frontend/components/admissions/record-payment-dialog.tsx` — payment modal
- `frontend/app/[userId]/admissions/students/[studentId]/page.tsx` — student detail with Edit/Suspend/Delete
- `frontend/app/[userId]/fees/page.tsx` — student-facing "My Fees"
- `frontend/app/[userId]/admissions-team/page.tsx` — admin performance dashboard
- `frontend/components/shared/fee-overdue-provider.tsx` — global modal on 402
- `frontend/components/shared/fee-overdue-banner.tsx` — student dashboard red banner

API client: `frontend/lib/api/admissions.ts` (typed wrappers for everything above).

## Reminders (`app/scheduler/jobs.py:send_fee_reminders`)

Daily cron. Three rules:
1. Installment `due_date == today + 7` → student notif + email (type `fee_due_soon_7d:<id>`)
2. Installment `due_date == today + 1` → student notif + email (type `fee_due_soon_1d:<id>`)
3. Installment `due_date == today` and unpaid → student notif + email + officer alert (type `fee_overdue:<id>` / `fee_overdue_alert:<id>`)

Dedup: the notification `type` field embeds the installment UUID, so re-running the job in the same day is a no-op.

Email templates: `fee_due_soon_email()` and `fee_overdue_email()` in `app/utils/email_templates.py`. Respect institute/user pref keys `email_fee_due` and `email_fee_overdue`.

## Receipt PDFs (`app/utils/receipt_pdf.py`)

Single-page A4 with:
- Top/bottom accent bar using institute branding
- Institute logo + name + contact header
- RECEIPT title + receipt number
- Issued on, student name, batch + plan
- Hero block with amount received + method + reference
- Balance summary (total, paid to date, remaining)
- Optional word-wrapped notes
- Optional QR code

Institute branding loaded via `app.utils.email_sender.get_institute_branding()`.

## Activity log actions

All officer actions emit `ActivityLog` rows (`services/activity_service.py:log_activity`):

| Action | Entity type | Triggered by |
|--------|-------------|--------------|
| `admissions.student_onboarded` | fee_plan | `onboard_student` |
| `admissions.student_updated` | user | `update_student_profile` |
| `admissions.student_suspended` | user | `suspend_student` |
| `admissions.student_reactivated` | user | `reactivate_student` |
| `admissions.student_deleted` | user | `soft_delete_student` |
| `admissions.enrollment_added` | fee_plan | `add_enrollment` |
| `admissions.enrollment_removed` | student_batch | `remove_enrollment` |
| `admissions.payment_recorded` | fee_payment | `record_payment` |

## Common pitfalls

- **Officer can't find a student** — confirm `FeePlan.onboarded_by_user_id == officer.id` in the DB. `_ensure_officer_owns_student` returns "Student not found" (not 403) to avoid leaking existence.
- **Receipt number is NULL** — payment row was created but the `_next_receipt_number()` step failed silently (unusual). Check ReceiptCounter table exists.
- **Monthly expiry not extending** — only extends when the *installment* flips to `paid` (not on partial payments). Check `StudentBatch.extended_end_date`.
- **Soft-lock not firing** — the route must explicitly pass `check_fee_overdue=True` to `verify_batch_access` / `check_student_batch_expiry`. Listing endpoints deliberately skip this.
- **Email not sending** — check `should_send_email` preference keys: `email_fee_due` and `email_fee_overdue`. Institute-level or user-level opt-out will silence the email (in-app notification still fires).

## Deferred (Phase 2)

- Bulk CSV import with per-row fee plan columns (`fee_type`, `amount`, `discount_percent`)
- Online payment gateway (JazzCash / Stripe) — would replace manual `record_payment` for self-pay flows
- Officer commission calculator + payout tracking
- Flutter "My Fees" page (web-only today)
- Waive-installment endpoint (currently requires direct DB edit)
