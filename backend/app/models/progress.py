import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import ForeignKey, UniqueConstraint, Index, CheckConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID

from app.models.enums import LectureWatchStatus


class LectureProgress(SQLModel, table=True):
    __tablename__ = "lecture_progress"
    __table_args__ = (
        UniqueConstraint("student_id", "lecture_id", name="uq_lecture_progress_student_lecture"),
        Index("ix_lecture_progress_student_id", "student_id"),
        Index("ix_lecture_progress_institute_id", "institute_id"),
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
