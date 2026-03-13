import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import ForeignKey, Index
from sqlalchemy.dialects.postgresql import TIMESTAMP, JSONB, UUID as PG_UUID


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
