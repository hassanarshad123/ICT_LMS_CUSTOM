import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class BatchCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    teacher_id: Optional[uuid.UUID] = None


class BatchUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    teacher_id: Optional[uuid.UUID] = None


class BatchOut(BaseModel):
    id: uuid.UUID
    name: str
    start_date: date
    end_date: date
    teacher_id: Optional[uuid.UUID] = None
    teacher_name: Optional[str] = None
    student_count: int = 0
    course_count: int = 0
    status: str
    created_by: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BatchStudentEnroll(BaseModel):
    student_id: uuid.UUID


class BatchCourseLink(BaseModel):
    course_id: uuid.UUID
