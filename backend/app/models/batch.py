import uuid
from datetime import date, datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import ForeignKey, Index, Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID

from app.models.enums import BatchHistoryAction


class Batch(SQLModel, table=True):
    __tablename__ = "batches"

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
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )


class StudentBatchHistory(SQLModel, table=True):
    __tablename__ = "student_batch_history"

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
