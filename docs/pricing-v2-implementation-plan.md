# Pricing Model v2 — Implementation Plan

**Status:** Approved. Ready to execute in 5 sequential PRs.
**Spec:** `docs/pricing-model-v2.md`
**Owner:** Hassan Arshad
**Started:** 2026-04-17

---

## What already exists (good news)

The backend has substantial billing infrastructure we'll **reuse, not replace**:

| Artifact | Location | Notes |
|---|---|---|
| `InstituteBilling` table | `backend/app/models/billing.py` | Per-institute config: `base_amount`, `extra_user_rate`, `extra_storage_rate`, `extra_video_rate`. Already generic enough for our new model. |
| `Invoice` table | `backend/app/models/billing.py` | Has `line_items` JSONB, periods, status, PDF, due_date. Perfect for our new invoice types — just new line-item codes. |
| `Payment` table | `backend/app/models/billing.py` | Links invoices to payments with method (`bank_transfer`, `jazzcash`, `easypaisa`, etc.). Exactly our MVP rail. |
| `InvoiceCounter` | `backend/app/models/billing.py` | Auto-numbering. |
| `sa_billing_service` | `backend/app/services/sa_billing_service.py` | `get_or_create_billing`, `generate_invoice`, `update_billing_config`. |
| `sa_billing` router | `backend/app/routers/sa_billing.py` | SA-facing billing endpoints. |
| `upgrade` router | `backend/app/routers/upgrade.py` | Admin self-serve upgrade flow with `PRICING_TABLE`. |
| APScheduler | `backend/main.py` (lines 72-94) | Already registers 15+ jobs incl. `auto_suspend_expired_institutes`. Add our new jobs here. |

**What truly needs to be built new:**
1. `institute_addons` table (storage pack subscriptions).
2. Monthly billing cron (`generate_monthly_invoices`).
3. Late-payment enforcement cron (extends `auto_suspend_expired_institutes`).
4. Per-student overage calculator (wraps `generate_invoice` with the right line items).
5. Admin-facing addon management endpoints.
6. 2-tier pricing page (check `landing/`, `frontend/`).
7. Admin billing dashboard.

---

## Protecting ICT.ZENSBOT.ONLINE (and other live institutes)

**Non-negotiable safety rules** applied at every step:

1. **Tier-based exclusion gate.** The new billing engine (monthly cron, per-student overage, addon enforcement) runs **only** for institutes with `plan_tier IN ('professional', 'custom')`. ICT and every grandfathered institute (`basic`, `pro`, `enterprise`, `starter`, `free`) are invisible to the new code path.

2. **Pre-deploy assertion.** Every PR runs a pre-deploy check that lists grandfathered institutes and their tiers. If any institute has `plan_tier IN ('professional', 'custom')` before we intend that, the deploy aborts.

3. **Additive migrations only.** No existing column is renamed, dropped, or repurposed. No existing row's data is mutated in any migration.

4. **Feature-flag the signup flip (PR 4).** Flipping the signup default from `free` → `professional` is behind env var `SIGNUP_DEFAULT_TIER` (default `free` in staging, flip to `professional` only after PRs 1–3 are live in prod).

5. **Staging-first for each PR.** Every PR ships to staging, soaks for 24-48h, then prod. Blue-green deploy allows instant rollback.

6. **ICT dry-run.** Before PR 3 lands (scheduler), run the billing cron **in dry-run mode** (log only, no DB writes) in production and verify: (a) zero institutes matched for grandfathered tiers, (b) only test Professional institutes (if any exist in prod) matched.

7. **Audit log.** Every billing action (invoice generated, addon activated, late-payment enforcement triggered) is written to `ActivityLog` with the institute ID. Easy to filter for "did anything touch ICT?"

---

## PR 1 — Backend enum + PLAN_LIMITS + InstituteBilling extension

**Goal:** Purely additive backend groundwork. Zero behavior change. No institute sees any difference.

