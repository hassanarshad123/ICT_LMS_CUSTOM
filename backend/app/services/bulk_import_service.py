"""Bulk CSV import for students, fee plans, and payments (Phase 6).

Designed for institutes onboarding from Frappe/ERPNext, Excel, or any other
source. Rows are processed one at a time so a single bad row doesn't abort
the job — errors are recorded per-row and the job completes with a summary.

Row schemas mirror the existing ``admin.py`` CSV *export* column names so an
institute can round-trip their data.
"""
from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.batch import Batch
from app.models.fee import FeePlan, FeeInstallment
from app.models.enums import FeePlanStatus, FeeInstallmentStatus, UserRole
from app.models.integration import BulkImportJob
from app.models.user import User
from app.schemas.fee import FeePlanCreate, InstallmentDraft, OnboardStudentRequest, PaymentCreate

logger = logging.getLogger("ict_lms.bulk_import")

MAX_ROWS_PER_IMPORT = 5000
MAX_ERRORS_STORED = 500


class BulkImportError(ValueError):
    """Surface validation — router maps to 400."""


# ── Job lifecycle ──────────────────────────────────────────────────

async def create_job(
    session: AsyncSession,
    *,
    institute_id: uuid.UUID,
    created_by: uuid.UUID,
    entity_type: str,
    csv_bytes: bytes,
) -> BulkImportJob:
    if entity_type not in ("students", "fee_plans", "payments"):
        raise BulkImportError(f"Unsupported entity: {entity_type}")
    if len(csv_bytes) > 10 * 1024 * 1024:  # 10 MB
        raise BulkImportError("CSV exceeds 10 MB limit")

    # Count rows up-front for the progress UI
    try:
        text = csv_bytes.decode("utf-8-sig")  # tolerate BOM from Excel
    except UnicodeDecodeError:
        raise BulkImportError("CSV must be UTF-8 encoded")
    total_rows = max(sum(1 for _ in csv.reader(io.StringIO(text))) - 1, 0)
    if total_rows > MAX_ROWS_PER_IMPORT:
        raise BulkImportError(f"Import exceeds max {MAX_ROWS_PER_IMPORT} rows")

    job = BulkImportJob(
        institute_id=institute_id,
        created_by=created_by,
        entity_type=entity_type,
        status="pending",
        total_rows=total_rows,
    )
    session.add(job)
    await session.flush()

    # Store the CSV bytes in-memory on the job by piggybacking the errors
    # column isn't appropriate; instead process inline in the request handler
    # via ``run_job`` after commit. The caller (router) does this.
    await session.commit()
    await session.refresh(job)
    return job


async def run_job(
    session: AsyncSession, *, job_id: uuid.UUID, csv_bytes: bytes,
) -> BulkImportJob:
    """Process the CSV synchronously. Called by the router after the file
    is uploaded — fits within a normal HTTP request for the 5k row cap.

    For larger imports we'd queue via APScheduler instead; out of scope for
    v1.
    """
    job = await session.get(BulkImportJob, job_id)
    if job is None:
        raise BulkImportError("Job not found")
    if job.status != "pending":
        raise BulkImportError("Job already started")

    job.status = "running"
    job.started_at = datetime.now(timezone.utc)
    session.add(job)
    await session.commit()

    try:
        text = csv_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        job.status = "failed"
        job.errors = [{"row": 0, "error": "CSV is not UTF-8"}]
        job.completed_at = datetime.now(timezone.utc)
        session.add(job)
        await session.commit()
        return job

    errors: list[dict] = []
    ok = 0
    fail = 0

    dispatcher = {
        "students": _import_student_row,
        "fee_plans": _import_fee_plan_row,
        "payments": _import_payment_row,
    }[job.entity_type]

    reader = csv.DictReader(io.StringIO(text))
    for idx, row in enumerate(reader, start=2):  # row 1 is header
        try:
            await dispatcher(session, job.institute_id, row, job.created_by)
            await session.commit()
            ok += 1
        except Exception as e:  # noqa: BLE001
            await session.rollback()
            fail += 1
            if len(errors) < MAX_ERRORS_STORED:
                errors.append({"row": idx, "error": f"{type(e).__name__}: {e}"[:500]})

        # Persist progress every 50 rows so the UI can poll
        if (ok + fail) % 50 == 0:
            job.processed_rows = ok + fail
            job.success_rows = ok
            job.failed_rows = fail
            session.add(job)
            await session.commit()

    job.processed_rows = ok + fail
    job.success_rows = ok
    job.failed_rows = fail
    job.errors = errors or None
    # Status is always "completed" — per-row failures live in job.errors and
    # the UI surfaces a "Partial" badge when failed_rows > 0. A job-level
    # "failed" status is reserved for full-job aborts (e.g. bad encoding).
    job.status = "completed"
    job.completed_at = datetime.now(timezone.utc)
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job


