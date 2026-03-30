"""Add per-student batch time extension support

- student_batches.extended_end_date: nullable DATE for per-student override
- batch_extension_logs: full audit trail of who extended whom and when

Revision ID: 020
Revises: 019
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Per-student extension date override
    op.add_column(
        "student_batches",
        sa.Column("extended_end_date", sa.Date(), nullable=True),
    )

    # Extension audit trail
    op.create_table(
        "batch_extension_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("student_batch_id", UUID(as_uuid=True), sa.ForeignKey("student_batches.id"), nullable=False),
        sa.Column("student_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("batch_id", UUID(as_uuid=True), sa.ForeignKey("batches.id"), nullable=False),
        sa.Column("previous_end_date", sa.Date(), nullable=True),
        sa.Column("new_end_date", sa.Date(), nullable=False),
        sa.Column("extension_type", sa.String(), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("extended_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("institute_id", UUID(as_uuid=True), sa.ForeignKey("institutes.id"), nullable=True),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index("ix_batch_extension_logs_student_batch", "batch_extension_logs", ["student_batch_id"])
    op.create_index("ix_batch_extension_logs_batch_id", "batch_extension_logs", ["batch_id"])
    op.create_index("ix_batch_extension_logs_institute_id", "batch_extension_logs", ["institute_id"])


def downgrade() -> None:
    op.drop_table("batch_extension_logs")
    op.drop_column("student_batches", "extended_end_date")
