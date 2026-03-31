"""Add user_email_preferences table for student email opt-out

Revision ID: 023
Revises: 022
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP

revision = "023"
down_revision = "022"


def upgrade() -> None:
    op.create_table(
        "user_email_preferences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("email_type", sa.String(50), nullable=False),
        sa.Column("subscribed", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "email_type", name="uq_user_email_pref"),
    )
    op.create_index("ix_user_email_preferences_user_id", "user_email_preferences", ["user_id"])


def downgrade() -> None:
    op.drop_table("user_email_preferences")
