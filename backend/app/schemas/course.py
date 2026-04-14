import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CourseCreate(BaseModel):
    title: str = Field(max_length=500)
    description: Optional[str] = Field(default=None, max_length=10000)


class CourseUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = Field(default=None, max_length=10000)
    status: Optional[str] = None


class CourseOut(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    status: str
    batch_ids: list[uuid.UUID] = []
    # Populated only on student course listings; identifies which specific
    # student-batch this row represents when the student is enrolled in
    # multiple batches of the same course.
    batch_id: Optional[uuid.UUID] = None
    batch_name: Optional[str] = None
    cloned_from_id: Optional[uuid.UUID] = None
    created_by: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None
    cover_image_url: Optional[str] = None

    model_config = {"from_attributes": True}
