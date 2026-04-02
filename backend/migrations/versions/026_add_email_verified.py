"""Add email_verified column to users table

Revision ID: 026
Revises: 025
Create Date: 2026-04-02
"""
from alembic import op
import sqlalchemy as sa

revision = "026"
down_revision = "025"


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"),
    )
    # Grandfather all existing users as verified
    op.execute("UPDATE users SET email_verified = true")


def downgrade() -> None:
    op.drop_column("users", "email_verified")
