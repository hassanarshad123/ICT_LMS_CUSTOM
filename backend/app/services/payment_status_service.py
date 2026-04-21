"""Refresh ERP-side status of LMS-recorded payments.

Two entry points:

  1. refresh_payment_erp_status(session, payment_id) -- single-row refresh
     used by the admin API endpoint.
  2. refresh_stale_payment_erp_statuses(session, institute_id) -- bulk
     refresh used by the daily cron; iterates pending PEs for one
     institute.

Both return a summary dict suitable for logging / response bodies.
Errors on any single row are swallowed with a warning; one bad row
never aborts the batch.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.fee import FeePayment, FeePlan
from app.services.frappe_client import FrappeClient
from app.services.integration_service import load_active_frappe_config

logger = logging.getLogger("ict_lms.payment_status")


@dataclass
class RefreshSummary:
    checked: int = 0
    confirmed: int = 0
    cancelled: int = 0
    still_pending: int = 0
    unknown: int = 0
    si_status_updated: int = 0
    errors: int = 0


async def refresh_payment_erp_status(
    session: AsyncSession,
    payment_id: uuid.UUID,
) -> Optional[str]:
    """Refresh one FeePayment's erp_status. Returns the new erp_status or
    None if the payment doesn't exist / isn't linked to Frappe yet.
    """
    payment = await session.get(FeePayment, payment_id)
    if payment is None:
        return None
    if not payment.frappe_payment_entry_name:
        return payment.erp_status

    cfg = await load_active_frappe_config(session, payment.institute_id)
    if cfg is None:
        return payment.erp_status

    client = FrappeClient(cfg)
    result = await client.get_payment_entry_status(payment.frappe_payment_entry_name)
    if not result.ok:
        logger.warning(
            "PE refresh failed for %s: %s", payment.frappe_payment_entry_name, result.error,
        )
        return payment.erp_status

    new_status = (result.response or {}).get("erp_status")
    if new_status and new_status != payment.erp_status:
        payment.erp_status = new_status
        session.add(payment)

    plan = await session.get(FeePlan, payment.fee_plan_id) if payment.fee_plan_id else None
    if plan and plan.frappe_sales_invoice_name:
        si_status = await client.get_sales_invoice_status(plan.frappe_sales_invoice_name)
        if si_status and plan.erp_si_status != si_status:
            plan.erp_si_status = si_status
            session.add(plan)

    await session.commit()
    return payment.erp_status


async def refresh_stale_payment_erp_statuses(
    session: AsyncSession,
    institute_id: uuid.UUID,
) -> RefreshSummary:
    """Bulk refresh every pending FeePayment for one institute.

    Called once per Frappe-enabled institute per day by the
    refresh_payment_erp_statuses scheduler job.
    """
    summary = RefreshSummary()
    cfg = await load_active_frappe_config(session, institute_id)
    if cfg is None:
        return summary

    result = await session.execute(
        select(FeePayment).where(
            FeePayment.institute_id == institute_id,
            FeePayment.erp_status == "pending",
            FeePayment.frappe_payment_entry_name.is_not(None),
        )
    )
    pending = result.scalars().all()
    summary.checked = len(pending)
    if not pending:
        return summary

    client = FrappeClient(cfg)

    plans_to_refresh: set[uuid.UUID] = set()

    for payment in pending:
        try:
            r = await client.get_payment_entry_status(payment.frappe_payment_entry_name)
            if not r.ok:
                summary.errors += 1
                continue
            new_status = (r.response or {}).get("erp_status")
            if new_status == "confirmed":
                summary.confirmed += 1
            elif new_status == "cancelled":
                summary.cancelled += 1
            elif new_status == "pending":
                summary.still_pending += 1
            else:
                summary.unknown += 1

            if new_status and new_status != payment.erp_status:
                payment.erp_status = new_status
                session.add(payment)

            if payment.fee_plan_id:
                plans_to_refresh.add(payment.fee_plan_id)
        except Exception:  # noqa: BLE001
            logger.exception(
                "PE refresh crashed for payment %s", payment.id,
            )
            summary.errors += 1

    for plan_id in plans_to_refresh:
        try:
            plan = await session.get(FeePlan, plan_id)
            if plan is None or not plan.frappe_sales_invoice_name:
                continue
            si_status = await client.get_sales_invoice_status(plan.frappe_sales_invoice_name)
            if si_status and plan.erp_si_status != si_status:
                plan.erp_si_status = si_status
                session.add(plan)
                summary.si_status_updated += 1
        except Exception:  # noqa: BLE001
            logger.exception(
                "SI status refresh crashed for plan %s", plan_id,
            )
            summary.errors += 1

    await session.commit()
    return summary
