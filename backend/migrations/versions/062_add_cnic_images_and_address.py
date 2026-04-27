"""Add address, cnic_front_key, cnic_back_key columns to users

CNIC images are uploaded to S3 during onboarding and attached to
Frappe Sales Order / Sales Invoice. Address is passed to Frappe
as a billing Address doc linked to the Customer.

Revision ID: 062
Revises: 061
"""
from alembic import op
import sqlalchemy as sa

revision = "062"
down_revision = "061"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("address", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("cnic_front_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("cnic_back_key", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "cnic_back_key")
    op.drop_column("users", "cnic_front_key")
    op.drop_column("users", "address")
