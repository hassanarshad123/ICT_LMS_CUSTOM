"""PayFast payment gateway integration.

Primitives ported from kamilzafar/payfast-nextjs-fastapi-starter and adapted
for the ICT LMS SaaS billing surface (admin -> Zensbot invoice payments).

Public exports:
    get_access_token      — fetch a one-time PayFast token (client.py)
    build_checkout_payload — build hosted-checkout form fields (payload.py)
    compute_validation_hash, verify_ipn — IPN signature (signature.py)
    PayFastError, PayFastAuthError, PayFastSignatureError — exceptions
    AccessToken, CheckoutRedirect, IpnPayload — typed responses
    SUCCESS_ERR_CODE, TOKEN_PATH, POST_TRANSACTION_PATH, DEFAULT_TIMEOUT — constants
"""
from app.services.payfast.client import get_access_token
from app.services.payfast.constants import (
    DEFAULT_TIMEOUT,
    POST_TRANSACTION_PATH,
    SUCCESS_ERR_CODE,
    TOKEN_PATH,
)
from app.services.payfast.exceptions import (
    PayFastAuthError,
    PayFastError,
    PayFastSignatureError,
)
from app.services.payfast.payload import build_checkout_payload
from app.services.payfast.signature import compute_validation_hash, verify_ipn
from app.services.payfast.types import AccessToken, CheckoutRedirect, IpnPayload

__all__ = [
    "get_access_token",
    "build_checkout_payload",
    "compute_validation_hash",
    "verify_ipn",
    "PayFastError",
    "PayFastAuthError",
    "PayFastSignatureError",
    "AccessToken",
    "CheckoutRedirect",
    "IpnPayload",
    "SUCCESS_ERR_CODE",
    "TOKEN_PATH",
    "POST_TRANSACTION_PATH",
    "DEFAULT_TIMEOUT",
]
