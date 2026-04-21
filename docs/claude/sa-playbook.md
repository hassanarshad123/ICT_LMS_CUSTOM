# SA Playbook

Source of truth for how the SuperAdmin (SA) surface is structured and
the invariants it must uphold. Read this before touching any SA
router, service, frontend page, or scheduler job.

## The 8-tier plan model

Single source of truth: `backend/app/utils/tier_registry.py`.

```python
from app.utils.tier_registry import (
    ALL_TIERS,                 # tuple of every PlanTier, presentation order
    V2_TIERS,                  # {professional, custom} — billed by v2 engine
    SA_COMPED_TIERS,           # {unlimited} — SA-assigned, never billed
    LEGACY_TIERS,              # {free, starter, basic, pro, enterprise}
    TIER_LABELS,               # PlanTier → "Human label"
    default_distribution_dict, # {tier_value: 0} seed for by-tier rollups
    is_v2_billing_tier,        # bool — in V2_TIERS?
    is_sa_comped_tier,         # bool — in SA_COMPED_TIERS?
)
```

Rules:

1. **Never hardcode** a tier name list in SA code. Use the registry.
   Covered by `backend/tests/test_tier_registry.py`.
2. **Every new PlanTier enum value** must be added to exactly one of
   V2_TIERS / SA_COMPED_TIERS / LEGACY_TIERS. The test fails otherwise.
3. **Response dicts** keyed by tier (plan_distribution, revenue_by_plan,
   institutes_by_plan) must zero-seed from
   `default_distribution_dict()` before populating.
4. **Frontend** mirrors via `PlanTier` type + `PLAN_TIER_LABELS` in
   `frontend/lib/api/super-admin.ts`. Keep both sides in sync.

## The unlimited-tier contract

`unlimited` is the SA-only comp tier. Assigned only via a PATCH with
`tier_change_reason` (enforced by `change_institute_tier` in
`institute_service.py`).

Institutes on `unlimited` have:

- `max_users`, `max_students`, `max_storage_gb`, `max_video_gb` = **NULL**.
- No cap enforcement anywhere. `check_and_increment_*` helpers
  short-circuit when the relevant max_* is None.
- No billing. `is_v2_billable()` is False by construction. The
  monthly billing cron's query filters to `plan_tier IN V2_TIERS`,
  which excludes `unlimited`.
- No overage line items. `sa_billing_service._auto_calculate_line_items`
  guards each dimension independently so a partially-null config
  still bills the dimensions that do have caps.
- No addons. `_effective_storage_limit_gb` returns None, and
  `get_addon_storage_bonus` is never consulted for non-v2 tiers.

If you introduce a new quota dimension in the future, you must:

1. Add a null-check in the corresponding `check_and_increment_*`.
2. Guard the corresponding branch in `_auto_calculate_line_items`.
3. Add a test case to `backend/tests/test_unlimited_tier_quota.py`.

## Impersonation security (Phase 4)

Flow:

1. SA hits `POST /api/v1/super-admin/impersonate/{user_id}`.
   - Rejects self-impersonation (`target.id == sa.id` → 403).
   - Rejects non-active or soft-deleted institutes (→ 403).
   - Rejects another super-admin as target (→ 403).
   - Mints JWT via `create_impersonation_token` (10-min expiry).
   - Stores JWT in Redis at `imp:handover:{id}` with 60s TTL via
     `app/utils/impersonation_handover.py::issue()`.
   - Returns `{handover_id, institute_slug, target_user_id, …}` —
     the JWT itself is NEVER in the response body or any URL.
   - If Redis is down → 503. No fallback to URL-embedded tokens.

2. SA frontend opens
   `https://{slug}.zensbot.online/impersonate-callback?hid=<handover_id>`.

3. Callback page POSTs the `hid` to
   `POST /api/v1/auth/impersonation-handover/{hid}`:
   - Single-use: Redis GETDEL deletes the key atomically. Second
     redemption returns 404.
   - Rate-limited 20/min.
   - Returns `{access_token}`. Page writes it to localStorage and
     redirects to `/{userId}`.

Invariants:

- Token never appears in any URL (neither SA side nor target side).
- `hid` alone is unauthenticated but unforgeable (24-byte urlsafe).
- Legacy `?token=` query parameter is rejected (redirect to /login)
  in case a stale SA frontend ever hits the callback.
- SA layout guard (`frontend/app/sa/layout.tsx`) runs a server-side
  `/auth/me` check in addition to the localStorage fast-path;
  stale localStorage can't grant SA access.

