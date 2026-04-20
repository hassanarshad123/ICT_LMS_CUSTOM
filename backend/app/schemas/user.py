import uuid
from datetime import datetime
from typing import Optional
import re
from pydantic import BaseModel, Field, field_validator


class UserCreate(BaseModel):
    email: str
    name: str
    password: Optional[str] = None
    phone: Optional[str] = None
    role: str
    specialization: Optional[str] = None
    employee_id: Optional[str] = Field(
        default=None,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
    )

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v.strip()):
            raise ValueError("Invalid email format")
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v.strip()


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    specialization: Optional[str] = None
    avatar_url: Optional[str] = None
    employee_id: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    phone: Optional[str] = None
    role: str
    specialization: Optional[str] = None
    employee_id: Optional[str] = None
    avatar_url: Optional[str] = None
    status: str
    batch_ids: Optional[list[str]] = None
    batch_names: Optional[list[str]] = None
    batch_active_statuses: Optional[list[bool]] = None
    join_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserPublicOut(BaseModel):
    """Minimal user info returned to students viewing other users."""
    id: uuid.UUID
    name: str
    role: str
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    data: list[UserOut]
    total: int
    page: int
    per_page: int
    total_pages: int
