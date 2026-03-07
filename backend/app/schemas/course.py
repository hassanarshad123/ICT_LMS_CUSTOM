import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class CourseOut(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    status: str
    batch_ids: list[uuid.UUID] = []
    cloned_from_id: Optional[uuid.UUID] = None
    created_by: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
