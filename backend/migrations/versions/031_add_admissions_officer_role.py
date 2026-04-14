"""Add admissions_officer to user_role enum

Revision ID: 031
Revises: 030
Create Date: 2026-04-14
"""
from alembic import op

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend the existing Postgres user_role enum. IF NOT EXISTS makes it idempotent.
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admissions_officer'")


def downgrade() -> None:
    # Postgres cannot remove enum values without recreating the type.
    # Intentional no-op: safe because no rows will reference the value
    # until Milestone B wires up officer creation.
    pass
