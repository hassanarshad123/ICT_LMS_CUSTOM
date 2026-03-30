"""Add access control columns: activity_log.impersonated_by, api_keys.scopes

- impersonated_by: tracks when SA performs actions while impersonating a user
- scopes: restricts API key permissions (default read-only)

Revision ID: 019
Revises: 018
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SA impersonation audit trail
    op.add_column(
        "activity_log",
        sa.Column("impersonated_by", UUID(as_uuid=True), nullable=True),
    )

    # API key scoped permissions (default read-only)
    op.add_column(
        "api_keys",
        sa.Column(
            "scopes",
            ARRAY(sa.Text),
            nullable=False,
            server_default=sa.text("ARRAY['read']::text[]"),
        ),
    )


def downgrade() -> None:
    op.drop_column("api_keys", "scopes")
    op.drop_column("activity_log", "impersonated_by")
