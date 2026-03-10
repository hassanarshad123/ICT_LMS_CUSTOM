import uuid
from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel


# ── Students ──────────────────────────────────────────────────

class PublicStudentOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    phone: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PublicStudentCreate(BaseModel):
    email: str
    name: str
    password: Optional[str] = None
    phone: Optional[str] = None


class PublicStudentUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


# ── Batches ───────────────────────────────────────────────────

class PublicBatchOut(BaseModel):
    id: uuid.UUID
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    teacher_name: Optional[str] = None
    student_count: int = 0
    course_count: int = 0
    status: Optional[str] = None
    created_at: Optional[datetime] = None


# ── Courses ───────────────────────────────────────────────────

class PublicCourseOut(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PublicModuleOut(BaseModel):
    id: uuid.UUID
    title: str
    order: int


class PublicCourseDetailOut(PublicCourseOut):
    modules: list[PublicModuleOut] = []


# ── Enrollments ───────────────────────────────────────────────

class PublicEnrollmentOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    student_email: str
    batch_id: uuid.UUID
    batch_name: str
    enrolled_at: Optional[datetime] = None


class PublicEnrollmentCreate(BaseModel):
    student_id: uuid.UUID
    batch_id: uuid.UUID


class PublicEnrollmentRemove(BaseModel):
    student_id: uuid.UUID
    batch_id: uuid.UUID


# ── Certificates ──────────────────────────────────────────────

class PublicCertificateOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    certificate_id: Optional[str] = None
    verification_code: Optional[str] = None
    status: str
    completion_percentage: Optional[float] = None
    issued_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Classes ───────────────────────────────────────────────────

class PublicClassOut(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    title: str
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    duration: Optional[int] = None
    status: str
    zoom_meeting_url: Optional[str] = None

    model_config = {"from_attributes": True}


class PublicAttendanceOut(BaseModel):
    student_id: uuid.UUID
    student_name: str
    attended: bool
    duration_minutes: Optional[int] = None


# ── Announcements ─────────────────────────────────────────────

class PublicAnnouncementOut(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    scope: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PublicAnnouncementCreate(BaseModel):
    title: str
    content: str
    scope: str
    batch_id: Optional[uuid.UUID] = None
    course_id: Optional[uuid.UUID] = None


# ── Jobs ──────────────────────────────────────────────────────

class PublicJobOut(BaseModel):
    id: uuid.UUID
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    salary: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
