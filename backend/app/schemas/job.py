import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class JobCreate(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    job_type: str
    salary: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[list[str]] = None
    deadline: Optional[datetime] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    salary: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[list[str]] = None
    deadline: Optional[datetime] = None


class JobOut(BaseModel):
    id: uuid.UUID
    title: str
    company: str
    location: Optional[str] = None
    type: str
    salary: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[list[str]] = None
    posted_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    posted_by: Optional[uuid.UUID] = None

    model_config = {"from_attributes": True}


class JobApply(BaseModel):
    resume_key: Optional[str] = None
    cover_letter: Optional[str] = None


class ApplicationOut(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    resume_url: Optional[str] = None
    cover_letter: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ApplicationStatusUpdate(BaseModel):
    status: str
