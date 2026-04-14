# Zensbot LMS Connector (Frappe/ERPNext)

**Open-source reference Frappe app** that wires ERPNext to the Zensbot LMS.
Mirrors LMS fees and payments into your accounting books automatically.

MIT licensed. Provided as-is — we do not maintain this long-term as a
supported product. Fork it, adapt it, vendor it into your own Frappe app.

## What it does

Adds the minimum Frappe customizations needed for the LMS integration:
- Custom field `zensbot_fee_plan_id` on `Sales Invoice` and `Payment Entry`
- Custom field `zensbot_payment_id` on `Payment Entry`
- Pre-configured Webhook on `Payment Entry / after_insert` (you supply the
  URL + secret)

Once installed, the LMS's admin Integrations page does all the work from
the other side.

## Install

```bash
cd ~/frappe-bench
bench get-app https://github.com/zensbot/zensbot_lms_connector
bench --site your-site install-app zensbot_lms_connector
bench --site your-site migrate
```

## Uninstall

```bash
bench --site your-site uninstall-app zensbot_lms_connector
```

Removes the custom fields and the webhook record.

## Configure

Follow [`docs/integrations/frappe.md`](../docs/integrations/frappe.md) in
the main LMS repo.

## Files

| File | Purpose |
|------|---------|
| `zensbot_lms_connector/hooks.py` | App manifest + fixtures registration |
| `zensbot_lms_connector/fixtures/custom_field.json` | 3 custom fields |
| `zensbot_lms_connector/fixtures/webhook.json` | Template Payment Entry webhook |
| `zensbot_lms_connector/hooks/webhook_signature.py` | Reference HMAC signing helper |

## Not a production app

This scaffolding is a reference implementation, not a production product.
It has:
- No automated tests
- No published PyPI / Frappe Marketplace release
- No backward-compatibility guarantees

If you need a polished, supported Frappe app, build one on top of this
scaffold.
