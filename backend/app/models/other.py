import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, Integer, BigInteger, Boolean, UniqueConstraint, Index, CheckConstraint, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP, JSONB, ARRAY, UUID as PG_UUID

from app.models.enums import (
    AnnouncementScope,
    LectureWatchStatus,
    JobType,
    ApplicationStatus,
)


class Announcement(SQLModel, table=True):
    __tablename__ = "announcements"
    __table_args__ = (
        Index("ix_announcements_batch_id", "batch_id"),
    )

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


class LectureProgress(SQLModel, table=True):
    __tablename__ = "lecture_progress"
    __table_args__ = (
        UniqueConstraint("student_id", "lecture_id", name="uq_lecture_progress_student_lecture"),
        Index("ix_lecture_progress_student_id", "student_id"),
        CheckConstraint("watch_percentage >= 0 AND watch_percentage <= 100", name="ck_lecture_progress_watch_pct"),
    )

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


class UserSession(SQLModel, table=True):
    __tablename__ = "user_sessions"
    __table_args__ = (
        UniqueConstraint("session_token", name="uq_user_sessions_token"),
        Index("ix_user_sessions_user_id", "user_id"),
    )

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
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )


class SystemSetting(SQLModel, table=True):
    __tablename__ = "system_settings"
    __table_args__ = (
        UniqueConstraint("setting_key", "institute_id", name="uq_system_setting_key_institute"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    setting_key: str = Field(nullable=False)  # uniqueness enforced by composite constraint above
    value: str = Field(nullable=False)
    description: Optional[str] = Field(default=None)
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_id_read", "user_id", "read"),
        Index("ix_notifications_user_id_created_at", "user_id", "created_at"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    type: str = Field(nullable=False)  # announcement, class_scheduled, class_reminder, certificate_issued, enrollment
    title: str = Field(nullable=False)
    message: str = Field(nullable=False)
    link: Optional[str] = Field(default=None)  # relative URL like /announcements, /classes
    read: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, server_default="false"))
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )


class ActivityLog(SQLModel, table=True):
    __tablename__ = "activity_log"
    __table_args__ = (
        Index("ix_activity_log_user_id_created_at", "user_id", "created_at"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    action: str = Field(nullable=False)
    entity_type: str = Field(nullable=False)
    entity_id: Optional[uuid.UUID] = Field(default=None)
    details: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    ip_address: Optional[str] = Field(default=None)
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
