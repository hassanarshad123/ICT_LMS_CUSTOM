import uuid
from datetime import date, datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import ForeignKey, Index, Text, Integer, String, Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID

from app.models.enums import BatchHistoryAction


class Batch(SQLModel, table=True):
    __tablename__ = "batches"
    __table_args__ = (
        Index("ix_batches_institute_id", "institute_id"),
        Index("ix_batches_teacher_id", "teacher_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(nullable=False)
    teacher_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="users.id"
    )
    start_date: date = Field(nullable=False)
    end_date: date = Field(nullable=False)
    created_by: Optional[uuid.UUID] = Field(
        default=None, foreign_key="users.id"
    )
    enable_lecture_gating: bool = Field(default=False)
    lecture_gating_threshold: int = Field(default=65)
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
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )


class StudentBatch(SQLModel, table=True):
    __tablename__ = "student_batches"
    __table_args__ = (
        Index(
            "uq_student_batch_active",
            "student_id", "batch_id",
            unique=True,
            postgresql_where=Column("removed_at").is_(None),
        ),
        Index("ix_student_batches_batch_id", "batch_id"),
        Index("ix_student_batches_student_id", "student_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    student_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    batch_id: uuid.UUID = Field(nullable=False, foreign_key="batches.id")
    enrolled_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    enrolled_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    removed_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    removed_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    is_active: bool = Field(default=True, nullable=False)
    extended_end_date: Optional[date] = Field(default=None)
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )


class StudentBatchHistory(SQLModel, table=True):
    __tablename__ = "student_batch_history"
    __table_args__ = (
        Index("ix_student_batch_history_student_id", "student_id"),
        Index("ix_student_batch_history_batch_id", "batch_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    student_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    batch_id: Optional[uuid.UUID] = Field(default=None, foreign_key="batches.id")
    action: BatchHistoryAction = Field(
        sa_column=Column(
            SAEnum(BatchHistoryAction, name="batch_history_action", create_type=False),
            nullable=False,
        )
    )
    changed_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )


class BatchExtensionLog(SQLModel, table=True):
    __tablename__ = "batch_extension_logs"
    __table_args__ = (
        Index("ix_batch_extension_logs_student_batch", "student_batch_id"),
        Index("ix_batch_extension_logs_batch_id", "batch_id"),
        Index("ix_batch_extension_logs_institute_id", "institute_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    student_batch_id: uuid.UUID = Field(nullable=False, foreign_key="student_batches.id")
    student_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    batch_id: uuid.UUID = Field(nullable=False, foreign_key="batches.id")
    previous_end_date: Optional[date] = Field(default=None)
    new_end_date: date = Field(nullable=False)
    extension_type: str = Field(sa_column=Column(String, nullable=False))
    duration_days: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True))
    reason: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    extended_by: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    )
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
