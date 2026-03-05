import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    phone: Optional[str] = None
    role: str
    specialization: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    specialization: Optional[str] = None
    avatar_url: Optional[str] = None


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    phone: Optional[str] = None
    role: str
    specialization: Optional[str] = None
    avatar_url: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    data: list[UserOut]
    total: int
    page: int
    per_page: int
