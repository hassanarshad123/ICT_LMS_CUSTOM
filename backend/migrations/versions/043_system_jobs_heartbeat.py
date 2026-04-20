"""Create system_jobs heartbeat table.

Revision ID: 043
Revises: 042
Create Date: 2026-04-20

Before this migration, /sa/health returned a hardcoded list of job
statuses that always said "active" regardless of whether the job had
actually run recently. A crash in, say, send_batch_expiry_notifications
would be invisible to SA — the job would just stop firing silently.

This table is the ground truth: scheduler jobs write a heartbeat
here on every run. The SA health endpoint JOINs against it so
"Last run" / "Last status" / "Last error" are live data.

Schema:
  name           — PK, matches the scheduler job id (unique string)
  last_run_at    — UTC timestamp of the most recent invocation start
  last_status    — one of: success | failure | running
  last_error     — NULL or short string (first ~500 chars of Exception)
  last_duration_ms — how long the last run took
  next_run_at    — NULL or UTC timestamp, advisory only
  updated_at     — same semantics as the other tables

Row per job is inserted on the first successful start; subsequent
runs UPDATE in place.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "043"
down_revision = "042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_jobs",
        sa.Column("name", sa.String(length=128), primary_key=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "last_status",
            sa.String(length=16),
            nullable=True,
            comment="success | failure | running",
        ),
        sa.Column("last_error", sa.String(length=500), nullable=True),
        sa.Column("last_duration_ms", sa.Integer(), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_system_jobs_last_run_at",
        "system_jobs",
        ["last_run_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_system_jobs_last_run_at", table_name="system_jobs")
    op.drop_table("system_jobs")
