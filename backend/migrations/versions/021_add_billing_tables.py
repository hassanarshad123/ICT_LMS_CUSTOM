"""Add billing, invoices, payments, and SA notifications tables

Revision ID: 021
Revises: 020
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP, JSONB, ARRAY

revision = "021"
down_revision = "020"


def upgrade() -> None:
    # Institute billing config (1:1 with institutes)
    op.create_table(
        "institute_billing",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("institute_id", UUID(as_uuid=True), sa.ForeignKey("institutes.id"), nullable=False, unique=True),
        sa.Column("base_amount", sa.Integer, nullable=False, server_default="0"),
        sa.Column("currency", sa.String(10), nullable=False, server_default="PKR"),
        sa.Column("billing_cycle", sa.String(20), nullable=False, server_default="monthly"),
        sa.Column("extra_user_rate", sa.Integer, nullable=False, server_default="0"),
        sa.Column("extra_storage_rate", sa.Integer, nullable=False, server_default="0"),
        sa.Column("extra_video_rate", sa.Integer, nullable=False, server_default="0"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_institute_billing_institute_id", "institute_billing", ["institute_id"])

    # Invoices
    op.create_table(
        "invoices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("institute_id", UUID(as_uuid=True), sa.ForeignKey("institutes.id"), nullable=False),
        sa.Column("invoice_number", sa.String(20), nullable=False, unique=True),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("base_amount", sa.Integer, nullable=False, server_default="0"),
        sa.Column("line_items", JSONB, nullable=False, server_default="[]"),
        sa.Column("total_amount", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("pdf_path", sa.String(500), nullable=True),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("generated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_invoices_institute_id", "invoices", ["institute_id"])

    # Payments
    op.create_table(
        "payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("institute_id", UUID(as_uuid=True), sa.ForeignKey("institutes.id"), nullable=False),
        sa.Column("invoice_id", UUID(as_uuid=True), sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("payment_date", TIMESTAMP(timezone=True), nullable=False),
        sa.Column("payment_method", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="received"),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("recorded_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_payments_institute_id", "payments", ["institute_id"])
    op.create_index("ix_payments_invoice_id", "payments", ["invoice_id"])

    # SA notifications (announcements from SA to admin users)
    op.create_table(
        "sa_notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("target_institute_ids", ARRAY(UUID(as_uuid=True)), nullable=False, server_default="{}"),
        sa.Column("sent_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_sa_notifications_sent_by", "sa_notifications", ["sent_by"])

    # Invoice counter (for sequential invoice numbers per year)
    op.create_table(
        "invoice_counter",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("current_year", sa.Integer, nullable=False),
        sa.Column("last_sequence", sa.Integer, nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("invoice_counter")
    op.drop_table("sa_notifications")
    op.drop_table("payments")
    op.drop_table("invoices")
    op.drop_table("institute_billing")
