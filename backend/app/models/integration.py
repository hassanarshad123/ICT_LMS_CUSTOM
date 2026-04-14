"""Integration models: per-institute ERP/CRM credentials and sync audit log.

Phase 0 of the Frappe/ERPNext integration plan — scaffolding only. No code path
reads these tables yet; rows are populated starting in Phase 2 (admin UI) and
Phase 3 (outbound push). See docs/integrations/frappe.md once Phase 7 lands.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Index, ForeignKey, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID as PG_UUID, JSONB


class InstituteIntegration(SQLModel, table=True):
    """One row per institute. Holds encrypted Frappe/ERPNext credentials and
    account mapping defaults used when pushing Sales Invoice / Payment Entry.

    Feature flag: `frappe_enabled` must be True for any outbound push to fire.
    Credentials stored as Fernet ciphertext via app.utils.encryption.
    """
    __tablename__ = "institute_integrations"
    __table_args__ = (
        Index("ix_institute_integrations_institute", "institute_id", unique=True),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False),
    )

    # Frappe connection (outbound LMS → Frappe)
    frappe_enabled: bool = Field(default=False, nullable=False)
    frappe_base_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    frappe_api_key_ciphertext: Optional[str] = Field(
        default=None, sa_column=Column(Text, nullable=True),
    )
    frappe_api_secret_ciphertext: Optional[str] = Field(
        default=None, sa_column=Column(Text, nullable=True),
    )

    # Frappe account mapping defaults (required for Sales Invoice / Payment Entry posting)
    default_income_account: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    default_receivable_account: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    default_mode_of_payment: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    default_cost_center: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    default_company: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    # Inbound webhook auth (Frappe → LMS). Separate secret from the API key so
    # rotating one doesn't revoke the other.
    frappe_inbound_secret_ciphertext: Optional[str] = Field(
        default=None, sa_column=Column(Text, nullable=True),
    )

    # Connection-test telemetry (populated by the "Test connection" button)
    last_test_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    last_test_status: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    last_test_error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )


class IntegrationSyncLog(SQLModel, table=True):
    """Audit row per sync attempt (inbound or outbound). Drives the admin
    "Sync health" dashboard and is the source of truth for retry dedup.

    One row is written per attempt — a successful sync after 2 failures has
    3 rows sharing the same payload_hash + lms_entity_id.
    """
    __tablename__ = "integration_sync_log"
    __table_args__ = (
        Index("ix_integration_sync_log_institute_created", "institute_id", "created_at"),
        Index("ix_integration_sync_log_lms_entity", "lms_entity_id"),
        Index("ix_integration_sync_log_frappe_doc", "frappe_doc_name"),
        Index("ix_integration_sync_log_status", "status"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False),
    )

    # outbound | inbound
    direction: str = Field(nullable=False)
    # sales_invoice | payment_entry | student | …
    entity_type: str = Field(nullable=False)
    # sales_invoice.created | payment_entry.created | payment_entry.received | …
    event_type: str = Field(nullable=False)

    # Either side of the sync may be unknown (e.g. outbound that failed before
    # Frappe returned a doc name).
    lms_entity_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True),
    )
    frappe_doc_name: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    # success | failed | retrying | skipped | duplicate
    status: str = Field(nullable=False)
    status_code: Optional[int] = Field(default=None)
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    attempt_count: int = Field(default=1, nullable=False)

    # Sanitized request/response for debugging (creds stripped). Bounded — see
    # frappe_sync_service for redaction rules.
    request_snapshot: Optional[dict] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    response_snapshot: Optional[dict] = Field(default=None, sa_column=Column(JSONB, nullable=True))

    # SHA256 of canonicalized payload — used to dedup inbound webhooks.
    payload_hash: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    next_retry_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )


class IntegrationSyncTask(SQLModel, table=True):
    """Outbound sync queue. Populated when a fee.* webhook event fires AND the
    institute has frappe_enabled=True. Drained by the APScheduler job added in
    Phase 3.

    Separate from WebhookDelivery because WebhookDelivery targets customer
    webhook URLs, not our internal Frappe push.
    """
    __tablename__ = "integration_sync_tasks"
    __table_args__ = (
        Index("ix_integration_sync_tasks_pending", "status", "next_run_at"),
        Index("ix_integration_sync_tasks_institute", "institute_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False),
    )
    # frappe (future: zoho, odoo, …)
    provider: str = Field(default="frappe", nullable=False)
    event_type: str = Field(nullable=False)
    payload: dict = Field(sa_column=Column(JSONB, nullable=False))

    # pending | running | completed | failed | cancelled
    status: str = Field(default="pending", nullable=False)
    attempt_count: int = Field(default=0, nullable=False)
    next_run_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    last_attempted_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    last_error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    completed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )


class BulkImportJob(SQLModel, table=True):
    """Bulk CSV import job record. Populated by Phase 6 bulk import endpoint.
    Created here in Phase 0 so the alembic migration lands once.
    """
    __tablename__ = "bulk_import_jobs"
    __table_args__ = (
        Index("ix_bulk_import_jobs_institute_created", "institute_id", "created_at"),
        Index("ix_bulk_import_jobs_status", "status"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    institute_id: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("institutes.id"), nullable=False),
    )
    created_by: uuid.UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False),
    )
    # students | fee_plans | payments
    entity_type: str = Field(nullable=False)
    # pending | running | completed | failed
    status: str = Field(default="pending", nullable=False)

    total_rows: int = Field(default=0, nullable=False)
    processed_rows: int = Field(default=0, nullable=False)
    success_rows: int = Field(default=0, nullable=False)
    failed_rows: int = Field(default=0, nullable=False)

    # Per-row errors: [{"row": 12, "error": "duplicate email"}, …]. Capped to
    # the first 500 rows of errors to bound the row size.
    errors: Optional[list] = Field(default=None, sa_column=Column(JSONB, nullable=True))

    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()"),
    )
    started_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    completed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
