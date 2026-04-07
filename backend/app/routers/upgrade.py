"""Self-serve plan upgrade endpoints.

Admins click "Upgrade" in their dashboard → POST /upgrade/request with
their chosen tier, billing cycle, and payment method. We:
  1. Compute the total amount from PRICING_TABLE
  2. Create a draft invoice via sa_billing_service.generate_invoice
  3. Generate a unique reference code
  4. Return bank/wallet details for the admin to pay
  5. Log the request in ActivityLog so SA sees it

SA then verifies the payment externally and calls
POST /super-admin/upgrade/approve/{invoice_id} which flips plan_tier
and resets expires_at.
"""
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from sqlmodel import func as sqlfunc

from app.database import get_session
from app.middleware.auth import get_current_user, require_roles
from app.models.activity import ActivityLog
from app.models.billing import Invoice
from app.models.enums import UserRole
from app.models.institute import Institute, InstituteStatus, PlanTier
from app.models.user import User
from app.services.sa_billing_service import (
    generate_invoice,
    get_or_create_billing,
)
from app.services.sa_settings_service import get_payment_methods
from app.utils.audit import log_sa_action
from app.utils.plan_limits import PLAN_LIMITS, TIER_LABELS
from app.utils.rate_limit import limiter


router = APIRouter()


# ---------------------------------------------------------------------------
# Pricing table — single source of truth for PKR amounts
# ---------------------------------------------------------------------------
# Amounts in PKR. Yearly = 10× monthly (2 months free).
# Enterprise is "Custom" so has no self-serve pricing.
PRICING_TABLE: dict[PlanTier, dict[str, int]] = {
    PlanTier.starter: {"monthly": 2_500, "yearly": 25_000},
    PlanTier.basic: {"monthly": 5_000, "yearly": 50_000},
    PlanTier.pro: {"monthly": 15_000, "yearly": 150_000},
}


Admin = Annotated[User, Depends(require_roles("admin"))]
SA = Annotated[User, Depends(require_roles("super_admin"))]
# Any authenticated non-SA user can read their own institute plan status.
AnyAuthed = Annotated[User, Depends(get_current_user)]


# ---------------------------------------------------------------------------
# Request/response schemas
# ---------------------------------------------------------------------------
UpgradeTierLiteral = Literal["starter", "basic", "pro", "enterprise"]
BillingCycleLiteral = Literal["monthly", "yearly"]
PaymentMethodLiteral = Literal["bank_transfer", "jazzcash", "easypaisa"]


class UpgradeRequest(BaseModel):
    target_tier: UpgradeTierLiteral
    billing_cycle: BillingCycleLiteral = "monthly"
    payment_method: PaymentMethodLiteral = "bank_transfer"


class MyInstituteResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    plan_tier: str
    max_students: int
    current_students: int
    max_storage_gb: float
    max_video_gb: float
    expires_at: Optional[datetime] = None
    # True when plan_tier is free AND expires_at is in the future
    is_trial: bool = False
    # None when not on a trial; otherwise int days until expiry (can be negative)
    trial_days_remaining: Optional[int] = None
    # Labels/pricing the frontend can display directly
    tier_label: str
    pricing_table: dict


