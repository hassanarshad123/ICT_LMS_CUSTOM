# Deploy Runbook — Frappe/ERPNext Integration v1

**Audience:** ops engineer doing the deploy.
**Blast radius:** low. Migration is additive (4 new tables, no existing columns touched). Feature flag defaults to OFF for every institute.
**Rollback time:** < 2 minutes via `backend/deploy/rollback.sh`.
**Expected downtime:** 0 seconds (blue-green).

---

## Pre-flight (5 minutes, before merging the PR)

1. **Confirm CI is green** on the PR branch (`feat/frappe-integration`):
   ```bash
   gh pr checks <PR-number>
   ```

2. **Review the alembic migration** in `backend/migrations/versions/033_add_integration_tables.py` — confirm:
   - Only `CREATE TABLE` / `CREATE INDEX` operations (no `ALTER TABLE`, no `DROP`, no data migrations)
   - Creates 4 tables: `institute_integrations`, `integration_sync_log`, `integration_sync_tasks`, `bulk_import_jobs`
   - `down_revision = "032"`

3. **Take an RDS snapshot** (belt + braces even though rollback is reversible):
   ```bash
   aws rds create-db-snapshot \
     --db-snapshot-identifier ict-lms-pre-frappe-$(date +%Y%m%d-%H%M) \
     --db-instance-identifier ict-lms-db
   ```
   Wait until `aws rds describe-db-snapshots --db-snapshot-identifier <id> --query 'DBSnapshots[0].Status'` returns `available`.

4. **Verify the admin JWT** you'll use for smoke testing:
   ```bash
   curl -s -X POST https://apiict.zensbot.site/api/v1/auth/login \
     -H 'Content-Type: application/json' \
     -H 'X-Institute-Slug: ict' \
     -d '{"email":"admin@ict.net.pk","password":"..."}' | jq -r .access_token
   ```
   Store it in `$ADMIN_TOKEN`.

---

## Deploy (10 minutes)

### Step 1 — Merge the PR
```bash
gh pr merge <PR-number> --squash
```
GitHub Actions picks it up. Watch the deploy workflow:
```bash
gh run watch
```

### Step 2 — Apply the migration on the active slot

SSH into EC2:
```bash
ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220
```

Identify the active slot:
```bash
cat /home/ubuntu/ICT_LMS_CUSTOM/backend/.active-slot
# expected: "blue" or "green"
```

Run the migration inside the **active** Docker container (so it uses the committed code, not whatever's in the host venv):
```bash
# Replace "blue" with whatever the active slot is
docker exec -it lms-blue alembic upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Context impl PostgreSQLImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade 032 -> 033, Add institute_integrations, integration_sync_log, integration_sync_tasks, bulk_import_jobs
```

Verify the tables exist:
```bash
docker exec -it lms-blue python -c "
from app.database import async_session
from sqlalchemy import text
import asyncio
async def check():
    async with async_session() as s:
        for t in ['institute_integrations','integration_sync_log','integration_sync_tasks','bulk_import_jobs']:
            r = await s.execute(text(f'SELECT COUNT(*) FROM {t}'))
            print(f'{t}: {r.scalar()} rows')
asyncio.run(check())
"
```

All four tables should report `0 rows`.

### Step 3 — GitHub Actions finishes blue-green

The deploy script (`backend/deploy/deploy-bg.sh`) does:
1. Builds the new Docker image
2. Spins up the **inactive** slot (green if blue is active)
3. Runs health check on inactive slot
4. Switches nginx to point to the new slot
5. Drains the old container after 60s

Watch the last 50 lines of the deploy log:
```bash
tail -f /var/log/lms/deploy-*.log
```

Wait for the log to say `Deploy complete. Active slot: <new-slot>`.

Re-check active slot:
```bash
cat /home/ubuntu/ICT_LMS_CUSTOM/backend/.active-slot
```
It should have flipped to the other slot.

### Step 4 — Run the smoke test

From your laptop (or EC2):
```bash
python backend/scripts/smoke_integrations.py https://apiict.zensbot.site "$ADMIN_TOKEN"
```

Expected:
```
  [OK ] Health endpoint (/api/health)
  [OK ] GET /integrations/frappe (admin)
         HTTP 200, frappe_enabled=False
  [OK ] GET /integrations/sync-log (admin)
  [OK ] GET /integrations/sync-log/kpis (admin)
         HTTP 200, success_rate_24h=100%
  [OK ] GET /admin/bulk-import/template/students
  [OK ] GET /admin/bulk-import/template/fee_plans
  [OK ] GET /admin/bulk-import/template/payments
  [OK ] GET /admin/bulk-import/jobs (admin)
  [OK ] POST /integrations/frappe/webhook (unauthenticated)

All 9/9 checks PASSED — integration surface is alive.
```

If any check fails, jump to [ROLLBACK.md](./ROLLBACK.md).

### Step 5 — Verify scheduler picked up the new job

```bash
docker logs lms-<new-active-slot> --tail 100 | grep -E "frappe_sync_tasks|Scheduler"
```

You should see `Scheduler started` once, and then `Processed 0 Frappe sync tasks` nothing — that's fine; no tasks to process when no institute is enabled.

### Step 6 — Regression check (existing flows unaffected)

Log into the admin UI at `https://zensbot.online/<admin-userId>`:

- Open Admissions → roster loads
- Open Fees → existing installments still render
- Open Lectures → video playback still works
- Open Integrations → 3 new tabs visible: **Frappe / ERPNext**, **Sync Health**, **Bulk Import**

---

## Post-deploy (5 minutes)

1. **Record the deploy** in your changelog / release notes.
2. **Monitor Sentry** for 30 minutes — any new error types? Especially anything with `integration`, `frappe`, or `bulk_import` in the path.
3. **Leave integrations disabled** — no institute is enabled yet. That's intentional.
4. **Share** [`PILOT-CHECKLIST.md`](./PILOT-CHECKLIST.md) with your pilot institute's Frappe admin.

---

## What to do if something looks wrong

- Smoke test fails → [`ROLLBACK.md`](./ROLLBACK.md)
- Existing flow regresses → [`ROLLBACK.md`](./ROLLBACK.md)
- Migration fails partway → [`ROLLBACK.md`](./ROLLBACK.md) → "Schema rollback"
- Scheduler job crashes repeatedly → disable the job (see ROLLBACK) but leave the rest deployed

## Reference

- Infrastructure: [`../claude/production-quick-ref.md`](../claude/production-quick-ref.md)
- Blue-green architecture: [`../blue-green.md`](../blue-green.md)
- Integration spec: [`README.md`](./README.md)
