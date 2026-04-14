# Frappe / ERPNext Integration

Two-way sync between the LMS and your Frappe/ERPNext instance for fees and
payments. **v1 scope is accounting only** — `Sales Invoice` + `Payment Entry`.
Student, course, and enrollment sync is on the roadmap but not in v1.

## How it works

```
┌────────────────┐      fee.plan_created          ┌────────────────┐
│                │  ──────────────────────────▶   │                │
│  Zensbot LMS   │      fee.payment_recorded      │   Your ERPNext │
│                │  ──────────────────────────▶   │                │
│                │                                 │                │
│                │  ◀──── X-Frappe-Signature ──── │                │
│                │     (Payment Entry:after_insert)│                │
└────────────────┘                                 └────────────────┘
         ▲                                                  │
         │   Sync health dashboard + retries                │
         └──────────────────────────────────────────────────┘
```

**Who does what:**
- **LMS → Frappe (outbound):** LMS pushes a Sales Invoice when a fee plan is
  created, and a Payment Entry (allocated against the invoice) when a payment
  is recorded in the LMS.
- **Frappe → LMS (inbound):** When an accountant records a Payment Entry
  directly in Frappe (bank reconciliation, offline cash from ledger),
  Frappe fires a webhook to the LMS and the matching installment flips to
  *paid*.
- **Conflict rule:** LMS wins on payment status. If an installment is already
  `paid` in LMS, the inbound Frappe event is rejected with `409 Conflict`.

## Prerequisites

1. **Frappe/ERPNext v14+** with the "Accounting" module enabled.
2. A dedicated API user in Frappe with permission on `Sales Invoice`,
   `Payment Entry`, `Customer`. Generate an **API key + secret** under
   *User > API Access*.
3. Install the [Zensbot LMS Connector](../../zensbot_lms_connector/) Frappe
   app (or recreate its 3 custom fields + 1 webhook manually — see below).

## Step 1 — Install the reference connector app

```bash
# On your Frappe bench server
cd ~/frappe-bench
bench get-app https://github.com/zensbot/zensbot_lms_connector
bench --site your-site install-app zensbot_lms_connector
```

This adds:
- Custom field `zensbot_fee_plan_id` on `Sales Invoice` + `Payment Entry`
- Custom field `zensbot_payment_id` on `Payment Entry`
- Pre-configured Webhook on `Payment Entry / after_insert` (you'll set the
  URL + secret in step 3)

If you can't install the app (air-gapped, restricted Frappe install, etc.),
add the same 3 custom fields and 1 webhook manually — the fixture files in
`zensbot_lms_connector/fixtures/` document the exact configuration.

## Step 2 — Connect the LMS to Frappe

1. Log in to the LMS as an **Institute Admin**.
2. Go to **Integrations** in the sidebar.
3. Fill in:
   - **Frappe URL** — your ERPNext base URL (HTTPS required, e.g.
     `https://erp.yourinstitute.com`)
   - **API Key** + **API Secret** — from step 2 above
   - **Income Account** — GL account for fee revenue (e.g. `4100 - Fee Income`)
   - **Receivable Account** — debtors account (e.g. `1310 - Sundry Debtors`)
   - **Mode of Payment** — default `Cash` or `Bank Transfer`
   - **Company** — your Frappe company name (e.g. `Your Institute Pvt Ltd`)
4. Click **Test Connection**. A green checkmark = ready.
5. Toggle **Enable sync** and save.

> **Note:** The LMS refuses to enable sync until the URL, both secrets,
> Income Account, Receivable Account, Mode of Payment, and Company are
> all set. This prevents half-configured deployments.

## Step 3 — Wire up the inbound webhook

The LMS generates a per-institute inbound secret. In the LMS integrations
page:

1. Click **Generate inbound secret**. You'll see the secret **once** —
   copy it immediately.
2. In Frappe, open the Webhook record created by the connector app (or
   create one on `Payment Entry / after_insert`) and set:
   - **Request URL:** `https://apiict.zensbot.site/api/v1/integrations/frappe/webhook?institute_id=<your-institute-uuid>`
   - **Request Headers:**
     - `X-Frappe-Signature: <HMAC-SHA256 of raw body with the secret you copied>`
   - **Request Body:** `{"doc": {{ doc_as_dict }}}`

   Frappe calculates the HMAC via a server script. A reference snippet is in
   `zensbot_lms_connector/hooks/webhook_signature.py`.

## What events sync

| LMS event | Frappe action | Notes |
|-----------|---------------|-------|
| `fee.plan_created` | Create Sales Invoice | Customer = student name. Custom field `zensbot_fee_plan_id` = LMS fee plan UUID. |
| `fee.payment_recorded` | Create Payment Entry | Allocated against the matching Sales Invoice (lookup via `zensbot_fee_plan_id`). |
| `fee.plan_cancelled` | Cancel Sales Invoice | Sets `docstatus=2` on the invoice. |
| `fee.plan_completed` | No-op in Frappe | Informational only. |
| `fee.installment_overdue` | No-op in Frappe | Fires as a webhook event you can subscribe to separately. |
| `payment_entry.after_insert` (in Frappe) | LMS installment → paid | Respects the LMS-wins rule — already-paid installments return 409. |

## Retries and failures

Every outbound call that fails is retried with exponential backoff:
**1 min → 5 min → 30 min → 2 h → 12 h** (6 total attempts). After all
attempts fail, the sync log row is marked `failed` and the admin sees it
in the **Sync Health** dashboard where they can manually retry.

Inbound events are not retried by the LMS — if the LMS returns non-2xx,
Frappe's own webhook retry policy applies (configure in Frappe).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Test connection fails with "HTTP 403" | API user lacks permission on `Sales Invoice`. Assign the **Accounts Manager** role in Frappe. |
| Sales Invoice created with wrong GL account | Update the **Income Account** / **Receivable Account** defaults in the LMS Integrations page; new events will use the new defaults. |
| "Customer not found" in Frappe error | Create the Customer record in Frappe first (auto-create coming in v1.1). |
| Inbound webhook returns 401 | Signature mismatch. Rotate the inbound secret and update the Frappe webhook header. |
| Inbound webhook returns 409 | LMS already has that installment marked paid. Expected — no action needed. |
| Duplicate invoices in Frappe | Check that the `zensbot_fee_plan_id` custom field is present on Sales Invoice. Idempotency depends on it. |

## Security

- Frappe credentials are Fernet-encrypted at rest in the LMS database.
- Inbound secret is never returned by any read endpoint — only shown once on
  rotation.
- The LMS rejects `frappe_base_url` values pointing to private networks
  (`10.*`, `192.168.*`, `169.254.*`, etc.) to prevent SSRF.
- See [`security.md`](./security.md) for the full checklist.

## Roadmap (not in v1)

- Student + Guardian sync (ERPNext Education module)
- Course / Program / Student Group sync
- Bulk initial load (today: use the LMS [bulk CSV import](./bulk-import.md))
- OAuth2 authorization flow (today: API key paste)
- Waive-installment two-way sync
