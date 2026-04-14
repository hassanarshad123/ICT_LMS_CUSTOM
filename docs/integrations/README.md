# Integrations — Public Developer Docs

This folder is the public contract between the LMS and any external system
(Frappe/ERPNext, Zoho, Odoo, custom in-house software).

If you're an institute's developer wiring the LMS to your accounting or CRM,
this is your starting point.

| File | Read when |
|------|-----------|
| [`frappe.md`](./frappe.md) | You run Frappe/ERPNext and want to mirror LMS fees/payments into your books. |
| [`api-reference.md`](./api-reference.md) | You want to call the LMS REST API directly from any system. |
| [`webhook-events.md`](./webhook-events.md) | You want the LMS to push real-time events to your server. |
| [`security.md`](./security.md) | Before you go live — HMAC verification, key rotation, SSRF protection. |
| [`bulk-import.md`](./bulk-import.md) | You're migrating 100+ existing records (students / fees / payments). |

## Quick start — which integration do I want?

- **Push LMS events to my system** → [webhook-events.md](./webhook-events.md)
- **Pull data from LMS on demand** → [api-reference.md](./api-reference.md)
- **Auto-sync fees into my Frappe books** → [frappe.md](./frappe.md)
- **Load existing institute data in bulk** → [bulk-import.md](./bulk-import.md)

## Support tiers

- **Public API + webhooks:** fully supported, SLA'd, versioned under `/api/v1/*`
- **Frappe reference app:** open-source, MIT licensed, provided as-is — we publish reference code at `zensbot_lms_connector/` in this repo. Fork and adapt.
- **Bespoke ERP connectors (Zoho, Odoo, SAP):** not built. Use the public API + webhooks to write your own.
