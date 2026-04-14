# Pilot Institute Onboarding Checklist

Step-by-step for enabling your first pilot institute on the Frappe/ERPNext integration.

**Goal:** prove the integration works end-to-end on a real institute's live Frappe instance before opening self-service.

**Expected total time:** ~90 minutes of joint work with the institute, then 14 days of low-effort observation.

---

## Pre-call (async, ~30 minutes)

- [ ] **Pick the pilot institute.** Criteria:
  - Already using Frappe/ERPNext with the Accounting module
  - Has a Frappe admin / developer you can coordinate with
  - Low fee volume (< 50 transactions/day) so any issues have low blast radius
  - Understands this is a pilot — occasional manual reconciliation may be needed

- [ ] **Send them the prerequisite doc:** [`frappe.md`](./frappe.md). Specifically:
  - Frappe v14+ required
  - They need to create a dedicated API user with Accounts Manager + Customer read roles
  - They need to generate an API key + secret from that user's profile

- [ ] **Share the reference connector app:** point them at `zensbot_lms_connector/` (or the public GitHub repo once published). Ask them to install it OR manually add the 3 custom fields documented there.

- [ ] **Confirm the Frappe URL is HTTPS** and publicly reachable. The LMS rejects private IPs.

---

## Joint call (~60 minutes)

### Part 1 — LMS side (15 min)

- [ ] **Log in** to the LMS as an **Institute Admin** (not just course creator).

- [ ] **Navigate to Integrations → Frappe / ERPNext** tab.

- [ ] **Paste Frappe credentials:**
  - Frappe URL (e.g. `https://erp.theirinstitute.com`)
  - API Key
  - API Secret
  - Income Account (e.g. `4100 - Fee Income - ABC`)
  - Receivable Account (e.g. `1310 - Sundry Debtors - ABC`)
  - Mode of Payment (e.g. `Bank Transfer`)
  - Company (exact Frappe company name)

- [ ] **Click "Test Connection"** → expect green "Connected as <frappe-user> (<latency>ms)".

  If it fails:
  - "HTTP 403" → API user lacks permissions in Frappe
  - "HTTP 401" → API key/secret wrong
  - "Connection timed out" → Frappe URL unreachable from the EC2 egress IP
  - "targets a private network" → they gave us a non-public URL

- [ ] **Toggle "Enabled"** and click **Save changes**.

  Expect: HTTP 200. If it refuses with "Cannot enable Frappe sync until..." → fill the missing account defaults.

### Part 2 — Frappe side (30 min)

- [ ] **Click "Generate inbound secret"** in the LMS admin UI. Copy the displayed secret **immediately** — it won't show again.

- [ ] **In Frappe, create a Webhook record** (`Settings → Integrations → Webhook`):
  - **DocType:** Payment Entry
  - **Doc Event:** After Insert
  - **Condition:** `doc.docstatus == 1` (only posted payments)
  - **Request URL:** `https://apiict.zensbot.site/api/v1/integrations/frappe/webhook?institute_id=<their-institute-uuid>`
  - **Request Structure:** JSON
  - **Request Body:** `{"doc": {{ doc_as_dict }}}`
  - **Custom Header:** `X-Frappe-Signature` = HMAC-SHA256 of the raw request body, signed with the inbound secret

  The signature has to be computed by a Frappe Server Script — reference code lives at `zensbot_lms_connector/zensbot_lms_connector/hooks/webhook_signature.py`. If their Frappe dev has trouble wiring this, point them at that file.

- [ ] **Save the webhook.**

### Part 3 — End-to-end verification (15 min)

- [ ] **Test outbound** (LMS → Frappe):
  1. In LMS, onboard a test student via Admissions → New Student (use a fake name like "Pilot Test Student 001")
  2. Wait 30-60 seconds (the scheduler polls every 30s)
  3. In Frappe, go to Accounting → Sales Invoice list → expect to see a new invoice for "Pilot Test Student 001"
  4. Verify the custom field `zensbot_fee_plan_id` is populated
  5. In the LMS Integrations → Sync Health tab, verify a "success" row for `fee.plan_created → sales_invoice`

- [ ] **Test outbound payment** (LMS → Frappe):
  1. Back in LMS Admissions, record a payment for the test student (any amount)
  2. Wait 30-60 seconds
  3. In Frappe, check Accounting → Payment Entry list → expect a new Payment Entry allocated against the invoice
  4. Verify the LMS sync log shows `fee.payment_recorded → payment_entry` as success

- [ ] **Test inbound** (Frappe → LMS):
  1. In Frappe, create a second Payment Entry directly (e.g. bank reconciliation against the same invoice) for a new/different installment if possible
  2. Save & submit
  3. The Frappe webhook fires → hits the LMS inbound endpoint
  4. Within seconds, the LMS installment should flip to `paid` with a new receipt number
  5. Verify in the LMS Sync Log → inbound → success

- [ ] **Test conflict rejection** (LMS-wins rule):
  1. Try to send the same Frappe Payment Entry webhook twice (use a webhook replay tool, or just resubmit the Frappe doc)
  2. First delivery: success
  3. Second delivery: LMS returns HTTP 202 with `{"status": "duplicate"}` — payment is NOT double-counted

- [ ] **Clean up the test student** in the LMS — soft-delete. Verify the Sales Invoice is cancelled in Frappe within 60s.

---

## Post-enable 14-day watch window

**Daily (2 minutes):**
- [ ] Open LMS Integrations → Sync Health tab
- [ ] Check KPIs: success rate ≥99%, failures 24h < 5, pending retries < 3
- [ ] Scan failed rows — if any, click "Retry" or investigate the error

**Weekly (10 minutes):**
- [ ] Reconciliation spot-check: pick 10 random LMS payments this week, confirm matching Payment Entries in Frappe
- [ ] Pick 5 Frappe-side Payment Entries this week, confirm matching LMS receipts

**On any Sentry alert for `integration_sync_log.status=failed` > 5%:**
- [ ] Check `docs/integrations/ROLLBACK.md` → Step C (disable sync for this institute only)
- [ ] Coordinate with institute's Frappe admin on root cause
- [ ] Re-enable after fix

---

## Escalation triggers

**Page the on-call engineer if:**
- Sync success rate drops below 95% for > 1 hour
- Inbound webhook 5xx rate > 10%
- Any LMS-side 500 in the `integrations` router
- Duplicate Payment Entries in Frappe for the same LMS payment (idempotency failure)

**Handle in the next business day if:**
- Occasional retry (Frappe timeout, network blip)
- Single-row failure with a clear user-fixable cause (e.g. "Customer not found in Frappe")
- Institute admin needs help reading the Sync Health dashboard

---

## Exit criteria for General Availability

After 14 consecutive days on the pilot institute with:
- Sync success rate ≥99%
- Zero LMS-side 500 errors from the integration routes
- Zero duplicate payments in Frappe
- Zero regressions in the pilot institute's existing admissions/fees/lectures flows
- Institute admin comfortable operating the Sync Health dashboard unassisted

…you can open self-service enable for all institutes (no code change — just announce it).

---

## Reference

- Operator deploy: [`DEPLOY.md`](./DEPLOY.md)
- Rollback procedures: [`ROLLBACK.md`](./ROLLBACK.md)
- Frappe integration spec: [`frappe.md`](./frappe.md)
- Security model: [`security.md`](./security.md)
