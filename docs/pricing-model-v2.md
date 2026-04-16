# Zensbot LMS — Pricing Model v2

**Status:** Approved. Supersedes the 5-tier model in `backend/app/utils/plan_limits.py`.
**Effective:** New signups only. Existing paying institutes are grandfathered on their current tier.
**Owner:** Hassan Arshad (hassan@zensbot.com)
**Last updated:** 2026-04-17

---

## TL;DR

Zensbot LMS has **two public tiers**:

1. **Professional** — free forever, with 10 students + 10 GB docs + 50 GB video included. Pay Rs 80/month per extra student. Everything else (all LMS features, customization, shared app, subdomain) is unlocked.
2. **Custom** — starts at Rs 50,000/mo (quoted per deal). Everything in Professional plus volume discounts, dedicated infrastructure, SLA, own app, own domain, and full white-labeling.

The 14-day trial is **retired**. Professional is itself a "free forever" plan with no expiry.

---

## Tier 1 — Professional

**Price:** Free forever. No trial timer, no expiry.

**Tagline:** *"Free forever. Pay only when you grow."*

### What's included

| Feature | Limit |
|---|---|
| Monthly price | **Rs 0** |
| Students (free) | **10 active students** |
| Students (overage) | **Rs 80 / month / extra student** |
| Staff accounts (admin, teacher, course creator, admissions officer) | **Unlimited, always free** |
| Document storage (PDFs, materials) | **10 GB** |
| Video storage (Bunny CDN — lectures) | **50 GB** |
| Courses | Unlimited |
| Batches | Unlimited |
| Quizzes | Unlimited |
| Zoom classes | Unlimited |
| Announcements | 100 / day per institute (soft abuse cap) |
| API keys | Unlimited |
| Webhooks | Unlimited |
| AI tools | Enabled |
| Branding — logo, colors, certificate templates, email sender name | Enabled |
| Mobile app | Shared Zensbot LMS app on App Store / Play Store |
| Domain | `{slug}.zensbot.online` subdomain |
| Push notifications (FCM + APNs) | Enabled |
| Support | Email + in-app feedback |
| Custom domain | Not included (upgrade to Custom) |
| Own-brand app | Not included (upgrade to Custom) |

### Storage add-on packs

Monthly recurring. Institutes can activate any combination at any time from the admin billing dashboard.

| Pack | Price / month |
|---|---|
| +10 GB documents | Rs 1,000 |
| +50 GB video | Rs 3,000 |
| +100 GB video | Rs 5,000 |
| +500 GB video | Rs 20,000 |

- Packs stack additively (e.g., 3× `+10 GB docs` = +30 GB docs for Rs 3,000/mo).
- The +100 GB video pack is cheaper per GB than two +50 GB packs — the UI recommends the cheapest combination for the requested size.
- Cancelling a pack takes effect at the end of the current billing period. If the institute exceeds base + remaining packs afterward, uploads are blocked but existing content remains.

### Per-student overage pricing

- First 10 active students: **free**.
- Student #11 onward: **Rs 80 / month / student**.
- "Active" = `role=student`, `status=active`, `deleted_at IS NULL`.
- Count is a **snapshot on the 1st of each month** at 00:05 UTC. Mid-month changes flow into next month's invoice.
- Deactivating or soft-deleting a student before the 1st removes them from next month's count.
- Adding a student mid-month: added instantly, counted in the next snapshot.
- No proration, no credits for mid-month removals.

---

## Tier 2 — Custom

**Price:** Quoted per deal. Landing page anchor: **"From Rs 50,000 – Rs 500,000 / month"**.

**Tagline:** *"Enterprise-grade LMS, built around your institute."*

### Everything in Professional, plus:

#### Volume discount on per-student pricing

| Student range | Rate (default; negotiable per deal) |
|---|---|
| 1 – 500 | Rs 80 / student / month |
| 501 – 1,000 | Rs 50 / student / month |
| 1,001+ | Rs 40 / student / month |

