"""Reference HMAC-SHA256 signer for the Payment Entry → Zensbot LMS webhook.

Install as a Frappe server script (Settings → Server Script) OR register as
a hook in ``hooks.py`` and reference from the Webhook header via
``{{ frappe.get_hooks('zensbot_sign') }}``.

Usage from within a Frappe Server Script:

    from zensbot_lms_connector.hooks.webhook_signature import sign

    secret = frappe.db.get_single_value("Zensbot LMS Settings", "inbound_secret")
    payload_json = frappe.as_json({"doc": doc.as_dict()})
    signature = sign(secret, payload_json)

The LMS verifies HMAC-SHA256 of the **raw request body**, so the signer
must sign the exact bytes Frappe will transmit.
"""
from __future__ import annotations

import hashlib
import hmac


def sign(secret: str, raw_body: str | bytes) -> str:
    """Return the hex-encoded HMAC-SHA256 of ``raw_body`` using ``secret``."""
    if isinstance(raw_body, str):
        raw_body = raw_body.encode()
    return hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
