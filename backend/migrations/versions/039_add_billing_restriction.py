"""Add billing_restriction column to institutes

Revision ID: 039
Revises: 038
Create Date: 2026-04-17

PR 3 of the pricing-v2 rollout. Purely additive.

Adds `billing_restriction` (VARCHAR(16), NULL) to the institutes table.
Set by the v2 late-payment scheduler when an invoice is overdue:
  NULL          → normal operation (default for every existing row)
  "add_blocked" → day 15+ overdue: POST /users + uploads refused
  "read_only"   → day 30+ overdue: all writes refused

Only ever set for institutes on v2 billing tiers (professional, custom).
Grandfathered tiers are untouched by the late-payment scheduler — ICT
etc. will always have billing_restriction = NULL.

Matches the danger-filter pattern in deploy-bg.sh: no DROP, no RENAME,
no ALTER SET NOT NULL.
"""
from alembic import op
import sqlalchemy as sa


revision = "039"
down_revision = "038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "institutes",
        sa.Column("billing_restriction", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("institutes", "billing_restriction")
