"""Add error_logs table for monitoring

Revision ID: 005
Revises: 004
Create Date: 2026-03-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS error_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            level VARCHAR NOT NULL,
            message TEXT NOT NULL,
            traceback TEXT,
            request_id VARCHAR,
            request_method VARCHAR,
            request_path VARCHAR,
            status_code INTEGER,
            user_id UUID,
            user_email VARCHAR,
            ip_address VARCHAR,
            user_agent VARCHAR,
            source VARCHAR NOT NULL DEFAULT 'backend',
            resolved BOOLEAN NOT NULL DEFAULT false,
            resolved_at TIMESTAMPTZ,
            resolved_by UUID,
            extra JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Index for common queries
    op.execute("CREATE INDEX IF NOT EXISTS ix_error_logs_created_at ON error_logs (created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_error_logs_resolved ON error_logs (resolved) WHERE resolved = false")
    op.execute("CREATE INDEX IF NOT EXISTS ix_error_logs_source ON error_logs (source)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_error_logs_level ON error_logs (level)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS error_logs")