**Scope:**
- Add `professional` and `custom` values to `PlanTier` enum in `backend/app/models/institute.py`.
- Add `PlanTier.professional` and `PlanTier.custom` entries to `PLAN_LIMITS` in `backend/app/utils/plan_limits.py` (values from spec).
- Add `TIER_LABELS` entries (`"Professional"`, `"Custom"`).
- Extend `InstituteBilling` with two optional columns:
  - `free_users_included: int = 0` — how many students/users are included before overage kicks in (10 for professional, per-deal for custom, 0 for all existing configs).
  - `custom_pricing_config: JSONB | None = None` — volume-discount tiers and addon overrides for Custom tier only.
- Alembic migration:
  - `ALTER TYPE plan_tier ADD VALUE 'professional'`
  - `ALTER TYPE plan_tier ADD VALUE 'custom'`
  - `ALTER TABLE institute_billing ADD COLUMN free_users_included INT NOT NULL DEFAULT 0`
  - `ALTER TABLE institute_billing ADD COLUMN custom_pricing_config JSONB NULL`
- Unit tests: enum values exist, `get_limit(PlanTier.professional, "students")` returns `None` (unlimited with overage), `has_feature(PlanTier.professional, "ai_tools")` returns `True`, `has_feature(PlanTier.professional, "custom_domain")` returns `False`.

**Files touched:**
- `backend/app/models/institute.py` (+2 enum values)
- `backend/app/utils/plan_limits.py` (+2 dict entries, +2 label entries)
- `backend/app/models/billing.py` (+2 columns on `InstituteBilling`)
- `backend/alembic/versions/xxxx_pricing_v2_enum.py` (new)
- `backend/tests/test_plan_limits.py` (new)

**ICT safety check:** No existing institute's `plan_tier` is changed. No existing `InstituteBilling` row is modified. New columns default to safe values (`0` and `NULL`).

