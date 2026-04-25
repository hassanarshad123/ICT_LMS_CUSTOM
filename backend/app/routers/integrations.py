"""Admin surface for ERP/CRM integrations. v1 covers Frappe/ERPNext only.

All endpoints are admin-only. Super admin can also reach them (role guard is
``require_roles("admin")`` which includes SA by project convention in
``middleware.auth``).

Sync log + inbound webhook receiver live here too; they share the same
``/api/v1/integrations`` prefix so the frontend only has one namespace to
remember.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.rbac.dependencies import require_permissions
from app.models.integration import (
    InstituteIntegration,
    IntegrationSyncLog,
    IntegrationSyncTask,
)
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.integration import (
    FrappeConfigIn,
    FrappeConfigOut,
    FrappeInboundSecretOut,
    FrappeItemListOut,
    FrappeTestConnectionOut,
    PaymentTermsTemplateDetail,
    PaymentTermsTemplateListOut,
    SalesPersonListOut,
    SyncLogItem,
    SyncLogKPIs,
)
from app.services import integration_service
from app.services.integration_service import IntegrationError
from app.utils.encryption import decrypt
from app.utils.rate_limit import limiter

logger = logging.getLogger("ict_lms.integrations.router")

router = APIRouter()

CanViewIntegrations = Annotated[User, Depends(require_permissions("integrations.view"))]
CanManageIntegrations = Annotated[User, Depends(require_permissions("integrations.manage"))]
CanSyncIntegrations = Annotated[User, Depends(require_permissions("integrations.sync"))]


# ── Frappe config ──────────────────────────────────────────────────

@router.get("/frappe", response_model=FrappeConfigOut)
async def get_frappe(
    current_user: CanViewIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await integration_service.get_frappe_config(session, current_user.institute_id)


@router.put("/frappe", response_model=FrappeConfigOut)
@limiter.limit("20/minute")
async def update_frappe(
    request: Request,
    body: FrappeConfigIn,
    current_user: CanManageIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        return await integration_service.update_frappe_config(
            session, current_user.institute_id, body
        )
    except IntegrationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/frappe/test", response_model=FrappeTestConnectionOut)
@limiter.limit("10/minute")
async def test_frappe(
    request: Request,
    current_user: CanManageIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await integration_service.test_frappe_connection(session, current_user.institute_id)


@router.post("/frappe/inbound-secret/rotate", response_model=FrappeInboundSecretOut)
@limiter.limit("5/hour")
async def rotate_inbound_secret(
    request: Request,
    current_user: CanManageIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Generate a new inbound webhook secret. Plaintext is returned exactly
    once — if lost, the admin must rotate again.
    """
    plaintext = await integration_service.rotate_inbound_secret(
        session, current_user.institute_id
    )
    return FrappeInboundSecretOut(secret=plaintext)


# ── Sync log (Phase 5 — dashboard & retry) ─────────────────────────

@router.get("/sync-log", response_model=PaginatedResponse[SyncLogItem])
async def list_sync_log(
    current_user: CanViewIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    direction: Optional[str] = Query(None, pattern="^(inbound|outbound)$"),
    status_filter: Optional[str] = Query(None, alias="status"),
    entity_type: Optional[str] = None,
):
    stmt = select(IntegrationSyncLog).where(
        IntegrationSyncLog.institute_id == current_user.institute_id
    )
    if direction:
        stmt = stmt.where(IntegrationSyncLog.direction == direction)
    if status_filter:
        stmt = stmt.where(IntegrationSyncLog.status == status_filter)
    if entity_type:
        stmt = stmt.where(IntegrationSyncLog.entity_type == entity_type)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await session.execute(count_stmt)).scalar_one()

    rows = (await session.execute(
        stmt.order_by(IntegrationSyncLog.created_at.desc())
            .limit(per_page).offset((page - 1) * per_page)
    )).scalars().all()

    return PaginatedResponse(
        data=[
            SyncLogItem(
                id=str(r.id),
                direction=r.direction,
                entity_type=r.entity_type,
                event_type=r.event_type,
                lms_entity_id=str(r.lms_entity_id) if r.lms_entity_id else None,
                frappe_doc_name=r.frappe_doc_name,
                status=r.status,
                status_code=r.status_code,
                error_message=r.error_message,
                attempt_count=r.attempt_count,
                next_retry_at=r.next_retry_at,
                created_at=r.created_at,
            )
            for r in rows
        ],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=(total + per_page - 1) // per_page if total else 0,
    )


