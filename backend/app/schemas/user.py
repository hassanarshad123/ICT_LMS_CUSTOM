import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class UserCreate(BaseModel):
    email: str
    name: str
    password: Optional[str] = None
    phone: Optional[str] = None
    role: str
    specialization: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    specialization: Optional[str] = None
    avatar_url: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    phone: Optional[str] = None
    role: str
    specialization: Optional[str] = None
    avatar_url: Optional[str] = None
    status: str
    batch_ids: Optional[list[str]] = None
    batch_names: Optional[list[str]] = None
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
