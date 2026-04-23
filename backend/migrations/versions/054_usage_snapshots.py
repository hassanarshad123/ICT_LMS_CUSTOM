"""add usage_snapshots and platform_snapshots tables

Revision ID: 054
Revises: 053
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "054"
down_revision = "053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "usage_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("institute_id", UUID(as_uuid=True), sa.ForeignKey("institutes.id"), nullable=False),
        sa.Column("snapshot_date", sa.Date, nullable=False),
        sa.Column("users_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("students_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("storage_bytes", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("video_bytes", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("courses_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("lectures_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("zoom_meetings_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("zoom_total_minutes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("institute_id", "snapshot_date", name="uq_usage_snapshot_inst_date"),
    )
    op.create_index("ix_usage_snapshots_date", "usage_snapshots", ["snapshot_date"])

    op.create_table(
        "platform_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("snapshot_date", sa.Date, nullable=False),
        sa.Column("total_institutes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("active_institutes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_users", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_students", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_storage_bytes", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("total_video_bytes", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("total_courses", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_lectures", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("snapshot_date", name="uq_platform_snapshot_date"),
    )


def downgrade() -> None:
    op.drop_table("platform_snapshots")
    op.drop_index("ix_usage_snapshots_date", table_name="usage_snapshots")
    op.drop_table("usage_snapshots")
