"""Add starter tier and max_students column

Revision ID: 029
Revises: 028
Create Date: 2026-04-08

Adds the 'starter' value to the plan_tier enum and a new max_students
column on the institutes table for the 5-tier PKR pricing model.

NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction on
Postgres, so this migration runs with transactional=False. The two
changes are committed independently.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '029'
down_revision = '028'
branch_labels = None
depends_on = None

# Postgres disallows ALTER TYPE ... ADD VALUE inside a transaction block.
# Alembic honors this flag and commits each statement on its own.
transactional = False


def upgrade():
    # 1. Add 'starter' to the plan_tier enum (between 'free' and 'basic')
    # Idempotent: IF NOT EXISTS guards against re-runs.
    op.execute("ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'starter' AFTER 'free'")

    # 2. Add max_students column with a safe default
    op.add_column(
        'institutes',
        sa.Column(
            'max_students',
            sa.Integer(),
            nullable=False,
            server_default='15',
        ),
    )

    # 3. Backfill max_students for existing institutes based on their current plan_tier.
    # Values match PLAN_LIMITS in backend/app/utils/plan_limits.py (Phase 2).
    op.execute("""
        UPDATE institutes
        SET max_students = CASE plan_tier
            WHEN 'free'       THEN 15
            WHEN 'basic'      THEN 250
            WHEN 'pro'        THEN 1000
            WHEN 'enterprise' THEN 100000
            ELSE 15
        END
        WHERE deleted_at IS NULL
    """)


def downgrade():
    # 1. Drop max_students column
    op.drop_column('institutes', 'max_students')

    # 2. Removing an enum value requires recreating the type — skipped for safety.
    # Any institute on 'starter' would need to be migrated to another tier first.
    # If you really need to drop 'starter':
    #   - UPDATE institutes SET plan_tier = 'free' WHERE plan_tier = 'starter';
    #   - CREATE TYPE plan_tier_new AS ENUM ('free', 'basic', 'pro', 'enterprise');
    #   - ALTER TABLE institutes ALTER COLUMN plan_tier TYPE plan_tier_new USING plan_tier::text::plan_tier_new;
    #   - DROP TYPE plan_tier; ALTER TYPE plan_tier_new RENAME TO plan_tier;
    pass
