"""add trigram indexes for SA global search

Revision ID: 051
Revises: 050
Create Date: 2026-04-22
"""
from alembic import op

revision = "051"
down_revision = "050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_institutes_name_trgm ON institutes USING gin (name gin_trgm_ops)")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_name_trgm ON users USING gin (name gin_trgm_ops)")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_users_email_trgm ON users USING gin (email gin_trgm_ops)")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_invoices_number_trgm ON invoices USING gin (invoice_number gin_trgm_ops)")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_courses_title_trgm ON courses USING gin (title gin_trgm_ops)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_courses_title_trgm")
    op.execute("DROP INDEX IF EXISTS ix_invoices_number_trgm")
    op.execute("DROP INDEX IF EXISTS ix_users_email_trgm")
    op.execute("DROP INDEX IF EXISTS ix_users_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_institutes_name_trgm")
