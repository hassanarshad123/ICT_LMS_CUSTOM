"""Add fee_plan Frappe fields + fee_payment proof URL columns.

Revision ID: 043
Revises: 042
Create Date: 2026-04-20

Adds three columns to fee_plans and two to fee_payments to persist
Frappe-side references needed by the upcoming Sales Order sync path:

  fee_plans.frappe_item_code            — ERP Item picked by the AO
  fee_plans.frappe_payment_terms_template — ERP PTT picked by the AO
  fee_plans.frappe_sales_order_name      — populated by the sync (idempotency)

  fee_payments.payment_proof_url  — signed URL for Frappe display (7-day)
  fee_payments.payment_proof_key  — S3 object key (source of truth)

Index on frappe_sales_order_name so inbound webhooks can look up plans
by Frappe's SO doc name in O(1).

All columns are nullable; this migration does NOT backfill any data.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "043"
down_revision = "042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fee_plans",
        sa.Column("frappe_item_code", sa.String(length=140), nullable=True),
    )
    op.add_column(
        "fee_plans",
        sa.Column("frappe_payment_terms_template", sa.String(length=140), nullable=True),
    )
    op.add_column(
        "fee_plans",
        sa.Column("frappe_sales_order_name", sa.String(length=140), nullable=True),
    )

    op.add_column(
        "fee_payments",
        sa.Column("payment_proof_url", sa.Text(), nullable=True),
    )
    op.add_column(
        "fee_payments",
        sa.Column("payment_proof_key", sa.Text(), nullable=True),
    )

    op.create_index(
        "ix_fee_plans_frappe_sales_order_name",
        "fee_plans",
        ["frappe_sales_order_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_fee_plans_frappe_sales_order_name", table_name="fee_plans")
    op.drop_column("fee_payments", "payment_proof_key")
    op.drop_column("fee_payments", "payment_proof_url")
    op.drop_column("fee_plans", "frappe_sales_order_name")
    op.drop_column("fee_plans", "frappe_payment_terms_template")
    op.drop_column("fee_plans", "frappe_item_code")