# ---------------------------------------------------------------------------
# Admin endpoint: fetch own institute's plan state
# ---------------------------------------------------------------------------
@router.get("/my-institute", response_model=MyInstituteResponse)
async def get_my_institute(
    current_user: AnyAuthed,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Return the authenticated user's institute + plan state.

    Used by the admin dashboard to render the upgrade banner + modal.
    Returns 404 if the user has no institute (shouldn't happen for
    non-SA users since auth middleware enforces institute assignment).
    """
    if not current_user.institute_id:
        raise HTTPException(404, "No institute for this user")

    institute = await session.get(Institute, current_user.institute_id)
    if not institute:
        raise HTTPException(404, "Institute not found")

    student_count_result = await session.execute(
        select(sqlfunc.count(User.id)).where(
            User.institute_id == institute.id,
            User.role == UserRole.student,
            User.deleted_at.is_(None),
        )
    )
    current_students = student_count_result.scalar_one() or 0

    is_trial = institute.plan_tier == PlanTier.free and institute.expires_at is not None
    trial_days_remaining: Optional[int] = None
    if is_trial and institute.expires_at is not None:
        delta = institute.expires_at - datetime.now(timezone.utc)
        trial_days_remaining = delta.days

    return MyInstituteResponse(
        id=institute.id,
        name=institute.name,
        slug=institute.slug,
        status=institute.status.value,
        plan_tier=institute.plan_tier.value,
        max_students=institute.max_students,
        current_students=current_students,
        max_storage_gb=institute.max_storage_gb,
        max_video_gb=institute.max_video_gb,
        expires_at=institute.expires_at,
        is_trial=is_trial,
        trial_days_remaining=trial_days_remaining,
        tier_label=TIER_LABELS.get(institute.plan_tier, institute.plan_tier.value),
        pricing_table={
            tier.value: prices for tier, prices in PRICING_TABLE.items()
        },
    )


class UpgradeResponse(BaseModel):
    invoice_id: uuid.UUID
    invoice_number: str
    reference_code: str
    amount: int
    currency: str = "PKR"
    target_tier: str
    billing_cycle: str
    payment_method: str
    # Instructions for the admin: bank/wallet details to send money to.
    # Populated from SA settings (get_payment_methods).
    payment_instructions: list[dict]
    # Message the admin should include as the payment reference.
    payment_reference_note: str
    enterprise: bool = False
    contact_email: Optional[str] = None


# ---------------------------------------------------------------------------
# Admin endpoint: request upgrade
# ---------------------------------------------------------------------------
@router.post("/request", response_model=UpgradeResponse)
@limiter.limit("5/minute")
async def request_upgrade(
    request: Request,
    body: UpgradeRequest,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Create a draft invoice for an upgrade request and return payment details.

    Admin clicks "Upgrade" → picks tier + cycle + payment method → submits.
    We create a draft invoice, log the request, and return bank details
    + a unique reference code. Admin sends money externally, SA approves.
    """
    if not current_user.institute_id:
        raise HTTPException(400, "No institute associated with this user")

    institute = await session.get(Institute, current_user.institute_id)
    if not institute:
        raise HTTPException(404, "Institute not found")

    # Enterprise is sales-assisted — return a special response pointing to email.
    if body.target_tier == "enterprise":
        return UpgradeResponse(
            invoice_id=uuid.uuid4(),  # dummy, not persisted
            invoice_number="ENTERPRISE-QUOTE",
            reference_code="N/A",
            amount=0,
            target_tier="enterprise",
            billing_cycle=body.billing_cycle,
            payment_method=body.payment_method,
            payment_instructions=[],
            payment_reference_note="Enterprise plans are custom quoted. Contact hello@zensbot.com with your requirements.",
            enterprise=True,
            contact_email="hello@zensbot.com",
        )

    # Look up the amount
    target_tier_enum = PlanTier(body.target_tier)
    pricing = PRICING_TABLE.get(target_tier_enum)
    if not pricing:
        raise HTTPException(400, f"Tier '{body.target_tier}' is not self-serve")

    amount = pricing[body.billing_cycle]
    period_days = 365 if body.billing_cycle == "yearly" else 30
    period_start = date.today()
    period_end = period_start + timedelta(days=period_days)
    due_date = period_start + timedelta(days=7)  # pay within 7 days

    # Ensure the institute has a billing config row (get_or_create)
    await get_or_create_billing(session, institute.id)

    # Build a descriptive line item for the invoice
    tier_label = TIER_LABELS.get(target_tier_enum, body.target_tier)
    cycle_label = "Yearly" if body.billing_cycle == "yearly" else "Monthly"
    line_item = {
        "description": f"{tier_label} plan ({cycle_label}) — {institute.name}",
        "quantity": 1,
        "unit_price": amount,
        "amount": amount,
    }

    # Generate the invoice using the existing billing service.
    # generate_invoice already handles invoice numbering + commit.
    invoice = await generate_invoice(
        session=session,
        institute_id=institute.id,
        period_start=period_start,
        period_end=period_end,
        due_date=due_date,
        generated_by=current_user.id,
        custom_line_items=[line_item],
        notes=(
            f"Upgrade request: {tier_label} ({cycle_label}). "
            f"Payment method: {body.payment_method}. "
            f"Requested by {current_user.email}."
        ),
    )

    # Unique reference code the admin should include with their payment
    reference_code = f"UPG-{institute.slug[:10].upper()}-{secrets.token_hex(3).upper()}"

    # Grab configured payment methods from SA settings
    all_methods = await get_payment_methods(session)
    # Filter to the method the admin picked (bank_transfer / jazzcash / easypaisa)
    matched = [m for m in all_methods if m.get("type") == body.payment_method]
    if not matched:
        # Fall back to showing all methods if the specific one isn't configured
        matched = all_methods

    # Log the request in ActivityLog so SA sees it in the activity feed
    log = ActivityLog(
        user_id=current_user.id,
        action="upgrade_requested",
        entity_type="invoice",
        entity_id=invoice.id,
        institute_id=institute.id,
        details={
            "target_tier": body.target_tier,
            "billing_cycle": body.billing_cycle,
            "payment_method": body.payment_method,
            "amount_pkr": amount,
            "reference_code": reference_code,
            "invoice_number": invoice.invoice_number,
        },
        ip_address=request.client.host if request.client else None,
    )
    session.add(log)
    await session.commit()

    return UpgradeResponse(
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        reference_code=reference_code,
        amount=amount,
        target_tier=body.target_tier,
        billing_cycle=body.billing_cycle,
        payment_method=body.payment_method,
        payment_instructions=matched,
        payment_reference_note=(
            f"Send Rs {amount:,} to the account below. Include '{reference_code}' "
            f"as the payment reference. Once we verify your payment (usually within "
            f"24 hours), your account will be upgraded to {tier_label}."
        ),
    )


# ---------------------------------------------------------------------------
# SA endpoint: approve upgrade
# ---------------------------------------------------------------------------
class ApproveUpgradeRequest(BaseModel):
    payment_notes: Optional[str] = Field(default=None, max_length=500)


@router.post("/approve/{invoice_id}")
@limiter.limit("20/minute")
async def approve_upgrade(
    request: Request,
    invoice_id: uuid.UUID,
    body: ApproveUpgradeRequest,
    sa: SA,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """SA approves an upgrade request: marks invoice paid + flips plan_tier.

    Called by SA after verifying the customer's payment externally
    (bank screenshot, JazzCash confirmation, etc).
    """
    invoice = await session.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    if invoice.status == "paid":
        raise HTTPException(400, "Invoice is already paid")

    # Look up the corresponding upgrade_requested ActivityLog to find the target tier
    log_result = await session.execute(
        select(ActivityLog)
        .where(
            ActivityLog.action == "upgrade_requested",
            ActivityLog.entity_id == invoice_id,
        )
        .order_by(ActivityLog.created_at.desc())
        .limit(1)
    )
    upgrade_log = log_result.scalar_one_or_none()
    if not upgrade_log or not upgrade_log.details:
        raise HTTPException(400, "No upgrade request found for this invoice")

    target_tier_str = upgrade_log.details.get("target_tier")
    billing_cycle = upgrade_log.details.get("billing_cycle", "monthly")
    if not target_tier_str:
        raise HTTPException(400, "Upgrade request is missing target_tier")

    target_tier_enum = PlanTier(target_tier_str)

    # Look up the institute and flip its plan + quotas + expiry
    institute = await session.get(Institute, invoice.institute_id)
    if not institute:
        raise HTTPException(404, "Institute not found")

    tier_defaults = PLAN_LIMITS.get(target_tier_enum, {})
    institute.plan_tier = target_tier_enum
    institute.status = InstituteStatus.active
    if tier_defaults.get("students") is not None:
        institute.max_students = tier_defaults["students"]
    if tier_defaults.get("storage_gb") is not None:
        institute.max_storage_gb = tier_defaults["storage_gb"]
    if tier_defaults.get("video_gb") is not None:
        institute.max_video_gb = tier_defaults["video_gb"]
    # Extend expiry based on billing cycle (or clear it for "no expiry until renewed")
    period_days = 365 if billing_cycle == "yearly" else 30
    institute.expires_at = datetime.now(timezone.utc) + timedelta(days=period_days)
    institute.updated_at = datetime.now(timezone.utc)

    # Mark invoice paid
    invoice.status = "paid"
    invoice.updated_at = datetime.now(timezone.utc)
    if body.payment_notes:
        existing_notes = invoice.notes or ""
        invoice.notes = f"{existing_notes}\n\nPayment verified: {body.payment_notes}".strip()

    session.add(institute)
    session.add(invoice)

    await log_sa_action(
        session,
        sa.id,
        "upgrade_approved",
        "invoice",
        invoice.id,
        institute_id=institute.id,
        details={
            "new_plan": target_tier_str,
            "billing_cycle": billing_cycle,
            "new_expires_at": institute.expires_at.isoformat(),
        },
    )

    await session.commit()

    # Invalidate the admin user cache so the new plan_tier is reflected immediately
    try:
        from app.core.cache import cache
        admin_result = await session.execute(
            select(User.id).where(
                User.institute_id == institute.id,
                User.deleted_at.is_(None),
            )
        )
        for uid in admin_result.scalars().all():
            await cache.delete(cache.user_key(str(uid)))
    except Exception:
        # Cache invalidation is best-effort; don't fail the upgrade if it breaks
        pass

    return {
        "detail": "Upgrade approved",
        "institute_id": str(institute.id),
        "new_plan": target_tier_str,
        "new_expires_at": institute.expires_at.isoformat(),
    }
