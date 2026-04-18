"""Schemas for the admin-facing billing router (`/api/v1/billing`).

Admin billing UI lives on top of the same data the SA billing router
reads — the difference is scope (admin sees only their own institute)
and tier gate (v2 billing tiers only; grandfathered tiers are always
redirected to the "billing not available on your plan" card).
"""
import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class AddonOut(BaseModel):
    id: uuid.UUID
    addon_type: str
    quantity: int
    unit_price_pkr: int
    storage_bonus_gb: float
    storage_bonus_kind: str
    activated_at: datetime
    cancelled_at: Optional[datetime] = None
    cancelled_effective_at: Optional[datetime] = None
    # Derived convenience field for the UI. Equals quantity * unit_price_pkr.
    monthly_total_pkr: int = 0

    model_config = {"from_attributes": True}


class AddonActivateRequest(BaseModel):
    addon_type: str = Field(..., min_length=1, max_length=40)
    quantity: int = Field(default=1, ge=1, le=100)


class AddonPackOut(BaseModel):
    """Catalogue entry — the packs an admin can activate."""
    addon_type: str
    price_pkr: int
    bonus_gb: float
    kind: str


class BillingPreviewOut(BaseModel):
    snapshot_student_count: int
    overage_student_count: int
    student_overage_pkr: int
    addon_total_pkr: int
    base_fee_pkr: int
    total_pkr: int
    line_items: list[dict]


class BillingOverviewOut(BaseModel):
    """Everything the admin billing dashboard needs in one call."""
    plan_tier: str
    status: str
    current_users: int
    current_storage_bytes: int
    current_video_bytes: int
    storage_limit_gb: float
    video_limit_gb: float
    free_users_included: int
    extra_user_rate_pkr: int
    currency: str
    billing_cycle: str
    billing_restriction: Optional[str] = None
    active_addons: list[AddonOut]
    next_invoice_preview: BillingPreviewOut
    available_addon_packs: list[AddonPackOut]


class AdminInvoiceOut(BaseModel):
    """Trimmed-down invoice view for the admin UI.

    Excludes `generated_by` (SA user id — not meaningful to admins)
    and `discount_*` (SA-only concern).
    """
    id: uuid.UUID
    invoice_number: str
    period_start: date
    period_end: date
    due_date: date
    total_amount: int
    status: str
    line_items: list[dict]
    notes: Optional[str] = None
    pdf_path: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AdminPaymentOut(BaseModel):
    id: uuid.UUID
    invoice_id: Optional[uuid.UUID] = None
    amount: int
    payment_date: Optional[datetime] = None
    payment_method: str
    status: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
