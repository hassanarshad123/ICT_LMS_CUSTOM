"""Typed response objects for the PayFast integration.

We use lightweight dataclasses (not Pydantic) because these are internal to
the services layer and never cross the HTTP boundary. Router-facing schemas
live in ``app/schemas/payfast.py``.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class AccessToken:
    """Parsed response from PayFast's GetAccessToken endpoint."""

    token: str
    expires_at: datetime | None = None


@dataclass(frozen=True)
class CheckoutRedirect:
    """Everything the browser needs to auto-POST into PayFast's hosted checkout.

    The frontend renders a hidden ``<form action="{action_url}" method="POST">``
    with one ``<input type="hidden">`` per ``fields`` entry and submits on mount.
    """

    action_url: str
    fields: dict[str, str]


@dataclass
class IpnPayload:
    """Parsed PayFast IPN webhook body.

    Unknown fields land in ``raw`` for audit. All known fields are optional
    so a malformed/partial body never raises here — validation happens in the
    router via ``verify_ipn`` + explicit field checks.
    """

    transaction_id: str | None = None
    basket_id: str | None = None
    err_code: str | None = None
    err_msg: str | None = None
    validation_hash: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)
