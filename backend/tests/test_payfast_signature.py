"""Tests for PayFast IPN signature verification.

These are pure unit tests — no DB, no network, no FastAPI. They run in the
default ``pytest tests/`` collection without any external dependencies.

Reference: PayFast Merchant IPN Integration Document (Apr 2026).
Docs example verbatim:
    "BAS-01|jdnkaabcks|102|000"
    -> e8192a7554dd699975adf39619c703a492392edf5e416a61e183866ecdf6a2a2
"""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.payfast.signature import (  # noqa: E402
    compute_validation_hash,
    verify_ipn,
)


DOCS_EXAMPLE_HASH = (
    "e8192a7554dd699975adf39619c703a492392edf5e416a61e183866ecdf6a2a2"
)


def test_compute_validation_hash_matches_payfast_docs_example():
    """The one fixed-point check — if this breaks, our hash is wrong everywhere."""
    result = compute_validation_hash(
        basket_id="BAS-01",
        secured_key="jdnkaabcks",
        merchant_id="102",
        err_code="000",
    )
    assert result == DOCS_EXAMPLE_HASH


def test_compute_validation_hash_is_deterministic():
    a = compute_validation_hash("b1", "k", "m", "000")
    b = compute_validation_hash("b1", "k", "m", "000")
    assert a == b


def test_compute_validation_hash_changes_with_any_field():
    base = compute_validation_hash("b1", "k", "m", "000")
    assert base != compute_validation_hash("b2", "k", "m", "000")
    assert base != compute_validation_hash("b1", "k2", "m", "000")
    assert base != compute_validation_hash("b1", "k", "m2", "000")
    assert base != compute_validation_hash("b1", "k", "m", "001")


def test_verify_ipn_returns_true_for_valid_payload():
    payload = {
        "basket_id": "BAS-01",
        "err_code": "000",
        "validation_hash": DOCS_EXAMPLE_HASH,
    }
    assert verify_ipn(payload, secured_key="jdnkaabcks", merchant_id="102") is True


def test_verify_ipn_accepts_uppercase_hash_from_gateway():
    """PayFast sometimes sends the hash in uppercase; we lowercase before compare."""
    payload = {
        "basket_id": "BAS-01",
        "err_code": "000",
        "validation_hash": DOCS_EXAMPLE_HASH.upper(),
    }
    assert verify_ipn(payload, secured_key="jdnkaabcks", merchant_id="102") is True


def test_verify_ipn_returns_false_for_tampered_hash():
    payload = {
        "basket_id": "BAS-01",
        "err_code": "000",
        "validation_hash": "0" * 64,
    }
    assert verify_ipn(payload, secured_key="jdnkaabcks", merchant_id="102") is False


def test_verify_ipn_returns_false_for_wrong_secured_key():
    payload = {
        "basket_id": "BAS-01",
        "err_code": "000",
        "validation_hash": DOCS_EXAMPLE_HASH,
    }
    assert verify_ipn(payload, secured_key="wrong", merchant_id="102") is False


def test_verify_ipn_returns_false_for_wrong_merchant_id():
    payload = {
        "basket_id": "BAS-01",
        "err_code": "000",
        "validation_hash": DOCS_EXAMPLE_HASH,
    }
    assert verify_ipn(payload, secured_key="jdnkaabcks", merchant_id="999") is False


def test_verify_ipn_rejects_missing_basket_id():
    payload = {
        "err_code": "000",
        "validation_hash": DOCS_EXAMPLE_HASH,
    }
    assert verify_ipn(payload, secured_key="jdnkaabcks", merchant_id="102") is False


def test_verify_ipn_rejects_missing_err_code():
    payload = {
        "basket_id": "BAS-01",
        "validation_hash": DOCS_EXAMPLE_HASH,
    }
    assert verify_ipn(payload, secured_key="jdnkaabcks", merchant_id="102") is False


def test_verify_ipn_rejects_missing_validation_hash():
    payload = {
        "basket_id": "BAS-01",
        "err_code": "000",
    }
    assert verify_ipn(payload, secured_key="jdnkaabcks", merchant_id="102") is False


def test_verify_ipn_rejects_blank_fields():
    """Whitespace-only values should be treated as missing."""
    payload = {
        "basket_id": "   ",
        "err_code": "000",
        "validation_hash": DOCS_EXAMPLE_HASH,
    }
    assert verify_ipn(payload, secured_key="jdnkaabcks", merchant_id="102") is False


def test_verify_ipn_handles_none_values_gracefully():
    """Callers sometimes pass dicts with None for missing PayFast fields."""
    payload: dict[str, str | None] = {
        "basket_id": None,
        "err_code": "000",
        "validation_hash": DOCS_EXAMPLE_HASH,
    }
    assert verify_ipn(payload, secured_key="k", merchant_id="m") is False  # type: ignore[arg-type]
