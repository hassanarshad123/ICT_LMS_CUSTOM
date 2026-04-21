"""Admissions Officer HTTP surface.

Endpoints exposed under ``/api/v1/admissions``. Covers:
  POST /students                                  — onboard a paying student
  GET  /students                                  — roster (own for officers)
  GET  /students/{user_id}                        — student detail + plans
  POST /students/{user_id}/payments               — record a manual payment
  GET  /students/{user_id}/payments               — payment history
  GET  /payments/{payment_id}/receipt.pdf         — branded PDF receipt

Admins see all rows; admissions officers see only their own roster.
"""
from __future__ import annotations

import math
import uuid
from datetime import timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.utils.rate_limit import limiter
from app.middleware.auth import require_roles
from app.models.user import User
from app.models.enums import FeeInstallmentStatus
from app.schemas.common import PaginatedResponse
from app.schemas.fee import (
    AddEnrollmentRequest,
    AdmissionsStudentListItem,
    FeePlanOut,
    InstallmentOut,
    OnboardStudentRequest,
    OnboardStudentResponse,
    PaymentCreate,
    PaymentOut,
    StudentUpdateRequest,
)
from app.services import admissions_service, fee_service
from app.services.admissions_service import AdmissionsError
from app.services.fee_service import FeeError
from app.models.fee import FeePayment
from app.middleware.auth import get_current_user
from sqlmodel import select


router = APIRouter()

AdminOrAO = Annotated[User, Depends(require_roles("admin", "admissions_officer"))]