# ── Row handlers (each commit independently) ───────────────────────

async def _import_student_row(
    session: AsyncSession,
    institute_id: uuid.UUID,
    row: dict,
    actor_id: uuid.UUID,
) -> None:
    """Columns: name, email, phone. Optional: batch_name (if set, also enrolls
    the student using institute defaults without creating a fee plan).
    """
    name = (row.get("name") or "").strip()
    email = (row.get("email") or "").strip().lower()
    phone = (row.get("phone") or "").strip() or None
    batch_name = (row.get("batch_name") or "").strip() or None

    # Optional per-student access window columns
    _access_days_raw = (row.get("access_days") or "").strip()
    _access_end_date_raw = (row.get("access_end_date") or "").strip()
    access_days: Optional[int] = None
    access_end_date = None
    if _access_days_raw:
        try:
            access_days = int(_access_days_raw)
        except ValueError:
            raise BulkImportError("access_days must be an integer")
    if _access_end_date_raw:
        try:
            access_end_date = date.fromisoformat(_access_end_date_raw)
        except ValueError:
            raise BulkImportError("access_end_date must be YYYY-MM-DD")
    if access_days is not None and access_end_date is not None:
        raise BulkImportError("Provide either access_days or access_end_date, not both.")

    if not name or not email:
        raise BulkImportError("name and email are required")

    # Duplicate email check within institute
    dupe = await session.execute(
        select(User.id).where(
            User.institute_id == institute_id,
            User.email == email,
            User.deleted_at.is_(None),
        )
    )
    if dupe.scalar_one_or_none():
        raise BulkImportError(f"Duplicate email for institute: {email}")

    # Use the institute default password so the student can log in + reset
    from app.routers.users import _get_default_student_password
    from app.services.user_service import create_user
    from app.services.institute_service import check_and_increment_student_quota

    await check_and_increment_student_quota(session, institute_id)

    temp_password = await _get_default_student_password(session, institute_id)
    student = await create_user(
        session,
        email=email,
        name=name,
        password=temp_password,
        role=UserRole.student.value,
        phone=phone,
        specialization=None,
        institute_id=institute_id,
    )

    if batch_name:
        batch = (await session.execute(
            select(Batch).where(
                Batch.institute_id == institute_id,
                Batch.name == batch_name,
                Batch.deleted_at.is_(None),
            )
        )).scalar_one_or_none()
        if batch is None:
            raise BulkImportError(f"Batch not found: {batch_name}")

        from app.services.batch_service import enroll_student
        try:
            await enroll_student(
                session,
                batch_id=batch.id,
                student_id=student.id,
                enrolled_by=actor_id,
                institute_id=institute_id,
                access_days=access_days,
                access_end_date=access_end_date,
            )
        except ValueError as exc:
            raise BulkImportError(str(exc)) from exc


