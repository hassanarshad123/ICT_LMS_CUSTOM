import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


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


class RecordingListOut(BaseModel):
    id: uuid.UUID
    class_title: str
    teacher_name: Optional[str] = None
    batch_name: Optional[str] = None
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None
    file_size: Optional[int] = None
    status: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RecordingSignedUrlOut(BaseModel):
    url: str
    type: str
