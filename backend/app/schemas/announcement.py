import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class AnnouncementCreate(BaseModel):
    title: str = Field(max_length=500)
    content: str = Field(max_length=50000)
    scope: str
    batch_id: Optional[uuid.UUID] = None
    course_id: Optional[uuid.UUID] = None
    expires_at: Optional[datetime] = None
    send_email: bool = False


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=500)
    content: Optional[str] = Field(default=None, max_length=50000)
    expires_at: Optional[datetime] = None


class AnnouncementOut(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    scope: str
    batch_id: Optional[uuid.UUID] = None
    course_id: Optional[uuid.UUID] = None
    posted_by: Optional[uuid.UUID] = None
    posted_by_name: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
