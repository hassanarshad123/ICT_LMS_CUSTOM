"""Add institute_addons table for Pricing v2 storage packs

Revision ID: 038
Revises: 037
Create Date: 2026-04-17

PR 2 of the pricing-v2 rollout (see docs/pricing-v2-implementation-plan.md).

Purely additive. Creates one new table — institute_addons — that stores
storage-pack subscriptions for Professional and Custom institutes.
Grandfathered tiers (free/starter/basic/pro/enterprise) never insert
into this table; the addon_service and institute_service both gate on
is_v2_billing_tier() before reading or writing.

ICT.ZENSBOT.ONLINE (plan_tier='pro') is therefore unaffected — no rows
are created for it, and the storage quota check for 'pro' returns
without ever selecting from institute_addons.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision = "038"
down_revision = "037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "institute_addons",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "institute_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("institutes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # addon_type maps to a key in ADDON_PRICING (plan_limits.py).
        # Stored as plain string so new pack types don't need a migration.
        sa.Column("addon_type", sa.String(length=32), nullable=False),
        sa.Column(
            "quantity",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
        # Snapshot of pricing at activation time — price changes to
        # ADDON_PRICING do not retroactively affect subscriptions.
        sa.Column("unit_price_pkr", sa.Integer(), nullable=False),
        sa.Column("storage_bonus_gb", sa.Float(), nullable=False),
        sa.Column("storage_bonus_kind", sa.String(length=16), nullable=False),
        sa.Column(
            "activated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("cancelled_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "cancelled_effective_at", sa.TIMESTAMP(timezone=True), nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Query pattern: "what's active right now for this institute?" —
    # hits both list_addons() and get_addon_storage_bonus(). A single
    # composite index covers both.
    op.create_index(
        "ix_institute_addons_active_lookup",
        "institute_addons",
        ["institute_id", "cancelled_effective_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_institute_addons_active_lookup", table_name="institute_addons",
    )
    op.drop_table("institute_addons")
