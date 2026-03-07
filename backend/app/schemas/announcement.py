import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AnnouncementCreate(BaseModel):
    title: str
    content: str
    scope: str
    batch_id: Optional[uuid.UUID] = None
    course_id: Optional[uuid.UUID] = None
    expires_at: Optional[datetime] = None


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
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
