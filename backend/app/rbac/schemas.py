from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PermissionOut(BaseModel):
    code: str
    module: str
    action: str
    description: Optional[str] = None


class PermissionGroupOut(BaseModel):
    module: str
    label: str
    permissions: list[PermissionOut]


class CustomRoleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    view_type: str = Field(pattern=r"^(student_view|staff_view|admin_view)$")
    permissions: list[str] = Field(default_factory=list)


class CustomRoleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    view_type: Optional[str] = Field(default=None, pattern=r"^(student_view|staff_view|admin_view)$")


class CustomRoleOut(BaseModel):
    id: uuid.UUID
    institute_id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    view_type: str
    is_active: bool
    user_count: int = 0
    created_at: datetime
    updated_at: datetime


class CustomRoleDetailOut(CustomRoleOut):
    permissions: list[str] = []


class SetPermissionsRequest(BaseModel):
    permissions: list[str]


class AssignRoleRequest(BaseModel):
    role_slug: str = Field(min_length=1, max_length=100)


class UserPermissionsOut(BaseModel):
    permissions: list[str]
    view_type: Optional[str] = None
    custom_role_id: Optional[uuid.UUID] = None
    custom_role_slug: Optional[str] = None


class SystemRolePermissionsOut(BaseModel):
    role: str
    permissions: list[str]
    is_system: bool = True
