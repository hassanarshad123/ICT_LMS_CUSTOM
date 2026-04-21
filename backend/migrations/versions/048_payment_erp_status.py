"""fee_payments.erp_status + frappe_payment_entry_name; fee_plans.erp_si_status

Revision ID: 048
Revises: 047
Create Date: 2026-04-22

Adds three ERP-mirror columns so the LMS can display (and refresh) the
Frappe Payment Entry's docstatus and the parent Sales Invoice's status.

Column 1: fee_payments.erp_status -- one of 'pending' / 'confirmed' /
'cancelled' / 'unknown'. Defaults to 'pending' because every newly
recorded payment creates a Draft PE in Frappe (docstatus=0). 'unknown'
is used for legacy rows that predate this migration (they never had a
PE name stamped, so the refresh logic can't look them up).

Column 2: fee_payments.frappe_payment_entry_name -- e.g. 'ACC-PAY-2026-
00009'. Set by frappe_sync_service after the Draft PE is posted.
Nullable because not every LMS payment reaches Frappe (non-Frappe
institutes, sync disabled, etc.).

Column 3: fee_plans.erp_si_status -- mirrors the linked Sales Invoice's
status field so the UI can show 'Partly Paid' / 'Paid' etc. on the plan
card. Nullable + refreshed by the same cron as the PE status.

Index the PE name column so per-row refresh lookups are O(1).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "048"
down_revision = "047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fee_payments",
        sa.Column(
            "erp_status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "fee_payments",
        sa.Column(
            "frappe_payment_entry_name",
            sa.String(length=140),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_fee_payments_frappe_payment_entry_name",
        "fee_payments",
        ["frappe_payment_entry_name"],
        unique=False,
    )
    op.create_index(
        "ix_fee_payments_pending_with_pe_name",
        "fee_payments",
        ["institute_id"],
        unique=False,
        postgresql_where=sa.text(
            "erp_status = 'pending' AND frappe_payment_entry_name IS NOT NULL"
        ),
    )
    op.add_column(
        "fee_plans",
        sa.Column(
            "erp_si_status",
            sa.String(length=32),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("fee_plans", "erp_si_status")
    op.drop_index(
        "ix_fee_payments_pending_with_pe_name", table_name="fee_payments",
    )
    op.drop_index(
        "ix_fee_payments_frappe_payment_entry_name", table_name="fee_payments",
    )
    op.drop_column("fee_payments", "frappe_payment_entry_name")
    op.drop_column("fee_payments", "erp_status")
