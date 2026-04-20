"""Request / response schemas for the /api/v1/integrations/* surface."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl, field_validator


class FrappeConfigIn(BaseModel):
    """Admin-submitted Frappe connection + accounting defaults.

    All secret fields (``api_key``, ``api_secret``) are optional so the admin
    can edit account defaults or toggle enabled without re-entering creds.
    Omitted secrets are preserved from the existing row.
    """
    frappe_enabled: bool = False
    frappe_base_url: Optional[str] = None
    api_key: Optional[str] = Field(default=None, min_length=6, max_length=256)
    api_secret: Optional[str] = Field(default=None, min_length=6, max_length=256)

    default_income_account: Optional[str] = None
    default_receivable_account: Optional[str] = None
    default_bank_account: Optional[str] = None
    default_mode_of_payment: Optional[str] = None
    default_cost_center: Optional[str] = None
    default_company: Optional[str] = None

    auto_create_customers: Optional[bool] = None

    @field_validator("frappe_base_url")
    @classmethod
    def _validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        v = v.strip().rstrip("/")
        # Block non-HTTPS except localhost (for dev), block private IPs to
        # prevent SSRF against AWS metadata / internal services.
        low = v.lower()
        if not (low.startswith("https://") or low.startswith("http://localhost") or low.startswith("http://127.")):
            raise ValueError("frappe_base_url must start with https://")
        # Reject obvious private/link-local targets
        blocked = ("169.254.", "10.", "192.168.", "172.16.", "172.17.", "172.18.",
                   "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
                   "172.24.", "172.25.", "172.26.", "172.27.", "172.28.",
                   "172.29.", "172.30.", "172.31.")
        host = low.split("://", 1)[1].split("/", 1)[0].split(":", 1)[0]
        for prefix in blocked:
            if host.startswith(prefix):
                raise ValueError("frappe_base_url targets a private network")
        return v


class FrappeConfigOut(BaseModel):
    """Sanitized view — never returns the decrypted secrets."""
    frappe_enabled: bool
    frappe_base_url: Optional[str] = None
    api_key_set: bool = False
    api_secret_set: bool = False
    inbound_secret_set: bool = False

    default_income_account: Optional[str] = None
    default_receivable_account: Optional[str] = None
    default_bank_account: Optional[str] = None
    default_mode_of_payment: Optional[str] = None
    default_cost_center: Optional[str] = None
    default_company: Optional[str] = None

    auto_create_customers: bool = True

    last_test_at: Optional[datetime] = None
    last_test_status: Optional[str] = None
    last_test_error: Optional[str] = None

    updated_at: Optional[datetime] = None


class FrappeTestConnectionOut(BaseModel):
    ok: bool
    message: str
    frappe_user: Optional[str] = None
    latency_ms: Optional[int] = None


class FrappeInboundSecretOut(BaseModel):
    """One-time reveal of the inbound webhook secret — only shown on rotation."""
    secret: str
    note: str = "Store this value — you won't be able to see it again."


# ── Tier 2: wizard / auto-setup schemas ─────────────────────────

class FrappeDropdownItem(BaseModel):
    """A single choice for an introspection dropdown (account, company, etc.)."""
    name: str


class FrappeDropdownOut(BaseModel):
    items: list[FrappeDropdownItem]
    cached: bool = False


class FrappeSetupStepResult(BaseModel):
    """One step of the wizard after running an action."""
    ok: bool
    message: str
    detail: Optional[str] = None


class FrappeSetupStatus(BaseModel):
    """Per-step pass/fail snapshot, used on wizard mount to resume where the
    admin left off. Values: ``ok`` / ``missing`` / ``unknown``.
    """
    connection: str
    accounts_mapped: str
    custom_fields_installed: str
    webhook_registered: str
    inbound_secret_shared: str


class FrappeDryRunOut(BaseModel):
    """Result of the end-to-end dry-run sync test."""
    ok: bool
    invoice_name: Optional[str] = None
    cancelled: bool = False
    message: str
    detail: Optional[str] = None


class FrappeAutoCustomerToggleIn(BaseModel):
    auto_create_customers: bool


# ── Sync log (Phase 5 — shipped early alongside the schemas) ──────

class SyncLogItem(BaseModel):
    id: str
    direction: str
    entity_type: str
    event_type: str
    lms_entity_id: Optional[str] = None
    frappe_doc_name: Optional[str] = None
    status: str
    status_code: Optional[int] = None
    error_message: Optional[str] = None
    attempt_count: int
    next_retry_at: Optional[datetime] = None
    created_at: datetime


class SyncLogKPIs(BaseModel):
    success_rate_24h: float
    success_count_24h: int
    failure_count_24h: int
    pending_retries: int
    failures_7d: int


# ── Sales Person listing (Phase 2 — AO onboarding dropdown) ──────────

class SalesPersonItem(BaseModel):
    employee_id: str
    sales_person_name: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    commission_rate: Optional[str] = None
    hr_status: Optional[str] = None
    already_mapped: bool = False
    linked_officer_id: Optional[str] = None


class SalesPersonListOut(BaseModel):
    enabled: bool
    cached_at: Optional[str] = None
    error: Optional[str] = None
    sales_persons: list[SalesPersonItem] = []
