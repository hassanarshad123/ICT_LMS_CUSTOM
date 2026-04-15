"""Add auto_create_customers flag to institute_integrations

Part of Tier 2 of the self-service Frappe wizard. When True (the default),
the outbound sync auto-creates a Customer in Frappe if one doesn't exist
for the student yet — closes the v1 "Customer not found" gap without
forcing admins to bulk-import customers before enabling sync.

Revision ID: 035
Revises: 034
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa


revision = "035"
down_revision = "034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "institute_integrations",
        sa.Column(
            "auto_create_customers",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("institute_integrations", "auto_create_customers")
