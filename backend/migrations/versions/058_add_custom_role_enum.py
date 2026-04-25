"""Add 'custom' value to user_role enum

Revision ID: 058
Revises: 057
Create Date: 2026-04-26
"""
from alembic import op

revision = "058"
down_revision = "057"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'custom'")


def downgrade() -> None:
    pass
