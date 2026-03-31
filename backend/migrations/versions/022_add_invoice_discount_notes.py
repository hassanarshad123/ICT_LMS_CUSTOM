"""Add discount and notes fields to invoices table

Revision ID: 022
Revises: 021
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa

revision = "022"
down_revision = "021"


def upgrade() -> None:
    op.add_column("invoices", sa.Column("discount_type", sa.String(20), nullable=True))
    op.add_column("invoices", sa.Column("discount_value", sa.Integer, nullable=True))
    op.add_column("invoices", sa.Column("discount_amount", sa.Integer, nullable=True))
    op.add_column("invoices", sa.Column("notes", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("invoices", "notes")
    op.drop_column("invoices", "discount_amount")
    op.drop_column("invoices", "discount_value")
    op.drop_column("invoices", "discount_type")
