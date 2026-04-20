# Sales Order Onboarding — Operations Runbook

When the `zensbot_lms_connector` Frappe app is upgraded to ship Sales Order custom fields, every institute running it must re-install to pick up the new schema.

## Reinstall connector in a Frappe site

```bash
# SSH to the Frappe server
bench --site <site-name> migrate

# Verify the 3 new Sales Order custom fields exist
bench --site <site-name> console
>>> import frappe
>>> frappe.get_all("Custom Field",
...     filters={"dt": "Sales Order"},
...     fields=["name", "fieldname", "fieldtype"])
```

Expected after migrate:

| name | fieldname | fieldtype |
|------|-----------|-----------|
| Sales Order-zensbot_fee_plan_id | zensbot_fee_plan_id | Data |
| Sales Order-zensbot_payment_id | zensbot_payment_id | Data |
| Sales Order-zensbot_payment_proof_url | zensbot_payment_proof_url | Long Text |

## LMS side

Nothing to redeploy separately — these field names are consumed by `FrappeClient.submit_sales_order` which is added in Phase 5 of the plan.

## Troubleshooting

- **Field missing after migrate** — check `bench --site <site> list-apps` includes `zensbot_lms_connector`. If not, install it: `bench --site <site> install-app zensbot_lms_connector`.
- **Existing Sales Orders don't show the new fields** — Frappe auto-backfills custom fields on existing rows during migrate. If you see NULL, it's just unset; the Sync will populate going forward.
- **Upgrade on production** — run during low-traffic window; migrate is non-breaking but holds a short DDL lock on the Sales Order table.
