"""Add cnic_no and father_name columns to users

Collected during student onboarding and passed to Frappe Sales Order
as custom_cnic_no and custom_father_name.

Revision ID: 061
Revises: 060
"""
from alembic import op
import sqlalchemy as sa

revision = "061"
down_revision = "060"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("cnic_no", sa.String(), nullable=True))
    op.add_column("users", sa.Column("father_name", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "father_name")
    op.drop_column("users", "cnic_no")
