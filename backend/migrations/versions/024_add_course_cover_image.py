"""Add cover_image_key to courses table

Revision ID: 024
Revises: 023
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa

revision = "024"
down_revision = "023"


def upgrade() -> None:
    op.add_column("courses", sa.Column("cover_image_key", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("courses", "cover_image_key")
