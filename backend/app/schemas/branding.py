"""Branding DTOs."""

import re
from typing import Optional
from pydantic import BaseModel, field_validator


def _validate_hex(v: str) -> str:
    if not re.match(r"^#[0-9A-Fa-f]{6}$", v):
        raise ValueError("Must be a valid hex color (e.g. #1A1A1A)")
    return v.upper()


class BrandingResponse(BaseModel):
    primary_color: str = "#1A1A1A"
    accent_color: str = "#C5D86D"
    background_color: str = "#F0F0F0"
    institute_name: str = "ICT Institute"
    tagline: str = "Learning Management System"
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    preset_theme: Optional[str] = None


class BrandingUpdate(BaseModel):
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    background_color: Optional[str] = None
    institute_name: Optional[str] = None
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    preset_theme: Optional[str] = None

    @field_validator("primary_color", "accent_color", "background_color", mode="before")
    @classmethod
    def validate_hex_color(cls, v):
        if v is not None:
            return _validate_hex(v)
        return v


class LogoUploadResponse(BaseModel):
    upload_url: str
    object_key: str
