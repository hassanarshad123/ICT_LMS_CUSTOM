from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
import uuid

import sqlalchemy as sa
from sqlmodel import SQLModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SAAlert(SQLModel, table=True):
    __tablename__ = "sa_alerts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    alert_type: str = Field(max_length=64, nullable=False)
    severity: str = Field(default="info", max_length=16)
    title: str = Field(max_length=256, nullable=False)
    message: str = Field(sa_column=sa.Column(sa.Text, nullable=False))
    entity_type: Optional[str] = Field(default=None, max_length=32)
    entity_id: Optional[uuid.UUID] = Field(default=None)
    link: Optional[str] = Field(default=None, max_length=256)
    read: bool = Field(
        default=False,
        sa_column=sa.Column(sa.Boolean, nullable=False, server_default="false"),
    )
    dedup_key: Optional[str] = Field(
        default=None,
        sa_column=sa.Column(sa.String(256), unique=True, nullable=True),
    )
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=sa.Column(
            sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")
        ),
    )


class SAAlertPreference(SQLModel, table=True):
    __tablename__ = "sa_alert_preferences"
    __table_args__ = (sa.UniqueConstraint("user_id", "alert_type"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(nullable=False, foreign_key="users.id")
    alert_type: str = Field(max_length=64, nullable=False)
    muted: bool = Field(default=False)
