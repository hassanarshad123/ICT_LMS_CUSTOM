"""Build the PayFast hosted-checkout POST payload.

Field names and casing confirmed from PayFast's official ``payment.php`` sample
(Merchant Integration Guide 2.3, Apr 2026).

Returned dict is used to render a self-submitting HTML form that redirects the
user to PayFast's hosted checkout page. See ``CheckoutRedirect`` for the
structure the router returns to the frontend.

LMS unit note: ``Invoice.total_amount`` is stored as **int PKR rupees**
(confirmed in ``backend/app/services/billing_calc.py`` — all fields suffixed
``_pkr``). PayFast's ``TXNAMT`` expects a 2-decimal major-unit string, so we
format ``total_amount`` directly without any paisa conversion.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.billing import Invoice
    from app.models.user import User


VERSION = "MERCHANTCART-0.1"
TRAN_TYPE = "ECOMM_PURCHASE"
PROCCODE = "00"


def _pkr_rupees_to_major_string(amount_pkr: int) -> str:
    """Format an integer PKR amount as ``"N.00"`` for PayFast's ``TXNAMT``.

    Example: ``1500`` -> ``"1500.00"``.
    """
    return f"{amount_pkr:.2f}"


def _build_signature(basket_id: str) -> str:
    """Build the SIGNATURE field.

    PayFast's sample uses ``'SOMERANDOM-STRING'`` — it's a merchant-chosen
    correlation tag. We concatenate 12 hex chars + ``-`` + basket_id so our
    own traffic is identifiable in logs.
    """
    return f"{secrets.token_hex(6)}-{basket_id}"


def build_checkout_payload(
    *,
    invoice: Invoice,
    admin: User,
    token: str,
    return_url: str,
    cancel_url: str,
    checkout_url: str,
    merchant_id: str,
    merchant_name: str,
) -> dict[str, str]:
    """Build the POST payload dict for PayFast's hosted-checkout redirect.

    Args:
        invoice:       The ``Invoice`` the admin is paying (basket_id + amount).
        admin:         The ``User`` initiating the checkout (email + phone).
        token:         One-time access token from ``get_access_token()``.
        return_url:    Browser lands here on success (UX only; non-authoritative).
        cancel_url:    Browser lands here on cancellation.
        checkout_url:  IPN callback URL (PayFast -> backend, authoritative).
        merchant_id:   PayFast merchant id (``settings.PAYFAST_MERCHANT_ID``).
        merchant_name: Display name shown on PayFast checkout header.

    Fields (from payment.php):
      CURRENCY_CODE, MERCHANT_ID, MERCHANT_NAME, TOKEN, BASKET_ID, TXNAMT,
      ORDER_DATE ("YYYY-MM-DD HH:MM:SS" UTC), SUCCESS_URL, FAILURE_URL,
      CHECKOUT_URL (IPN endpoint), CUSTOMER_EMAIL_ADDRESS, CUSTOMER_MOBILE_NO,
      SIGNATURE, VERSION="MERCHANTCART-0.1", TXNDESC, PROCCODE="00",
      TRAN_TYPE="ECOMM_PURCHASE", STORE_ID="", RECURRING_TXN="" (no MIT support).
    """
    order_date = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    basket_id = str(invoice.basket_id)

    return {
        "CURRENCY_CODE": "PKR",
        "MERCHANT_ID": merchant_id,
        "MERCHANT_NAME": merchant_name,
        "TOKEN": token,
        "BASKET_ID": basket_id,
        "TXNAMT": _pkr_rupees_to_major_string(invoice.total_amount),
        "ORDER_DATE": order_date,
        "SUCCESS_URL": return_url,
        "FAILURE_URL": cancel_url,
        "CHECKOUT_URL": checkout_url,
        "CUSTOMER_EMAIL_ADDRESS": admin.email,
        "CUSTOMER_MOBILE_NO": admin.phone or "",
        "SIGNATURE": _build_signature(basket_id),
        "VERSION": VERSION,
        "TXNDESC": f"Invoice {invoice.invoice_number}",
        "PROCCODE": PROCCODE,
        "TRAN_TYPE": TRAN_TYPE,
        "STORE_ID": "",
        "RECURRING_TXN": "",
    }
