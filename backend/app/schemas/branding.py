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
    watermark_enabled: bool = True


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


# ── Certificate Design DTOs ──────────────────────────────────────────

VALID_BORDER_STYLES = {"classic", "modern", "ornate"}


class CertificateDesignResponse(BaseModel):
    primary_color: str = "#1A1A1A"
    accent_color: str = "#C5D86D"
    institute_name: str = "ICT INSTITUTE"
    website_url: str = "https://ict.net.pk"
    logo_url: Optional[str] = None
    title: str = "CERTIFICATE OF COMPLETION"
    body_line1: str = "This is to certify that"
    body_line2: str = "has successfully completed the course"
    sig1_label: str = "Director"
    sig1_name: str = ""
    sig1_image: Optional[str] = None
    sig2_label: str = "Course Instructor"
    sig2_name: str = ""
    sig2_image: Optional[str] = None
    id_prefix: str = "ICT"
    border_style: str = "classic"


class CertificateDesignUpdate(BaseModel):
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    institute_name: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    title: Optional[str] = None
    body_line1: Optional[str] = None
    body_line2: Optional[str] = None
    sig1_label: Optional[str] = None
    sig1_name: Optional[str] = None
    sig1_image: Optional[str] = None
    sig2_label: Optional[str] = None
    sig2_name: Optional[str] = None
    sig2_image: Optional[str] = None
    id_prefix: Optional[str] = None
    border_style: Optional[str] = None

    @field_validator("primary_color", "accent_color", mode="before")
    @classmethod
    def validate_cert_hex(cls, v):
        if v is not None:
            return _validate_hex(v)
        return v

    @field_validator("border_style", mode="before")
    @classmethod
    def validate_border_style(cls, v):
        if v is not None and v not in VALID_BORDER_STYLES:
            raise ValueError(f"border_style must be one of: {', '.join(sorted(VALID_BORDER_STYLES))}")
        return v

    @field_validator("id_prefix", mode="before")
    @classmethod
    def validate_id_prefix(cls, v):
        if v is not None:
            v = v.strip().upper()
            if not 1 <= len(v) <= 10:
                raise ValueError("id_prefix must be 1-10 characters")
            if not re.match(r"^[A-Z0-9]+$", v):
                raise ValueError("id_prefix must be uppercase alphanumeric only")
            return v
        return v
