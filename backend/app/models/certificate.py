import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Integer, String, Text, UniqueConstraint, Index, CheckConstraint, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID

from app.models.enums import CertificateStatus


class Certificate(SQLModel, table=True):
    __tablename__ = "certificates"
    __table_args__ = (
        UniqueConstraint("student_id", "batch_id", "course_id", name="uq_certificate_student_batch_course"),
        Index("ix_certificates_student_id", "student_id"),
        CheckConstraint("completion_percentage >= 0 AND completion_percentage <= 100", name="ck_certificate_completion_pct"),
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

    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )

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
    """Per-institute, per-year sequential certificate IDs."""
    __tablename__ = "certificate_counter"
    __table_args__ = (
        UniqueConstraint("institute_id", "current_year", name="uq_cert_counter_institute_year"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False)
    )
    current_year: int = Field(nullable=False)
    last_sequence: int = Field(default=0, nullable=False)