@router.get("/sync-log/kpis", response_model=SyncLogKPIs)
async def sync_log_kpis(
    current_user: CanViewIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)
    since_7d = now - timedelta(days=7)

    async def _count(where_extra) -> int:
        stmt = select(func.count(IntegrationSyncLog.id)).where(
            IntegrationSyncLog.institute_id == current_user.institute_id
        ).where(where_extra)
        return (await session.execute(stmt)).scalar_one()

    success_24h = await _count(
        (IntegrationSyncLog.created_at >= since_24h) & (IntegrationSyncLog.status == "success")
    )
    fail_24h = await _count(
        (IntegrationSyncLog.created_at >= since_24h) & (IntegrationSyncLog.status == "failed")
    )
    pending_retries = (await session.execute(
        select(func.count(IntegrationSyncTask.id)).where(
            IntegrationSyncTask.institute_id == current_user.institute_id,
            IntegrationSyncTask.status.in_(("pending", "running")),
        )
    )).scalar_one()
    failures_7d = await _count(
        (IntegrationSyncLog.created_at >= since_7d) & (IntegrationSyncLog.status == "failed")
    )

    total_24h = success_24h + fail_24h
    success_rate = (success_24h / total_24h * 100.0) if total_24h else 100.0

    return SyncLogKPIs(
        success_rate_24h=round(success_rate, 2),
        success_count_24h=success_24h,
        failure_count_24h=fail_24h,
        pending_retries=pending_retries,
        failures_7d=failures_7d,
    )


