"""fee_plans: grace_period_ends_at + frappe_sales_invoice_name

Revision ID: 045
Revises: 044
Create Date: 2026-04-21

Adds 72-hour grace window tracking and the SI pointer used by the new
SI-first sync path.

Column 1: grace_period_ends_at -- NULL for legacy plans (they don't have a
grace window; the enforcement service skips NULL values as "grace already
elapsed"). New plans get NOW() + 72h set by admissions_service.

Column 2: frappe_sales_invoice_name -- populated by the sync when a
Sales Invoice is created from the companion Sales Order. Indexed so inbound
webhooks can look up plans by SI doc name in O(1).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "045"
down_revision = "044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fee_plans",
        sa.Column(
            "grace_period_ends_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "fee_plans",
        sa.Column(
            "frappe_sales_invoice_name",
            sa.String(length=140),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_fee_plans_frappe_sales_invoice_name",
        "fee_plans",
        ["frappe_sales_invoice_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_fee_plans_frappe_sales_invoice_name", table_name="fee_plans",
    )
    op.drop_column("fee_plans", "frappe_sales_invoice_name")
    op.drop_column("fee_plans", "grace_period_ends_at")
