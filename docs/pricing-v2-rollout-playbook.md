# Pricing v2 — Production Rollout Playbook

Step-by-step commands for the DevOps / on-call engineer rolling v2 billing
live on AWS blue-green. Companion to `pricing-v2-dry-run-verification.md`
(which is the verification checklist) and `pricing-model-v2.md` (the spec).

> **Critical invariant:** ICT.ZENSBOT.ONLINE (`plan_tier='pro'`) must never
> appear in any billing cron output. Both cron jobs and every addon/
> restriction path are tier-gated. Checklist items below call this out
> explicitly at every decision point.

---

## Prerequisites

- [ ] PR 4 (backend) merged to `main`
- [ ] PR 5 (frontend) merged to `main`
- [ ] Both merges passed CI
- [ ] Staging has been deployed post-merge (blue-green cutover complete)
- [ ] You have SSH access to prod EC2 (see `docs/claude/production-quick-ref.md`)
- [ ] You have access to the AWS Console for env var changes
- [ ] A test admin account exists on a staging Professional institute so you can
      receive + inspect the first live invoice email

---

## Phase A — Staging

### A1. Walk the dry-run checklist

Open `docs/pricing-v2-dry-run-verification.md` and run every item under
**Phase A — Staging dry-run**. Do not proceed if any item fails.

### A2. Seed a Professional institute + ICT clone on staging

From your local machine, pointing at staging DB:

```bash
export DATABASE_URL="postgresql+asyncpg://..."  # staging direct URL
cd backend

# Assuming you already have ICT clone seed data. If not:
python scripts/seed_ict_data.py

# Create a brand-new Professional institute via the signup endpoint
# (exercises the SIGNUP_DEFAULT_TIER flip end-to-end):
curl -X POST https://staging.zensbot.online/api/v1/signup/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Admin",
    "email": "test+v2@zensbot.com",
    "password": "testpass123",
    "phone": "+923001234567",
    "institute_name": "V2 Test Institute",
    "institute_slug": "v2-test"
  }'
```

Expected response JSON includes `institute.planTier === "professional"` and
an access token. Login as this admin; your browser redirects to
`v2-test.staging.zensbot.online` and the sidebar shows the **Billing** entry.

### A3. Run the dry-run cron manually on staging

SSH into the staging EC2 instance and exec into the running container:

```bash
ssh ubuntu@<staging-host>
docker exec -it <active-slot-container> bash
cd /app
python scripts/run_billing_dry.py all
```

Watch for:
- `Found N v2-billable institutes` — `N` equals the number of professional + custom active institutes
- For each one: `[DRY-RUN] would issue invoice` with sensible totals
- Zero output lines for ICT clone or any `free` / `starter` / `basic` / `pro` / `enterprise` institute

### A4. Flip staging to live

Edit the staging ECS task definition / env vars:

```
BILLING_CRON_DRY_RUN=false
SIGNUP_DEFAULT_TIER=professional
```

Trigger a blue-green redeploy via your CI/CD pipeline (GitHub Actions or
the AWS CodeDeploy console — whichever you usually use).

After the cutover:

```bash
# Re-run the monthly job — this time WITH writes:
docker exec -it <active-slot-container> python scripts/run_billing_dry.py monthly

# Expect one invoice row per v2 institute; zero for ICT clone:
docker exec -it <active-slot-container> python -c "
import asyncio
from sqlmodel import select, func
from app.database import async_session
from app.models.billing import Invoice
from app.models.institute import Institute

async def go():
    async with async_session() as s:
        total = (await s.execute(select(func.count()).select_from(Invoice))).scalar()
        ict = (await s.execute(select(func.count()).select_from(Invoice).join(
            Institute, Institute.id == Invoice.institute_id
        ).where(Institute.plan_tier == 'pro'))).scalar()
        print(f'total invoices: {total}  invoices for pro tier: {ict}')

asyncio.run(go())
"
```

Expected: `invoices for pro tier: 0`.

### A5. Verify the admin UI + invoice email