@router.post("/students", response_model=OnboardStudentResponse, status_code=status.HTTP_201_CREATED)
async def onboard_student_endpoint(
    body: OnboardStudentRequest,
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Create account + enrollment + fee plan + installments in one transaction."""
    try:
        result = await admissions_service.onboard_student(
            session, officer=current_user, payload=body
        )
    except AdmissionsError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return OnboardStudentResponse(**result)


@router.get("/students", response_model=PaginatedResponse[AdmissionsStudentListItem])
async def list_students_endpoint(
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    officer_id: Optional[uuid.UUID] = Query(default=None, description="Admin-only: filter by officer"),
):
    items, total = await admissions_service.list_officer_students(
        session,
        current_user=current_user,
        officer_id=officer_id,
        page=page,
        per_page=per_page,
        search=search,
    )
    return PaginatedResponse(
        data=[AdmissionsStudentListItem(**it) for it in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/students/{user_id}")
async def get_student_detail_endpoint(
    user_id: uuid.UUID,
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        result = await admissions_service.get_student_detail(
            session, current_user=current_user, user_id=user_id
        )
    except AdmissionsError as e:
        raise HTTPException(status_code=404, detail=str(e))

    student = result["student"]
    plans_out = []
    for p in result["plans"]:
        plan = p["plan"]
        batch = p["batch"]
        inst_models = p["installments"]
        plans_out.append(
            dict(
                **FeePlanOut(
                    id=plan.id,
                    student_batch_id=plan.student_batch_id,
                    student_id=plan.student_id,
                    batch_id=plan.batch_id,
                    plan_type=plan.plan_type,
                    total_amount=plan.total_amount,
                    discount_type=plan.discount_type,
                    discount_value=plan.discount_value,
                    final_amount=plan.final_amount,
                    currency=plan.currency,
                    billing_day_of_month=plan.billing_day_of_month,
                    onboarded_by_user_id=plan.onboarded_by_user_id,
                    status=plan.status,
                    notes=plan.notes,
                    created_at=plan.created_at,
                    installments=[
                        InstallmentOut(
                            id=i.id,
                            sequence=i.sequence,
                            amount_due=i.amount_due,
                            amount_paid=i.amount_paid,
                            due_date=i.due_date,
                            status=i.status,
                            label=i.label,
                        )
                        for i in inst_models
                    ],
                    amount_paid=p["amount_paid"],
                    balance_due=p["balance_due"],
                    next_due_date=p["next_due_date"],
                    is_overdue=p["is_overdue"],
                    erp_si_status=plan.erp_si_status,
                    frappe_sales_invoice_name=plan.frappe_sales_invoice_name,
                ).model_dump(),
                batch_name=batch.name,
            )
        )

    return dict(
        user_id=student.id,
        name=student.name,
        email=student.email,
        phone=student.phone,
        status=student.status.value,
        plans=plans_out,
    )


@router.post(
    "/students/{user_id}/payments",
    response_model=PaymentOut,
    status_code=status.HTTP_201_CREATED,
)
async def record_payment_endpoint(
    user_id: uuid.UUID,
    body: PaymentCreate,
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
    fee_plan_id: Optional[uuid.UUID] = Query(
        default=None,
        description="Optional — pick a specific plan when the student has multiple enrollments",
    ),
):
    try:
        student, plans = await fee_service.load_fee_plan_for_student(
            session, actor=current_user, student_id=user_id
        )
        plan = _pick_plan(plans, fee_plan_id)
        payment = await fee_service.record_payment(
            session,
            actor=current_user,
            student=student,
            fee_plan=plan,
            payload=body,
        )
    except FeeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return PaymentOut(**_payment_to_dict(payment))


@router.get("/students/{user_id}/payments", response_model=list[PaymentOut])
async def list_student_payments_endpoint(
    user_id: uuid.UUID,
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        _, plans = await fee_service.load_fee_plan_for_student(
            session, actor=current_user, student_id=user_id
        )
    except FeeError as e:
        raise HTTPException(status_code=404, detail=str(e))

    plan_ids = [p.id for p in plans]
    result = await session.execute(
        select(FeePayment)
        .where(FeePayment.fee_plan_id.in_(plan_ids))
        .order_by(FeePayment.payment_date.desc())
    )
    payments = result.scalars().all()
    return [PaymentOut(**_payment_to_dict(p)) for p in payments]


@router.post("/payments/{payment_id}/refresh-erp-status")
@limiter.limit("30/minute")
async def refresh_payment_erp_status_endpoint(
    request: Request,
    payment_id: uuid.UUID,
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Manually refresh one payment's erp_status from Frappe.

    Admin + admissions_officer can call. Returns the new erp_status +
    the refreshed SI status of the parent plan. Rate-limited to keep
    the AO button from hammering Frappe if clicked repeatedly.
    """
    from app.services import payment_status_service
    from app.models.fee import FeePlan

    if current_user.institute_id is None:
        raise HTTPException(status_code=403, detail="Institute scope required")

    payment = await session.get(FeePayment, payment_id)
    if payment is None or payment.institute_id != current_user.institute_id:
        raise HTTPException(status_code=404, detail="Payment not found")

    fee_plan_id = payment.fee_plan_id
    new_status = await payment_status_service.refresh_payment_erp_status(session, payment_id)

    # Service committed; re-fetch to avoid expire_on_commit stale reads.
    payment = await session.get(FeePayment, payment_id)
    plan = await session.get(FeePlan, fee_plan_id) if fee_plan_id else None

    return {
        "payment_id": str(payment_id),
        "erp_status": new_status,
        "frappe_payment_entry_name": payment.frappe_payment_entry_name if payment else None,
        "erp_si_status": plan.erp_si_status if plan else None,
        "frappe_sales_invoice_name": plan.frappe_sales_invoice_name if plan else None,
    }


def _pick_plan(plans, fee_plan_id):
    if fee_plan_id is not None:
        matched = next((p for p in plans if p.id == fee_plan_id), None)
        if matched is None:
            raise FeeError("Fee plan not found for this student")
        return matched
    active = [p for p in plans if p.status == "active"]
    if len(active) == 1:
        return active[0]
    if len(plans) == 1:
        return plans[0]
    raise FeeError("Student has multiple fee plans — pass fee_plan_id")


@router.get("/admin/stats")
async def admissions_admin_stats_endpoint(
    current_user: Annotated[User, Depends(require_roles("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    date_from: Optional[str] = Query(default=None, description="YYYY-MM-DD inclusive"),
    date_to: Optional[str] = Query(default=None, description="YYYY-MM-DD inclusive"),
):
    """Per-officer performance roll-up for the institute admin dashboard.

    Returns one row per admissions officer in the institute with: students
    onboarded, active vs suspended breakdown, revenue collected, and average
    fee plan size. All filters respect the institute boundary.
    """
    from datetime import datetime as _dt
    from sqlalchemy import func, case, and_
    from app.models.enums import UserRole, UserStatus
    from app.models.fee import FeePayment, FeePlan

    if current_user.institute_id is None:
        raise HTTPException(status_code=403, detail="Admin must belong to an institute")

    # Parse date filters
    def _parse(s: Optional[str]) -> Optional[_dt]:
        if not s:
            return None
        try:
            return _dt.fromisoformat(s)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date '{s}' — expected YYYY-MM-DD")

    dt_from = _parse(date_from)
    dt_to = _parse(date_to)

    # Load all admissions officers in this institute
    officers_q = select(User).where(
        User.institute_id == current_user.institute_id,
        User.role == UserRole.admissions_officer,
        User.deleted_at.is_(None),
    )
    officers = (await session.execute(officers_q)).scalars().all()

    # Aggregate fee plans per officer (optional date filter on created_at)
    plan_filters = [
        FeePlan.institute_id == current_user.institute_id,
        FeePlan.deleted_at.is_(None),
    ]
    if dt_from is not None:
        plan_filters.append(FeePlan.created_at >= dt_from)
    if dt_to is not None:
        # End-of-day on date_to
        plan_filters.append(FeePlan.created_at < dt_to + (timedelta(days=1) if dt_to else timedelta(0)))

    plan_agg_q = (
        select(
            FeePlan.onboarded_by_user_id.label("officer_id"),
            func.count(FeePlan.id).label("plans_total"),
            func.sum(FeePlan.final_amount).label("plans_final_sum"),
            func.sum(
                case((FeePlan.status == "active", 1), else_=0)
            ).label("plans_active"),
        )
        .where(*plan_filters)
        .group_by(FeePlan.onboarded_by_user_id)
    )
    plan_rows = {r.officer_id: r for r in (await session.execute(plan_agg_q)).all()}

    # Aggregate payments per officer via FeePlan.onboarded_by_user_id
    payment_filters = [
        FeePayment.institute_id == current_user.institute_id,
        FeePayment.status != "reversed",
    ]
    if dt_from is not None:
        payment_filters.append(FeePayment.payment_date >= dt_from)
    if dt_to is not None:
        payment_filters.append(FeePayment.payment_date < dt_to + timedelta(days=1))

    revenue_q = (
        select(
            FeePlan.onboarded_by_user_id.label("officer_id"),
            func.coalesce(func.sum(FeePayment.amount), 0).label("revenue"),
            func.count(FeePayment.id).label("payments_total"),
        )
        .select_from(FeePayment)
        .join(FeePlan, FeePlan.id == FeePayment.fee_plan_id)
        .where(*payment_filters)
        .group_by(FeePlan.onboarded_by_user_id)
    )
    revenue_rows = {r.officer_id: r for r in (await session.execute(revenue_q)).all()}

    # Count unique active students per officer (use FeePlan, not user status,
    # because a student with multiple plans counts once if ANY plan is active).
    # Distinct students per officer via existing plan_rows would over-count
    # across multi-plan students; do a dedicated query.
    active_students_q = (
        select(
            FeePlan.onboarded_by_user_id.label("officer_id"),
            func.count(func.distinct(FeePlan.student_id)).label("active_students"),
        )
        .join(User, User.id == FeePlan.student_id)
        .where(
            FeePlan.institute_id == current_user.institute_id,
            FeePlan.deleted_at.is_(None),
            User.deleted_at.is_(None),
            User.status == UserStatus.active,
        )
        .group_by(FeePlan.onboarded_by_user_id)
    )
    active_student_rows = {
        r.officer_id: int(r.active_students)
        for r in (await session.execute(active_students_q)).all()
    }

    out = []
    grand_plans = 0
    grand_revenue = 0
    grand_active = 0
    for officer in officers:
        pr = plan_rows.get(officer.id)
        rr = revenue_rows.get(officer.id)
        active_count = active_student_rows.get(officer.id, 0)

        plans_total = int(pr.plans_total) if pr else 0
        billed = int(pr.plans_final_sum) if pr and pr.plans_final_sum else 0
        revenue = int(rr.revenue) if rr else 0
        avg_fee = int(billed / plans_total) if plans_total else 0

        grand_plans += plans_total
        grand_revenue += revenue
        grand_active += active_count

        out.append({
            "officer_id": str(officer.id),
            "name": officer.name,
            "email": officer.email,
            "employee_id": officer.employee_id,
            "status": officer.status.value,
            "students_onboarded": plans_total,
            "active_students": active_count,
            "revenue_collected": revenue,
            "total_billed": billed,
            "avg_fee": avg_fee,
            "payments_count": int(rr.payments_total) if rr else 0,
        })

    out.sort(key=lambda x: (-x["revenue_collected"], -x["students_onboarded"]))

    return {
        "officers": out,
        "summary": {
            "officers_total": len(officers),
            "plans_total": grand_plans,
            "revenue_total": grand_revenue,
            "active_students_total": grand_active,
        },
        "filters": {
            "date_from": date_from,
            "date_to": date_to,
        },
    }


@router.patch("/students/{user_id}")
async def update_student_endpoint(
    user_id: uuid.UUID,
    body: StudentUpdateRequest,
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        updated = await admissions_service.update_student_profile(
            session,
            officer=current_user,
            student_id=user_id,
            name=body.name,
            email=body.email,
            phone=body.phone,
        )
    except AdmissionsError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "id": updated.id,
        "name": updated.name,
        "email": updated.email,
        "phone": updated.phone,
        "status": updated.status.value,
    }


@router.post("/students/{user_id}/suspend")
async def suspend_student_endpoint(
    user_id: uuid.UUID,
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        updated = await admissions_service.suspend_student(
            session, officer=current_user, student_id=user_id
        )
    except AdmissionsError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": updated.id, "status": updated.status.value}


@router.post("/students/{user_id}/reactivate")
async def reactivate_student_endpoint(
    user_id: uuid.UUID,
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        updated = await admissions_service.reactivate_student(
            session, officer=current_user, student_id=user_id
        )
    except AdmissionsError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": updated.id, "status": updated.status.value}


@router.delete("/students/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student_endpoint(
    user_id: uuid.UUID,
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await admissions_service.soft_delete_student(
            session, officer=current_user, student_id=user_id
        )
    except AdmissionsError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return Response(status_code=204)


@router.post("/students/{user_id}/enrollments", status_code=status.HTTP_201_CREATED)
async def add_enrollment_endpoint(
    user_id: uuid.UUID,
    body: AddEnrollmentRequest,
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        plan = await admissions_service.add_enrollment(
            session,
            officer=current_user,
            student_id=user_id,
            batch_id=body.batch_id,
            fee_plan=body.fee_plan,
            notes=body.notes,
        )
    except AdmissionsError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "fee_plan_id": plan.id,
        "student_batch_id": plan.student_batch_id,
        "batch_id": plan.batch_id,
        "final_amount": plan.final_amount,
        "currency": plan.currency,
    }


@router.delete(
    "/students/{user_id}/enrollments/{student_batch_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_enrollment_endpoint(
    user_id: uuid.UUID,
    student_batch_id: uuid.UUID,
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await admissions_service.remove_enrollment(
            session,
            officer=current_user,
            student_id=user_id,
            student_batch_id=student_batch_id,
        )
    except AdmissionsError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return Response(status_code=204)


@router.get("/me/quota")
async def admissions_quota_endpoint(
    current_user: AdminOrAO,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Institute student-quota for the wizard's step-1 banner.

    Returns ``{max_students, current_students, slots_left}``. Live-counted
    from the users table so the number is always accurate (institute sizes
    are bounded; one extra COUNT per wizard open is fine).
    """
    from sqlalchemy import func as _func

    from app.models.enums import UserRole, UserStatus
    from app.models.institute import Institute

    if current_user.institute_id is None:
        raise HTTPException(status_code=403, detail="User has no institute")

    institute = await session.get(Institute, current_user.institute_id)
    max_students = int(institute.max_students) if institute and institute.max_students else 0

    count_row = await session.execute(
        select(_func.count())
        .select_from(User)
        .where(
            User.institute_id == current_user.institute_id,
            User.role == UserRole.student,
            User.deleted_at.is_(None),
        )
    )
    current_students = int(count_row.scalar_one() or 0)

    return {
        "max_students": max_students,
        "current_students": current_students,
        "slots_left": max(max_students - current_students, 0),
    }


@router.get("/me/has-fees")
async def my_has_fees_endpoint(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Lightweight check: does the current user have at least one active fee plan?

    Used by the student sidebar to decide whether to render the "My Fees" nav
    item. Separate from ``/me/fees`` so the check stays cheap — single EXISTS
    query, no joins, no pagination.
    """
    from app.models.fee import FeePlan

    result = await session.execute(
        select(FeePlan.id)
        .where(
            FeePlan.student_id == current_user.id,
            FeePlan.deleted_at.is_(None),
        )
        .limit(1)
    )
    has_fees = result.first() is not None
    return {"has_fees": has_fees}


@router.get("/me/fees")
async def my_fees_endpoint(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Student-facing fee summary: every active plan + installments + payments."""
    from datetime import date
    from app.models.batch import Batch
    from app.models.fee import FeeInstallment, FeePlan

    plans_result = await session.execute(
        select(FeePlan, Batch)
        .join(Batch, Batch.id == FeePlan.batch_id)
        .where(
            FeePlan.student_id == current_user.id,
            FeePlan.deleted_at.is_(None),
        )
        .order_by(FeePlan.created_at.desc())
    )
    plan_rows = plans_result.all()

    if not plan_rows:
        return {
            "summary": {
                "total_billed": 0,
                "total_paid": 0,
                "balance_due": 0,
                "next_due_date": None,
                "next_due_amount": 0,
                "is_overdue": False,
                "currency": "PKR",
            },
            "plans": [],
        }

    plan_ids = [fp.id for fp, _ in plan_rows]
    inst_result = await session.execute(
        select(FeeInstallment)
        .where(FeeInstallment.fee_plan_id.in_(plan_ids))
        .order_by(FeeInstallment.fee_plan_id, FeeInstallment.sequence)
    )
    installments_by_plan: dict = {}
    for inst in inst_result.scalars().all():
        installments_by_plan.setdefault(inst.fee_plan_id, []).append(inst)

    payments_result = await session.execute(
        select(FeePayment)
        .where(FeePayment.fee_plan_id.in_(plan_ids))
        .order_by(FeePayment.payment_date.desc())
    )
    payments_by_plan: dict = {}
    for pay in payments_result.scalars().all():
        payments_by_plan.setdefault(pay.fee_plan_id, []).append(pay)

    today = date.today()
    plans_out = []
    grand_billed = 0
    grand_paid = 0
    earliest_due = None
    earliest_due_amount = 0
    any_overdue = False
    currency = "PKR"

    for fee_plan, batch in plan_rows:
        installments = installments_by_plan.get(fee_plan.id, [])
        amount_paid = sum(i.amount_paid for i in installments)
        balance_due = max(int(fee_plan.final_amount) - int(amount_paid), 0)
        plan_overdue = any(
            i.due_date < today and i.amount_paid < i.amount_due for i in installments
        )
        if plan_overdue:
            any_overdue = True

        next_inst = next(
            (
                i for i in sorted(installments, key=lambda x: x.due_date)
                if i.amount_paid < i.amount_due
            ),
            None,
        )
        next_due = next_inst.due_date if next_inst else None
        next_amount = (next_inst.amount_due - next_inst.amount_paid) if next_inst else 0

        if next_due is not None and (earliest_due is None or next_due < earliest_due):
            earliest_due = next_due
            earliest_due_amount = next_amount

        grand_billed += int(fee_plan.final_amount)
        grand_paid += int(amount_paid)
        currency = fee_plan.currency or currency

        plans_out.append(
            dict(
                fee_plan_id=fee_plan.id,
                batch_id=fee_plan.batch_id,
                batch_name=batch.name,
                plan_type=fee_plan.plan_type,
                status=fee_plan.status,
                total_amount=fee_plan.total_amount,
                discount_type=fee_plan.discount_type,
                discount_value=fee_plan.discount_value,
                final_amount=fee_plan.final_amount,
                currency=fee_plan.currency,
                amount_paid=amount_paid,
                balance_due=balance_due,
                is_overdue=plan_overdue,
                next_due_date=next_due,
                next_due_amount=next_amount,
                created_at=fee_plan.created_at,
                installments=[
                    dict(
                        id=i.id,
                        sequence=i.sequence,
                        amount_due=i.amount_due,
                        amount_paid=i.amount_paid,
                        due_date=i.due_date,
                        status=i.status,
                        label=i.label,
                    )
                    for i in installments
                ],
                payments=[
                    dict(
                        id=p.id,
                        amount=p.amount,
                        payment_date=p.payment_date,
                        payment_method=p.payment_method,
                        reference_number=p.reference_number,
                        receipt_number=p.receipt_number,
                        notes=p.notes,
                        fee_installment_id=p.fee_installment_id,
                    )
                    for p in payments_by_plan.get(fee_plan.id, [])
                ],
            )
        )

    return {
        "summary": {
            "total_billed": grand_billed,
            "total_paid": grand_paid,
            "balance_due": max(grand_billed - grand_paid, 0),
            "next_due_date": earliest_due,
            "next_due_amount": earliest_due_amount,
            "is_overdue": any_overdue,
            "currency": currency,
        },
        "plans": plans_out,
    }


@router.get("/payments/{payment_id}/receipt.pdf")
async def download_receipt_pdf(
    payment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Stream a one-page branded receipt PDF.

    Access allowed for the admissions officer who recorded the payment, any
    admin in the institute, or the student who owns the underlying plan.
    """
    from app.utils.email_sender import get_institute_branding
    from app.utils.receipt_pdf import ReceiptDesign, generate_receipt_pdf

    try:
        payment = await fee_service.load_payment_for_actor(
            session, actor=current_user, payment_id=payment_id
        )
    except FeeError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if current_user.institute_id is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    branding = await get_institute_branding(session, current_user.institute_id)
    design = ReceiptDesign(
        accent_color=branding.get("accent_color", "#C5D86D"),
        company_name=branding.get("name") or "",
        company_email="",
        company_phone="",
        company_address="",
        company_logo=branding.get("logo_url") or None,
    )

    content = await fee_service.build_receipt_content(
        session, payment=payment
    )

    pdf_bytes = generate_receipt_pdf(design, content)

    filename = f"{content.receipt_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "private, no-store",
        },
    )


def _payment_to_dict(p: FeePayment) -> dict:
    return dict(
        id=p.id,
        fee_plan_id=p.fee_plan_id,
        fee_installment_id=p.fee_installment_id,
        amount=p.amount,
        payment_date=p.payment_date,
        payment_method=p.payment_method,
        status=p.status,
        reference_number=p.reference_number,
        receipt_number=p.receipt_number,
        recorded_by_user_id=p.recorded_by_user_id,
        notes=p.notes,
        created_at=p.created_at,
        erp_status=p.erp_status,
        frappe_payment_entry_name=p.frappe_payment_entry_name,
    )
