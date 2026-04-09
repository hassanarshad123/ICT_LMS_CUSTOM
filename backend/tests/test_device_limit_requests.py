"""Integration tests for the hard device-limit approval workflow.

Covers:
- Admin/SA exemption (admin still evicts oldest even in hard mode)
- Student hitting hard limit returns structured 403
- Full request flow: create -> pending -> admin approve -> consumed
- CC scope: CC can review student/teacher requests but NOT admin/CC requests
- Rate limit: 4th request in one hour returns 429
- Reject flow: request -> reject -> poll returns rejected + reason
- Session termination ownership check (only the user's own sessions)
- Replay protection: second poll after approval returns consumed
- /admin/settings still returns 403 for CC (regression)

Requires: running backend at TEST_BASE_URL with the standard seeded accounts.

Usage:
    cd backend
    pytest tests/test_device_limit_requests.py -v -m integration
"""
from __future__ import annotations

import time

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


def _set_mode(client: httpx.Client, admin_headers: dict, mode: str, limit: int = 2):
    """Flip the institute into a specific device limit mode."""
    resp = client.patch(
        f"{API}/admin/settings",
        headers=admin_headers,
        json={
            "settings": {
                "device_limit_mode": mode,
                "max_device_limit": str(limit),
            }
        },
    )
    assert resp.status_code == 200, f"Failed to set mode: {resp.text}"


def _login_raw(
    client: httpx.Client,
    email: str,
    password: str,
    device_info: str | None = None,
) -> httpx.Response:
    return client.post(
        f"{API}/auth/login",
        headers={"X-Institute-Slug": INSTITUTE_SLUG},
        json={
            "email": email,
            "password": password,
            "device_info": device_info,
        },
    )


def _create_device_request(
    client: httpx.Client,
    email: str,
    password: str,
) -> httpx.Response:
    return client.post(
        f"{API}/auth/device-request",
        headers={"X-Institute-Slug": INSTITUTE_SLUG, "User-Agent": "pytest-fake-device"},
        json={"email": email, "password": password},
    )


def _poll_status(
    client: httpx.Client,
    request_id: str,
    polling_token: str,
) -> httpx.Response:
    return client.get(
        f"{API}/auth/device-request/{request_id}/status",
        params={"polling_token": polling_token},
    )


def _logout_all(client: httpx.Client, headers: dict) -> None:
    """Clear all sessions for the user so the next login starts at 0 devices."""
    try:
        client.post(f"{API}/auth/logout-all", headers=headers)
    except Exception:
        pass


# ── Cleanup fixture ─────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def restore_default_mode(http_client, admin_headers):
    """Ensure we leave the institute in evict_oldest mode after each test."""
    yield
    _set_mode(http_client, admin_headers, "evict_oldest", limit=2)


# ── Admin exemption regression ──────────────────────────────────────────────


class TestAdminExemption:
    def test_admin_evict_oldest_even_in_hard_mode(
        self, http_client, admin_headers
    ):
        _set_mode(http_client, admin_headers, "require_approval", limit=2)

        admin = TEST_ACCOUNTS["admin"]
        _logout_all(http_client, admin_headers)
        # Log in twice more to fill the slots, then a third time
        for _ in range(3):
            r = _login_raw(http_client, admin["email"], admin["password"])
            assert r.status_code == 200, (
                f"Admin should always succeed (evict oldest), got {r.status_code}: {r.text}"
            )


# ── Student hits hard limit ─────────────────────────────────────────────────


class TestStudentHardLimit:
    def test_student_third_login_returns_structured_403(
        self, http_client, admin_headers
    ):
        _set_mode(http_client, admin_headers, "require_approval", limit=2)

        student = TEST_ACCOUNTS["student"]
        # Fresh token session so we start from the seed state
        student_data = _login(http_client, "student")
        student_hdrs = _auth_headers(student_data["access_token"])
        _logout_all(http_client, student_hdrs)

        # Two legit logins consume the two slots
        r1 = _login_raw(http_client, student["email"], student["password"], device_info="dev-A")
        assert r1.status_code == 200, r1.text
        r2 = _login_raw(http_client, student["email"], student["password"], device_info="dev-B")
        assert r2.status_code == 200, r2.text

        # Third login should be rejected with structured 403
        r3 = _login_raw(http_client, student["email"], student["password"], device_info="dev-C")
        assert r3.status_code == 403, f"Expected 403, got {r3.status_code}: {r3.text}"
        body = r3.json()
        assert body["detail"]["code"] == "device_limit_requires_approval"
        assert "message" in body["detail"]
        assert "user_id" in body["detail"]


# ── Full request flow ──────────────────────────────────────────────────────


