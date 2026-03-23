import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class LectureCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    video_type: str = "external"
    video_url: Optional[str] = None
    duration: Optional[int] = None
    batch_id: uuid.UUID
    course_id: Optional[uuid.UUID] = None


class LectureUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
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
    video_status: Optional[str] = None
    duration: Optional[int] = None
    duration_display: Optional[str] = None
    file_size: Optional[int] = None
    batch_id: uuid.UUID
    course_id: Optional[uuid.UUID] = None
    sequence_order: int
    thumbnail_url: Optional[str] = None
    upload_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    # Progress gating fields (populated for students when batch has gating enabled)
    watch_percentage: Optional[int] = None
    progress_status: Optional[str] = None
    is_locked: Optional[bool] = None

    model_config = {"from_attributes": True}


class UploadInitRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    batch_id: uuid.UUID
    course_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    duration: Optional[int] = None
    file_size: int = Field(ge=1)


class LectureReorderRequest(BaseModel):
    sequence_order: int = Field(ge=1)


class BulkReorderItem(BaseModel):
    id: uuid.UUID
    sequence_order: int = Field(ge=1)


class BulkReorderRequest(BaseModel):
    items: list[BulkReorderItem] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def no_duplicate_ids(self) -> "BulkReorderRequest":
        ids = [item.id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate lecture IDs in reorder request")
        return self


class ProgressUpdate(BaseModel):
    watch_percentage: int = Field(ge=0, le=100)
    resume_position_seconds: int = Field(default=0, ge=0)


class ProgressOut(BaseModel):
    lecture_id: uuid.UUID
    watch_percentage: int
    resume_position_seconds: int
    status: str

    model_config = {"from_attributes": True}
