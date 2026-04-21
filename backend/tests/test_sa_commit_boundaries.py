"""Phase 3 regression tests for router↔service commit boundary.

Invariant: SA billing services MUST NOT commit the session internally
— they flush only, and the router commits after writing its audit
log. This keeps the audit log entry atomic with the domain mutation:
if log_sa_action fails, the service change rolls back too.

Also exercises the overpayment guard in record_payment.
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


# ──────────────────────────────────────────────────────────────────
# Fake session that tracks commit/flush calls
# ──────────────────────────────────────────────────────────────────

@dataclass
class _Tracker:
    commits: int = 0
    flushes: int = 0
    added: list = field(default_factory=list)


class _FakeSession:
    """Enough AsyncSession surface to exercise the commit-boundary
    contract in SA billing services."""

    def __init__(self, *, inst, billing=None, invoice=None, prior_payments_sum=0):
        self.tracker = _Tracker()
        self._inst = inst
        self._billing = billing
        self._invoice = invoice
        self._prior_payments_sum = prior_payments_sum

    def add(self, obj) -> None:
        self.tracker.added.append(obj)

    async def flush(self) -> None:
        self.tracker.flushes += 1

    async def commit(self) -> None:
        self.tracker.commits += 1

    async def refresh(self, obj) -> None:
        return None

    async def get(self, model, pk):
        name = getattr(model, "__name__", str(model))
        if name == "Institute":
            return self._inst
        if name == "InstituteBilling":
            return self._billing
        if name == "Invoice":
            return self._invoice
        return None

    async def execute(self, stmt, params=None):
        # Return a result whose scalar_one_or_none / scalar_one /
        # one_or_none / one cover the paths used by the services
        # under test. We return the invoice for SELECT ... FOR UPDATE
        # on Invoice, and the prior-payment sum for the COALESCE/SUM
        # query.
        class _Row(tuple):
            pass

        class _Result:
            def __init__(_self, invoice, prior_sum):
                _self._invoice = invoice
                _self._prior_sum = prior_sum

            def scalar_one_or_none(_self):
                return _self._invoice

            def scalar_one(_self):
                return _self._prior_sum

            def one(_self):
                return _Row((_self._prior_sum,))

            def one_or_none(_self):
                return _Row((0, 0, 0))

            def all(_self):
                return []

        return _Result(self._invoice, self._prior_payments_sum)


@dataclass
class _FakeInstitute:
    id: uuid.UUID = uuid.UUID("00000000-0000-0000-0000-000000000001")
    plan_tier: Any = None
    deleted_at: Any = None
    name: str = "Fake Inst"
    contact_email: str = "x@y.z"
    max_users: int | None = 100
    max_students: int | None = 50
    max_storage_gb: float | None = 10.0
    max_video_gb: float | None = 50.0


@dataclass
class _FakeBilling:
    base_amount: int = 5000
    currency: str = "PKR"
    billing_cycle: str = "monthly"
    extra_user_rate: int = 80
    extra_storage_rate: int = 100
    extra_video_rate: int = 50
    notes: str | None = None
    updated_at: Any = None
    institute_id: uuid.UUID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@dataclass
class _FakeInvoice:
    id: uuid.UUID = uuid.UUID("00000000-0000-0000-0000-000000000042")
    institute_id: uuid.UUID = uuid.UUID("00000000-0000-0000-0000-000000000001")
    total_amount: int = 10_000
    status: str = "sent"
    updated_at: Any = None


# ──────────────────────────────────────────────────────────────────
# update_billing_config: flushes, does not commit
# ──────────────────────────────────────────────────────────────────

def test_update_billing_config_flushes_but_does_not_commit():
    from app.services import sa_billing_service as svc

    inst = _FakeInstitute()
    billing = _FakeBilling()
    session = _FakeSession(inst=inst, billing=billing)

    # Patch get_or_create_billing to avoid its DB path.
    original = svc.get_or_create_billing

    async def _fake(session, institute_id):
        return billing

    svc.get_or_create_billing = _fake
    try:
        result = asyncio.run(
            svc.update_billing_config(
                session, inst.id, {"base_amount": 7500, "notes": "new"}
            )
        )
    finally:
        svc.get_or_create_billing = original

    assert result["base_amount"] == 7500
    assert result["notes"] == "new"
    assert session.tracker.flushes >= 1
    assert session.tracker.commits == 0, (
        "Service must not commit — router owns the commit so audit log "
        "can be atomic with the billing change."
    )


def test_update_billing_config_raises_on_missing_institute():
    from app.services import sa_billing_service as svc

    session = _FakeSession(inst=None)

    try:
        asyncio.run(svc.update_billing_config(session, uuid.uuid4(), {}))
    except ValueError as e:
        assert "not found" in str(e).lower()
        return
    raise AssertionError("Expected ValueError for missing institute")


# ──────────────────────────────────────────────────────────────────
# record_payment: flush only + overpayment guard
# ──────────────────────────────────────────────────────────────────

def test_record_payment_rejects_overpayment_on_locked_invoice():
    """Concurrent payments against the same invoice cannot overpay:
    the service sums prior payments within the FOR UPDATE lock and
    rejects with ValueError if the new amount would exceed total."""
    from datetime import datetime, timezone
    from app.services import sa_billing_service as svc

    inst = _FakeInstitute()
    invoice = _FakeInvoice(total_amount=10_000)
    # Simulate: Rs 7000 already paid on this Rs 10000 invoice.
    session = _FakeSession(
        inst=inst, invoice=invoice, prior_payments_sum=7_000,
    )

    try:
        asyncio.run(
            svc.record_payment(
                session=session,
                institute_id=inst.id,
                amount=5_000,  # would total Rs 12000 > 10000
                payment_date=datetime.now(timezone.utc),
                payment_method="bank_transfer",
                recorded_by=uuid.uuid4(),
                invoice_id=invoice.id,
            )
        )
    except ValueError as e:
        assert "overpay" in str(e).lower()
        assert session.tracker.commits == 0
        return
    raise AssertionError("Expected ValueError for overpayment")


def test_record_payment_marks_invoice_paid_and_flushes_only():
    from datetime import datetime, timezone
    from app.services import sa_billing_service as svc

    inst = _FakeInstitute()
    invoice = _FakeInvoice(total_amount=10_000, status="sent")
    session = _FakeSession(
        inst=inst, invoice=invoice, prior_payments_sum=0,
    )

    payment = asyncio.run(
        svc.record_payment(
            session=session,
            institute_id=inst.id,
            amount=10_000,
            payment_date=datetime.now(timezone.utc),
            payment_method="bank_transfer",
            recorded_by=uuid.uuid4(),
            invoice_id=invoice.id,
        )
    )

    assert payment is not None
    assert invoice.status == "paid"
    assert session.tracker.flushes >= 1
    assert session.tracker.commits == 0


def test_record_payment_rejects_wrong_institute_on_invoice():
    from datetime import datetime, timezone
    from app.services import sa_billing_service as svc

    inst = _FakeInstitute()
    # Invoice belongs to a different institute
    invoice = _FakeInvoice(
        institute_id=uuid.UUID("00000000-0000-0000-0000-0000000000ff"),
    )
    session = _FakeSession(inst=inst, invoice=invoice, prior_payments_sum=0)

    try:
        asyncio.run(
            svc.record_payment(
                session=session,
                institute_id=inst.id,
                amount=1_000,
                payment_date=datetime.now(timezone.utc),
                payment_method="bank_transfer",
                recorded_by=uuid.uuid4(),
                invoice_id=invoice.id,
            )
        )
    except ValueError as e:
        assert "different institute" in str(e).lower()
        return
    raise AssertionError("Expected ValueError for institute mismatch")
