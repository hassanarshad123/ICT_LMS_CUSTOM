"""add payfast fields to invoices and institute_billing

Revision ID: 052
Revises: 051
Create Date: 2026-04-22
"""
from alembic import op
import sqlalchemy as sa

revision = "052"
down_revision = "051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("basket_id", sa.String(64), nullable=True, unique=True))
    op.add_column("invoices", sa.Column("payfast_transaction_id", sa.String(128), nullable=True))
    op.add_column("institute_billing", sa.Column("payfast_enabled", sa.Boolean, nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("institute_billing", "payfast_enabled")
    op.drop_column("invoices", "payfast_transaction_id")
    op.drop_column("invoices", "basket_id")
