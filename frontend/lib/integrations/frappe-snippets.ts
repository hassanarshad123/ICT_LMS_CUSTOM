/**
 * Generates copy-paste snippets for Frappe admins configuring the webhook
 * by hand (without the Zensbot connector app and without the auto-setup
 * wizard). Used in the "Advanced" section of the Integrations page.
 *
 * Target audience: Frappe sysadmins who want to add the HMAC header via
 * a Server Script on the Webhook doctype instead of using Frappe's native
 * enable_security flag.
 */

export function getHmacServerScript(secret: string): string {
  if (!secret || secret.length < 16) {
    return '// Generate the inbound webhook secret first, then refresh this page.';
  }
  // Escape single quotes in the secret so the Python string literal stays valid.
  const safe = secret.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `# Frappe Webhook → Server Script
# DocType: Webhook, Script Type: Webhook
# Paste this into the Webhook's "Before Send Script" field.
import hmac, hashlib

SECRET = '${safe}'
body = (doc_json or '').encode('utf-8')
sig = hmac.new(SECRET.encode('utf-8'), body, hashlib.sha256).hexdigest()

# Inject the X-Frappe-Signature header on this request
request_headers = request_headers or {}
request_headers['X-Frappe-Signature'] = sig
`;
}

export function getCustomFieldFixture(): string {
  return `// Frappe Customize Form → add these fields manually if you can't
// run bench commands. DocType order: Sales Invoice, Payment Entry.

1. Sales Invoice
   - Label: Zensbot Fee Plan ID
   - Type: Data
   - Insert After: amended_from
   - Fieldname (auto): custom_zensbot_fee_plan_id

2. Payment Entry
   - Label: Zensbot Fee Plan ID
   - Type: Data
   - Insert After: amended_from
   - Fieldname (auto): custom_zensbot_fee_plan_id

3. Payment Entry
   - Label: Zensbot Payment ID
   - Type: Data
   - Insert After: custom_zensbot_fee_plan_id
   - Fieldname (auto): custom_zensbot_payment_id
`;
}