@router.post("/sync-log/{log_id}/retry", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("30/minute")
async def retry_sync_log(
    request: Request,
    log_id: uuid.UUID,
    current_user: CanSyncIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Re-enqueue a failed outbound event. No-op for inbound rows (Frappe is
    the producer of those)."""
    row = await session.get(IntegrationSyncLog, log_id)
    if row is None or row.institute_id != current_user.institute_id:
        raise HTTPException(status_code=404, detail="Log entry not found")

    if row.direction != "outbound":
        raise HTTPException(
            status_code=400,
            detail="Only outbound events can be retried from the LMS side",
        )

    task = IntegrationSyncTask(
        institute_id=row.institute_id,
        provider="frappe",
        event_type=row.event_type,
        payload=(row.request_snapshot or {}),
        status="pending",
        next_run_at=datetime.now(timezone.utc),
    )
    session.add(task)
    await session.commit()
    return {"status": "queued", "task_id": str(task.id)}


# ── Inbound Frappe webhook receiver (Phase 4) ──────────────────────

@router.post("/frappe/webhook", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("120/minute")
async def inbound_frappe_webhook(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_institute_id: Annotated[Optional[str], Query(alias="institute_id")] = None,
):
    """Receive Payment Entry events from Frappe.

    Auth: HMAC-SHA256 of the raw body, signed with the institute's inbound
    secret, passed in the ``X-Frappe-Signature`` header. The institute_id is
    sent as a query param because Frappe webhooks don't carry custom auth
    context in a standard way.
    """
    if not x_institute_id:
        raise HTTPException(status_code=400, detail="institute_id query param required")
    try:
        institute_id = uuid.UUID(x_institute_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="institute_id must be a UUID")

    raw_body = await request.body()
    # Accept both our custom header and Frappe's native Webhook security header.
    # Frappe's built-in "Enable Security" sends X-Frappe-Webhook-Signature;
    # our connector's server script sends X-Frappe-Signature.
    signature = (
        request.headers.get("x-frappe-signature")
        or request.headers.get("x-frappe-webhook-signature")
        or ""
    )
    # Frappe's native signature sometimes ships as "sha256=<hex>" — strip prefix.
    if signature.startswith("sha256="):
        signature = signature[len("sha256="):]
    if not signature:
        raise HTTPException(
            status_code=401,
            detail="Missing X-Frappe-Signature or X-Frappe-Webhook-Signature",
        )

    # Load inbound secret
    result = await session.execute(
        select(InstituteIntegration).where(
            InstituteIntegration.institute_id == institute_id
        )
    )
    cfg = result.scalar_one_or_none()
    if cfg is None or not cfg.frappe_inbound_secret_ciphertext:
        raise HTTPException(status_code=401, detail="Integration not configured")

    expected = hmac.new(
        decrypt(cfg.frappe_inbound_secret_ciphertext).encode(),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Delegate to sync service (lives in a separate module to avoid circular
    # imports with fee_service / admissions_service).
    from app.services import frappe_sync_service

    try:
        result_summary = await frappe_sync_service.handle_inbound_payment_entry(
            session, institute_id=institute_id, raw_body=raw_body,
        )
    except frappe_sync_service.DuplicateEventError:
        return {"status": "duplicate", "message": "Event already processed"}
    except frappe_sync_service.ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except frappe_sync_service.InboundError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "accepted", **result_summary}


# ── Tier 2: wizard introspection + auto-setup ─────────────────────

@router.get("/frappe/introspect/{resource}")
@limiter.limit("60/minute")
async def introspect_frappe(
    request: Request,
    resource: str,
    current_user: CanViewIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
    company: Optional[str] = None,
    account_type: Optional[str] = Query(None, alias="accountType"),
    refresh: bool = False,
):
    """Proxy read-only Frappe listings for the wizard's dropdowns.

    ``resource`` ∈ {companies, accounts, modes-of-payment, cost-centers}.
    Results are cached 5 minutes per institute — pass ``?refresh=true`` to
    bust the cache (wizard offers this as a "Refresh" button).
    """
    try:
        return await integration_service.introspect_resource(
            session, current_user.institute_id,
            resource=resource, company=company, account_type=account_type,
            refresh=refresh,
        )
    except IntegrationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/frappe/setup/custom-fields")
@limiter.limit("10/hour")
async def setup_custom_fields(
    request: Request,
    current_user: CanManageIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Install the 3 LMS custom fields in Frappe via REST API. Idempotent."""
    try:
        return await integration_service.install_custom_fields(
            session, current_user.institute_id,
        )
    except IntegrationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/frappe/setup/webhook")
@limiter.limit("10/hour")
async def setup_webhook(
    request: Request,
    current_user: CanManageIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Register the Payment Entry webhook in Frappe with the inbound secret
    pre-filled. Generates the secret if not already set."""
    try:
        return await integration_service.register_webhook(
            session, current_user.institute_id,
        )
    except IntegrationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/frappe/setup/dry-run")
@limiter.limit("5/hour")
async def setup_dry_run(
    request: Request,
    current_user: CanManageIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Create + immediately cancel a test Sales Invoice in Frappe to verify
    the full account mapping works end-to-end. Never touches real student
    data; the test customer name is namespaced ``zensbot_test_<uuid>``.
    """
    try:
        return await integration_service.run_dry_run(
            session, current_user.institute_id,
        )
    except IntegrationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/frappe/setup/status")
async def setup_status(
    current_user: CanViewIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Per-step pass/fail snapshot — wizard uses this to resume."""
    return await integration_service.get_setup_status(
        session, current_user.institute_id,
    )


@router.put("/frappe/auto-create-customers")
@limiter.limit("10/minute")
async def update_auto_create_customers(
    request: Request,
    body: dict,
    current_user: CanManageIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Toggle whether the outbound sync should auto-create Customers in
    Frappe when they don't exist yet (closes the known v1 "Customer not
    found" gap)."""
    flag = bool(body.get("auto_create_customers", True))
    return await integration_service.set_auto_create_customers(
        session, current_user.institute_id, flag,
    )


@router.get("/frappe/sales-persons", response_model=SalesPersonListOut)
@limiter.limit("20/minute")
async def list_frappe_sales_persons(
    request: Request,
    current_user: CanViewIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """List active Frappe Sales Persons for the AO onboarding dropdown."""
    return await integration_service.fetch_sales_persons(
        session, current_user.institute_id,
    )


# ── Frappe Items (Phase 1 — AO onboarding course-SKU picker) ──────────────────

@router.get("/frappe/items", response_model=FrappeItemListOut)
@limiter.limit("20/minute")
async def list_frappe_items(
    request: Request,
    current_user: CanViewIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """List active ERP Items (Services by default) for the onboarding wizard."""
    return await integration_service.fetch_items(session, current_user.institute_id)


# ── Payment Terms Templates (Phase 1 — AO onboarding installment-plan picker) ─

@router.get("/frappe/payment-terms-templates", response_model=PaymentTermsTemplateListOut)
@limiter.limit("20/minute")
async def list_frappe_payment_terms_templates(
    request: Request,
    current_user: CanViewIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """List Payment Terms Templates for the AO wizard's installment picker."""
    return await integration_service.fetch_payment_terms_templates(
        session, current_user.institute_id,
    )


@router.get(
    "/frappe/payment-terms-templates/{template_name}",
    response_model=PaymentTermsTemplateDetail,
)
@limiter.limit("40/minute")
async def get_frappe_payment_terms_template(
    request: Request,
    template_name: str,
    current_user: CanViewIntegrations,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Full PTT including the terms[] schedule for UI preview."""
    detail = await integration_service.fetch_payment_terms_template_detail(
        session, current_user.institute_id, template_name,
    )
    if detail is None:
        raise HTTPException(
            status_code=404,
            detail="Template not found or Frappe integration disabled",
        )
    return detail
