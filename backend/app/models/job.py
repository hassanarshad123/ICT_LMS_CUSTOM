import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, ForeignKey, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP, ARRAY, UUID as PG_UUID

from app.models.enums import JobType, ApplicationStatus


class Job(SQLModel, table=True):
    __tablename__ = "jobs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(nullable=False)
    company: str = Field(nullable=False)
    location: Optional[str] = Field(default=None)
    job_type: JobType = Field(
        sa_column=Column(SAEnum(JobType, name="job_type", create_type=False), nullable=False)
    )
    salary: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    requirements: Optional[list[str]] = Field(default=None, sa_column=Column(ARRAY(Text)))
    deadline: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    posted_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )
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


class JobApplication(SQLModel, table=True):
    __tablename__ = "job_applications"
    __table_args__ = (
        UniqueConstraint("job_id", "student_id", name="uq_job_application_job_student"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    job_id: uuid.UUID = Field(nullable=False, foreign_key="jobs.id")
    student_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    resume_url: Optional[str] = Field(default=None)
    cover_letter: Optional[str] = Field(default=None)
    status: ApplicationStatus = Field(
        sa_column=Column(
            SAEnum(ApplicationStatus, name="application_status", create_type=False),
            nullable=False,
            server_default="applied",
        )
    )
    status_changed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    status_changed_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )
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
