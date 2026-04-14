# Rollback Runbook — Frappe/ERPNext Integration v1

**When to use:** something broke post-deploy. Smoke test failed, existing flows regressed, or Sentry is lighting up with new errors.

**Principle:** roll back the smallest thing that fixes it. Don't reach for the database unless the code rollback fails.

---

## Decision tree

```
Is the existing LMS broken (admissions, fees, lectures, certificates)?
├── YES → Step A (code rollback)
│         └── Still broken after code rollback? → Step B (schema rollback)
│
└── NO, but Frappe sync is misbehaving
    ├── Any institute has frappe_enabled=true? → Step C (disable sync only)
    └── Otherwise → Step D (investigate, no rollback needed)
```

---

## Step A — Code rollback (blue-green flip)

**Effect:** nginx switches back to the previous Docker container. Zero downtime. Feature flag + integration UI disappear (they live in the new code).

**Duration:** ~30 seconds.

```bash
ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220
cd /home/ubuntu/ICT_LMS_CUSTOM/backend/deploy
./rollback.sh
```

Expected output:
```
Rolling back from green to blue...
Active slot is now: blue
```

Verify:
```bash
curl https://apiict.zensbot.site/api/health | jq .
# status should be "ok"
```

**Schema note:** the 4 new tables stay in place. They're harmless — no code path in the rolled-back image references them. Leave them until you're ready to re-deploy.

---

## Step B — Schema rollback (only if Step A didn't fix it)

**When to use:** Step A flipped nginx back but the application still crashes on startup or returns 500s. This usually means the migration left the DB in an unexpected state.

**Pre-check:** make sure no code path in the rolled-back image touches the new tables:
```bash
docker exec -it lms-blue grep -r "institute_integrations\|integration_sync_log\|integration_sync_tasks\|bulk_import_jobs" /app/app/ 2>&1 | head
# Should return nothing — if it does, you rolled back incorrectly
```

Apply the down-migration:
```bash
docker exec -it lms-blue alembic downgrade 032
```

Expected output:
```
INFO  [alembic.runtime.migration] Running downgrade 033 -> 032, Add institute_integrations...
```

Verify the tables are gone:
```bash
docker exec -it lms-blue python -c "
from app.database import async_session
from sqlalchemy import text
import asyncio
async def check():
    async with async_session() as s:
        for t in ['institute_integrations','integration_sync_log','integration_sync_tasks','bulk_import_jobs']:
            try:
                await s.execute(text(f'SELECT 1 FROM {t} LIMIT 1'))
                print(f'{t}: STILL EXISTS')
            except Exception:
                print(f'{t}: dropped OK')
asyncio.run(check())
"
```

If any table still exists, manually drop it:
```sql
DROP TABLE IF EXISTS bulk_import_jobs;
DROP TABLE IF EXISTS integration_sync_tasks;
DROP TABLE IF EXISTS integration_sync_log;
DROP TABLE IF EXISTS institute_integrations;
```

**Worst case:** restore the RDS snapshot you took in DEPLOY.md step "Pre-flight":
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ict-lms-db-restored \
  --db-snapshot-identifier <snapshot-id>
```
Then swap the restored instance in place of the current one via RDS console. **~20 minutes of downtime** — last resort only.

---

## Step C — Disable Frappe sync without rolling back code

**When to use:** the new integration UI is fine but the outbound Frappe push is failing for a pilot institute and noisy-failing in Sentry. You want to stop the bleeding without rolling back the whole deploy.

Connect to RDS:
```bash
ssh -i LMS_CUSTOM.pem ubuntu@13.204.107.220
docker exec -it lms-$(cat /home/ubuntu/ICT_LMS_CUSTOM/backend/.active-slot) python
```

In the Python REPL:
```python
import asyncio
from app.database import async_session
from sqlalchemy import text

async def disable_all():
    async with async_session() as s:
        result = await s.execute(
            text("UPDATE institute_integrations SET frappe_enabled=false RETURNING institute_id")
        )
        rows = result.fetchall()
        await s.commit()
        print(f"Disabled sync for {len(rows)} institute(s): {[str(r[0]) for r in rows]}")

asyncio.run(disable_all())
```

Pending `IntegrationSyncTask` rows will be cancelled by the scheduler on their next attempt (because `load_active_frappe_config` returns `None` for disabled institutes).

**Re-enable later** via the admin UI → Integrations → Frappe / ERPNext → toggle Enabled.

---

## Step D — No rollback, investigate

**When to use:** integration is disabled everywhere (no institute has `frappe_enabled=true`) but you're seeing errors in Sentry.

This means existing flows haven't been affected. You can:
1. Investigate at your own pace
2. Tail logs: `docker logs lms-<active-slot> --tail 500 --follow | grep -i integration`
3. Query sync log: `SELECT * FROM integration_sync_log ORDER BY created_at DESC LIMIT 20;`
4. Fix forward — next deploy resolves it

**Do not** rollback the entire deploy over logs-only issues. The feature flag is protection.

---

## Verification after any rollback

```bash
# 1. Health
curl https://apiict.zensbot.site/api/health | jq .

# 2. Smoke test (will fail on the integration endpoints if you did schema rollback)
python backend/scripts/smoke_integrations.py https://apiict.zensbot.site "$ADMIN_TOKEN"

# 3. Existing flows work
#    — Login to admin UI
#    — Check admissions roster loads
#    — Check lectures playback
#    — Check certificates page
```

If the health check returns `"status": "degraded"`, stop and escalate — that's a DB connectivity issue, not an integration issue.

---

## Incident post-mortem template

For every rollback, fill in:
- **Time of deploy:**
- **Time of rollback:**
- **Symptoms:**
- **What triggered the rollback** (which step of `DEPLOY.md` / smoke test / Sentry alert):
- **Root cause:**
- **Fix plan for redeploy:**

File it in `docs/incidents/YYYY-MM-DD-frappe-rollback.md` so the next deploy avoids the same trap.
