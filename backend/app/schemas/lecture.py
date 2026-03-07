import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LectureCreate(BaseModel):
    title: str
    description: Optional[str] = None
    video_type: str = "external"
    video_url: Optional[str] = None
    duration: Optional[int] = None
    batch_id: uuid.UUID
    course_id: Optional[uuid.UUID] = None


class LectureUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    video_url: Optional[str] = None
    duration: Optional[int] = None


class LectureOut(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    video_type: str
    video_url: Optional[str] = None
    bunny_video_id: Optional[str] = None
    duration: Optional[int] = None
    duration_display: Optional[str] = None
    file_size: Optional[int] = None
    batch_id: uuid.UUID
    course_id: Optional[uuid.UUID] = None
    sequence_order: int
    thumbnail_url: Optional[str] = None
    upload_date: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LectureReorderRequest(BaseModel):
    sequence_order: int


class ProgressUpdate(BaseModel):
    watch_percentage: int
    resume_position_seconds: int = 0


class ProgressOut(BaseModel):
    lecture_id: uuid.UUID
    watch_percentage: int
    resume_position_seconds: int
    status: str

    model_config = {"from_attributes": True}