- Log in to the Professional test institute → `/billing` → Overview shows a recent invoice in the Invoices tab
- Download the PDF → valid file opens
- Activate a `video_50gb` pack → Overview refreshes with the new charge in the preview
- Cancel it → row shows "Ends <last day of month>"
- Admin receives the "Invoice Issued" email

### A6. Idempotency check

Run the monthly cron a second time:

```bash
docker exec -it <active-slot-container> python scripts/run_billing_dry.py monthly
```

Expect log: `already_existed=<N>` equal to the number of institutes — no new rows.

---

## Phase B — Production

Only proceed if every Phase A item passed.

### B1. Pre-flight sanity

```bash
# From your local machine, pointing at prod read replica (NOT direct prod):
psql "$PROD_READONLY_URL" -c "
  SELECT plan_tier, status, COUNT(*)
    FROM institutes WHERE deleted_at IS NULL
  GROUP BY plan_tier, status
  ORDER BY plan_tier;
"
```

Confirm expected counts — ICT (pro, active) present, no surprise rows.

### B2. Flip prod env vars

In AWS Console → ECS → task definition → env vars:
```
BILLING_CRON_DRY_RUN=false
SIGNUP_DEFAULT_TIER=professional
```

Deploy via your standard blue-green pipeline. Watch the CodeDeploy progress
and health-check the new slot before traffic shifts.

### B3. Trigger the first live run immediately (don't wait for the 1st of the month)

```bash
ssh ubuntu@<prod-host>
docker exec -it <active-slot-container> python scripts/run_billing_dry.py monthly
```

Monitor:
- **Sentry** — any error in `generate_monthly_invoices` surfaces as a captured exception via `sentry_job_wrapper`
- **CloudWatch logs** — tail the backend container for `Monthly billing cron done:` summary
- **DB** — query invoice count, confirm zero for tier `pro`:

```sql
-- Should return 0
SELECT COUNT(*) FROM invoices i
  JOIN institutes inst ON i.institute_id = inst.id
 WHERE inst.plan_tier = 'pro'
   AND i.created_at > NOW() - INTERVAL '1 hour';

-- Should equal count of active v2 institutes
SELECT COUNT(*) FROM invoices i
  JOIN institutes inst ON i.institute_id = inst.id
 WHERE inst.plan_tier IN ('professional', 'custom')
   AND i.status = 'sent'
   AND i.created_at > NOW() - INTERVAL '1 hour';
```

### B4. Watch for 72 hours

- Sentry: zero errors from `generate_monthly_invoices` / `enforce_late_payments`
- Support inbox: zero complaints from ICT or other grandfathered customers
- Activity log: reminder emails queued for any prod institute with an overdue invoice

---

## Rollback

If anything misbehaves:

```bash
# 1. Set env var back
# AWS Console: BILLING_CRON_DRY_RUN=true, redeploy

# 2. (Optional) cancel erroneous invoices
docker exec -it <slot> psql "$DATABASE_URL" -c "
  UPDATE invoices SET status='cancelled', updated_at=NOW()
   WHERE invoice_number IN ('V-...', 'V-...');
"

# 3. (Optional) clear any wrongly-set billing_restriction
docker exec -it <slot> psql "$DATABASE_URL" -c "
  UPDATE institutes SET billing_restriction = NULL
   WHERE billing_restriction IS NOT NULL;
"
```

Rollback leaves Professional institutes created during the window on their
Professional tier — no auto-downgrade. If that's wrong for your situation,
update individual tiers manually via the SA console.

---

## Sign-off checklist (for the on-call engineer)

- [ ] Phase A complete, all sub-items green
- [ ] Phase B env vars flipped, deploy succeeded
- [ ] First live cron run: invoices exist for v2 tiers, zero for `pro`
- [ ] At least one admin confirms receipt of invoice email
- [ ] Sentry clean for 72 hours post-flip
- [ ] Update team Slack: "v2 billing live, monthly cron running, ICT unaffected"
