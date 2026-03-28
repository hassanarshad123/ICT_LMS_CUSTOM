import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class BatchCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    teacher_id: Optional[uuid.UUID] = None
    enable_lecture_gating: bool = False
    lecture_gating_threshold: int = Field(default=65, ge=0, le=100)


class BatchUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    teacher_id: Optional[uuid.UUID] = None
    enable_lecture_gating: Optional[bool] = None
    lecture_gating_threshold: Optional[int] = Field(default=None, ge=0, le=100)


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
    enable_lecture_gating: bool = False
    lecture_gating_threshold: int = 65

    model_config = {"from_attributes": True}


class BatchStudentEnroll(BaseModel):
    student_id: uuid.UUID


class BatchCourseLink(BaseModel):
    course_id: uuid.UUID


class EnrollmentToggle(BaseModel):
    is_active: bool
