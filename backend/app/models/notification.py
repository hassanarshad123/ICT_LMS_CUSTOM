import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Boolean, ForeignKey, Index
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID


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
