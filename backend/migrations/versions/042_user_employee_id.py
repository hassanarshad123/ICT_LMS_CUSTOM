"""add users.employee_id for Frappe Sales Person linking

Revision ID: 042
Revises: 041
Create Date: 2026-04-20

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "042"
down_revision = "041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("employee_id", sa.String(length=64), nullable=True),
    )
    # Partial unique index: enforce uniqueness of employee_id per institute,
    # but only for non-deleted rows with a non-null employee_id.
    op.create_index(
        "uq_user_employee_id_institute",
        "users",
        ["institute_id", "employee_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL AND employee_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_user_employee_id_institute", table_name="users")
    op.drop_column("users", "employee_id")
