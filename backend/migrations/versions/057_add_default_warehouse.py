"""Add default_warehouse column to institute_integrations

Stock-type Items in Frappe require a delivery warehouse on Sales Order
line items. This column lets each institute configure which warehouse
to use when the sync service creates Sales Orders.

Revision ID: 057
Revises: 056
"""
from alembic import op
import sqlalchemy as sa

revision = "057"
down_revision = "056"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "institute_integrations",
        sa.Column("default_warehouse", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("institute_integrations", "default_warehouse")
