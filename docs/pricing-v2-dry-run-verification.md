# Pricing v2 — Dry-Run Verification Checklist

This doc is the **pre-flight checklist** before flipping `BILLING_CRON_DRY_RUN`
to `false` in production. Run through every item. If any item fails, stop,
investigate, fix, and re-run.

> **Scope:** monthly invoice cron + late-payment escalation cron.
> **Gated by:** `plan_tier IN ('professional', 'custom')` at query level + `is_v2_billable()` defense-in-depth check. ICT.ZENSBOT.ONLINE (tier `pro`) is *never* selected by either cron.

---

## Phase A — Staging dry-run

All of this runs on a staging DB that is a clone of production. Do not
run on prod until every box below is green.

### A1. Env prep

- [ ] `BILLING_CRON_DRY_RUN=true` in staging `.env`
- [ ] `SIGNUP_DEFAULT_TIER=professional` (to exercise new signup path)
- [ ] `APP_ENV=staging`
- [ ] Database URL points at the staging clone (not prod)
- [ ] Confirm staging has at least: 1× `professional` institute with >10 students, 1× `pro` grandfathered institute (ICT clone), 1× `free` trial

### A2. Signup flip smoke test

- [ ] Create a brand-new institute via `POST /api/v1/signup/register`
- [ ] Expect: `plan_tier=professional`, `status=active`, `expires_at=null`
- [ ] Expect: a row in `institute_billing` with `extra_user_rate=80`, `free_users_included=10`
- [ ] Login as the new admin → `/dashboard` loads
- [ ] Navigate to `/billing` → Overview tab loads with "0 students · Rs 0 total"

### A3. Run monthly cron manually

```bash
cd backend
python scripts/run_billing_dry.py monthly
```

Watch the log output:

- [ ] Log line `Found N v2-billable institutes` — N equals count of professional + custom active institutes
- [ ] For each institute, a `[DRY-RUN] would issue invoice` line
- [ ] For the ICT clone (tier=`pro`), **no log line at all** — it must not appear in the candidate list
- [ ] For the free trial institute, **no log line at all**
- [ ] Computed totals match spot-check SQL:
  ```sql
  SELECT COUNT(*) FROM users
   WHERE institute_id = '<professional-uuid>'
     AND role='student' AND deleted_at IS NULL;
  ```
  (× `billing.extra_user_rate`) ± add-on charges = logged total
- [ ] **No new rows** appear in `invoices` table (`SELECT COUNT(*) FROM invoices` unchanged)

### A4. Run late-payment cron manually

```bash
python scripts/run_billing_dry.py late
```

For the test: hand-insert an overdue invoice into staging:
```sql
-- Example: 20-day overdue invoice for the seeded professional institute
INSERT INTO invoices (institute_id, invoice_number, period_start, period_end,
                      due_date, base_amount, total_amount, status, generated_by,
                      line_items)
VALUES ('<prof-uuid>', 'TEST-OVERDUE', '2026-03-01', '2026-03-31',
        '2026-04-01' /* 18 days before today */,
        5000, 5000, 'sent', '<sa-user-uuid>', '[]');
```

Re-run `python scripts/run_billing_dry.py late`:

- [ ] Log line `days_overdue=18` for the seeded institute
- [ ] Log line `[DRY-RUN] would set billing_restriction='add_blocked'`
- [ ] **No actual change** to `institutes.billing_restriction` (it stays NULL)
- [ ] No reminder email log for ICT clone or free-trial institute

### A5. Middleware enforcement smoke test (with restriction manually set)

- [ ] On staging only, manually set `billing_restriction='add_blocked'` for a professional institute
- [ ] `POST /api/v1/users` with role=student → expect `402 Payment Required`
- [ ] `POST /api/v1/materials/upload-url` → expect `402`
- [ ] `GET /api/v1/users` → expect `200`
- [ ] Set `billing_restriction='read_only'` → all writes return `402`, reads return `200`
- [ ] Manually set `billing_restriction` back to NULL before leaving staging
- [ ] Repeat the same restriction test against an ICT clone (tier=`pro`, billing_restriction=`read_only`) → every write returns `200` or `201` (tier gate skips the check — ICT is never restricted)

