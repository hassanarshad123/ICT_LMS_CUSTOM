"""Add default_bank_account column to institute_integrations

Payment Entry ``paid_to`` must be a balance-sheet asset (bank/cash), not the
income P&L account. Before this column existed the client code wrongly used
``default_income_account`` for both Sales Invoice income_account AND Payment
Entry paid_to. Splitting them lets each role use the correct GL account.

Revision ID: 034
Revises: 033
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa


revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "institute_integrations",
        sa.Column("default_bank_account", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("institute_integrations", "default_bank_account")