Final rates are written into the deal and stored per institute. The billing engine reads the institute-specific tiered-rate table when computing invoices.

#### Infrastructure & support

- **Dedicated EC2 + RDS** (not shared with other tenants).
- **99.9% uptime SLA** with monthly uptime reports.
- **Priority support** via dedicated Slack or WhatsApp channel, same-day response during business hours.
- **On-premise deployment option** — self-hosted in the institute's own infrastructure with Zensbot providing installation, upgrades, and support.
- **Custom integrations** — bespoke hookups to SIS, ERP, payment gateways, identity providers.

#### Branding & distribution

- **Own iOS + Android app** — published on App Store and Play Store under the institute's developer account, with their name, icon, and description.
- **Custom domain** — full DNS ownership (`lms.schoolname.edu.pk`), not a `zensbot.online` subdomain.
- **Fully white-labeled** — no Zensbot branding visible in the app, web UI, emails, certificates, or anywhere a student or teacher interacts.

### Who qualifies for Custom

Typical Custom customers:
- Institutes with 500+ students needing the volume discount.
- Universities or corporate training programs requiring white-label app distribution.
- Customers with compliance/regulatory requirements demanding dedicated infra or on-prem deployment.
- Strategic partners needing deep integrations with their existing stack.

Inbound leads from the pricing page's "Talk to Sales" CTA are routed to Hassan directly.

---

## Billing mechanics

### Cycle

- **Monthly**, aligned to calendar month (Asia/Karachi timezone for business communication, UTC for system cron).
- Invoice generated **on the 1st of each month** at 00:05 UTC.
- Each invoice covers the upcoming month's active-student count + active storage add-ons.

### Student count snapshot

A single atomic query on the 1st of the month:

```
SELECT COUNT(*) FROM users
WHERE institute_id = :id
  AND role = 'student'
  AND status = 'active'
  AND deleted_at IS NULL
```

- No peak-count tracking. No prorated billing. No credits for mid-month removals.
- The number on the 1st is the billable count for that month.

### Invoice structure

| Line item | Formula |
|---|---|
| Base | Rs 0 (Professional) — plus negotiated base fee on Custom |
| Student overage | `max(0, snapshot_count − 10) × Rs 80` (Professional) |
| Student overage (Custom) | Tiered rates applied to `snapshot_count` using institute-specific rate table |
| Storage add-ons | Sum of active add-on unit prices × quantity |
| **Total (Rs)** | **Base + student overage + add-ons** |

### Payment rails (MVP)

- **Manual invoice + bank transfer / JazzCash / EasyPaisa**
- Invoice PDF emailed to institute admin on the 1st.
- Institute pays via bank transfer or wallet.
- Super admin verifies receipt and marks invoice `status=paid` in the super-admin billing dashboard.
- No Stripe, card-on-file, or auto-debit in v1. This will be revisited once transaction volume justifies the integration work.

### Late-payment escalation

| Days overdue | Consequence |
|---|---|
| 0 – 14 | Full access. Automated reminders on day 1, 7, and 14. |
| 15 – 29 | **Block new student adds and new content uploads.** Existing users keep full read + interact access. Banner shown in admin dashboard with pay-now instructions. |
| 30 – 59 | **Read-only mode.** Students can view existing lectures, materials, and certificates. No new activity — no quiz submissions, no zoom classes, no admin writes. |
| 60+ | **Archived.** Login blocked for all users. Data retained for 90 more days for recovery. After that, scheduled for deletion. |

Payment resets the state immediately.

---

## Grandfathering

Existing paying institutes — `ICT.ZENSBOT.ONLINE` and any other institute currently on `basic`, `pro`, or `enterprise` — **stay on their current tier at their current price indefinitely**.

