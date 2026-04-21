import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import ForeignKey, UniqueConstraint, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID


class EmailTemplate(SQLModel, table=True):
    __tablename__ = "email_templates"
    __table_args__ = (
        UniqueConstraint("template_key", "institute_id", name="uq_email_template_key_institute"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    template_key: str = Field(nullable=False, max_length=64)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False),
    )
    subject: str = Field(nullable=False, max_length=512)
    body_html: str = Field(sa_column=Column(Text, nullable=False))
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
