"""High-level Frappe sync orchestration (Phase 3 + 4).

Responsibilities:
  * Process outbound IntegrationSyncTask rows → call FrappeClient → write
    IntegrationSyncLog row per attempt.
  * Accept inbound Payment Entry webhooks from Frappe → call fee_service.
    record_payment → enforce LMS-wins conflict rule.
  * Enqueue sync tasks when a fee.* webhook event fires (used by the webhook
    event service extension).

Retry cadence reuses the existing webhook RETRY_INTERVALS.
"""
from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.batch import Batch, StudentBatch
from app.models.fee import FeeInstallment, FeePayment, FeePlan
from app.models.enums import FeeInstallmentStatus, FeePlanStatus
from app.models.integration import (
    InstituteIntegration,
    IntegrationSyncLog,
    IntegrationSyncTask,
)
from app.models.user import User
from app.services.frappe_client import FrappeClient, FrappeResult
from app.services.integration_service import load_active_frappe_config

logger = logging.getLogger("ict_lms.frappe_sync")

# Same shape as webhook_event_service.RETRY_INTERVALS
RETRY_INTERVALS = [
    timedelta(minutes=1),
    timedelta(minutes=5),
    timedelta(minutes=30),
    timedelta(hours=2),
    timedelta(hours=12),
]
MAX_ATTEMPTS = len(RETRY_INTERVALS) + 1


class InboundError(ValueError):
    """Inbound payload is malformed or references unknown entities."""


class DuplicateEventError(Exception):
    """Inbound event already seen (by payload hash)."""


class ConflictError(Exception):
    """LMS-wins conflict rule fired — Frappe sent a change LMS already has."""


# ── Enqueue (called from webhook_event_service) ─────────────────────

async def enqueue_from_event(
    session: AsyncSession,
    institute_id: uuid.UUID,
    event_type: str,
    data: dict,
) -> None:
    """If the institute has Frappe sync enabled AND the event type is one we
    care about (fee.*), park a pending IntegrationSyncTask.

    No-op otherwise — existing institutes without integration see zero effect.
    The caller (webhook_event_service) owns the transaction.
    """
    if not event_type.startswith("fee."):
        return
    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        return

    task = IntegrationSyncTask(
        institute_id=institute_id,
        provider="frappe",
        event_type=event_type,
        payload=data,
        status="pending",
        next_run_at=datetime.now(timezone.utc),
    )
    session.add(task)


# ── Outbound worker (called from APScheduler every 30s) ─────────────

async def process_pending_tasks(session: AsyncSession, batch_size: int = 25) -> int:
    """Drain up to ``batch_size`` pending IntegrationSyncTask rows. Returns
    the count processed. Called by the scheduler job added in main.py.
    """
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(IntegrationSyncTask).where(
            IntegrationSyncTask.status == "pending",
            (IntegrationSyncTask.next_run_at.is_(None))
            | (IntegrationSyncTask.next_run_at <= now),
        ).order_by(IntegrationSyncTask.created_at.asc()).limit(batch_size)
    )
    tasks = result.scalars().all()
    if not tasks:
        return 0

    for task in tasks:
        await _run_task(session, task)
    return len(tasks)


async def _run_task(session: AsyncSession, task: IntegrationSyncTask) -> None:
    task.status = "running"
    task.last_attempted_at = datetime.now(timezone.utc)
    task.attempt_count += 1
    session.add(task)
    await session.commit()

    cfg = await load_active_frappe_config(session, task.institute_id)
    if cfg is None:
        task.status = "cancelled"
        task.last_error = "Integration disabled or credentials removed"
        task.completed_at = datetime.now(timezone.utc)
        session.add(task)
        await session.commit()
        return

    try:
        ok, log_row = await _dispatch(session, cfg, task)
    except Exception as e:  # noqa: BLE001
        logger.exception("Frappe sync task crashed for task %s", task.id)
        ok = False
        log_row = _build_log_row(
            task, status="failed", error=f"Unhandled: {type(e).__name__}: {e}",
        )

    session.add(log_row)

    if ok:
        task.status = "completed"
        task.completed_at = datetime.now(timezone.utc)
        task.last_error = None
    elif task.attempt_count >= MAX_ATTEMPTS:
        task.status = "failed"
        task.completed_at = datetime.now(timezone.utc)
        task.last_error = log_row.error_message
    else:
        task.status = "pending"
        delay = RETRY_INTERVALS[min(task.attempt_count - 1, len(RETRY_INTERVALS) - 1)]
        task.next_run_at = datetime.now(timezone.utc) + delay
        task.last_error = log_row.error_message

    session.add(task)
    await session.commit()


