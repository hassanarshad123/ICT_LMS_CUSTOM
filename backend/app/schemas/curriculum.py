import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CurriculumModuleCreate(BaseModel):
    course_id: uuid.UUID
    title: str
    description: Optional[str] = None
    topics: Optional[list[str]] = None


class CurriculumModuleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    topics: Optional[list[str]] = None


class CurriculumModuleOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: Optional[str] = None
    topics: Optional[list[str]] = None
    sequence_order: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ReorderRequest(BaseModel):
    sequence_order: int
