"""certificate redesign - add certificate_name, requested_at, make cert_id/verification_code nullable

Revision ID: 004
Revises: 003
Create Date: 2026-03-09
"""
from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE certificates ADD COLUMN IF NOT EXISTS certificate_name VARCHAR")
    op.execute("ALTER TABLE certificates ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ")
    op.execute("ALTER TABLE certificates ALTER COLUMN certificate_id DROP NOT NULL")
    op.execute("ALTER TABLE certificates ALTER COLUMN verification_code DROP NOT NULL")


def downgrade() -> None:
    # Backfill nulls before restoring NOT NULL constraints
    op.execute("UPDATE certificates SET certificate_id = 'UNKNOWN' WHERE certificate_id IS NULL")
    op.execute("UPDATE certificates SET verification_code = 'UNKNOWN' WHERE verification_code IS NULL")
    op.execute("ALTER TABLE certificates ALTER COLUMN certificate_id SET NOT NULL")
    op.execute("ALTER TABLE certificates ALTER COLUMN verification_code SET NOT NULL")
    op.execute("ALTER TABLE certificates DROP COLUMN IF EXISTS requested_at")
    op.execute("ALTER TABLE certificates DROP COLUMN IF EXISTS certificate_name")
