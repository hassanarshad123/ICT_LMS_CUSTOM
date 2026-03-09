import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CertificateOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    student_email: str
    batch_id: uuid.UUID
    batch_name: str
    course_id: uuid.UUID
    course_title: str
    certificate_id: str
    verification_code: str
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


class CertificateBatchApproveRequest(BaseModel):
    student_ids: list[uuid.UUID]


class CertificateRevokeRequest(BaseModel):
    reason: str


class CertificateVerifyOut(BaseModel):
    valid: bool
    certificate_id: Optional[str] = None
    student_name: Optional[str] = None
    course_title: Optional[str] = None
    batch_name: Optional[str] = None
    issued_at: Optional[datetime] = None
    status: Optional[str] = None
