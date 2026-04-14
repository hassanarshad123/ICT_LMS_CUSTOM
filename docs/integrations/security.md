# Integration Security Guidelines

Checklist for anyone building against the LMS.

## Storing API keys

- **Never** commit API keys to version control.
- Use your system's secret manager (Vault, AWS Secrets Manager, 1Password
  Connect, etc.).
- Rotate keys at least every 6 months, or immediately if you suspect
  exposure.

## Verifying webhook signatures

Every webhook delivery carries `X-Webhook-Timestamp` + `X-Webhook-Signature`.

**Always** verify:
1. Signature matches (HMAC-SHA256 of `"<timestamp>.<raw body>"` with your
   endpoint's secret).
2. Timestamp is within 5 minutes of now (prevents replay attacks).

Python example in [`webhook-events.md`](./webhook-events.md).

## Verifying inbound Frappe webhooks

The LMS verifies the `X-Frappe-Signature` header using the per-institute
inbound secret (HMAC-SHA256 of the raw request body).

When you rotate the secret in the LMS, update **every** Frappe Webhook
record that uses it — there's no grace period.

## Network posture

- All LMS endpoints are **HTTPS only**. Plaintext HTTP is refused.
- The LMS will not talk to private/link-local IPs for outbound Frappe sync
  (`10.*`, `192.168.*`, `169.254.*`, `172.16-31.*`, `127.*` except localhost
  in dev). This prevents SSRF attacks via a spoofed Frappe URL.
- IP allowlisting: if your network requires it, contact us to get the EC2
  egress IP.

## Minimising permission scope

- Create a **dedicated Frappe user** for the LMS integration. Don't reuse
  an admin's credentials.
- Grant only the roles the integration needs: `Accounts Manager` (for
  Sales Invoice + Payment Entry) and `Customer` read. Avoid `System Manager`.
- On the LMS side, API keys default to `read` scope. Only grant `write`
  when you actually POST/PATCH/DELETE.

## Handling PII

The LMS sends student name + email in fee-related webhook payloads (for
customer matching in Frappe). If your receiver logs requests:
- Redact name/email from long-term logs (keep only IDs).
- Respect your local data-protection regime (GDPR, CCPA, PDPA, etc.).

## Incident response

If you believe a credential leaked:
1. **Immediately** revoke the API key in the LMS admin UI.
2. Rotate the Frappe API key + secret in the LMS integrations page.
3. Rotate the inbound webhook secret.
4. Review the **Sync Health** dashboard for suspicious calls in the last
   24 hours.
5. Contact support@zensbot.com with timestamps so we can cross-check server
   logs.

## Audit log

Every credential change (enable/disable sync, rotate secret, update
defaults) emits an `ActivityLog` row visible to the institute admin.
Super-admin-side audit is retained for 12 months.
