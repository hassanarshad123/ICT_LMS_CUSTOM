import uuid
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
import re


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None
    institute_name: str
    institute_slug: str
    website: Optional[str] = None  # honeypot field

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("institute_slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$", v):
            raise ValueError("Slug must be 3-30 lowercase alphanumeric characters or hyphens, starting and ending with alphanumeric")
        return v


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
