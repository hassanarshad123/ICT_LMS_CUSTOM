"""Add Pricing v2 tiers (professional, custom) + InstituteBilling v2 columns

Revision ID: 037
Revises: 036
Create Date: 2026-04-17

PR 1 of the pricing-v2 rollout (see docs/pricing-v2-implementation-plan.md).

Purely additive. No existing institute row is modified. Grandfathered
institutes (basic/pro/enterprise/starter/free) are untouched and continue
to use the legacy billing flow — the v2 billing engine explicitly filters
to plan_tier IN ('professional', 'custom') before doing anything.

Changes:
  1. Add 'professional' and 'custom' values to the plan_tier enum.
  2. Add free_users_included INT NOT NULL DEFAULT 0 to institute_billing.
  3. Add custom_pricing_config JSONB NULL to institute_billing.

NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction on
Postgres, so this migration runs with transactional=False. Each statement
commits independently. See migrations/versions/029_* for the same pattern.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision = "037"
down_revision = "036"
branch_labels = None
depends_on = None

# Postgres disallows ALTER TYPE ... ADD VALUE inside a transaction block.
transactional = False


def upgrade() -> None:
    # 1. Extend plan_tier enum. Idempotent — IF NOT EXISTS guards re-runs.
    # Placement: after 'enterprise' so the canonical v2 tiers sit at the end.
    # (Postgres enum ordering only matters for ORDER BY; application code
    # uses string comparison, so placement is cosmetic.)
    op.execute("ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'professional'")
    op.execute("ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'custom'")

    # 2. free_users_included — how many users/students are included before
    # extra_user_rate kicks in. Default 0 means "no free tier, charge from
    # the first extra user" which matches all existing legacy configs.
    # Professional signups will set this to 10 in PR 4.
    op.add_column(
        "institute_billing",
        sa.Column(
            "free_users_included",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    # 3. custom_pricing_config — JSONB blob for Custom-tier volume discounts
    # and addon overrides. NULL for every non-Custom institute.
    op.add_column(
        "institute_billing",
        sa.Column(
            "custom_pricing_config",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    # 1. Drop the two new columns.
    op.drop_column("institute_billing", "custom_pricing_config")
    op.drop_column("institute_billing", "free_users_included")

    # 2. Removing an enum value requires recreating the type — skipped for
    # safety (same policy as migration 029). Any institute on 'professional'
    # or 'custom' would need to be migrated to another tier first. If truly
    # necessary:
    #   UPDATE institutes SET plan_tier = 'free'
    #     WHERE plan_tier IN ('professional', 'custom');
    #   CREATE TYPE plan_tier_new AS ENUM ('free', 'starter', 'basic', 'pro', 'enterprise');
    #   ALTER TABLE institutes ALTER COLUMN plan_tier TYPE plan_tier_new
    #     USING plan_tier::text::plan_tier_new;
    #   DROP TYPE plan_tier;
    #   ALTER TYPE plan_tier_new RENAME TO plan_tier;
    pass
