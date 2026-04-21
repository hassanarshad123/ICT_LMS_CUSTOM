"""System job heartbeat model.

Each scheduled job upserts a row here on every run (see
``app/utils/job_heartbeat.py`` for the decorator that drives this).
The SA health endpoint JOINs against this table so the UI shows real
last-run / status / error data instead of hardcoded "active" strings.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import sqlalchemy as sa
from sqlmodel import SQLModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SystemJob(SQLModel, table=True):
    __tablename__ = "system_jobs"

    name: str = Field(primary_key=True, max_length=128)
    last_run_at: Optional[datetime] = Field(
        default=None,
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True),
    )
    # One of: "success" | "failure" | "running"
    last_status: Optional[str] = Field(default=None, max_length=16)
    last_error: Optional[str] = Field(default=None, max_length=500)
    last_duration_ms: Optional[int] = Field(default=None)
    next_run_at: Optional[datetime] = Field(
        default=None,
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True),
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=sa.Column(
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
