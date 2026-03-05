import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, Integer, BigInteger, Boolean
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP, JSONB, ARRAY

from app.models.enums import (
    AnnouncementScope,
    LectureWatchStatus,
    JobType,
    ApplicationStatus,
)


class Announcement(SQLModel, table=True):
    __tablename__ = "announcements"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(nullable=False)
    content: str = Field(nullable=False)
    scope: AnnouncementScope = Field(
        sa_column=Column(
            SAEnum(AnnouncementScope, name="announcement_scope", create_type=False),
            nullable=False,
        )
    )
    batch_id: Optional[uuid.UUID] = Field(default=None, foreign_key="batches.id")
    course_id: Optional[uuid.UUID] = Field(default=None, foreign_key="courses.id")
    posted_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    expires_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
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


class LectureProgress(SQLModel, table=True):
    __tablename__ = "lecture_progress"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    student_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    lecture_id: uuid.UUID = Field(nullable=False, foreign_key="lectures.id")
    watch_percentage: int = Field(default=0)
    resume_position_seconds: int = Field(default=0)
    status: LectureWatchStatus = Field(
        sa_column=Column(
            SAEnum(LectureWatchStatus, name="lecture_watch_status", create_type=False),
            nullable=False,
            server_default="unwatched",
        )
    )
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )


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


class UserSession(SQLModel, table=True):
    __tablename__ = "user_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    session_token: str = Field(nullable=False)
    device_info: Optional[str] = Field(default=None)
    ip_address: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    logged_in_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    last_active_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    expires_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )


class SystemSetting(SQLModel, table=True):
    __tablename__ = "system_settings"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    setting_key: str = Field(nullable=False, unique=True)
    value: str = Field(nullable=False)
    description: Optional[str] = Field(default=None)
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )


class ActivityLog(SQLModel, table=True):
    __tablename__ = "activity_log"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    action: str = Field(nullable=False)
    entity_type: str = Field(nullable=False)
    entity_id: Optional[uuid.UUID] = Field(default=None)
    details: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    ip_address: Optional[str] = Field(default=None)
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
