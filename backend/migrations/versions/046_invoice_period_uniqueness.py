"""Add UNIQUE constraint on invoices(institute_id, period_start, period_end).

Revision ID: 046
Revises: 045
Create Date: 2026-04-20

Belt-and-suspenders guard against duplicate invoices issued for the
same billing period. The billing cron (``scheduler/billing_jobs.py``)
already checks for an existing invoice before inserting, but that
check is not locked, so two scheduler runs racing during a blue-green
cutover could both insert invoices for the same period. This
constraint makes that race impossible at the DB level.

Upgrade: delete any existing duplicates (keep the lowest invoice_id
per tuple), then add the constraint. Dedup is a no-op in practice —
there are no known duplicates today.

Downgrade: drop the constraint.
"""
from alembic import op


# revision identifiers
revision = "046"
down_revision = "045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove any accidental duplicates before constraint creation.
    # Keep the earliest (lowest id) invoice per (institute_id,
    # period_start, period_end) tuple.
    op.execute("""
        DELETE FROM invoices
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY institute_id, period_start, period_end
                           ORDER BY created_at ASC, id ASC
                       ) AS rn
                FROM invoices
                WHERE period_start IS NOT NULL
                  AND period_end IS NOT NULL
            ) sub
            WHERE rn > 1
        )
    """)

    op.create_unique_constraint(
        "uq_invoices_institute_period",
        "invoices",
        ["institute_id", "period_start", "period_end"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_invoices_institute_period",
        "invoices",
        type_="unique",
    )