async def _dispatch(
    session: AsyncSession,
    cfg: InstituteIntegration,
    task: IntegrationSyncTask,
) -> tuple[bool, IntegrationSyncLog]:
    """Route to the right Frappe client method based on event_type.

    Returns (success, log_row). The log row is NOT added to session — caller
    does that.
    """
    client = FrappeClient(cfg)
    payload = task.payload or {}

    if task.event_type == "fee.plan_created":
        return await _sync_sales_invoice(session, client, task, payload)
    if task.event_type == "fee.payment_recorded":
        return await _sync_payment_entry(session, client, task, payload)
    if task.event_type == "fee.plan_cancelled":
        return await _cancel_sales_invoice(session, client, task, payload)
    if task.event_type in ("fee.plan_completed", "fee.installment_overdue"):
        # No-op in Frappe today — logged as skipped for observability.
        return True, _build_log_row(task, status="skipped", error="Event has no Frappe side effect")

    return True, _build_log_row(task, status="skipped", error=f"Unknown event: {task.event_type}")


async def _sync_sales_invoice(
    session: AsyncSession,
    client: FrappeClient,
    task: IntegrationSyncTask,
    payload: dict,
) -> tuple[bool, IntegrationSyncLog]:
    fee_plan_id_str = payload.get("fee_plan_id")
    student_id_str = payload.get("student_id")
    if not (fee_plan_id_str and student_id_str):
        return False, _build_log_row(task, status="failed", error="Missing fee_plan_id or student_id")

    # Load authoritative data — payload may be stale after retries.
    plan = await session.get(FeePlan, uuid.UUID(fee_plan_id_str))
    student = await session.get(User, uuid.UUID(student_id_str))
    batch = await session.get(Batch, plan.batch_id) if plan else None
    if plan is None or student is None or batch is None:
        return False, _build_log_row(task, status="failed", error="Fee plan / student / batch missing")

    # Auto-create Customer if the institute opted in (default True). Closes
    # the v1 "Customer not found" gap without pre-seeding Frappe's Customer
    # list. Idempotent — the client returns ok if the Customer already exists.
    if getattr(client.cfg, "auto_create_customers", True):
        await client.create_customer(customer_name=student.name, email=student.email)

    result = await client.upsert_sales_invoice(
        fee_plan_id=str(plan.id),
        customer_name=student.name,
        posting_date=plan.created_at.date().isoformat() if plan.created_at else datetime.utcnow().date().isoformat(),
        due_date=None,
        amount=plan.final_amount,
        currency=plan.currency,
        description=f"{batch.name} — {plan.plan_type}",
    )
    return _finalize_outbound(task, result, entity_type="sales_invoice", lms_entity_id=plan.id)


async def _sync_payment_entry(
    session: AsyncSession,
    client: FrappeClient,
    task: IntegrationSyncTask,
    payload: dict,
) -> tuple[bool, IntegrationSyncLog]:
    payment_id_str = payload.get("payment_id")
    fee_plan_id_str = payload.get("fee_plan_id")
    if not (payment_id_str and fee_plan_id_str):
        return False, _build_log_row(task, status="failed", error="Missing payment_id or fee_plan_id")

    payment = await session.get(FeePayment, uuid.UUID(payment_id_str))
    plan = await session.get(FeePlan, uuid.UUID(fee_plan_id_str))
    if payment is None or plan is None:
        return False, _build_log_row(task, status="failed", error="Payment / plan missing")

    student = await session.get(User, plan.student_id)
    if student is None:
        return False, _build_log_row(task, status="failed", error="Student missing")

    # Look up the invoice the plan mirrors to for reference allocation
    invoice_lookup = await client._find_by_zensbot_id("Sales Invoice", str(plan.id))  # noqa: SLF001
    invoice_name = invoice_lookup.doc_name if invoice_lookup.ok else None

    result = await client.upsert_payment_entry(
        payment_id=str(payment.id),
        fee_plan_id=str(plan.id),
        invoice_name=invoice_name,
        customer_name=student.name,
        posting_date=(payment.payment_date.isoformat()
                      if payment.payment_date else datetime.utcnow().date().isoformat()),
        amount=payment.amount,
        currency=plan.currency,
        mode_of_payment=payment.payment_method,
        reference_no=payment.reference_number or payment.receipt_number,
    )
    return _finalize_outbound(task, result, entity_type="payment_entry", lms_entity_id=payment.id)


