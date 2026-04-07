import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CertificateOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    student_email: str
    batch_id: uuid.UUID
    batch_name: str
    course_id: uuid.UUID
    course_title: str
    certificate_id: Optional[str] = None
    verification_code: Optional[str] = None
    certificate_name: Optional[str] = None
    requested_at: Optional[datetime] = None
    status: str
    completion_percentage: int
    approved_by: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    issued_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    revocation_reason: Optional[str] = None
    created_at: Optional[datetime] = None


class EligibleStudentOut(BaseModel):
    student_id: uuid.UUID
    student_name: str
    student_email: str
    completion_percentage: int
    certificate_name: Optional[str] = None
    requested_at: Optional[datetime] = None
    has_requested: bool = False
    cert_uuid: Optional[uuid.UUID] = None


class StudentDashboardCourseOut(BaseModel):
    batch_id: uuid.UUID
    batch_name: str
    course_id: uuid.UUID
    course_title: str
    completion_percentage: int
    threshold: int
    status: str  # not_started | in_progress | eligible | pending | approved | revoked
    certificate_id: Optional[uuid.UUID] = None  # cert record UUID if exists
    certificate_name: Optional[str] = None
    issued_at: Optional[datetime] = None


class CertificateRequestBody(BaseModel):
    batch_id: uuid.UUID
    course_id: uuid.UUID
    certificate_name: str


class CertificateBatchApproveRequest(BaseModel):
    student_ids: list[uuid.UUID] = Field(..., max_length=25)


class CertificateRevokeRequest(BaseModel):
    reason: str


class CertificateVerifyOut(BaseModel):
    valid: bool
    certificate_id: Optional[str] = None
    student_name: Optional[str] = None
    certificate_name: Optional[str] = None
    course_title: Optional[str] = None
    batch_name: Optional[str] = None
    issued_at: Optional[datetime] = None
    status: Optional[str] = None
