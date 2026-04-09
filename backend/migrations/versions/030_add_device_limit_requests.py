"""Add device_limit_requests table + device_limit_request_status enum

Revision ID: 030
Revises: 029
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP

revision = "030"
down_revision = "029"


def upgrade() -> None:
    # Create enum idempotently
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE device_limit_request_status AS ENUM ('pending', 'approved', 'rejected', 'consumed');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    status_enum = postgresql.ENUM(
        "pending", "approved", "rejected", "consumed",
        name="device_limit_request_status", create_type=False,
    )

    op.create_table(
        "device_limit_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id", UUID(as_uuid=True),
            sa.ForeignKey("users.id"), nullable=False,
        ),
        sa.Column(
            "institute_id", UUID(as_uuid=True),
            sa.ForeignKey("institutes.id"), nullable=True,
        ),
        sa.Column("requested_device_info", sa.Text(), nullable=True),
        sa.Column("requested_ip", sa.String(), nullable=True),
        sa.Column("status", status_enum, nullable=False, server_default="pending"),
        sa.Column("polling_token_hash", sa.String(), nullable=False),
        sa.Column(
            "reviewed_by", UUID(as_uuid=True),
            sa.ForeignKey("users.id"), nullable=True,
        ),
        sa.Column("reviewed_at", TIMESTAMP(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column(
            "terminated_session_id", UUID(as_uuid=True),
            sa.ForeignKey("user_sessions.id"), nullable=True,
        ),
        sa.Column("consumed_at", TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at", TIMESTAMP(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at", TIMESTAMP(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_device_limit_requests_user_id",
        "device_limit_requests", ["user_id"],
    )
    op.create_index(
        "ix_device_limit_requests_institute_id_status",
        "device_limit_requests", ["institute_id", "status"],
    )
    op.create_index(
        "ix_device_limit_requests_status_created",
        "device_limit_requests", ["status", "created_at"],
    )
    op.create_index(
        "ix_device_limit_requests_polling_token_hash",
        "device_limit_requests", ["polling_token_hash"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_device_limit_requests_polling_token_hash",
        table_name="device_limit_requests",
    )
    op.drop_index(
        "ix_device_limit_requests_status_created",
        table_name="device_limit_requests",
    )
    op.drop_index(
        "ix_device_limit_requests_institute_id_status",
        table_name="device_limit_requests",
    )
    op.drop_index(
        "ix_device_limit_requests_user_id",
        table_name="device_limit_requests",
    )
    op.drop_table("device_limit_requests")
    op.execute("DROP TYPE IF EXISTS device_limit_request_status")
