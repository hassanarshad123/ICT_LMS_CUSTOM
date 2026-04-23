import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.validators import (
    ValidatedEmail,
    ValidatedName,
    ValidatedPassword,
    ValidatedPhone,
    ValidatedSlug,
    PlanTierField,
    validate_password_strength,
    validate_slug_format,
)


class InstituteCreate(BaseModel):
    name: ValidatedName
    slug: ValidatedSlug
    contact_email: ValidatedEmail
    plan_tier: PlanTierField = "free"
    max_users: int = 10
    max_students: int = 15
    max_storage_gb: float = 1.0
    max_video_gb: float = 5.0
    expires_at: Optional[datetime] = None

    _validate_slug = field_validator("slug")(validate_slug_format)


class InstituteUpdate(BaseModel):
    name: Optional[ValidatedName] = None
    slug: Optional[ValidatedSlug] = None
    contact_email: Optional[ValidatedEmail] = None
    plan_tier: Optional[PlanTierField] = None
    max_users: Optional[int] = None
    max_students: Optional[int] = None
    max_storage_gb: Optional[float] = None
    max_video_gb: Optional[float] = None
    expires_at: Optional[datetime] = None
    # Required when changing plan_tier to or from "unlimited" — captured
    # in the ActivityLog so every comp assignment (and revocation) has a
    # recorded rationale. Ignored for other tier changes.
    tier_change_reason: Optional[str] = Field(default=None, max_length=500)

    _validate_slug = field_validator("slug")(validate_slug_format)


class InstituteOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    plan_tier: str
    max_users: Optional[int] = None
    max_students: Optional[int] = None
    max_storage_gb: Optional[float] = None
    max_video_gb: Optional[float] = None
    contact_email: str
    expires_at: Optional[datetime]
    created_at: Optional[datetime]
    current_users: int = 0
    current_students: int = 0
    current_storage_gb: float = 0.0
    current_video_gb: float = 0.0

    class Config:
        from_attributes = True


class AdminCreate(BaseModel):
    email: ValidatedEmail
    name: ValidatedName
    password: ValidatedPassword
    phone: ValidatedPhone = None

    _validate_password = field_validator("password")(validate_password_strength)


class PlatformDashboard(BaseModel):
    total_institutes: int
    active_institutes: int
    suspended_institutes: int
    trial_institutes: int
    total_users: int
    total_storage_gb: float
    total_video_gb: float
    institutes_by_plan: dict
    recent_institutes: list
