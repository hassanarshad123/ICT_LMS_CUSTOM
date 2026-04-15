/**
 * Map raw Frappe/LMS sync error strings to plain-English messages with
 * remediation hints. Used by the Sync Health dashboard so non-technical
 * admins can act on failures without opening a support ticket.
 *
 * Design: each rule matches on a substring of the raw error message
 * (case-insensitive). First match wins. Unmatched errors fall back to the
 * original message so we never hide information.
 */

export interface TranslatedError {
  friendly: string;
  hint: string | null;
  severity: 'info' | 'warning' | 'error';
}

interface Rule {
  match: RegExp;
  friendly: string;
  hint: string | null;
  severity: 'info' | 'warning' | 'error';
}

const RULES: Rule[] = [
  {
    match: /customer.*not.*found|linkvalidationerror.*customer/i,
    friendly: 'Customer missing in Frappe',
    hint: "Frappe doesn't have this student's Customer record yet. Turn on auto-create Customers in the setup wizard, or add the Customer manually in Frappe.",
    severity: 'warning',
  },
  {
    match: /account.*not.*found|accountnotfound|does not exist.*account/i,
    friendly: 'GL account name mismatch',
    hint: "One of your Income / Receivable / Bank account names doesn't match Frappe exactly. Re-check the account defaults in the Integrations page.",
    severity: 'error',
  },
  {
    match: /installment already paid|lms wins|already paid|409/i,
    friendly: 'Payment already recorded in LMS',
    hint: 'Safe to ignore — the LMS already has this installment marked paid, so the inbound Frappe event was rejected by the LMS-wins rule.',
    severity: 'info',
  },
  {
    match: /invalid signature|signature mismatch/i,
    friendly: 'Webhook signature mismatch',
    hint: "Frappe's webhook signature doesn't match the LMS inbound secret. Rotate the secret here and paste the new value into the Frappe Webhook record.",
    severity: 'error',
  },
  {
    match: /missing.*x-frappe-signature|missing x-frappe-webhook-signature/i,
    friendly: 'Webhook security not enabled in Frappe',
    hint: 'Open the Frappe Webhook record, check "Enable Security", paste the inbound secret, and save.',
    severity: 'error',
  },
  {
    match: /missing.*custom_zensbot|zensbot_fee_plan_id|unknown field/i,
    friendly: 'LMS custom fields missing in Frappe',
    hint: 'Install the LMS custom fields (custom_zensbot_fee_plan_id, custom_zensbot_payment_id) via the setup wizard or manually in Frappe.',
    severity: 'error',
  },
  {
    match: /integration not configured/i,
    friendly: 'Webhook URL is pointing to the wrong institute',
    hint: "The institute_id in the Frappe Webhook's Request URL doesn't match this tenant. Copy the exact webhook URL from the Integrations page and paste it into Frappe.",
    severity: 'error',
  },
  {
    match: /timeout|timed out/i,
    friendly: 'Frappe server unreachable (timeout)',
    hint: 'Check that your ERPNext is online and reachable from the public internet. A private-network URL (10.x, 192.168.x) will not work.',
    severity: 'error',
  },
  {
    match: /401|unauthorized|invalid token/i,
    friendly: 'Frappe API credentials rejected',
    hint: 'Re-generate the API key + secret on the Frappe side for the LMS sync user and paste them back into the Integrations page.',
    severity: 'error',
  },
  {
    match: /403|forbidden/i,
    friendly: 'Frappe API user lacks permission',
    hint: 'Assign the Accounts Manager role (or a role with write access to Sales Invoice, Payment Entry, and Customer) to your Frappe LMS sync user.',
    severity: 'error',
  },
  {
    match: /mandatory.*missing|required field/i,
    friendly: 'Required Frappe field was empty',
    hint: 'Frappe rejected the document because a mandatory field was empty. Check the Mode of Payment, Company, and Cost Center defaults.',
    severity: 'error',
  },
  {
    match: /ssl|certificate/i,
    friendly: 'SSL / certificate problem reaching Frappe',
    hint: 'Your Frappe URL is not reachable over HTTPS with a valid certificate. Use a public domain with Let\'s Encrypt or similar, not a self-signed cert.',
    severity: 'error',
  },
];

export function translateError(raw: string | null | undefined): TranslatedError {
  if (!raw) {
    return { friendly: '—', hint: null, severity: 'info' };
  }
  for (const rule of RULES) {
    if (rule.match.test(raw)) {
      return { friendly: rule.friendly, hint: rule.hint, severity: rule.severity };
    }
  }
  return { friendly: raw, hint: null, severity: 'error' };
}