async def _cancel_sales_invoice(
    session: AsyncSession,
    client: FrappeClient,
    task: IntegrationSyncTask,
    payload: dict,
) -> tuple[bool, IntegrationSyncLog]:
    fee_plan_id_str = payload.get("fee_plan_id")
    if not fee_plan_id_str:
        return False, _build_log_row(task, status="failed", error="Missing fee_plan_id")

    result = await client.cancel_sales_invoice(fee_plan_id=fee_plan_id_str)
    return _finalize_outbound(
        task, result, entity_type="sales_invoice", lms_entity_id=uuid.UUID(fee_plan_id_str),
    )


def _finalize_outbound(
    task: IntegrationSyncTask,
    result: FrappeResult,
    *,
    entity_type: str,
    lms_entity_id: Optional[uuid.UUID],
) -> tuple[bool, IntegrationSyncLog]:
    log = IntegrationSyncLog(
        institute_id=task.institute_id,
        direction="outbound",
        entity_type=entity_type,
        event_type=task.event_type,
        lms_entity_id=lms_entity_id,
        frappe_doc_name=result.doc_name,
        status="success" if result.ok else "failed",
        status_code=result.status_code,
        error_message=None if result.ok else (result.error or "Unknown failure")[:2000],
        attempt_count=task.attempt_count,
        request_snapshot=_redact(task.payload),
        response_snapshot=_redact(result.response),
        payload_hash=_hash_payload(task.payload),
    )
    return result.ok, log


def _build_log_row(
    task: IntegrationSyncTask, *, status: str, error: Optional[str],
) -> IntegrationSyncLog:
    entity = "sales_invoice" if "plan" in task.event_type else "payment_entry"
    return IntegrationSyncLog(
        institute_id=task.institute_id,
        direction="outbound",
        entity_type=entity,
        event_type=task.event_type,
        status=status,
        error_message=error[:2000] if error else None,
        attempt_count=task.attempt_count,
        request_snapshot=_redact(task.payload),
        payload_hash=_hash_payload(task.payload),
    )


def _redact(d: Optional[dict]) -> Optional[dict]:
    """Strip obvious credential-looking keys before persisting the snapshot."""
    if not d:
        return d
    sensitive = {"api_key", "api_secret", "password", "token", "secret", "authorization"}
    out = {}
    for k, v in d.items():
        if str(k).lower() in sensitive:
            out[k] = "[REDACTED]"
        else:
            out[k] = v
    return out


def _hash_payload(payload: Optional[dict]) -> Optional[str]:
    if payload is None:
        return None
    canonical = json.dumps(payload, sort_keys=True, default=str).encode()
    return hashlib.sha256(canonical).hexdigest()


# ── Inbound handler (Phase 4 — called from router) ──────────────────

