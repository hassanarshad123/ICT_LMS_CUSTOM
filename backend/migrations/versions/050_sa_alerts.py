"""create sa_alerts and sa_alert_preferences tables

Revision ID: 050
Revises: 049
Create Date: 2026-04-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "050"
down_revision = "049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sa_alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("alert_type", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False, server_default="info"),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("entity_type", sa.String(32), nullable=True),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column("link", sa.String(256), nullable=True),
        sa.Column("read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("dedup_key", sa.String(256), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.execute("CREATE INDEX ix_sa_alerts_read_created ON sa_alerts (read, created_at DESC)")
    op.create_index("ix_sa_alerts_type", "sa_alerts", ["alert_type"])

    op.create_table(
        "sa_alert_preferences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("alert_type", sa.String(64), nullable=False),
        sa.Column("muted", sa.Boolean, nullable=False, server_default="false"),
        sa.UniqueConstraint("user_id", "alert_type"),
    )


def downgrade() -> None:
    op.drop_table("sa_alert_preferences")
    op.drop_index("ix_sa_alerts_type", table_name="sa_alerts")
    op.drop_index("ix_sa_alerts_read_created", table_name="sa_alerts")
    op.drop_table("sa_alerts")
