import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID


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
