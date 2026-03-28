"""Add is_active column to student_batches and new batch_history_action enum values

Revision ID: 017
Revises: 016
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade():
    # Add is_active column with default True
    op.add_column(
        "student_batches",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    # Add new enum values to batch_history_action
    op.execute("ALTER TYPE batch_history_action ADD VALUE IF NOT EXISTS 'deactivated'")
    op.execute("ALTER TYPE batch_history_action ADD VALUE IF NOT EXISTS 'activated'")


def downgrade():
    op.drop_column("student_batches", "is_active")
    # Note: PostgreSQL does not support removing enum values
