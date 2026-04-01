import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.schemas.validators import (
    BulkActionField,
    ValidatedPassword,
    validate_password_strength,
)


class ActivityLogItem(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    action: str
    entity_type: str
    entity_id: Optional[uuid.UUID] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    institute_id: Optional[uuid.UUID] = None
    institute_name: Optional[str] = None
    impersonated_by: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    model_config = {"from_attributes": True}


class GlobalUserSearchResult(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    role: str
    status: str
    institute_id: Optional[uuid.UUID] = None
    institute_name: Optional[str] = None
    institute_slug: Optional[str] = None
    created_at: Optional[datetime] = None


class AdminListItem(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    status: str
    institute_id: Optional[uuid.UUID] = None
    institute_name: Optional[str] = None
    created_at: Optional[datetime] = None


class ActiveSessionItem(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    logged_in_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None
    institute_name: Optional[str] = None


class BulkInstituteAction(BaseModel):
    institute_ids: list[uuid.UUID]
    action: BulkActionField


class PasswordResetRequest(BaseModel):
    new_password: ValidatedPassword

    _validate_password = field_validator("new_password")(validate_password_strength)
