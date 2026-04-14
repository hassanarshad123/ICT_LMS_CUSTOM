"""Seed demo data for the Admissions Officer portal.

Creates (within the first active institute it can find):
  - 1 admissions officer:  officer@demo.local / Officer!234
  - 1 batch:               "Admissions Demo Batch" (60 days)
  - 3 students, one per fee-plan type (one-time, monthly, installment)
  - One recorded payment on each plan

Safe to run multiple times — emails include a timestamp suffix so each run
creates fresh rows (we do not try to reuse existing ones).

Usage (from backend/):
    venv/Scripts/python.exe scripts/seed_admissions_demo.py
"""
from __future__ import annotations

import asyncio
import logging
import random
import string
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("seed_admissions_demo")


async def main() -> None:
    from sqlmodel import select

    from app.database import async_session
    from app.models.batch import Batch
    from app.models.institute import Institute, InstituteStatus
    from app.models.user import User
    from app.models.enums import UserRole, UserStatus
    from app.services.admissions_service import onboard_student
    from app.services.fee_service import record_payment
    from app.services.user_service import create_user
    from app.schemas.fee import (
        FeePlanCreate,
        InstallmentDraft,
        OnboardStudentRequest,
        PaymentCreate,
    )

    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))

    async with async_session() as session:
        # Pick the first active institute
        inst_row = await session.execute(
            select(Institute).where(
                Institute.status == InstituteStatus.active,
                Institute.deleted_at.is_(None),
            ).order_by(Institute.created_at).limit(1)
        )
        institute = inst_row.scalar_one_or_none()
        if not institute:
            log.error("No active institute found — run seed_ict_data.py first")
            return
        log.info("Using institute: %s (%s)", institute.name, institute.slug)

        # 1. Create the officer
        officer_email = f"officer+{suffix}@demo.local"
        officer = await create_user(
            session,
            email=officer_email,
            name="Demo Officer",
            password="Officer!234",
            role=UserRole.admissions_officer.value,
            phone="0300-0000000",
            institute_id=institute.id,
        )
        log.info("Created officer: %s / Officer!234", officer.email)

        # 2. Create a demo batch
        today = date.today()
        batch = Batch(
            name=f"Admissions Demo Batch ({suffix})",
            teacher_id=None,
            start_date=today,
            end_date=today + timedelta(days=60),
            institute_id=institute.id,
        )
        session.add(batch)
        await session.commit()
        await session.refresh(batch)
        log.info("Created batch: %s", batch.name)

        # 3. Onboard 3 students — one per fee-plan type
        plans_configs = [
            {
                "name": "Demo Student OneTime",
                "email": f"onetime+{suffix}@demo.local",
                "fee_plan": FeePlanCreate(
                    plan_type="one_time",
                    total_amount=15000,
                    discount_type=None,
                    discount_value=None,
                    first_due_date=today,
                ),
            },
            {
                "name": "Demo Student Monthly",
                "email": f"monthly+{suffix}@demo.local",
                "fee_plan": FeePlanCreate(
                    plan_type="monthly",
                    total_amount=18000,
                    discount_type="percent",
                    discount_value=10,
                    monthly_installments=3,
                    first_due_date=today,
                ),
            },
            {
                "name": "Demo Student Installment",
                "email": f"installment+{suffix}@demo.local",
                "fee_plan": FeePlanCreate(
                    plan_type="installment",
                    total_amount=24000,
                    discount_type="flat",
                    discount_value=2000,
                    installments=[
                        InstallmentDraft(sequence=1, amount_due=10000, due_date=today, label="Down payment"),
                        InstallmentDraft(sequence=2, amount_due=6000, due_date=today + timedelta(days=30), label="Installment 2"),
                        InstallmentDraft(sequence=3, amount_due=6000, due_date=today + timedelta(days=60), label="Installment 3"),
                    ],
                ),
            },
        ]

        results = []
        for cfg in plans_configs:
            payload = OnboardStudentRequest(
                name=cfg["name"],
                email=cfg["email"],
                phone="0301-1234567",
                batch_id=batch.id,
                fee_plan=cfg["fee_plan"],
                notes="Demo seeded by seed_admissions_demo.py",
            )
            res = await onboard_student(session, officer=officer, payload=payload)
            results.append((cfg["name"], res))
            log.info(
                "Onboarded %s → user=%s fee_plan=%s installments=%d temp_pw=%s",
                cfg["name"], res["user_id"], res["fee_plan_id"],
                res["installment_count"], res["temporary_password"],
            )

        # 4. Record one payment on each plan (the first installment)
        from app.models.fee import FeeInstallment, FeePlan

        for name, res in results:
            plan = await session.get(FeePlan, res["fee_plan_id"])
            first_inst = (await session.execute(
                select(FeeInstallment)
                .where(FeeInstallment.fee_plan_id == plan.id)
                .order_by(FeeInstallment.sequence.asc())
                .limit(1)
            )).scalar_one()

            student = await session.get(User, res["user_id"])
            amount = min(first_inst.amount_due, 5000)
            payment = await record_payment(
                session,
                actor=officer,
                student=student,
                fee_plan=plan,
                payload=PaymentCreate(
                    fee_installment_id=first_inst.id,
                    amount=amount,
                    payment_date=datetime.now(timezone.utc),
                    payment_method="cash",
                    reference_number=f"DEMO-{suffix.upper()}",
                    notes=f"Demo seed payment for {name}",
                ),
            )
            log.info("  ↳ payment %s PKR %d receipt=%s", name, amount, payment.receipt_number)

    log.info("")
    log.info("Done. Log in at /login with: %s / Officer!234", officer_email)
    log.info("Students (default password from institute settings):")
    for cfg in plans_configs:
        log.info("  - %s", cfg["email"])


if __name__ == "__main__":
    asyncio.run(main())
