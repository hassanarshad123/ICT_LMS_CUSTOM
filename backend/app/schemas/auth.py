import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: str
    password: str
    device_info: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserBrief"


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserBrief(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    phone: Optional[str] = None
    role: str
    status: str = "active"
    avatar_url: Optional[str] = None
    batch_ids: list[str] = []
    batch_names: list[str] = []
    institute_id: Optional[uuid.UUID] = None
    institute_slug: Optional[str] = None

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class LogoutAllResponse(BaseModel):
    detail: str
    sessions_terminated: int
