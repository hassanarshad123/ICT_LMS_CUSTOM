"""Add lecture gating fields to batches table

Revision ID: 014
Revises: 013
"""
from alembic import op
import sqlalchemy as sa


revision = "014"
down_revision = "013"


def upgrade() -> None:
    op.add_column(
        "batches",
        sa.Column("enable_lecture_gating", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "batches",
        sa.Column("lecture_gating_threshold", sa.Integer(), nullable=False, server_default="65"),
    )


def downgrade() -> None:
    op.drop_column("batches", "lecture_gating_threshold")
    op.drop_column("batches", "enable_lecture_gating")
