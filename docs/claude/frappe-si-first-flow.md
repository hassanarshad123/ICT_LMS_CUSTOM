# Frappe SI-first flow + 72h grace + Draft Payment Entry review

## What the pipeline does

1. AO onboards a student (LMS-side flow unchanged).
2. `fee.plan_created` webhook → outbound sync:
   - Creates + submits a **Sales Order** in Frappe with sales_team commission stamped.
   - Immediately calls `erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice` to generate a **Sales Invoice** draft, stamps our zensbot custom fields + commission, then submits it.
   - Stamps `FeePlan.frappe_sales_invoice_name` on the LMS row.
3. `FeePlan.grace_period_ends_at = NOW() + 72h`. The student has unconditional LMS access during grace.
4. Daily at **00:00 PKT (19:00 UTC)** the `enforce_overdue_access_revocation` job runs per Frappe-enabled institute:
   - Queries Frappe for Sales Invoices whose `status` is NOT in `Partly Paid / Paid / Cancelled / Return / Credit Note Issued`.
   - Skips plans within their 72h grace.
   - Otherwise flips `UserStatus.inactive` + `suspension_reason="overdue_fees"`, bumps `token_version` (kills all sessions), emails the student.
   - Second sweep reactivates any student whose SI has cleared (not in the unpaid list anymore).

## Payment Entry review workflow

Payment Entries created by the LMS sync land in Frappe as **Draft** (`docstatus=0`). This gives accounting staff a chance to review the attached payment-proof screenshot (`custom_zensbot_payment_proof_url`) against the bank statement or transfer log before committing the PE to the ledger.

When accounting submits the Draft PE:

- Frappe updates `payment_schedule[].paid_amount` on the matching Sales Invoice schedule row (we set `payment_term` on the reference row at post time).
- SI status flips to `Partly Paid` (or `Paid` once all rows clear).
- The LMS suspension cron at 00:00 PKT sees the SI is no longer in its unpaid list and reactivates any student it had previously auto-suspended.

If a student is suspended during the accounting review window, they lose portal access until the cron's next pass after the PE is submitted. The 72h onboarding grace window protects new students from being suspended while their first installment is pending review.

## Admin override

An admin can manually reactivate a cron-suspended student via `POST /api/v1/admissions/students/{id}/reactivate`. That flips their `suspension_reason` to NULL. The next cron pass will re-suspend only if Frappe still shows the SI as unpaid.

## Disabling the cron (emergency)

Set `SCHEDULER_ENABLED=false` in the backend env and redeploy. All APScheduler jobs stop. Per-endpoint HTTP 402 soft-locks in `middleware/access_control.py` continue to apply.

## Common log lines

- `Overdue enforcement[<institute-id>]: checked=N newly_suspended=N already_suspended=N newly_reactivated=N errors=0` — per-institute summary.
- `Overdue enforcement complete: ...` — aggregate across all institutes.

## Audit trail

Every suspension + reactivation emits an `activity_logs` row with:

- `action = admissions.student_auto_suspended` (or `_auto_reactivated`)
- `details.reason = overdue_fees`
- `details.frappe_sales_invoice = ACC-SINV-...`
- `details.outstanding_amount`, `details.si_status`

Query:

    SELECT created_at, user_id, details
    FROM activity_logs
    WHERE action LIKE 'admissions.student_auto_%'
    ORDER BY created_at DESC
    LIMIT 20;
