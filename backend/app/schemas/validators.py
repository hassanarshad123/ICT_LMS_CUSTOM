"""Shared field types and validators for consistent validation across all schemas.

Single source of truth for email, password, slug, name, phone, and enum fields.
Import these instead of defining inline validators in each schema file.
"""

import re
from typing import Annotated, Literal, Optional

from pydantic import EmailStr, Field, field_validator

# ── Reusable Field Types ────────────────────────────────────────

# Email — always RFC-5322 validated via Pydantic EmailStr
ValidatedEmail = EmailStr

# Password — min 8 chars, must contain uppercase + digit + special character
# Usage: `password: ValidatedPassword`
ValidatedPassword = Annotated[str, Field(min_length=8, max_length=128)]

# Name — 1-255 chars, no blank strings
ValidatedName = Annotated[str, Field(min_length=1, max_length=255)]

# Phone — optional, max 20 chars (international format)
ValidatedPhone = Annotated[Optional[str], Field(default=None, max_length=20)]

# Slug — 3-30 lowercase alphanumeric + hyphens
ValidatedSlug = Annotated[str, Field(min_length=3, max_length=30)]

# Plan tier — only valid enum values
PlanTierField = Literal["free", "basic", "pro", "enterprise"]

# Billing cycle — only valid enum values
BillingCycleField = Literal["monthly", "quarterly", "yearly"]

# Bulk action — only valid actions
BulkActionField = Literal["suspend", "activate"]

# Invoice status — only valid statuses
InvoiceStatusField = Literal["draft", "sent", "paid", "overdue", "cancelled"]

# Discount type — only valid types
DiscountTypeField = Literal["percentage", "flat"]


# ── Reusable Validators ────────────────────────────────────────

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$")


def validate_password_strength(v: str) -> str:
    """Enforce password complexity: min 8 chars, at least one uppercase,
    one digit, and one special character."""
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not any(c.isupper() for c in v):
        raise ValueError("Password must contain at least one uppercase letter")
    if not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one digit")
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" for c in v):
        raise ValueError("Password must contain at least one special character")
    return v


def validate_slug_format(v: str) -> str:
    """Enforce slug format: lowercase alphanumeric + hyphens, no consecutive hyphens."""
    if not _SLUG_RE.match(v):
        raise ValueError(
            "Slug must be 3-30 lowercase alphanumeric characters or hyphens, "
            "starting and ending with alphanumeric"
        )
    if "--" in v:
        raise ValueError("Slug cannot contain consecutive hyphens")
    return v
