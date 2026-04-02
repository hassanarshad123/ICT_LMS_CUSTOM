"""Add feedback tables: feedbacks, feedback_attachments, feedback_responses

Revision ID: 025
Revises: 024
Create Date: 2026-04-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP

revision = "025"
down_revision = "024"


def upgrade() -> None:
    # Create enums idempotently (DO block handles already-exists in async drivers)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE feedback_type AS ENUM ('bug_report', 'feature_request', 'general_feedback', 'ux_issue');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE feedback_status AS ENUM ('submitted', 'under_review', 'planned', 'in_progress', 'done', 'declined');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # Reference enums with create_type=False (already created above)
    feedback_type_enum = postgresql.ENUM(
        "bug_report", "feature_request", "general_feedback", "ux_issue",
        name="feedback_type", create_type=False,
    )
    feedback_status_enum = postgresql.ENUM(
        "submitted", "under_review", "planned", "in_progress", "done", "declined",
        name="feedback_status", create_type=False,
    )

    op.create_table(
        "feedbacks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("feedback_type", feedback_type_enum, nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("status", feedback_status_enum, nullable=False, server_default="submitted"),
        sa.Column("is_anonymous", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("user_role", sa.String(), nullable=True),
        sa.Column("client_context", JSONB, nullable=True),
        sa.Column("institute_id", UUID(as_uuid=True), sa.ForeignKey("institutes.id"), nullable=True),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_feedbacks_institute_id_status", "feedbacks", ["institute_id", "status"])
    op.create_index("ix_feedbacks_type_created", "feedbacks", ["feedback_type", "created_at"])
    op.create_index("ix_feedbacks_user_id", "feedbacks", ["user_id"])
    op.create_index("ix_feedbacks_status", "feedbacks", ["status"])

    op.create_table(
        "feedback_attachments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "feedback_id", UUID(as_uuid=True),
            sa.ForeignKey("feedbacks.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("object_key", sa.String(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_feedback_attachments_feedback_id", "feedback_attachments", ["feedback_id"])

    op.create_table(
        "feedback_responses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "feedback_id", UUID(as_uuid=True),
            sa.ForeignKey("feedbacks.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("responder_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_internal", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_feedback_responses_feedback_id", "feedback_responses", ["feedback_id"])


def downgrade() -> None:
    op.drop_table("feedback_responses")
    op.drop_table("feedback_attachments")
    op.drop_table("feedbacks")
    op.execute("DROP TYPE IF EXISTS feedback_status")
    op.execute("DROP TYPE IF EXISTS feedback_type")
