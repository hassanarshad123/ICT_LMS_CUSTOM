"""users.suspension_reason for Frappe-driven auto-suspension tracking

Revision ID: 044
Revises: 043
Create Date: 2026-04-21

Adds a nullable suspension_reason string so the auto-suspension job can
identify which suspensions it created (reason="overdue_fees") and lift
them when Frappe confirms payment. A manual admin-initiated suspend has
reason=None (or a human-readable string) so the cron won't auto-lift it.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "044"
down_revision = "043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("suspension_reason", sa.String(length=64), nullable=True),
    )
    # Partial index: only index rows with a non-null reason (typical: < 1% of users).
    op.create_index(
        "ix_users_suspension_reason",
        "users",
        ["suspension_reason"],
        unique=False,
        postgresql_where=sa.text("suspension_reason IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_users_suspension_reason", table_name="users")
    op.drop_column("users", "suspension_reason")