## Scheduler job heartbeats (Phase 5)

Table: `system_jobs` (migration 043). Upserted by `sentry_job_wrapper`
in `backend/app/core/sentry.py` on every actual run (after slot
ownership + lock acquisition).

Columns:

- `name` — matches the wrapper's `job_name` argument.
- `last_run_at` — UTC timestamp of the most recent start.
- `last_status` — `running | success | failure`.
- `last_error` — first 500 chars of the exception on failure.
- `last_duration_ms` — wall time of the last completed run.

`/sa/health` endpoint JOINs against this and returns live status per
job. A crashed job shows `failure` with the exception summary;
never-run jobs show `unknown`.

## Commit boundaries (Phase 3)

All SA billing / settings services **flush, do not commit**. The
router is responsible for commit so the audit log entry
(`log_sa_action`) is in the same transaction as the mutation.

Pattern to follow:

```python
# Service
async def update_X(session, …) -> dict:
    …
    session.add(row)
    await session.flush()   # not commit
    return data

# Router
async def update_X_endpoint(...):
    data = await service.update_X(session, …)
    await log_sa_action(session, sa.id, …)
    await session.commit()   # single atomic commit
    return response
```

If you add a new SA mutation: follow this pattern. A regression is
caught by `backend/tests/test_sa_commit_boundaries.py`.

## BILLING_CRON_DRY_RUN flip procedure

The v2 billing engine (monthly invoice cron + late-payment
enforcement) is dormant by default. `settings.BILLING_CRON_DRY_RUN =
True` makes every write path log intent without inserting rows or
sending emails.

Before flipping to False in production:

1. Run a full dry cycle on day-1 of a month. Check logs for each
   v2-tier institute:
   - `[DRY-RUN] would issue invoice for {slug}: total=... line_items=...`
   - No `[DRY-RUN]` lines for any legacy or unlimited institute.
2. Confirm `/sa/health` shows `generate_monthly_invoices` with
   `last_status = success` after day-1 00:05 UTC.
3. Verify `system_jobs.last_error IS NULL` for both billing jobs.
4. Inspect a sample institute's generated billing preview via SA UI.
5. Flip `BILLING_CRON_DRY_RUN=False` in the production env + redeploy.
6. Watch `/sa/health` and Sentry for the next firing.

On app startup, if `APP_ENV=production` and dry-run is on, the
lifespan logs a WARNING and sends a Sentry breadcrumb
`billing_cron_dry_run_enabled_in_prod`. Clear intention signal.

## Cache invalidation

Mutations that change quota caps or billing config must call
`cache.invalidate_dashboard(str(institute_id))` after commit so the
next dashboard load is fresh. Covered today in:

- `super_admin.update_institute` (tier / cap changes)
- `sa_billing.update_billing_config`

Add it to any new SA mutation that changes a field the institute
admin's dashboard renders.

## Files you'll touch most

| Concern | Path |
|---|---|
| Tier registry | `backend/app/utils/tier_registry.py` |
| Quota enforcement | `backend/app/services/institute_service.py` |
| SA billing service | `backend/app/services/sa_billing_service.py` |
| SA analytics service | `backend/app/services/sa_analytics_service.py` |
| SA operations service | `backend/app/services/sa_operations_service.py` |
| SA monitoring service | `backend/app/services/sa_monitoring_service.py` |
| Impersonation handover | `backend/app/utils/impersonation_handover.py` |
| Scheduler wrapper (heartbeat) | `backend/app/core/sentry.py` |
| Billing cron | `backend/app/scheduler/billing_jobs.py` |
| SA routers | `backend/app/routers/{super_admin,sa_billing,sa_operations,sa_analytics,sa_monitoring}.py` |
| Frontend SA pages | `frontend/app/sa/…` |
| Frontend SA API client | `frontend/lib/api/super-admin.ts` |
| SA error boundary | `frontend/components/layout/sa-error-boundary.tsx` |

## Test suites

All SA tests live under `backend/tests/` and run without a live DB or
server. They use dataclass + fake-session fakes.

```bash
cd backend && source venv/Scripts/activate
python -m pytest \
  tests/test_tier_registry.py \
  tests/test_unlimited_tier_helper.py \
  tests/test_unlimited_tier_quota.py \
  tests/test_sa_commit_boundaries.py \
  tests/test_impersonation_security.py \
  -q
```

Expected: 34 passing.
