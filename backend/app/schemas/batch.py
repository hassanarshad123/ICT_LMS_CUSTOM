import uuid
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class BatchCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    teacher_id: Optional[uuid.UUID] = None
    enable_lecture_gating: bool = False
    lecture_gating_threshold: int = Field(default=65, ge=0, le=100)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


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
    # Per-student access status (populated for students only)
    access_expired: Optional[bool] = None
    effective_end_date: Optional[str] = None
    extended_end_date: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Access duration schemas ──────────────────────────────────────────


class AccessDuration(BaseModel):
    """Optional per-student access window. Exactly one of access_days or access_end_date may be set."""
    access_days: Optional[int] = Field(default=None, ge=1, le=3650)
    access_end_date: Optional[date] = None

    @model_validator(mode="after")
    def _mutually_exclusive(self):
        if self.access_days is not None and self.access_end_date is not None:
            raise ValueError("Provide either access_days OR access_end_date, not both.")
        return self


class StudentIdList(BaseModel):
    student_ids: List[uuid.UUID] = Field(min_length=1, max_length=500)


class BatchStudentEnroll(AccessDuration):
    student_id: uuid.UUID
    reason: Optional[str] = None


class BulkEnrollRequest(AccessDuration):
    student_ids: List[uuid.UUID] = Field(min_length=1, max_length=500)
    reason: Optional[str] = None
    skip_notifications: bool = False


class AccessAdjustRequest(AccessDuration):
    reason: Optional[str] = None
    skip_notifications: bool = False


class BulkAccessAdjustRequest(AccessAdjustRequest):
    student_ids: List[uuid.UUID] = Field(min_length=1, max_length=500)


class BatchCourseLink(BaseModel):
    course_id: uuid.UUID


class EnrollmentToggle(BaseModel):
    is_active: bool


# ── Extension schemas ────────────────────────────────────────────


class ExtendAccessRequest(BaseModel):
    end_date: Optional[date] = None
    duration_days: Optional[int] = Field(default=None, gt=0, le=365)
    reason: Optional[str] = Field(default=None, max_length=500)


class ExtensionOut(BaseModel):
    student_id: uuid.UUID
    batch_id: uuid.UUID
    previous_end_date: Optional[date] = None
    new_end_date: date
    extension_type: str
    duration_days: Optional[int] = None
    reason: Optional[str] = None


class ExtensionHistoryItem(BaseModel):
    id: uuid.UUID
    previous_end_date: Optional[date] = None
    new_end_date: date
    extension_type: str
    duration_days: Optional[int] = None
    reason: Optional[str] = None
    extended_by: uuid.UUID
    extended_by_name: str
    created_at: datetime


class StudentExpiryInfo(BaseModel):
    student_id: uuid.UUID
    student_name: str
    student_email: str
    batch_end_date: date
    extended_end_date: Optional[date] = None
    effective_end_date: date


class ExpirySummary(BaseModel):
    expiring_soon: List[StudentExpiryInfo]
    expired: List[StudentExpiryInfo]
    adjusted: List[StudentExpiryInfo]  # renamed from 'extended'
