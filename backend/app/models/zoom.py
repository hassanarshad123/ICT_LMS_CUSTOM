import uuid
from datetime import date, time, datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Integer, BigInteger, Boolean, UniqueConstraint, Index
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP

from app.models.enums import ZoomClassStatus, RecordingStatus


class ZoomAccount(SQLModel, table=True):
    __tablename__ = "zoom_accounts"
    __table_args__ = (
        Index(
            "uq_zoom_account_active",
            "account_id",
            unique=True,
            postgresql_where=Column("deleted_at").is_(None),
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    account_name: str = Field(nullable=False)
    account_id: str = Field(nullable=False)
    client_id: str = Field(nullable=False)
    client_secret: str = Field(nullable=False)  # Fernet encrypted
    is_default: bool = Field(default=False)
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


class ZoomClass(SQLModel, table=True):
    __tablename__ = "zoom_classes"
    __table_args__ = (
        Index("ix_zoom_classes_batch_id", "batch_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    batch_id: uuid.UUID = Field(nullable=False, foreign_key="batches.id")
    teacher_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    zoom_account_id: uuid.UUID = Field(nullable=False, foreign_key="zoom_accounts.id")
    title: str = Field(nullable=False)
    scheduled_date: date = Field(nullable=False)
    scheduled_time: time = Field(nullable=False)
    duration: int = Field(nullable=False)
    zoom_meeting_id: Optional[str] = Field(default=None)
    zoom_meeting_url: Optional[str] = Field(default=None)
    zoom_start_url: Optional[str] = Field(default=None)
    status: ZoomClassStatus = Field(
        sa_column=Column(
            SAEnum(ZoomClassStatus, name="zoom_class_status", create_type=False),
            nullable=False,
            server_default="upcoming",
        )
    )
    reminder_sent: bool = Field(default=False)
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


class ClassRecording(SQLModel, table=True):
    __tablename__ = "class_recordings"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    zoom_class_id: uuid.UUID = Field(nullable=False, foreign_key="zoom_classes.id")
    bunny_video_id: Optional[str] = Field(default=None)
    bunny_library_id: Optional[str] = Field(default=None)
    original_download_url: Optional[str] = Field(default=None)
    duration: Optional[int] = Field(default=None)
    file_size: Optional[int] = Field(default=None, sa_column=Column(BigInteger))
    status: RecordingStatus = Field(
        sa_column=Column(
            SAEnum(RecordingStatus, name="recording_status", create_type=False),
            nullable=False,
            server_default="processing",
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


class ZoomAttendance(SQLModel, table=True):
    __tablename__ = "zoom_attendance"
    __table_args__ = (
        UniqueConstraint("zoom_class_id", "student_id", name="uq_zoom_attendance_class_student"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    zoom_class_id: uuid.UUID = Field(nullable=False, foreign_key="zoom_classes.id")
    student_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    attended: bool = Field(nullable=False)
    join_time: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    leave_time: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    duration_minutes: Optional[int] = Field(default=None)
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
