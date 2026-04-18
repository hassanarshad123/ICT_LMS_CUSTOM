"""Admin-facing billing router (pricing v2).

Scope:
  * Only an institute's own admin can read/write against their billing.
  * Only v2 billing tiers (professional, custom) have a billing surface
    at all — grandfathered / trial tiers get HTTP 403 with a clear
    message so the frontend can render the "upgrade to see billing" card.

Routes (mounted at `/api/v1/billing`):
  GET    /overview               — plan, usage, next-invoice preview, addons
  GET    /invoices               — paginated, tenant-scoped
  GET    /invoices/{id}          — single invoice
  GET    /invoices/{id}/download — invoice PDF stream
  GET    /payments               — paginated, tenant-scoped
  GET    /addons                 — all addons (active + historical)
  POST   /addons                 — activate a storage pack
  DELETE /addons/{id}            — cancel (effective end of month)

ICT safety: every endpoint resolves the admin's institute and passes it
through `_require_v2_tier()`. Grandfathered tiers (pro/basic/starter/…)
never advance past that guard.
"""
import io
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.billing import Invoice, Payment, InstituteBilling
from app.models.institute import Institute
from app.models.institute_addon import InstituteAddon
from app.models.user import User
from app.schemas.billing import (
    AddonActivateRequest,
    AddonOut,
    AddonPackOut,
    AdminInvoiceOut,
    AdminPaymentOut,
    BillingOverviewOut,
    BillingPreviewOut,
)
from app.schemas.common import PaginatedResponse
from app.services import addon_service, billing_calc, sa_billing_service
from app.services.institute_service import get_or_create_usage
from app.utils.audit import log_sa_action
from app.utils.plan_limits import ADDON_PRICING, is_v2_billing_tier
from app.utils.rate_limit import limiter

router = APIRouter()

Admin = Annotated[User, Depends(require_roles("admin"))]


async def _require_v2_tier(
    session: AsyncSession, admin: User,
) -> Institute:
    """Resolve the admin's institute and enforce the v2 tier gate.

    Raises 403 for grandfathered tiers (ICT, etc.) and 500 if the admin
    row is missing an institute_id (shouldn't happen — auth middleware
    already guards against this, but we re-check for defense in depth).
    """
    if admin.institute_id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Admin account has no institute assignment",
        )

    institute = await session.get(Institute, admin.institute_id)
    if institute is None or institute.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Institute not found")

    if not is_v2_billing_tier(institute.plan_tier):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "billing_not_available",
                "message": (
                    "Self-serve billing is available on the Professional and "
                    "Custom plans. Contact support to upgrade."
                ),
            },
        )
    return institute


async def _get_billing_or_400(
    session: AsyncSession, institute_id: uuid.UUID,
) -> InstituteBilling:
    """Fetch the InstituteBilling row for this institute.

    Every v2-tier institute should have had this row created at signup
    (see signup_service._initial_billing_for_tier). If it's missing we
    surface a 400 rather than silently computing a zero-bill preview —
    this helps surface drift between signup and billing tables.
    """
    result = await session.execute(
        select(InstituteBilling).where(
            InstituteBilling.institute_id == institute_id
        )
    )
    billing = result.scalar_one_or_none()
    if billing is None:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "billing_config_missing",
                "message": (
                    "Billing configuration is not yet set up for this "
                    "institute. Please contact support."
                ),
            },
        )
    return billing


def _addon_to_out(addon: InstituteAddon) -> AddonOut:
    """Convert an ORM row to the UI schema with monthly_total computed."""
    return AddonOut(
        id=addon.id,
        addon_type=addon.addon_type,
        quantity=addon.quantity,
        unit_price_pkr=addon.unit_price_pkr,
        storage_bonus_gb=addon.storage_bonus_gb,
        storage_bonus_kind=addon.storage_bonus_kind,
        activated_at=addon.activated_at,
        cancelled_at=addon.cancelled_at,
        cancelled_effective_at=addon.cancelled_effective_at,
        monthly_total_pkr=addon.unit_price_pkr * addon.quantity,
    )


def _addon_catalogue() -> list[AddonPackOut]:
    """Return the static pack catalogue for the UI."""
    return [
        AddonPackOut(
            addon_type=key,
            price_pkr=int(cfg["price_pkr"]),
            bonus_gb=float(cfg["bonus_gb"]),
            kind=cfg["kind"],
        )
        for key, cfg in ADDON_PRICING.items()
    ]


# ── Overview ─────────────────────────────────────────────────────


