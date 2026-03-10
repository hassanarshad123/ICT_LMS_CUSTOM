import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel


class InstituteCreate(BaseModel):
    name: str
    slug: str
    contact_email: str
    plan_tier: str = "free"
    max_users: int = 10
    max_storage_gb: float = 1.0
    max_video_gb: float = 5.0
    expires_at: Optional[datetime] = None


class InstituteUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    contact_email: Optional[str] = None
    plan_tier: Optional[str] = None
    max_users: Optional[int] = None
    max_storage_gb: Optional[float] = None
    max_video_gb: Optional[float] = None
    expires_at: Optional[datetime] = None


class InstituteOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    plan_tier: str
    max_users: int
    max_storage_gb: float
    max_video_gb: float
    contact_email: str
    expires_at: Optional[datetime]
    created_at: Optional[datetime]
    current_users: int = 0
    current_storage_gb: float = 0.0
    current_video_gb: float = 0.0

    class Config:
        from_attributes = True


class AdminCreate(BaseModel):
    email: str
    name: str
    password: str
    phone: Optional[str] = None


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
