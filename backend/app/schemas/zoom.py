import re
import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class ZoomAccountCreate(BaseModel):
    account_name: str
    account_id: str
    client_id: str
    client_secret: str
    is_default: bool = False


class ZoomAccountUpdate(BaseModel):
    account_name: Optional[str] = None
    account_id: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    is_default: Optional[bool] = None


class ZoomAccountOut(BaseModel):
    id: uuid.UUID
    account_name: str
    account_id: Optional[str] = None
    client_id: Optional[str] = None
    is_default: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ZoomAccountAdminOut(ZoomAccountOut):
    client_secret_masked: Optional[str] = None


class ZoomClassCreate(BaseModel):
    title: str
    batch_id: uuid.UUID
    teacher_id: uuid.UUID
    zoom_account_id: uuid.UUID
    scheduled_date: date
    scheduled_time: str
    duration: int

    @field_validator('scheduled_time')
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        if not re.match(r'^\d{2}:\d{2}$', v):
            raise ValueError('scheduled_time must be in HH:MM format')
        h, m = int(v[:2]), int(v[3:5])
        if h > 23 or m > 59:
            raise ValueError('Invalid time value')
        return v


class ZoomClassUpdate(BaseModel):
    title: Optional[str] = None
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    duration: Optional[int] = None


class ZoomClassOut(BaseModel):
    id: uuid.UUID
    title: str
    batch_id: uuid.UUID
    batch_name: Optional[str] = None
    teacher_id: uuid.UUID
    teacher_name: Optional[str] = None
    zoom_meeting_url: Optional[str] = None
    zoom_start_url: Optional[str] = None
    scheduled_date: date
    scheduled_time: str
    duration: int
    duration_display: Optional[str] = None
    status: str
    zoom_account_id: uuid.UUID
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AttendanceOut(BaseModel):
    id: uuid.UUID
    zoom_class_id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    attended: bool
    join_time: Optional[datetime] = None
    leave_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None

    model_config = {"from_attributes": True}


class RecordingOut(BaseModel):
    id: uuid.UUID
    zoom_class_id: uuid.UUID
    bunny_video_id: Optional[str] = None
    duration: Optional[int] = None
    file_size: Optional[int] = None
    status: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RecordingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class RecordingListOut(BaseModel):
    id: uuid.UUID
    class_title: str
    title: Optional[str] = None
    description: Optional[str] = None
    teacher_name: Optional[str] = None
    batch_name: Optional[str] = None
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None
    file_size: Optional[int] = None
    status: str
    deleted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RecordingSignedUrlOut(BaseModel):
    url: str
    type: str
    expires_at: Optional[int] = None  # Unix timestamp when token expires
