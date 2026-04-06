"""Add title, description, deleted_at to class_recordings

Revision ID: 028
Revises: 027
Create Date: 2026-04-06
"""
import sqlalchemy as sa
from alembic import op

revision = "028"
down_revision = "027"


def upgrade() -> None:
    op.add_column("class_recordings", sa.Column("title", sa.String(255), nullable=True))
    op.add_column("class_recordings", sa.Column("description", sa.Text(), nullable=True))
    op.add_column(
        "class_recordings",
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("class_recordings", "deleted_at")
    op.drop_column("class_recordings", "description")
    op.drop_column("class_recordings", "title")
