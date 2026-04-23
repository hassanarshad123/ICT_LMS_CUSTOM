"""add platform_costs, institute_cost_attributions, and quota_alert_logs tables

Revision ID: 055
Revises: 054
Create Date: 2026-04-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "055"
down_revision = "054"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_costs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("month", sa.Date, nullable=False),
        sa.Column("service", sa.String(32), nullable=False),
        sa.Column("amount_usd", sa.Float, nullable=False, server_default="0"),
        sa.Column("amount_pkr", sa.Float, nullable=False, server_default="0"),
        sa.Column("source", sa.String(16), nullable=False, server_default="'manual'"),
        sa.Column("raw_data", JSONB, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("month", "service", name="uq_platform_cost_month_service"),
    )

    op.create_table(
        "institute_cost_attributions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("institute_id", UUID(as_uuid=True), sa.ForeignKey("institutes.id"), nullable=False),
        sa.Column("month", sa.Date, nullable=False),
        sa.Column("service", sa.String(32), nullable=False),
        sa.Column("amount_usd", sa.Float, nullable=False, server_default="0"),
        sa.Column("amount_pkr", sa.Float, nullable=False, server_default="0"),
        sa.Column("usage_ratio", sa.Float, nullable=False, server_default="0"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("institute_id", "month", "service", name="uq_cost_attr_inst_month_svc"),
    )
    op.create_index("ix_cost_attr_month", "institute_cost_attributions", ["month"])

    op.create_table(
        "quota_alert_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("institute_id", UUID(as_uuid=True), sa.ForeignKey("institutes.id"), nullable=False),
        sa.Column("resource", sa.String(16), nullable=False),
        sa.Column("threshold_pct", sa.Integer, nullable=False),
        sa.Column("sent_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("notified_sa", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("notified_admin", sa.Boolean, nullable=False, server_default="false"),
        sa.UniqueConstraint("institute_id", "resource", "threshold_pct", name="uq_quota_alert_inst_res_thresh"),
    )
    op.create_index("ix_quota_alert_institute", "quota_alert_logs", ["institute_id"])


def downgrade() -> None:
    op.drop_index("ix_quota_alert_institute", table_name="quota_alert_logs")
    op.drop_table("quota_alert_logs")
    op.drop_index("ix_cost_attr_month", table_name="institute_cost_attributions")
    op.drop_table("institute_cost_attributions")
    op.drop_table("platform_costs")
