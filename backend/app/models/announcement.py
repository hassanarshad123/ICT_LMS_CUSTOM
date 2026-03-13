import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import ForeignKey, Index
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID

from app.models.enums import AnnouncementScope


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
