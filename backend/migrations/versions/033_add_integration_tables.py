"""Add institute_integrations, integration_sync_log, integration_sync_tasks, bulk_import_jobs

Phase 0 of the Frappe/ERPNext integration plan. Additive only — no existing
columns/tables are touched. Feature flags all default to disabled so no
production institute is affected until a later phase flips them.

Revision ID: 033
Revises: 032
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP, JSONB


revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── institute_integrations ──────────────────────────────────────
    op.create_table(
        "institute_integrations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "institute_id", UUID(as_uuid=True),
            sa.ForeignKey("institutes.id"), nullable=False,
        ),
        sa.Column("frappe_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("frappe_base_url", sa.Text(), nullable=True),
        sa.Column("frappe_api_key_ciphertext", sa.Text(), nullable=True),
        sa.Column("frappe_api_secret_ciphertext", sa.Text(), nullable=True),
        sa.Column("default_income_account", sa.Text(), nullable=True),
        sa.Column("default_receivable_account", sa.Text(), nullable=True),
        sa.Column("default_mode_of_payment", sa.Text(), nullable=True),
        sa.Column("default_cost_center", sa.Text(), nullable=True),
        sa.Column("default_company", sa.Text(), nullable=True),
        sa.Column("frappe_inbound_secret_ciphertext", sa.Text(), nullable=True),
        sa.Column("last_test_at", TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_test_status", sa.Text(), nullable=True),
        sa.Column("last_test_error", sa.Text(), nullable=True),
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
        "ix_institute_integrations_institute",
        "institute_integrations", ["institute_id"], unique=True,
    )

    # ── integration_sync_log ────────────────────────────────────────
    op.create_table(
        "integration_sync_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "institute_id", UUID(as_uuid=True),
            sa.ForeignKey("institutes.id"), nullable=False,
        ),
        sa.Column("direction", sa.String(16), nullable=False),
        sa.Column("entity_type", sa.String(64), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("lms_entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column("frappe_doc_name", sa.Text(), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("request_snapshot", JSONB(), nullable=True),
        sa.Column("response_snapshot", JSONB(), nullable=True),
        sa.Column("payload_hash", sa.Text(), nullable=True),
        sa.Column("next_retry_at", TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at", TIMESTAMP(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_integration_sync_log_institute_created",
        "integration_sync_log", ["institute_id", "created_at"],
    )
    op.create_index(
        "ix_integration_sync_log_lms_entity",
        "integration_sync_log", ["lms_entity_id"],
    )
    op.create_index(
        "ix_integration_sync_log_frappe_doc",
        "integration_sync_log", ["frappe_doc_name"],
    )
    op.create_index(
        "ix_integration_sync_log_status",
        "integration_sync_log", ["status"],
    )

    # ── integration_sync_tasks ──────────────────────────────────────
    op.create_table(
        "integration_sync_tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "institute_id", UUID(as_uuid=True),
            sa.ForeignKey("institutes.id"), nullable=False,
        ),
        sa.Column("provider", sa.String(32), nullable=False, server_default="frappe"),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_run_at", TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_attempted_at", TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column(
            "created_at", TIMESTAMP(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
        sa.Column("completed_at", TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_integration_sync_tasks_pending",
        "integration_sync_tasks", ["status", "next_run_at"],
    )
    op.create_index(
        "ix_integration_sync_tasks_institute",
        "integration_sync_tasks", ["institute_id"],
    )

    # ── bulk_import_jobs ────────────────────────────────────────────
    op.create_table(
        "bulk_import_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "institute_id", UUID(as_uuid=True),
            sa.ForeignKey("institutes.id"), nullable=False,
        ),
        sa.Column(
            "created_by", UUID(as_uuid=True),
            sa.ForeignKey("users.id"), nullable=False,
        ),
        sa.Column("entity_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("success_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("errors", JSONB(), nullable=True),
        sa.Column(
            "created_at", TIMESTAMP(timezone=True),
            nullable=False, server_default=sa.text("now()"),
        ),
        sa.Column("started_at", TIMESTAMP(timezone=True), nullable=True),
        sa.Column("completed_at", TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_bulk_import_jobs_institute_created",
        "bulk_import_jobs", ["institute_id", "created_at"],
    )
    op.create_index(
        "ix_bulk_import_jobs_status",
        "bulk_import_jobs", ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_bulk_import_jobs_status", table_name="bulk_import_jobs")
    op.drop_index("ix_bulk_import_jobs_institute_created", table_name="bulk_import_jobs")
    op.drop_table("bulk_import_jobs")

    op.drop_index("ix_integration_sync_tasks_institute", table_name="integration_sync_tasks")
    op.drop_index("ix_integration_sync_tasks_pending", table_name="integration_sync_tasks")
    op.drop_table("integration_sync_tasks")

    op.drop_index("ix_integration_sync_log_status", table_name="integration_sync_log")
    op.drop_index("ix_integration_sync_log_frappe_doc", table_name="integration_sync_log")
    op.drop_index("ix_integration_sync_log_lms_entity", table_name="integration_sync_log")
    op.drop_index("ix_integration_sync_log_institute_created", table_name="integration_sync_log")
    op.drop_table("integration_sync_log")

    op.drop_index("ix_institute_integrations_institute", table_name="institute_integrations")
    op.drop_table("institute_integrations")
