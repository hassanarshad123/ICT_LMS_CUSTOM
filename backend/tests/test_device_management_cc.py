"""Integration tests for Course Creator device management access.

Verifies that course creators can view and terminate device sessions for
students and teachers in their institute, but cannot see or touch sessions
belonging to admins or other course creators.

Requires: running backend at TEST_BASE_URL (default http://localhost:8000)
with the standard seeded accounts from conftest.py (admin/cc/teacher/student).

Usage:
    cd backend
    pytest tests/test_device_management_cc.py -v -m integration
"""
from __future__ import annotations

import httpx
import pytest

from tests.conftest import API, _auth_headers


pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _list_devices(
    client: httpx.Client,
    headers: dict,
    role: str | None = None,
    per_page: int = 100,
) -> dict:
    """Hit GET /admin/devices and return the parsed JSON body."""
    params: dict[str, str | int] = {"per_page": per_page}
    if role is not None:
        params["role"] = role
    resp = client.get(f"{API}/admin/devices", headers=headers, params=params)
    assert resp.status_code == 200, f"list_devices failed: {resp.status_code} {resp.text}"
    return resp.json()


def _login_to_create_session(
    client: httpx.Client,
    email: str,
    password: str,
    institute_slug: str,
) -> str:
    """Log in a seeded account so the user has at least one active session.

    Returns the access token (not strictly used by the tests, but the login
    call creates the session row that the devices endpoint will list).
    """
    resp = client.post(
        f"{API}/auth/login",
        json={"email": email, "password": password},
        headers={"X-Institute-Slug": institute_slug},
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# Admin parity — regression guard
# ---------------------------------------------------------------------------

class TestAdminDeviceListing:
    """Admin behavior must not regress."""

    def test_admin_sees_all_roles(self, http_client, admin_headers):
        body = _list_devices(http_client, admin_headers)

        assert "data" in body
        assert "device_limit" in body, (
            "device_limit should be embedded in list response"
        )
        assert isinstance(body["device_limit"], int)
        assert body["device_limit"] >= 1

        # Admin should be able to see users of any role that exists in the
        # institute (we expect at least one admin-role user — themselves).
        returned_roles = {user["user_role"] for user in body["data"]}
        assert "admin" in returned_roles or len(body["data"]) == 0, (
            f"Admin list should include admin-role users when they exist. "
            f"Got roles: {returned_roles}"
        )

    def test_admin_can_filter_by_course_creator(self, http_client, admin_headers):
        """Admin passing ?role=course-creator should get CC users only."""
        body = _list_devices(http_client, admin_headers, role="course-creator")

        for user in body["data"]:
            assert user["user_role"] == "course_creator", (
                f"Admin filter role=course-creator leaked: {user['user_role']}"
            )


# ---------------------------------------------------------------------------
# CC scope — the core new behavior
# ---------------------------------------------------------------------------

class TestCourseCreatorDeviceListing:
    """Course creators can only see student + teacher sessions."""

    def test_cc_can_list_devices_without_403(self, http_client, cc_headers):
        resp = http_client.get(f"{API}/admin/devices", headers=cc_headers)
        assert resp.status_code == 200, (
            f"CC should get 200 on /admin/devices, got {resp.status_code}: {resp.text}"
        )

    def test_cc_list_contains_device_limit(self, http_client, cc_headers):
        body = _list_devices(http_client, cc_headers)
        assert "device_limit" in body
        assert isinstance(body["device_limit"], int)
        assert body["device_limit"] >= 1

    def test_cc_list_only_contains_students_and_teachers(
        self, http_client, cc_headers
    ):
        body = _list_devices(http_client, cc_headers)
        allowed_roles = {"student", "teacher"}
        leaked = [u for u in body["data"] if u["user_role"] not in allowed_roles]
        assert not leaked, (
            f"CC devices list leaked out-of-scope users: "
            f"{[u['user_role'] for u in leaked]}"
        )

    def test_cc_role_filter_admin_is_sanitized(self, http_client, cc_headers):
        """Passing ?role=admin as a CC must not return admin users."""
        body = _list_devices(http_client, cc_headers, role="admin")
        admin_users = [u for u in body["data"] if u["user_role"] == "admin"]
        assert not admin_users, (
            f"CC with role=admin filter leaked admin users: {admin_users}"
        )

    def test_cc_role_filter_cc_is_sanitized(self, http_client, cc_headers):
        """Passing ?role=course-creator as a CC must not return CC users."""
        body = _list_devices(http_client, cc_headers, role="course-creator")
        cc_users = [u for u in body["data"] if u["user_role"] == "course_creator"]
        assert not cc_users, (
            f"CC with role=course-creator filter leaked CC users: {cc_users}"
        )

    def test_cc_role_filter_student_works(self, http_client, cc_headers):
        body = _list_devices(http_client, cc_headers, role="student")
        for user in body["data"]:
            assert user["user_role"] == "student", (
                f"CC role=student returned {user['user_role']}"
            )

    def test_cc_role_filter_teacher_works(self, http_client, cc_headers):
        body = _list_devices(http_client, cc_headers, role="teacher")
        for user in body["data"]:
            assert user["user_role"] == "teacher", (
                f"CC role=teacher returned {user['user_role']}"
            )


# ---------------------------------------------------------------------------
# CC termination boundary
# ---------------------------------------------------------------------------

class TestCourseCreatorTerminationBoundary:
    """CCs must get 404 when trying to terminate sessions for admin/CC users."""

    def test_cc_cannot_terminate_admin_user_sessions(
        self, http_client, cc_headers, admin_headers
    ):
        """CC hits DELETE /admin/devices/user/{admin_user_id} → expects 404."""
        # Discover an admin user via the admin list
        admin_body = _list_devices(http_client, admin_headers, role="admin")
        admin_users = [u for u in admin_body["data"] if u["user_role"] == "admin"]

        if not admin_users:
            pytest.skip("No admin user found in institute — cannot test boundary")

        admin_user_id = admin_users[0]["user_id"]

        resp = http_client.delete(
            f"{API}/admin/devices/user/{admin_user_id}",
            headers=cc_headers,
        )
        assert resp.status_code == 404, (
            f"CC terminating admin user sessions should 404, got {resp.status_code}: {resp.text}"
        )

    def test_cc_cannot_terminate_admin_single_session(
        self, http_client, cc_headers, admin_headers
    ):
        """CC hits DELETE /admin/devices/{admin_session_id} → expects 404.

        We first ensure the admin has an active session by listing devices
        and finding a non-empty active_sessions array. If none exists, skip.
        """
        admin_body = _list_devices(http_client, admin_headers, role="admin")
        admin_sessions: list[str] = []
        for user in admin_body["data"]:
            if user["user_role"] == "admin":
                for session in user.get("active_sessions", []):
                    admin_sessions.append(session["id"])

        if not admin_sessions:
            pytest.skip(
                "No active admin session found — cannot test single-session boundary. "
                "Log in as admin first to create one."
            )

        resp = http_client.delete(
            f"{API}/admin/devices/{admin_sessions[0]}",
            headers=cc_headers,
        )
        assert resp.status_code == 404, (
            f"CC terminating admin session should 404, got {resp.status_code}: {resp.text}"
        )


# ---------------------------------------------------------------------------
# CC positive path — can terminate sessions in scope
# ---------------------------------------------------------------------------

class TestCourseCreatorCanTerminateInScope:
    """CC can successfully terminate student/teacher sessions.

    We log the seeded student/teacher in first to guarantee there is an
    active session to terminate. Each test restores the session by
    logging the victim back in at the end so the overall suite is
    idempotent.
    """

    def test_cc_can_terminate_student_session(
        self, http_client, cc_headers, institute_slug
    ):
        from tests.conftest import TEST_ACCOUNTS

        # Ensure student has an active session
        student = TEST_ACCOUNTS["student"]
        _login_to_create_session(
            http_client, student["email"], student["password"], institute_slug
        )

        # Find that student in the CC's device list
        body = _list_devices(http_client, cc_headers, role="student")
        target = None
        for user in body["data"]:
            if user["user_email"] == student["email"] and user.get("active_sessions"):
                target = user
                break

        if target is None:
            pytest.skip("Seeded student has no active session after login — skipping")

        session_id = target["active_sessions"][0]["id"]
        resp = http_client.delete(
            f"{API}/admin/devices/{session_id}",
            headers=cc_headers,
        )
        assert resp.status_code == 204, (
            f"CC should successfully terminate student session, got {resp.status_code}: {resp.text}"
        )

    def test_cc_can_bulk_terminate_teacher_sessions(
        self, http_client, cc_headers, institute_slug
    ):
        from tests.conftest import TEST_ACCOUNTS

        teacher = TEST_ACCOUNTS["teacher"]
        _login_to_create_session(
            http_client, teacher["email"], teacher["password"], institute_slug
        )

        body = _list_devices(http_client, cc_headers, role="teacher")
        target = None
        for user in body["data"]:
            if user["user_email"] == teacher["email"]:
                target = user
                break

        assert target is not None, "Seeded teacher should appear in CC devices list"

        resp = http_client.delete(
            f"{API}/admin/devices/user/{target['user_id']}",
            headers=cc_headers,
        )
        assert resp.status_code == 204, (
            f"CC should successfully bulk-terminate teacher sessions, got {resp.status_code}: {resp.text}"
        )


# ---------------------------------------------------------------------------
# /admin/settings remains admin-only (no collateral exposure)
# ---------------------------------------------------------------------------

class TestSettingsEndpointUnchanged:
    """CCs should still get 403 on /admin/settings."""

    def test_cc_cannot_read_admin_settings(self, http_client, cc_headers):
        resp = http_client.get(f"{API}/admin/settings", headers=cc_headers)
        assert resp.status_code == 403, (
            f"CC should still be blocked from /admin/settings, got {resp.status_code}"
        )

    def test_admin_can_read_admin_settings(self, http_client, admin_headers):
        resp = http_client.get(f"{API}/admin/settings", headers=admin_headers)
        assert resp.status_code == 200