async def handle_inbound_payment_entry(
    session: AsyncSession,
    *,
    institute_id: uuid.UUID,
    raw_body: bytes,
) -> dict:
    """Accept a Frappe Payment Entry webhook and mirror it into LMS.

    Idempotency: refuse if this ``name`` (Frappe doc name) was already seen in
    IntegrationSyncLog with status=success.
    Conflict: LMS wins — if the matched installment is already ``paid``, return
    409 and log it; do NOT overwrite.
    """
    try:
        body = json.loads(raw_body.decode() or "{}")
    except json.JSONDecodeError:
        raise InboundError("Body is not valid JSON")

    # Frappe ships the event body in a "doc" key by default; accept either.
    doc = body.get("doc") if isinstance(body.get("doc"), dict) else body

    doc_name = doc.get("name")
    # Accept both prefixed (UI-installed) and bare (fixture-installed) names.
    fee_plan_id_str = doc.get("custom_zensbot_fee_plan_id") or doc.get("zensbot_fee_plan_id")
    amount = doc.get("paid_amount") or doc.get("received_amount")
    posting_date_str = doc.get("posting_date")
    mode_of_payment = doc.get("mode_of_payment")
    reference_no = doc.get("reference_no")

    if not (doc_name and fee_plan_id_str and amount):
        raise InboundError("Missing doc.name / custom_zensbot_fee_plan_id / amount")

    # Dedup by Frappe doc name
    already = (await session.execute(
        select(IntegrationSyncLog.id).where(
            IntegrationSyncLog.institute_id == institute_id,
            IntegrationSyncLog.direction == "inbound",
            IntegrationSyncLog.frappe_doc_name == doc_name,
            IntegrationSyncLog.status == "success",
        ).limit(1)
    )).scalar_one_or_none()
    if already:
        raise DuplicateEventError()

    try:
        fee_plan_id = uuid.UUID(str(fee_plan_id_str))
    except ValueError:
        raise InboundError("custom_zensbot_fee_plan_id is not a valid UUID")

    plan = await session.get(FeePlan, fee_plan_id)
    if plan is None or plan.institute_id != institute_id:
        raise InboundError("Fee plan not found for this institute")

    # Find next unpaid installment to apply payment to.
    inst_result = await session.execute(
        select(FeeInstallment).where(
            FeeInstallment.fee_plan_id == fee_plan_id,
        ).order_by(FeeInstallment.sequence.asc())
    )
    installments = inst_result.scalars().all()
    target = None
    for i in installments:
        if i.status != FeeInstallmentStatus.paid.value and i.status != FeeInstallmentStatus.waived.value:
            target = i
            break

    if target is None:
        _log_inbound(session, institute_id, doc_name, fee_plan_id, "failed",
                     f"No open installment on plan {fee_plan_id}", raw_body)
        await session.commit()
        raise ConflictError("All installments already paid in LMS (LMS-wins rule)")

    # Conflict: installment already paid — reject per the LMS-wins rule.
    if target.status == FeeInstallmentStatus.paid.value:
        _log_inbound(session, institute_id, doc_name, fee_plan_id, "failed",
                     "Installment already paid in LMS", raw_body)
        await session.commit()
        raise ConflictError("Installment already paid in LMS")

    # Build a PaymentCreate-compatible payload and call fee_service.
    from app.services import fee_service
    from app.schemas.fee import PaymentCreate

    student = await session.get(User, plan.student_id)
    if student is None:
        raise InboundError("Plan references a missing student")

    # Use the LMS system actor: find the admissions officer who onboarded
    # the student so the activity log reflects them.
    actor = await session.get(User, plan.onboarded_by_user_id) or student

    try:
        posting_date = (datetime.fromisoformat(posting_date_str).date()
                        if posting_date_str else datetime.now(timezone.utc).date())
    except ValueError:
        posting_date = datetime.now(timezone.utc).date()

    payload = PaymentCreate(
        fee_installment_id=target.id,
        amount=int(amount),
        payment_date=posting_date,
        payment_method=mode_of_payment or "frappe_sync",
        reference_number=reference_no,
        notes=f"Synced from Frappe Payment Entry {doc_name}",
    )
    try:
        payment = await fee_service.record_payment(
            session, actor=actor, student=student, fee_plan=plan, payload=payload,
        )
    except fee_service.FeeError as e:
        _log_inbound(session, institute_id, doc_name, fee_plan_id, "failed", str(e), raw_body)
        await session.commit()
        raise InboundError(str(e))

    _log_inbound(session, institute_id, doc_name, fee_plan_id, "success",
                 None, raw_body, lms_entity_id=payment.id)
    await session.commit()

    return {
        "payment_id": str(payment.id),
        "installment_id": str(target.id),
        "receipt_number": payment.receipt_number,
    }


def _log_inbound(
    session: AsyncSession,
    institute_id: uuid.UUID,
    frappe_doc_name: str,
    fee_plan_id: uuid.UUID,
    status: str,
    error: Optional[str],
    raw_body: bytes,
    lms_entity_id: Optional[uuid.UUID] = None,
) -> None:
    try:
        parsed = json.loads(raw_body.decode() or "{}")
    except Exception:  # noqa: BLE001
        parsed = None

    log = IntegrationSyncLog(
        institute_id=institute_id,
        direction="inbound",
        entity_type="payment_entry",
        event_type="payment_entry.received",
        lms_entity_id=lms_entity_id or fee_plan_id,
        frappe_doc_name=frappe_doc_name,
        status=status,
        error_message=(error or "")[:2000] if error else None,
        attempt_count=1,
        request_snapshot=_redact(parsed) if isinstance(parsed, dict) else None,
        payload_hash=hashlib.sha256(raw_body).hexdigest(),
    )
    session.add(log)