- The existing `PlanTier` values (`free`, `starter`, `basic`, `pro`, `enterprise`) remain in the enum and `PLAN_LIMITS` dict.
- Grandfathered institutes are **not** billed via the new per-student / add-on engine.
- Their existing hard-caps on `max_students`, `max_storage_gb`, `max_video_gb` still apply.
- Their admin dashboard continues to show the old pricing UI.
- The 14-day `free` trial tier is **closed for new signups** but preserved for any institutes still mid-trial at launch time (they complete their trial, then either convert or expire).

### If a grandfathered institute wants to migrate to Professional

Super admin triggers a one-way migration from the super-admin dashboard:
1. Institute `plan_tier` changes from `basic`/`pro`/`enterprise` → `professional`.
2. All hard-caps removed; new billing engine begins snapshotting on the next 1st of the month.
3. Any unused credit from their last paid cycle is applied to their first new invoice.
4. Action is logged to `ActivityLog` with reason recorded.

Migration is **opt-in from the customer side** — Zensbot will not force-migrate anyone.

---

## What this model replaces

Prior model (see git history of `backend/app/utils/plan_limits.py` for the old values):

| Old tier | Students | Docs | Video | Monthly price |
|---|---|---|---|---|
| free (14-day trial) | 15 | 1 GB | 3 GB | — |
| starter | 50 | 3 GB | 15 GB | Rs 2,500 |
| basic | 250 | 10 GB | 75 GB | Rs 5,000 |
| pro | 1,000 | 50 GB | 300 GB | Rs 15,000 |
| enterprise | Unlimited | Unlimited | Unlimited | From Rs 50,000 |

Problems with the old model:
- Too many tiers, hard to explain.
- API keys, webhooks, AI tools, custom domain all locked behind paid tiers — frustrating for free-demo ad campaign prospects who want to evaluate the full product.
- 14-day trial creates a ticking-clock pressure that hurts conversion for slower institutional buying cycles.

---

## FAQ

**Q: Does the 10-student limit include inactive or deleted students?**
No. Only students with `status=active` and `deleted_at IS NULL` count. Deactivating a student immediately frees a slot.

**Q: What if we add a student on the 31st and remove them on the 2nd?**
You'll pay for them for one full month. The snapshot is taken on the 1st; whatever the count is at that moment is the bill.

**Q: Can we mix staff and students on the 10 free slots?**
No. Staff accounts (admin, teacher, course creator, admissions officer) are **always free and unlimited**. The 10-slot allowance is exclusively for students.

**Q: What happens if we go over 50 GB video and don't activate an add-on?**
New video uploads fail with a clear error: *"Your video storage is full. Activate a video add-on pack or remove existing lectures."* Existing lectures continue to play. Teachers can still record live Zoom classes but the recording won't be saved to Bunny until space is freed.

**Q: Can we downgrade from Custom to Professional?**
Yes. Super admin triggers the reverse migration. Volume-discount rates drop to flat Rs 80/student. Dedicated infra is decommissioned. Own-brand app is deprecated (the institute continues as a tenant in the shared Zensbot LMS app). Custom domain reverts to subdomain after 30-day DNS grace.

**Q: Do Professional institutes get support for the shared app?**
Yes. The shared "Zensbot LMS" app on App Store / Play Store is maintained by Zensbot. Professional institutes are tenants inside it, identified by subdomain login. Bug reports go through the standard in-app feedback channel.

**Q: Is there a cap on API call rate or webhook volume?**
Standard rate limits apply (same as the rest of the platform — 15/min login, 10/min refresh, standard REST limits per endpoint). No per-tier API quota — if a Professional institute needs higher API limits, that's a signal they should evaluate Custom.

---

## Related docs

- `backend/app/utils/plan_limits.py` — canonical code enforcement of tier limits.
- `backend/app/models/institute.py` — `PlanTier` enum + `Institute` / `InstituteUsage` tables.
- `backend/app/services/institute_service.py` — quota check + atomic increment logic.
- `backend/app/services/signup_service.py` — new-institute creation (to be updated to default to `professional`).
- `docs/DatabaseSchema.md` — schema reference (to be updated after new billing tables land).
- `docs/Features.md` — feature list (to be updated for the 2-tier rollout).
