"""Migrate ict + ictbusiness to the 'unlimited' plan tier.

Revision ID: 041
Revises: 040
Create Date: 2026-04-20

Data migration that (a) relaxes NOT NULL on the three quota columns and
(b) moves the two known internal/partner institutes onto the SA-only
'unlimited' tier. Written in a single transaction — either all changes
apply or none do.

Upgrade effects:
  - institutes.max_users / max_storage_gb / max_video_gb become NULL-able.
    (max_students has been nullable since migration 029.)
  - ict            : enterprise → unlimited, all four cap columns NULL
  - ictbusiness    : professional → unlimited, all four cap columns NULL

No other institute is touched. Other existing rows keep their current
cap values; the columns simply become NULL-able.

Downgrade restores both institutes to their EXACT pre-migration state
per the Phase 0 snapshot (2026-04-20):
  ict          → enterprise, (999999, 100000, 999999, 999999)
  ictbusiness  → professional, (1000000, 1000000, 10, 50)
Then re-applies the NOT NULL constraints on the quota columns.
"""
from alembic import op


# revision identifiers
revision = "041"
down_revision = "040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Relax NOT NULL on quota columns so 'unlimited' can truly be NULL.
    op.execute("ALTER TABLE institutes ALTER COLUMN max_users DROP NOT NULL")
    op.execute("ALTER TABLE institutes ALTER COLUMN max_storage_gb DROP NOT NULL")
    op.execute("ALTER TABLE institutes ALTER COLUMN max_video_gb DROP NOT NULL")
    # max_students is already nullable per migration 029.

    # 2. Move ict + ictbusiness to unlimited, null their caps.
    op.execute(
        """
        UPDATE institutes
           SET plan_tier = 'unlimited',
               max_users = NULL,
               max_students = NULL,
               max_storage_gb = NULL,
               max_video_gb = NULL,
               updated_at = now()
         WHERE slug IN ('ict', 'ictbusiness')
           AND deleted_at IS NULL
        """
    )


def downgrade() -> None:
    # Restore ict to enterprise with its original soft-unlimited sentinels.
    op.execute(
        """
        UPDATE institutes
           SET plan_tier = 'enterprise',
               max_users = 999999,
               max_students = 100000,
               max_storage_gb = 999999,
               max_video_gb = 999999,
               updated_at = now()
         WHERE slug = 'ict' AND plan_tier = 'unlimited'
        """
    )
    # Restore ictbusiness to professional with its base-v2 caps.
    op.execute(
        """
        UPDATE institutes
           SET plan_tier = 'professional',
               max_users = 1000000,
               max_students = 1000000,
               max_storage_gb = 10,
               max_video_gb = 50,
               updated_at = now()
         WHERE slug = 'ictbusiness' AND plan_tier = 'unlimited'
        """
    )

    # Re-apply NOT NULL — safe now because the two ict* rows have been
    # restored to concrete values and no other existing row was NULL'd.
    op.execute("ALTER TABLE institutes ALTER COLUMN max_users SET NOT NULL")
    op.execute("ALTER TABLE institutes ALTER COLUMN max_storage_gb SET NOT NULL")
    op.execute("ALTER TABLE institutes ALTER COLUMN max_video_gb SET NOT NULL")
