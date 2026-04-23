"""Add resolution_notes column to error_logs

Revision ID: 056
Revises: 055
"""
from alembic import op
import sqlalchemy as sa

revision = "056"
down_revision = "055"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("error_logs", sa.Column("resolution_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("error_logs", "resolution_notes")
