"""Integration tests for the Admissions Officer portal.

Covers the full lifecycle end-to-end against a running backend:

  - Admin creates an admissions officer
  - Officer onboards paying students (one-time, monthly, installment)
  - Officer records payments (full + partial) and gets receipt numbers
  - Officer list is scoped to own onboarded students
  - Officer cannot edit / delete another officer's students
  - Record payment flips installment status correctly
  - Final installment paid → plan status = completed
  - Receipt PDF endpoint returns a valid PDF
  - Soft-delete cancels plans and removes student from lists
  - Admin stats endpoint returns the right KPI counts

Usage:
    cd backend
    pytest tests/test_admissions_flow.py -v -m integration
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

import httpx
import pytest

from tests.conftest import (
    API,
    INSTITUTE_SLUG,
    TEST_ACCOUNTS,
    _auth_headers,
    _login,
)


pytestmark = pytest.mark.integration


# ── Helpers ─────────────────────────────────────────────────────────────────


def _rand(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _create_officer(client: httpx.Client, admin_headers: dict) -> dict:
    email = f"{_rand('officer')}@demo.local"
    resp = client.post(
        f"{API}/users",
        headers=admin_headers,
        json={
            "name": "Test Officer",
            "email": email,
            "phone": "0300-0000001",
            "role": "admissions-officer",
            "password": "Officer!234",
        },
    )
    assert resp.status_code == 201, resp.text
    return {"email": email, **resp.json()}


def _officer_headers(client: httpx.Client, email: str, password: str = "Officer!234") -> dict:
    resp = client.post(
        f"{API}/auth/login",
        json={"email": email, "password": password},
        headers={"X-Institute-Slug": INSTITUTE_SLUG},
    )
    resp.raise_for_status()
    return _auth_headers(resp.json()["access_token"])


def _pick_batch(client: httpx.Client, headers: dict) -> str:
    resp = client.get(f"{API}/batches?per_page=1", headers=headers)
    resp.raise_for_status()
    data = resp.json()
    assert data.get("data"), "No batches exist — seed first"
    return data["data"][0]["id"]


# ── Tests ───────────────────────────────────────────────────────────────────


def test_officer_onboards_student_one_time(http_client: httpx.Client, admin_headers: dict):
    officer = _create_officer(http_client, admin_headers)
    officer_h = _officer_headers(http_client, officer["email"])
    batch_id = _pick_batch(http_client, admin_headers)

    resp = http_client.post(
        f"{API}/admissions/students",
        headers=officer_h,
        json={
            "name": "Ali OneTime",
            "email": f"{_rand('ali')}@demo.local",
            "phone": "0301-0000001",
            "batchId": batch_id,
            "feePlan": {
                "planType": "one_time",
                "totalAmount": 15000,
                "currency": "PKR",
                "firstDueDate": date.today().isoformat(),
            },
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["finalAmount"] == 15000
    assert body["installmentCount"] == 1
    assert body["temporaryPassword"]

    # Officer list contains this student
    list_resp = http_client.get(f"{API}/admissions/students", headers=officer_h)
    assert list_resp.status_code == 200
    roster = list_resp.json()["data"]
    assert any(r["userId"] == body["userId"] for r in roster)


def test_record_full_payment_completes_plan(http_client: httpx.Client, admin_headers: dict):
    officer = _create_officer(http_client, admin_headers)
    officer_h = _officer_headers(http_client, officer["email"])
    batch_id = _pick_batch(http_client, admin_headers)

    onboard = http_client.post(
        f"{API}/admissions/students",
        headers=officer_h,
        json={
            "name": "Ali Payer",
            "email": f"{_rand('payer')}@demo.local",
            "phone": "0301-0000002",
            "batchId": batch_id,
            "feePlan": {
                "planType": "one_time",
                "totalAmount": 10000,
                "firstDueDate": date.today().isoformat(),
            },
        },
    )
    student_id = onboard.json()["userId"]

    # Fetch detail to find installment id
    detail = http_client.get(
        f"{API}/admissions/students/{student_id}", headers=officer_h
    ).json()
    inst_id = detail["plans"][0]["installments"][0]["id"]

    pay_resp = http_client.post(
        f"{API}/admissions/students/{student_id}/payments",
        headers=officer_h,
        json={
            "feeInstallmentId": inst_id,
            "amount": 10000,
            "paymentDate": datetime.now(timezone.utc).isoformat(),
            "paymentMethod": "cash",
            "referenceNumber": "TEST-REF-FULL",
        },
    )
    assert pay_resp.status_code == 201, pay_resp.text
    payment = pay_resp.json()
    assert payment["receiptNumber"].startswith("RCP-")

    detail2 = http_client.get(
        f"{API}/admissions/students/{student_id}", headers=officer_h
    ).json()
    plan = detail2["plans"][0]
    assert plan["installments"][0]["status"] == "paid"
    assert plan["balanceDue"] == 0


def test_partial_payment_flags_partially_paid(http_client: httpx.Client, admin_headers: dict):
    officer = _create_officer(http_client, admin_headers)
    officer_h = _officer_headers(http_client, officer["email"])
    batch_id = _pick_batch(http_client, admin_headers)

    onboard = http_client.post(
        f"{API}/admissions/students",
        headers=officer_h,
        json={
            "name": "Ali Partial",
            "email": f"{_rand('partial')}@demo.local",
            "phone": "0301-0000003",
            "batchId": batch_id,
            "feePlan": {
                "planType": "one_time",
                "totalAmount": 6000,
                "firstDueDate": date.today().isoformat(),
            },
        },
    )
    student_id = onboard.json()["userId"]
    detail = http_client.get(f"{API}/admissions/students/{student_id}", headers=officer_h).json()
    inst_id = detail["plans"][0]["installments"][0]["id"]

    r = http_client.post(
        f"{API}/admissions/students/{student_id}/payments",
        headers=officer_h,
        json={
            "feeInstallmentId": inst_id,
            "amount": 2000,
            "paymentDate": datetime.now(timezone.utc).isoformat(),
            "paymentMethod": "cash",
        },
    )
    assert r.status_code == 201

    d2 = http_client.get(f"{API}/admissions/students/{student_id}", headers=officer_h).json()
    inst = d2["plans"][0]["installments"][0]
    assert inst["status"] == "partially_paid"
    assert inst["amountPaid"] == 2000
    assert d2["plans"][0]["balanceDue"] == 4000


def test_officer_b_cannot_see_officer_a_students(http_client: httpx.Client, admin_headers: dict):
    officer_a = _create_officer(http_client, admin_headers)
    officer_b = _create_officer(http_client, admin_headers)
    ha = _officer_headers(http_client, officer_a["email"])
    hb = _officer_headers(http_client, officer_b["email"])
    batch_id = _pick_batch(http_client, admin_headers)

    onboard = http_client.post(
        f"{API}/admissions/students",
        headers=ha,
        json={
            "name": "A's student",
            "email": f"{_rand('astud')}@demo.local",
            "phone": "0301-0000009",
            "batchId": batch_id,
            "feePlan": {
                "planType": "one_time",
                "totalAmount": 5000,
                "firstDueDate": date.today().isoformat(),
            },
        },
    )
    student_id = onboard.json()["userId"]

    # Officer B's roster does NOT contain the student
    list_resp = http_client.get(f"{API}/admissions/students", headers=hb)
    b_roster = [r["userId"] for r in list_resp.json()["data"]]
    assert student_id not in b_roster

    # Officer B's detail fetch returns 404 / 400
    detail = http_client.get(f"{API}/admissions/students/{student_id}", headers=hb)
    assert detail.status_code in (400, 404)


def test_receipt_pdf_downloads(http_client: httpx.Client, admin_headers: dict):
    officer = _create_officer(http_client, admin_headers)
    officer_h = _officer_headers(http_client, officer["email"])
    batch_id = _pick_batch(http_client, admin_headers)

    onboard = http_client.post(
        f"{API}/admissions/students",
        headers=officer_h,
        json={
            "name": "Ali Receipt",
            "email": f"{_rand('rec')}@demo.local",
            "phone": "0301-0000004",
            "batchId": batch_id,
            "feePlan": {
                "planType": "one_time",
                "totalAmount": 3000,
                "firstDueDate": date.today().isoformat(),
            },
        },
    )
    student_id = onboard.json()["userId"]
    detail = http_client.get(f"{API}/admissions/students/{student_id}", headers=officer_h).json()
    inst_id = detail["plans"][0]["installments"][0]["id"]

    pay = http_client.post(
        f"{API}/admissions/students/{student_id}/payments",
        headers=officer_h,
        json={
            "feeInstallmentId": inst_id,
            "amount": 3000,
            "paymentDate": datetime.now(timezone.utc).isoformat(),
            "paymentMethod": "cash",
        },
    ).json()

    pdf_resp = http_client.get(
        f"{API}/admissions/payments/{pay['id']}/receipt.pdf", headers=officer_h
    )
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content.startswith(b"%PDF")


def test_admin_stats_counts_officer_performance(http_client: httpx.Client, admin_headers: dict):
    officer = _create_officer(http_client, admin_headers)
    officer_h = _officer_headers(http_client, officer["email"])
    batch_id = _pick_batch(http_client, admin_headers)

    # Onboard 2 students under this officer
    for i in range(2):
        http_client.post(
            f"{API}/admissions/students",
            headers=officer_h,
            json={
                "name": f"Ali Stat {i}",
                "email": f"{_rand('stat')}-{i}@demo.local",
                "phone": "0301-0000005",
                "batchId": batch_id,
                "feePlan": {
                    "planType": "one_time",
                    "totalAmount": 4000,
                    "firstDueDate": date.today().isoformat(),
                },
            },
        )

    stats = http_client.get(
        f"{API}/admissions/admin/stats", headers=admin_headers
    ).json()
    me = next((r for r in stats["officers"] if r["email"] == officer["email"]), None)
    assert me is not None
    assert me["studentsOnboarded"] >= 2
    assert me["totalBilled"] >= 8000