**Rollback:** Alembic downgrade drops the two columns and the enum values (Postgres `ALTER TYPE` rollback is tricky — we'll document it as "leave the enum value orphaned if rollback is needed; remove next release"). Code changes revert cleanly.

**Deploy:** Standard blue-green. Soak 24h in prod.

---

## PR 2 — institute_addons model + service (dormant)

**Goal:** Create the addon-subscription infrastructure. Not yet wired to any quota enforcement or UI — purely schema + service layer.

**Scope:**
- New model `backend/app/models/institute_addon.py`:
  ```python
  class InstituteAddon(SQLModel, table=True):
      __tablename__ = "institute_addons"
      id: uuid.UUID (PK)
      institute_id: uuid.UUID (FK, indexed)
      addon_type: str  # "docs_10gb" | "video_50gb" | "video_100gb" | "video_500gb"
      quantity: int = 1
      unit_price_pkr: int  # captured at activation time for billing stability
      storage_bonus_gb: float  # pre-computed (docs or video)
      storage_bonus_kind: str  # "docs" | "video"
      activated_at: datetime
      cancelled_at: datetime | None = None
      cancelled_effective_at: datetime | None = None  # end of current billing period
  ```
- New service `backend/app/services/addon_service.py`:
  - `list_addons(session, institute_id) -> list[InstituteAddon]` (all, incl. cancelled)
  - `active_addons(session, institute_id) -> list[InstituteAddon]` (where cancelled_effective_at is null or in future)
  - `get_addon_storage_bonus(session, institute_id) -> tuple[float, float]` (returns `(docs_bonus_gb, video_bonus_gb)`)
  - `activate_addon(session, institute_id, addon_type, quantity=1) -> InstituteAddon`
  - `cancel_addon(session, addon_id) -> InstituteAddon` (sets `cancelled_at=now`, `cancelled_effective_at=last_day_of_current_month`)
- Add addon type constants to `backend/app/utils/plan_limits.py`:
  ```python
  ADDON_PRICING = {
      "docs_10gb":    {"price_pkr": 1_000, "bonus_gb": 10.0,  "kind": "docs"},
      "video_50gb":   {"price_pkr": 3_000, "bonus_gb": 50.0,  "kind": "video"},
      "video_100gb":  {"price_pkr": 5_000, "bonus_gb": 100.0, "kind": "video"},
      "video_500gb":  {"price_pkr": 20_000, "bonus_gb": 500.0, "kind": "video"},
  }
  ```
- Alembic migration for `institute_addons` table with index on `(institute_id, cancelled_effective_at)`.
- Extend `check_and_increment_storage_quota` and `check_and_increment_video_quota` in `backend/app/services/institute_service.py` to add `addon_storage_bonus` to the effective limit **only if** `institute.plan_tier IN ('professional', 'custom')`. Grandfathered institutes skip this entirely (their `max_storage_gb` stays authoritative).
- Unit tests for `addon_service` and for `check_and_increment_storage_quota` with/without addons, grandfathered vs new tiers.

**Files touched:**
- `backend/app/models/institute_addon.py` (new)
- `backend/app/services/addon_service.py` (new)
- `backend/app/utils/plan_limits.py` (add `ADDON_PRICING` dict)
- `backend/app/services/institute_service.py` (extend quota checks — tier-gated)
- `backend/alembic/versions/xxxx_institute_addons.py` (new)
- `backend/tests/test_addon_service.py` (new)

**ICT safety check:** Quota extension is explicitly tier-gated (`if institute.plan_tier in (professional, custom)`). ICT is on `pro` (verify in staging!) so the new path is not hit for ICT. Existing behavior unchanged.

**Rollback:** Drop table + revert quota-check code.

**Deploy:** Standard. Soak 24h.

---

## PR 3 — Billing cron + late-payment enforcement (dormant until tier is used)

**Goal:** Stand up the monthly billing engine and late-payment escalation. Still no real billing happens because no institute has `plan_tier='professional'` yet.

**Scope:**
- New file `backend/app/scheduler/billing_jobs.py`:
  - `generate_monthly_invoices()` — runs on 1st at 00:05 UTC. For each institute where `plan_tier IN ('professional', 'custom')` AND `status='active'`:
    1. Count active students (same SQL as spec).
    2. Compute overage: `max(0, count - billing.free_users_included) * billing.extra_user_rate` (Professional) or apply `custom_pricing_config.tiered_student_rates` (Custom).
    3. Query active addons, sum their monthly charges.
    4. Build `line_items` JSONB: `[{"code": "student_overage", "qty": overage_count, "unit_pkr": 80, "total_pkr": ...}, {"code": "addon_video_50gb", "qty": 1, "unit_pkr": 3000, "total_pkr": 3000}, ...]`.
    5. Call existing `sa_billing_service.generate_invoice(...)` with computed line_items.
    6. Send invoice email via existing email template system (create `invoice_issued.html` template).
    7. Log to `ActivityLog(action='invoice_auto_generated', institute_id=..., details={invoice_id, total_pkr, ...})`.
  - `enforce_late_payments()` — runs daily at 02:00 UTC. For each `Invoice` where `status IN ('sent', 'overdue')` AND `institute.plan_tier IN ('professional', 'custom')`:
    1. Compute `days_overdue = now - due_date`.
    2. Day 15+: set institute flag `billing_restriction='add_blocked'`.
    3. Day 30+: set `billing_restriction='read_only'`.
    4. Day 60+: set `institute.status='suspended'`.
    5. Reset flag if invoice becomes paid.
  - Add `billing_restriction` column to `institutes` table (nullable string: `add_blocked` | `read_only` | null).
- Register both jobs in `backend/main.py`:
  ```python
  scheduler.add_job(generate_monthly_invoices, "cron", day=1, hour=0, minute=5, id="monthly_billing")
  scheduler.add_job(enforce_late_payments, "cron", hour=2, minute=0, id="late_payment")
  ```
- New middleware check in `backend/app/middleware/access_control.py`: if request is a write (POST/PUT/PATCH/DELETE) and `institute.billing_restriction='read_only'`, return 402 Payment Required. If `billing_restriction='add_blocked'` and the route is `POST /users` or upload routes, return 402.
- Dry-run flag: `BILLING_CRON_DRY_RUN=true` env var makes the cron log only, no DB writes. First run in prod uses dry-run mode for 1 full cycle.
- Alembic migration for the new `billing_restriction` column.
- Email templates `invoice_issued.html`, `invoice_reminder.html`, `late_payment_restricted.html`.
- Integration tests for the cron with a staging fixture (1 professional institute, 1 grandfathered institute) — verify the grandfathered one is skipped.

**Files touched:**
- `backend/app/scheduler/billing_jobs.py` (new)
- `backend/main.py` (register 2 new jobs)
- `backend/app/models/institute.py` (add `billing_restriction` column)
- `backend/app/middleware/access_control.py` (add billing check)
- `backend/app/templates/emails/` (3 new templates)
- `backend/alembic/versions/xxxx_billing_restriction.py` (new)
- `backend/tests/test_billing_jobs.py` (new, with ICT-simulation test)

**ICT safety check:**
- **Explicit plan_tier filter on both crons.** ICT's `plan_tier=pro` excludes it.
- **Middleware check tier-gated** — `billing_restriction` is only ever set for professional/custom institutes. For safety, middleware also checks tier: `if institute.plan_tier in (professional, custom) and institute.billing_restriction == 'read_only': ...`.
- **Dry-run in prod for 1 cycle.** First real run: `BILLING_CRON_DRY_RUN=true`. Log output reviewed manually. Confirm zero grandfathered institutes appear. Only then flip to `false`.
- **Manual audit after first real run.** Super admin dashboard lists all auto-generated invoices — verify only Professional institutes received them.

**Rollback:** Disable the two cron jobs in `main.py` (one-line change), redeploy.

**Deploy:** Blue-green, soak 48h with dry-run enabled.

---

## PR 4 — Signup flip + admin addon endpoints

**Goal:** Start creating new institutes on Professional. Enable admins to activate/cancel storage addons.

**Scope:**
- Update `backend/app/services/signup_service.py`:
  - In `create_institute_with_admin()`, read env var `SIGNUP_DEFAULT_TIER` (default `free` in staging, `professional` in prod after QA).
  - If `professional`: create institute with `plan_tier=professional`, `status=active`, `expires_at=None`. Also create `InstituteBilling(institute_id, free_users_included=10, extra_user_rate=80, currency='PKR', billing_cycle='monthly')`.
  - Retire 14-day trial logic (guarded by flag — keep the code path for grandfathered institutes but never triggered by new signups).
- New router `backend/app/routers/billing.py` (admin-facing):
  - `GET /billing/current-period` — preview this month's computed bill (live count × rate + addons).
  - `GET /billing/invoices` — list institute's invoices.
  - `GET /billing/invoices/{id}` — invoice detail + PDF URL.
  - `GET /billing/addons` — list institute's addons (active + historical).
  - `POST /billing/addons` — activate addon. Body: `{"addon_type": "video_50gb", "quantity": 1}`. Capacity effective immediately. Billing starts next cycle.
  - `DELETE /billing/addons/{id}` — cancel addon. Sets `cancelled_effective_at` to end of current billing period.
- Guard all new routes with role check (`admin` only) + plan_tier check (reject if `plan_tier NOT IN ('professional', 'custom')` with message "Your plan doesn't use this billing system.").
- Extend `sa_billing` router: new endpoint `POST /sa/institutes/{id}/migrate-to-professional` — super admin one-way migration for grandfathered institutes that opt in.
- Activity logs for addon activate/cancel.
- Landing page copy update: remove "14-day trial" language → "Free forever, start with 10 students."
- Integration tests: sign up → `plan_tier=professional`. Sign up 2nd with same email → still blocked by 90-day cooldown.

**Files touched:**
- `backend/app/services/signup_service.py` (tier default + billing config creation)
- `backend/app/routers/billing.py` (new — admin-facing)
- `backend/app/routers/sa_billing.py` (add migration endpoint)
- `backend/app/schemas/billing.py` (new — request/response schemas)
- `landing/components/signup/register-form.tsx` (remove trial copy)
- `backend/tests/test_signup_v2.py` (new)
- `backend/tests/test_admin_billing_endpoints.py` (new)

**Rollout steps within the PR:**
1. Merge code with `SIGNUP_DEFAULT_TIER=free` in prod (no behavior change yet).
2. QA signup flow in staging with `SIGNUP_DEFAULT_TIER=professional`.
3. Flip prod env var to `professional`. First new signup gets the new tier.
4. Monitor for 48h — new institute appears in PR 3's cron on next 1st of month.

**ICT safety check:**
- Admin endpoints reject calls from ICT (tier is `pro`, not `professional`/`custom`).
- Signup flip doesn't touch existing institutes.
- SA migration endpoint requires explicit super-admin action, not automatic.

**Rollback:** Flip env var back to `free`. Existing `professional` institutes stay on their tier (no auto-downgrade).

**Deploy:** Blue-green. First real new-tier signup = the moment of truth.

---

## PR 5 — UI: pricing page + admin billing dashboard + SA invoice tooling

**Goal:** Make the new system visible and usable. Launch-ready.

**Scope:**

### Landing page
- `landing/app/pricing/page.tsx` (new or overwrite existing): 2-column layout.
  - Left: "Professional — Free forever", feature list, add-on table, "Start free" CTA → signup.
  - Right: "Custom — From Rs 50,000–500,000/mo", feature list, "Talk to sales" CTA → contact form.
- Contact form posts to a new `POST /leads/custom-sales` endpoint (or integrates with existing CRM webhook).

### Admin dashboard (new institute-admin pages)
- `frontend/app/admin/billing/page.tsx` (new):
  - Current period card: live student count, overage count, overage amount, active addons, total projected bill.
  - Invoice history table (period, total, status, pay-now instructions for sent invoices).
  - "Storage add-ons" section: current storage usage (docs + video), activate new pack modal, cancel pack button.
  - If `billing_restriction` is set: big warning banner with pay-now instructions.
- `frontend/app/admin/layout.tsx`: add "Billing" nav item (visible to `admin` role on `professional`/`custom` tiers only; hidden for grandfathered tiers so ICT's dashboard is unchanged).

### Super-admin dashboard (extend existing)
- `frontend/app/super-admin/billing/page.tsx` (extend or new):
  - Platform-wide invoice list with filters (status, overdue, tier).
  - "Mark paid" flow (existing `sa_billing_service.record_payment`).
  - "Migrate institute to Professional" button for grandfathered institutes.
  - Monthly revenue summary (Professional overage + addons + Custom base fees).

### Copy updates
- Wherever the old 5-tier pricing is shown, add a "Legacy plan" note for grandfathered views.

### E2E tests
- Playwright/browser test: signup → admin login → admin billing page shows Rs 0 projected. Add 11 students → projected shows Rs 80. Activate `+50 GB video` addon → projected shows Rs 3,080 for next month.

**Files touched:**
- `landing/app/pricing/page.tsx` (new/overwrite)
- `landing/app/contact-sales/page.tsx` (new) + lead capture endpoint
- `frontend/app/admin/billing/page.tsx` (new)
- `frontend/app/super-admin/billing/page.tsx` (new or extend)
- `frontend/app/admin/layout.tsx` (nav update)
- `frontend/lib/api/billing.ts` (new — typed API client)
- `e2e/tests/billing-flow.spec.ts` (new)

**ICT safety check:**
- "Billing" nav item hidden for tiers other than `professional`/`custom`. ICT's admin UI stays visually identical.
- Super-admin dashboard clearly separates grandfathered institutes into their own view.

**Rollback:** Revert frontend. Backend stays — it's functional without UI.

**Deploy:** Vercel/Netlify blue-green.

---

## Cross-cutting concerns

### Monitoring & alerting
- Sentry captures for:
  - `generate_monthly_invoices` errors (already via `sentry_job_wrapper`).
  - `enforce_late_payments` errors.
  - Any `ValueError` raised by `check_and_increment_*_quota` when a Professional institute hits a limit.
- CloudWatch/Logs alarm: if `generate_monthly_invoices` produces 0 invoices on a 1st-of-month run (after new signups exist), page the team.

### Feature flags (env vars)
| Flag | PR | Default | Purpose |
|---|---|---|---|
| `BILLING_CRON_DRY_RUN` | 3 | `true` | Cron logs only, no DB writes. Flip `false` after first successful dry run. |
| `SIGNUP_DEFAULT_TIER` | 4 | `free` | Staging: `professional`. Prod: flip to `professional` after staging QA. |
| `NEW_PRICING_UI_ENABLED` | 5 | `false` | Gates the admin billing nav item during rollout. |

### Migration ordering
1. PR 1 alembic → `ALTER TYPE plan_tier` must commit in its own transaction (Postgres quirk).
2. PR 2 alembic → depends on PR 1 being live.
3. PR 3 alembic → adds `billing_restriction` to institutes.
4. Never squash these; each migration is independently revertible.

### Grandfathering verification (run at each PR)
```sql
-- Before each deploy: confirm no live institute accidentally has professional/custom
SELECT id, slug, plan_tier, status, created_at FROM institutes
WHERE plan_tier IN ('professional', 'custom') AND deleted_at IS NULL;
-- Expected: empty until PR 4's signup flip goes live.
```

```sql
-- Confirm ICT.ZENSBOT.ONLINE is unchanged
SELECT id, slug, plan_tier, status, max_students, max_storage_gb, max_video_gb
FROM institutes WHERE slug = 'ict';
-- Expected: plan_tier='pro', status='active', original caps intact.
```

### Communications
- **Internal (before PR 4 lands):** All-hands Slack heads-up that new signups will default to Professional.
- **Existing customers (after PR 5):** Email from Hassan explaining the new 2-tier model. Reassure "your plan is unchanged. You will never be moved unless you request it."
- **Landing visitors:** New pricing page goes live with PR 5.

---

## Success criteria

**Must-have for launch:**
- [ ] ICT.ZENSBOT.ONLINE: unchanged (quarterly audit of `plan_tier`, quotas, billing config, invoices).
- [ ] A new signup → lands on `professional` → creates `InstituteBilling(free_users_included=10, extra_user_rate=80)`.
- [ ] A `professional` institute with 12 students on the 1st of the month → receives an invoice for Rs 160 (2 × 80).
- [ ] Admin activates `+50 GB video` on day 15 → can upload immediately → next month's invoice includes Rs 3,000 line item.
- [ ] Admin on a `pro` (grandfathered) tier: no billing nav, no auto-invoice, no addon UI, no behavior change whatsoever.
- [ ] Late-payment enforcement: Professional institute 15+ days overdue → POST /users returns 402. Grandfathered institute with overdue invoice: no enforcement (their billing is manual).
- [ ] Custom tier institute: super admin can set `custom_pricing_config` JSONB with tiered rates; billing cron uses those rates.

**Nice-to-have (post-launch):**
- Stripe/card integration for auto-charge.
- Prorated mid-month billing (currently snapshot-only).
- Tax/GST line item on invoices.
- Multi-currency support (USD for international signups).

---

## Open questions (resolve before PR 4)

1. **Email templates** — the spec mentions 3 new templates. Need confirmation of the existing template system (`backend/app/templates/emails/`?) and branding standards.
2. **Invoice PDF generation** — `Invoice.pdf_path` exists. Is there a PDF service already, or does SA generate manually? Check `sa_billing_service.generate_invoice`.
3. **Custom sales lead capture** — route to email, CRM (which?), or Slack? Confirm with Hassan.
4. **Pricing page copy** — does marketing have final copy, or do we draft?

---

## Estimated timeline

| PR | Dev effort | Soak | Ship by |
|---|---|---|---|
| PR 1 | 0.5 day | 24h | Day 2 |
| PR 2 | 1.5 days | 24h | Day 5 |
| PR 3 | 2 days | 48h (dry-run cycle) | Day 10 |
| PR 4 | 1.5 days | 48h | Day 13 |
| PR 5 | 3 days | 48h | Day 18 |

**Total: ~18 days** from kickoff to public launch, assuming one engineer full-time and no blocking issues.
