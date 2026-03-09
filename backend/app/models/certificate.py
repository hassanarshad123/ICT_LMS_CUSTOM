import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Integer, String, Text, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP

from app.models.enums import CertificateStatus


class Certificate(SQLModel, table=True):
    __tablename__ = "certificates"
    __table_args__ = (
        UniqueConstraint("student_id", "batch_id", "course_id", name="uq_certificate_student_batch_course"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    student_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    batch_id: uuid.UUID = Field(nullable=False, foreign_key="batches.id")
    course_id: uuid.UUID = Field(nullable=False, foreign_key="courses.id")

    certificate_id: Optional[str] = Field(default=None, unique=True)  # ICT-2026-00001 (set at approval)
    verification_code: Optional[str] = Field(default=None, unique=True)  # 12-char alphanumeric (set at approval)
    certificate_name: Optional[str] = Field(default=None)  # Student's chosen name for the certificate

    status: CertificateStatus = Field(
        sa_column=Column(
            SAEnum(CertificateStatus, name="certificate_status", create_type=False),
            nullable=False,
            server_default="eligible",
        )
    )
    completion_percentage: int = Field(default=0)

    requested_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )

    # Approval tracking
    approved_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    approved_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    issued_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )

    # Revocation tracking
    revoked_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    revoked_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    revocation_reason: Optional[str] = Field(default=None)

    # S3 path
    pdf_path: Optional[str] = Field(default=None)

    # Standard timestamps
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    deleted_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )


class CertificateCounter(SQLModel, table=True):
    """Single-row table for atomic sequential certificate IDs."""
    __tablename__ = "certificate_counter"

    id: int = Field(default=1, primary_key=True)
    current_year: int = Field(nullable=False)
    last_sequence: int = Field(default=0, nullable=False)
