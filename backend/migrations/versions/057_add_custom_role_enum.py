"""Add 'custom' value to user_role enum

Revision ID: 057
Revises: 056
Create Date: 2026-04-26
"""
from alembic import op

revision = "057"
down_revision = "056"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'custom'")


def downgrade() -> None:
    pass
