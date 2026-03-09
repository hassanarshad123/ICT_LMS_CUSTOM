"""add certificates

Revision ID: 003
Revises: 002
Create Date: 2026-03-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create certificate_status enum via raw SQL (IF NOT EXISTS avoids conflict)
    op.execute("DO $$ BEGIN CREATE TYPE certificate_status AS ENUM ('eligible', 'approved', 'revoked'); EXCEPTION WHEN duplicate_object THEN null; END $$")

    # Create certificates table (use sa.String for status to avoid auto-enum creation)
    op.create_table(
        "certificates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("student_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("batch_id", UUID(as_uuid=True), sa.ForeignKey("batches.id"), nullable=False),
        sa.Column("course_id", UUID(as_uuid=True), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("certificate_id", sa.String, nullable=False, unique=True),
        sa.Column("verification_code", sa.String, nullable=False, unique=True),
        sa.Column("status", sa.String, nullable=False, server_default="eligible"),
        sa.Column("completion_percentage", sa.Integer, nullable=False, server_default="0"),
        sa.Column("approved_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", TIMESTAMP(timezone=True), nullable=True),
        sa.Column("issued_at", TIMESTAMP(timezone=True), nullable=True),
        sa.Column("revoked_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("revoked_at", TIMESTAMP(timezone=True), nullable=True),
        sa.Column("revocation_reason", sa.Text, nullable=True),
        sa.Column("pdf_path", sa.String, nullable=True),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", TIMESTAMP(timezone=True), nullable=True),
        sa.UniqueConstraint("student_id", "batch_id", "course_id", name="uq_certificate_student_batch_course"),
    )

    # Alter status column to use the enum type
    op.execute("ALTER TABLE certificates ALTER COLUMN status TYPE certificate_status USING status::certificate_status")

    # Create certificate_counter table
    op.create_table(
        "certificate_counter",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("current_year", sa.Integer, nullable=False),
        sa.Column("last_sequence", sa.Integer, nullable=False, server_default="0"),
    )

    # Insert initial row
    op.execute("INSERT INTO certificate_counter (id, current_year, last_sequence) VALUES (1, 2026, 0)")

    # Insert certificate threshold setting
    op.execute(
        "INSERT INTO system_settings (id, setting_key, value, description) "
        "VALUES (gen_random_uuid(), 'certificate_completion_threshold', '70', "
        "'Minimum video completion percentage required for certificate eligibility') "
        "ON CONFLICT (setting_key) DO NOTHING"
    )


def downgrade() -> None:
    op.drop_table("certificate_counter")
    op.drop_table("certificates")
    op.execute("DROP TYPE IF EXISTS certificate_status")
    op.execute("DELETE FROM system_settings WHERE setting_key = 'certificate_completion_threshold'")