async def _import_fee_plan_row(
    session: AsyncSession,
    institute_id: uuid.UUID,
    row: dict,
    actor_id: uuid.UUID,
) -> None:
    """Columns: student_email, batch_name, plan_type (one_time|monthly|installment),
    total_amount, currency (optional), discount_type (optional), discount_value (optional).
    """
    email = (row.get("student_email") or "").strip().lower()
    batch_name = (row.get("batch_name") or "").strip()
    plan_type = (row.get("plan_type") or "").strip()
    total_amount_raw = (row.get("total_amount") or "0").strip()
    currency = (row.get("currency") or "PKR").strip() or "PKR"

    if not (email and batch_name and plan_type):
        raise BulkImportError("student_email, batch_name, plan_type are required")
    try:
        total_amount = int(total_amount_raw)
    except ValueError:
        raise BulkImportError("total_amount must be an integer")

    student = (await session.execute(
        select(User).where(
            User.institute_id == institute_id,
            User.email == email,
            User.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if student is None:
        raise BulkImportError(f"Student not found: {email}")

    batch = (await session.execute(
        select(Batch).where(
            Batch.institute_id == institute_id,
            Batch.name == batch_name,
            Batch.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if batch is None:
        raise BulkImportError(f"Batch not found: {batch_name}")

    from app.models.batch import StudentBatch

    # Ensure an enrollment exists
    sb = (await session.execute(
        select(StudentBatch).where(
            StudentBatch.student_id == student.id,
            StudentBatch.batch_id == batch.id,
            StudentBatch.removed_at.is_(None),
        )
    )).scalar_one_or_none()
    if sb is None:
        sb = StudentBatch(
            student_id=student.id,
            batch_id=batch.id,
            institute_id=institute_id,
            is_active=True,
        )
        session.add(sb)
        await session.flush()

    # Plan (without installments yet — plan_type=one_time gets a single inst)
    plan = FeePlan(
        student_batch_id=sb.id,
        student_id=student.id,
        batch_id=batch.id,
        institute_id=institute_id,
        plan_type=plan_type,
        total_amount=total_amount,
        final_amount=total_amount,
        currency=currency,
        onboarded_by_user_id=actor_id,
        status=FeePlanStatus.active.value,
    )
    session.add(plan)
    await session.flush()

    installment = FeeInstallment(
        fee_plan_id=plan.id,
        sequence=1,
        amount_due=total_amount,
        amount_paid=0,
        due_date=date.today(),
        status=FeeInstallmentStatus.pending.value,
        label="Total fee",
    )
    session.add(installment)


async def _import_payment_row(
    session: AsyncSession,
    institute_id: uuid.UUID,
    row: dict,
    actor_id: uuid.UUID,
) -> None:
    """Columns: student_email, batch_name, amount, payment_date (YYYY-MM-DD),
    payment_method (optional), reference_number (optional).
    """
    email = (row.get("student_email") or "").strip().lower()
    batch_name = (row.get("batch_name") or "").strip()
    amount_raw = (row.get("amount") or "0").strip()
    payment_date_raw = (row.get("payment_date") or "").strip()
    method = (row.get("payment_method") or "bank_transfer").strip() or "bank_transfer"
    ref = (row.get("reference_number") or "").strip() or None

    if not (email and batch_name):
        raise BulkImportError("student_email and batch_name are required")
    try:
        amount = int(amount_raw)
    except ValueError:
        raise BulkImportError("amount must be an integer")
    try:
        posting_date = date.fromisoformat(payment_date_raw) if payment_date_raw else date.today()
    except ValueError:
        raise BulkImportError(f"payment_date must be YYYY-MM-DD (got {payment_date_raw!r})")

    # Resolve student + plan
    student = (await session.execute(
        select(User).where(
            User.institute_id == institute_id,
            User.email == email,
            User.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if student is None:
        raise BulkImportError(f"Student not found: {email}")

    plan = (await session.execute(
        select(FeePlan).join(Batch, Batch.id == FeePlan.batch_id).where(
            FeePlan.institute_id == institute_id,
            FeePlan.student_id == student.id,
            Batch.name == batch_name,
            FeePlan.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if plan is None:
        raise BulkImportError(f"Fee plan not found for {email} in {batch_name}")

    from app.services import fee_service

    actor = await session.get(User, actor_id) or student
    payload = PaymentCreate(
        fee_installment_id=None,  # auto-pick next unpaid
        amount=amount,
        payment_date=posting_date,
        payment_method=method,
        reference_number=ref,
        notes="Bulk import",
    )
    await fee_service.record_payment(
        session, actor=actor, student=student, fee_plan=plan, payload=payload,
    )


# ── CSV templates (returned to the frontend for download) ──────────

TEMPLATES = {
    "students": "name,email,phone,batch_name,access_days,access_end_date\n",
    "fee_plans": "student_email,batch_name,plan_type,total_amount,currency\n",
    "payments": "student_email,batch_name,amount,payment_date,payment_method,reference_number\n",
}
