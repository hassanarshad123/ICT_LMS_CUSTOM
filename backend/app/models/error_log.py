import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text, Boolean, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import TIMESTAMP, JSONB, UUID as PG_UUID


class ErrorLog(SQLModel, table=True):
    __tablename__ = "error_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    level: str = Field(nullable=False)  # error, warning, critical
    message: str = Field(sa_column=Column(Text, nullable=False))
    traceback: Optional[str] = Field(default=None, sa_column=Column(Text))

    # Request context
    request_id: Optional[str] = Field(default=None)
    request_method: Optional[str] = Field(default=None)
    request_path: Optional[str] = Field(default=None)
    status_code: Optional[int] = Field(default=None, sa_column=Column(Integer))

    # User context
    user_id: Optional[uuid.UUID] = Field(default=None)
    user_email: Optional[str] = Field(default=None)

    # Client info
    ip_address: Optional[str] = Field(default=None)
    user_agent: Optional[str] = Field(default=None)

    # Source: "backend" or "frontend"
    source: str = Field(default="backend")

    # Resolution
    resolved: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
    )
    resolved_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True)),
    )
    resolved_by: Optional[uuid.UUID] = Field(default=None)

    # Extra context (JSONB)
    extra: Optional[dict] = Field(default=None, sa_column=Column(JSONB))

    # Institute context
    institute_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=True),
    )

    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
