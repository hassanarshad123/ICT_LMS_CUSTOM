import uuid
from typing import Optional

from pydantic import BaseModel, field_validator

from app.schemas.validators import (
    ValidatedEmail,
    ValidatedName,
    ValidatedPassword,
    ValidatedPhone,
    ValidatedSlug,
    validate_password_strength,
    validate_slug_format,
)


class SignupRequest(BaseModel):
    name: ValidatedName
    email: ValidatedEmail
    password: ValidatedPassword
    phone: ValidatedPhone = None
    institute_name: ValidatedName
    institute_slug: ValidatedSlug
    website: Optional[str] = None  # honeypot field
    cf_turnstile_token: Optional[str] = None  # Cloudflare Turnstile CAPTCHA token
    referral_source: Optional[str] = None  # marketing: how they found us
    expected_students: Optional[int] = None  # marketing: expected student count

    _validate_password = field_validator("password")(validate_password_strength)
    _validate_slug = field_validator("institute_slug")(validate_slug_format)


class SignupResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict
    institute: dict


class SlugCheckResponse(BaseModel):
    slug: str
    available: bool
    reason: str
