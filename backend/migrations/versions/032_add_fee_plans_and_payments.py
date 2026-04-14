"""Add fee_plans, fee_installments, fee_payments, receipt_counter tables

Revision ID: 032
Revises: 031
Create Date: 2026-04-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP, JSONB


revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── fee_plans ────────────────────────────────────────────────
    op.create_table(
        "fee_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_batch_id", UUID(as_uuid=True),
            sa.ForeignKey("student_batches.id"), nullable=False,
        ),
        sa.Column(
            "student_id", UUID(as_uuid=True),
            sa.ForeignKey("users.id"), nullable=False,
        ),
        sa.Column(
            "batch_id", UUID(as_uuid=True),
            sa.ForeignKey("batches.id"), nullable=False,
        ),
        sa.Column(
            "institute_id", UUID(as_uuid=True),
            sa.ForeignKey("institutes.id"), nullable=False,
        ),
        sa.Column("plan_type", sa.String(20), nullable=False),
        sa.Column("total_amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("discount_type", sa.String(10), nullable=True),
        sa.Column("discount_value", sa.Integer(), nullable=True),
        sa.Column("final_amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(8), nullable=False, server_default="PKR"),
        sa.Column("billing_day_of_month", sa.Integer(), nullable=True),
        sa.Column(
            "onboarded_by_user_id", UUID(as_uuid=True),
            sa.ForeignKey("users.id"), nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at", TIMESTAMP(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at", TIMESTAMP(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_fee_plans_student_batch_id", "fee_plans", ["student_batch_id"])
    op.create_index("ix_fee_plans_student_id", "fee_plans", ["student_id"])
    op.create_index("ix_fee_plans_onboarded_by", "fee_plans", ["onboarded_by_user_id"])
    op.create_index("ix_fee_plans_institute_id", "fee_plans", ["institute_id"])
    # One active (non-deleted) plan per enrollment
    op.create_index(
        "uq_fee_plans_active_per_enrollment",
        "fee_plans", ["student_batch_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # ── fee_installments ─────────────────────────────────────────
    op.create_table(
        "fee_installments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "fee_plan_id", UUID(as_uuid=True),
            sa.ForeignKey("fee_plans.id"), nullable=False,
        ),
        sa.Column(
            "institute_id", UUID(as_uuid=True),
            sa.ForeignKey("institutes.id"), nullable=False,
        ),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("amount_due", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("amount_paid", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("label", sa.String(100), nullable=True),
        sa.Column(
            "created_at", TIMESTAMP(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at", TIMESTAMP(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_fee_installments_plan_id", "fee_installments", ["fee_plan_id"])
    op.create_index("ix_fee_installments_due_date", "fee_installments", ["due_date"])
    op.create_index(
        "ix_fee_installments_status_due", "fee_installments", ["status", "due_date"],
    )
    op.create_index("ix_fee_installments_institute_id", "fee_installments", ["institute_id"])
    op.create_unique_constraint(
        "uq_fee_installment_plan_sequence",
        "fee_installments", ["fee_plan_id", "sequence"],
    )

    # ── fee_payments ─────────────────────────────────────────────
    op.create_table(
        "fee_payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "fee_plan_id", UUID(as_uuid=True),
            sa.ForeignKey("fee_plans.id"), nullable=False,
        ),
        sa.Column(
            "fee_installment_id", UUID(as_uuid=True),
            sa.ForeignKey("fee_installments.id"), nullable=True,
        ),
        sa.Column(
            "institute_id", UUID(as_uuid=True),
            sa.ForeignKey("institutes.id"), nullable=False,
        ),
        sa.Column("amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("payment_date", TIMESTAMP(timezone=True), nullable=False),
        sa.Column("payment_method", sa.String(20), nullable=False, server_default="cash"),
        sa.Column("status", sa.String(20), nullable=False, server_default="received"),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("receipt_number", sa.String(40), nullable=True, unique=True),
        sa.Column(
            "recorded_by_user_id", UUID(as_uuid=True),
            sa.ForeignKey("users.id"), nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at", TIMESTAMP(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at", TIMESTAMP(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_fee_payments_plan_id", "fee_payments", ["fee_plan_id"])
    op.create_index("ix_fee_payments_installment_id", "fee_payments", ["fee_installment_id"])
    op.create_index(
        "ix_fee_payments_institute_date", "fee_payments", ["institute_id", "payment_date"],
    )
    op.create_index("ix_fee_payments_recorded_by", "fee_payments", ["recorded_by_user_id"])

    # ── receipt_counter ─────────────────────────────────────────
    op.create_table(
        "receipt_counter",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("institute_id", UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("current_year", sa.Integer(), nullable=False),
        sa.Column("last_sequence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at", TIMESTAMP(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("receipt_counter")

    op.drop_index("ix_fee_payments_recorded_by", table_name="fee_payments")
    op.drop_index("ix_fee_payments_institute_date", table_name="fee_payments")
    op.drop_index("ix_fee_payments_installment_id", table_name="fee_payments")
    op.drop_index("ix_fee_payments_plan_id", table_name="fee_payments")
    op.drop_table("fee_payments")

    op.drop_constraint("uq_fee_installment_plan_sequence", "fee_installments", type_="unique")
    op.drop_index("ix_fee_installments_institute_id", table_name="fee_installments")
    op.drop_index("ix_fee_installments_status_due", table_name="fee_installments")
    op.drop_index("ix_fee_installments_due_date", table_name="fee_installments")
    op.drop_index("ix_fee_installments_plan_id", table_name="fee_installments")
    op.drop_table("fee_installments")

    op.drop_index("uq_fee_plans_active_per_enrollment", table_name="fee_plans")
    op.drop_index("ix_fee_plans_institute_id", table_name="fee_plans")
    op.drop_index("ix_fee_plans_onboarded_by", table_name="fee_plans")
    op.drop_index("ix_fee_plans_student_id", table_name="fee_plans")
    op.drop_index("ix_fee_plans_student_batch_id", table_name="fee_plans")
    op.drop_table("fee_plans")
