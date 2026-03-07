import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DashboardResponse(BaseModel):
    total_batches: int
    active_batches: int
    total_students: int
    active_students: int
    total_teachers: int
    total_course_creators: int
    total_courses: int
    recent_batches: list[dict]
    recent_students: list[dict]


class InsightsResponse(BaseModel):
    monthly: list[dict]
    students_by_status: dict
    batches_by_status: dict
    enrollment_per_batch: list[dict]
    teacher_workload: list[dict]
    materials_by_type: dict
    lectures_per_course: list[dict]
    device_overview: dict


class SessionOut(BaseModel):
    id: uuid.UUID
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    logged_in_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserDeviceSummary(BaseModel):
    user_id: uuid.UUID
    user_name: str
    user_email: str
    user_role: str
    active_sessions: list[SessionOut]


class SettingsResponse(BaseModel):
    settings: dict[str, str]


class SettingsUpdate(BaseModel):
    settings: dict[str, str]


class ActivityLogOut(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    action: str
    entity_type: str
    entity_id: Optional[uuid.UUID] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ExportResponse(BaseModel):
    download_url: str
    expires_at: datetime
