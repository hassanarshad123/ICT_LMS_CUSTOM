"""Add 'unlimited' value to plan_tier enum.

Revision ID: 040
Revises: 039
Create Date: 2026-04-20

Purely additive. Adds a new enum value 'unlimited' to the plan_tier type.
No existing row is modified here — the data migration for ICT and ICTBusiness
lives in 041_migrate_ict_to_unlimited.

The 'unlimited' tier is an SA-only internal tier: truly unlimited quotas,
fully comped, explicitly excluded from the v2 billing engine (it is NOT
added to V2_BILLING_TIERS in app/utils/plan_limits.py), so the monthly
invoice cron and late-payment cron never touch it.

NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction on
Postgres, so this migration runs with transactional=False. Each statement
commits independently. See migrations/versions/037_* for the same pattern.
"""
from alembic import op


# revision identifiers
revision = "040"
down_revision = "039"
branch_labels = None
depends_on = None

# Postgres disallows ALTER TYPE ... ADD VALUE inside a transaction block.
transactional = False


def upgrade() -> None:
    # Idempotent — IF NOT EXISTS guards re-runs.
    op.execute("ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'unlimited'")


def downgrade() -> None:
    # Removing an enum value requires recreating the type — skipped for
    # safety (same policy as migrations 029 and 037). Any institute on
    # 'unlimited' would need to be migrated to another tier first. If truly
    # necessary:
    #   UPDATE institutes SET plan_tier = 'enterprise'
    #     WHERE plan_tier = 'unlimited';
    #   CREATE TYPE plan_tier_new AS ENUM (
    #     'free','starter','basic','pro','enterprise','professional','custom'
    #   );
    #   ALTER TABLE institutes ALTER COLUMN plan_tier TYPE plan_tier_new
    #     USING plan_tier::text::plan_tier_new;
    #   DROP TYPE plan_tier;
    #   ALTER TYPE plan_tier_new RENAME TO plan_tier;
    pass