### A6. Flip staging to live

- [ ] Set `BILLING_CRON_DRY_RUN=false` on staging
- [ ] Re-run `python scripts/run_billing_dry.py monthly`
- [ ] Verify **one** invoice row created per v2-billable institute (no duplicates)
- [ ] Re-run the same command — verify zero new rows created (idempotency)
- [ ] Manual SQL:
  ```sql
  SELECT COUNT(*) FROM invoices i
    JOIN institutes inst ON i.institute_id = inst.id
   WHERE inst.plan_tier = 'pro';
  ```
  Should be **exactly 0** — ICT clone got no invoice

---

## Phase B — Production rollout

Only proceed if every Phase A item is green.

### B1. Pre-flight

- [ ] Confirm prod `BILLING_CRON_DRY_RUN=true` (current state)
- [ ] Confirm `SCHEDULER_ENABLED=true`
- [ ] Announce maintenance window to institutes if flipping during business hours (low-risk — no user impact expected)

### B2. First real monthly run (flipped)

- [ ] Set prod `BILLING_CRON_DRY_RUN=false`
- [ ] Blue-green deploy (see `docs/blue-green.md`)
- [ ] Manually trigger the cron on the active slot via SSH:
      `python scripts/run_billing_dry.py monthly`
- [ ] Tail logs for errors
- [ ] Spot-check in DB:
  ```sql
  SELECT COUNT(*) FROM invoices WHERE status='sent' AND created_at > NOW() - INTERVAL '1 hour';
  SELECT COUNT(*) FROM invoices i
    JOIN institutes inst ON i.institute_id = inst.id
   WHERE inst.plan_tier IN ('free', 'pro', 'starter', 'basic', 'enterprise')
     AND i.created_at > NOW() - INTERVAL '1 hour';  -- must be 0
  ```
- [ ] At least one test admin confirms they received the invoice email

### B3. Watch for 72 hours

- [ ] Sentry shows no `generate_monthly_invoices` / `enforce_late_payments` error events
- [ ] No support tickets from ICT or other grandfathered institutes about unexpected charges
- [ ] First-day late-payment reminder fires exactly 1 day after due_date (verify in activity log)

### B4. Rollback (if needed)

If anything goes sideways:

```bash
# 1. Flip back to dry-run
export BILLING_CRON_DRY_RUN=true

# 2. Restart scheduler via blue-green or kill the container

# 3. If erroneous invoices were created, soft-cancel them:
UPDATE invoices SET status='cancelled' WHERE invoice_number IN (...);

# 4. If billing_restriction was wrongly set, clear it:
UPDATE institutes SET billing_restriction=NULL WHERE billing_restriction IS NOT NULL;
```

---

## Non-negotiable invariants (verified automatically by code)

- **ICT.ZENSBOT.ONLINE is tier=`pro`** → the v2 query filter `plan_tier IN ('professional', 'custom')` excludes it from both cron jobs.
- **`check_billing_restriction()` returns early** if `is_v2_billing_tier(plan_tier)` is false — the middleware can never hold back ICT writes.
- **Grandfathered institutes have `billing_restriction=NULL`** — even if it were somehow set, the tier gate in `check_billing_restriction` ignores it.
- **Signup default tier** is env-driven via `SIGNUP_DEFAULT_TIER`; setting it back to `free` restores the legacy trial flow without code changes.

## Rollback safety

Flipping `SIGNUP_DEFAULT_TIER=free` at any time returns to the pre-v2 trial
flow for *new* signups. Already-created Professional institutes keep their
tier (no auto-downgrade). The monthly cron just stops generating invoices
for them — which is the correct behaviour (they're on a paid plan and
still using it, we just decided not to bill them for this period). Use
this if the billing engine needs to be paused while you investigate.