@router.get("/overview", response_model=BillingOverviewOut)
async def get_billing_overview(
    admin: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """One-shot dashboard payload: plan + usage + preview + addons."""
    institute = await _require_v2_tier(session, admin)
    billing = await _get_billing_or_400(session, institute.id)
    usage = await get_or_create_usage(session, institute.id)

    # Preview the bill that would be generated if the cron ran right now.
    preview = await billing_calc.compute_billing_preview(
        session, institute, billing,
    )

    addons = await addon_service.active_addons(session, institute.id)

    # The /overview endpoint is read-only but get_or_create_usage may have
    # inserted a new row on its first call. Commit so the caller sees a
    # stable state on subsequent requests.
    await session.commit()

    return BillingOverviewOut(
        plan_tier=institute.plan_tier.value,
        status=institute.status.value,
        current_users=usage.current_users,
        current_storage_bytes=usage.current_storage_bytes,
        current_video_bytes=usage.current_video_bytes,
        storage_limit_gb=institute.max_storage_gb,
        video_limit_gb=institute.max_video_gb,
        free_users_included=billing.free_users_included,
        extra_user_rate_pkr=billing.extra_user_rate,
        currency=billing.currency,
        billing_cycle=billing.billing_cycle,
        billing_restriction=institute.billing_restriction,
        active_addons=[_addon_to_out(a) for a in addons],
        next_invoice_preview=BillingPreviewOut(
            snapshot_student_count=preview.snapshot_student_count,
            overage_student_count=preview.overage_student_count,
            student_overage_pkr=preview.student_overage_pkr,
            addon_total_pkr=preview.addon_total_pkr,
            base_fee_pkr=preview.base_fee_pkr,
            total_pkr=preview.total_pkr,
            line_items=preview.line_items,
        ),
        available_addon_packs=_addon_catalogue(),
    )


# ── Invoices ─────────────────────────────────────────────────────


@router.get("/invoices", response_model=PaginatedResponse[AdminInvoiceOut])
async def list_invoices(
    admin: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
):
    """Paginated invoice history for the admin's own institute."""
    institute = await _require_v2_tier(session, admin)

    filters = [Invoice.institute_id == institute.id]
    if status:
        filters.append(Invoice.status == status)

    count_q = select(func.count()).select_from(Invoice).where(*filters)
    total = (await session.execute(count_q)).scalar() or 0

    offset = (page - 1) * per_page
    data_q = (
        select(Invoice)
        .where(*filters)
        .order_by(Invoice.period_start.desc(), Invoice.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    rows = (await session.execute(data_q)).scalars().all()
    total_pages = (total + per_page - 1) // per_page

    return PaginatedResponse[AdminInvoiceOut](
        data=[AdminInvoiceOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/invoices/{invoice_id}", response_model=AdminInvoiceOut)
async def get_invoice(
    invoice_id: uuid.UUID,
    admin: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Single invoice — 404 if the invoice belongs to a different institute."""
    institute = await _require_v2_tier(session, admin)

    inv = await session.get(Invoice, invoice_id)
    if inv is None or inv.institute_id != institute.id:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return AdminInvoiceOut.model_validate(inv)


@router.get("/invoices/{invoice_id}/download")
async def download_invoice(
    invoice_id: uuid.UUID,
    admin: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Stream the invoice PDF.

    Tenant-scoped: the invoice must belong to the admin's institute, otherwise
    we 404 (not 403) to avoid leaking the existence of other institutes' invoices.
    """
    institute = await _require_v2_tier(session, admin)

    inv = await session.get(Invoice, invoice_id)
    if inv is None or inv.institute_id != institute.id:
        raise HTTPException(status_code=404, detail="Invoice not found")

    try:
        pdf_bytes, filename = await sa_billing_service.generate_invoice_pdf_bytes(
            session, invoice_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Payments ─────────────────────────────────────────────────────


@router.get("/payments", response_model=PaginatedResponse[AdminPaymentOut])
async def list_payments(
    admin: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    """Read-only payment history for the admin's own institute."""
    institute = await _require_v2_tier(session, admin)

    filters = [Payment.institute_id == institute.id]

    count_q = select(func.count()).select_from(Payment).where(*filters)
    total = (await session.execute(count_q)).scalar() or 0

    offset = (page - 1) * per_page
    data_q = (
        select(Payment)
        .where(*filters)
        .order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    rows = (await session.execute(data_q)).scalars().all()
    total_pages = (total + per_page - 1) // per_page

    return PaginatedResponse[AdminPaymentOut](
        data=[AdminPaymentOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


# ── Add-ons ──────────────────────────────────────────────────────


@router.get("/addons", response_model=list[AddonOut])
async def list_addons(
    admin: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """All addon rows (active + historical) for this institute."""
    institute = await _require_v2_tier(session, admin)
    addons = await addon_service.list_addons(session, institute.id)
    return [_addon_to_out(a) for a in addons]


@router.post(
    "/addons",
    response_model=AddonOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/hour")
async def activate_addon(
    request: Request,
    body: AddonActivateRequest,
    admin: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Activate a new storage pack subscription.

    Rate-limited 10/hour per IP to prevent accidental spam (clicking
    Activate repeatedly). Capacity applies immediately; billing starts
    on the next cron cycle.
    """
    institute = await _require_v2_tier(session, admin)

    try:
        addon = await addon_service.activate_addon(
            session, institute.id, body.addon_type, body.quantity,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await log_sa_action(
        session,
        admin.id,
        "addon_activated",
        "institute_addon",
        entity_id=addon.id,
        institute_id=institute.id,
        details={
            "addon_type": body.addon_type,
            "quantity": body.quantity,
            "unit_price_pkr": addon.unit_price_pkr,
        },
    )
    await session.commit()
    await session.refresh(addon)
    return _addon_to_out(addon)


@router.delete("/addons/{addon_id}", response_model=AddonOut)
async def cancel_addon(
    addon_id: uuid.UUID,
    admin: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Cancel an active addon.

    Takes effect at the end of the current calendar month — capacity and
    billing both remain until then. 404 if the addon belongs to a
    different institute (tenant isolation).
    """
    institute = await _require_v2_tier(session, admin)

    addon = await session.get(InstituteAddon, addon_id)
    if addon is None or addon.institute_id != institute.id:
        raise HTTPException(status_code=404, detail="Addon not found")

    try:
        cancelled = await addon_service.cancel_addon(session, addon_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await log_sa_action(
        session,
        admin.id,
        "addon_cancelled",
        "institute_addon",
        entity_id=addon_id,
        institute_id=institute.id,
        details={
            "addon_type": cancelled.addon_type,
            "effective_at": cancelled.cancelled_effective_at.isoformat()
            if cancelled.cancelled_effective_at
            else None,
        },
    )
    await session.commit()
    await session.refresh(cancelled)
    return _addon_to_out(cancelled)