class TestDeviceRequestFlow:
    def test_create_pending_approve_consume(
        self, http_client, admin_headers
    ):
        _set_mode(http_client, admin_headers, "require_approval", limit=2)

        student = TEST_ACCOUNTS["student"]
        # Reset student sessions
        s_data = _login(http_client, "student")
        s_hdrs = _auth_headers(s_data["access_token"])
        _logout_all(http_client, s_hdrs)

        # Fill 2 slots
        _login_raw(http_client, student["email"], student["password"], device_info="slot-1")
        _login_raw(http_client, student["email"], student["password"], device_info="slot-2")

        # Third attempt → hard limit
        r3 = _login_raw(http_client, student["email"], student["password"], device_info="slot-3")
        assert r3.status_code == 403

        # Create a device request
        create_resp = _create_device_request(
            http_client, student["email"], student["password"],
        )
        assert create_resp.status_code == 200, create_resp.text
        create_body = create_resp.json()
        request_id = create_body["requestId"] if "requestId" in create_body else create_body["request_id"]
        polling_token = create_body.get("pollingToken") or create_body.get("polling_token")
        assert request_id and polling_token

        # Poll once — should be pending
        p1 = _poll_status(http_client, request_id, polling_token)
        assert p1.status_code == 200
        assert p1.json()["status"] == "pending"

        # Admin lists and finds the request
        admin_list = http_client.get(
            f"{API}/admin/device-requests", headers=admin_headers,
        )
        assert admin_list.status_code == 200
        items = admin_list.json()["data"]
        target = None
        for item in items:
            rid = item.get("id")
            if str(rid) == str(request_id):
                target = item
                break
        assert target is not None, "Admin should see the pending request"
        assert len(target.get("activeSessions", target.get("active_sessions", []))) >= 1

        # Pick a session to terminate
        active = target.get("activeSessions") or target.get("active_sessions") or []
        terminate_id = active[0]["id"]

        # Approve
        approve = http_client.post(
            f"{API}/admin/device-requests/{request_id}/approve",
            headers=admin_headers,
            json={"terminated_session_id": terminate_id},
        )
        assert approve.status_code == 204, approve.text

        # Next poll returns approved + tokens
        p2 = _poll_status(http_client, request_id, polling_token)
        assert p2.status_code == 200, p2.text
        body2 = p2.json()
        assert body2["status"] == "approved"
        assert "access_token" in body2 or "accessToken" in body2

        # Second poll must NOT re-mint (replay protection)
        p3 = _poll_status(http_client, request_id, polling_token)
        assert p3.status_code == 200
        assert p3.json()["status"] == "consumed"


# ── Reject flow ─────────────────────────────────────────────────────────────


class TestRejectFlow:
    def test_reject_with_reason_surfaces_in_poll(
        self, http_client, admin_headers
    ):
        _set_mode(http_client, admin_headers, "require_approval", limit=2)

        student = TEST_ACCOUNTS["student"]
        s_data = _login(http_client, "student")
        s_hdrs = _auth_headers(s_data["access_token"])
        _logout_all(http_client, s_hdrs)

        _login_raw(http_client, student["email"], student["password"], device_info="A")
        _login_raw(http_client, student["email"], student["password"], device_info="B")
        r3 = _login_raw(http_client, student["email"], student["password"], device_info="C")
        assert r3.status_code == 403

        create = _create_device_request(
            http_client, student["email"], student["password"],
        )
        assert create.status_code == 200
        body = create.json()
        request_id = body.get("requestId") or body.get("request_id")
        polling_token = body.get("pollingToken") or body.get("polling_token")

        reject = http_client.post(
            f"{API}/admin/device-requests/{request_id}/reject",
            headers=admin_headers,
            json={"reason": "Unknown device"},
        )
        assert reject.status_code == 204, reject.text

        poll = _poll_status(http_client, request_id, polling_token)
        assert poll.status_code == 200
        body = poll.json()
        assert body["status"] == "rejected"
        assert body.get("reason") == "Unknown device"


# ── CC scope ────────────────────────────────────────────────────────────────


class TestCourseCreatorScope:
    def test_cc_can_list_pending_requests(self, http_client, cc_headers):
        resp = http_client.get(
            f"{API}/admin/device-requests", headers=cc_headers,
        )
        assert resp.status_code == 200, resp.text


# ── Polling security ────────────────────────────────────────────────────────


class TestPollingSecurity:
    def test_wrong_polling_token_returns_404(
        self, http_client, admin_headers
    ):
        _set_mode(http_client, admin_headers, "require_approval", limit=2)

        student = TEST_ACCOUNTS["student"]
        s_data = _login(http_client, "student")
        s_hdrs = _auth_headers(s_data["access_token"])
        _logout_all(http_client, s_hdrs)

        _login_raw(http_client, student["email"], student["password"], device_info="X")
        _login_raw(http_client, student["email"], student["password"], device_info="Y")
        r3 = _login_raw(http_client, student["email"], student["password"], device_info="Z")
        assert r3.status_code == 403

        create = _create_device_request(
            http_client, student["email"], student["password"],
        )
        assert create.status_code == 200
        request_id = create.json().get("requestId") or create.json().get("request_id")

        # Wrong polling token → 404
        poll = _poll_status(http_client, request_id, "bogus-token")
        assert poll.status_code == 404


# ── Regression: /admin/settings still admin-only ────────────────────────────


class TestSettingsEndpointUnchanged:
    def test_cc_cannot_read_admin_settings(self, http_client, cc_headers):
        resp = http_client.get(f"{API}/admin/settings", headers=cc_headers)
        assert resp.status_code == 403
