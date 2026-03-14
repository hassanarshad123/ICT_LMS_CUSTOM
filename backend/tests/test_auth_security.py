"""Integration tests for auth flows and role-based access control.

Requires: running backend at TEST_BASE_URL (default http://localhost:8000)

NOTE: Login endpoint has 5/min rate limit. Tests are ordered so that
session-scoped token fixtures are obtained first (RBAC tests), then
auth flow tests that make direct login calls run last.
"""
import time
import pytest
import httpx

from tests.conftest import API, INSTITUTE_SLUG, TEST_ACCOUNTS, _auth_headers


pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# 1. Role-Based Access Control Tests (run first — trigger token fixtures)
# ---------------------------------------------------------------------------

class TestAdminOnlyEndpoints:
    """Verify admin-only endpoints reject other roles."""

    ADMIN_ENDPOINTS = [
        ("GET", "/admin/dashboard"),
        ("GET", "/admin/devices"),
        ("GET", "/admin/activity-log"),
        ("GET", "/monitoring/errors"),
        ("GET", "/monitoring/errors/stats"),
    ]

    @pytest.mark.parametrize("method,path", ADMIN_ENDPOINTS)
    def test_student_cannot_access(self, http_client, student_headers, method, path):
        resp = getattr(http_client, method.lower())(f"{API}{path}", headers=student_headers)
        assert resp.status_code == 403, f"Student should be 403 on {method} {path}, got {resp.status_code}"

    @pytest.mark.parametrize("method,path", ADMIN_ENDPOINTS)
    def test_teacher_cannot_access(self, http_client, teacher_headers, method, path):
        resp = getattr(http_client, method.lower())(f"{API}{path}", headers=teacher_headers)
        assert resp.status_code == 403, f"Teacher should be 403 on {method} {path}, got {resp.status_code}"

    @pytest.mark.parametrize("method,path", ADMIN_ENDPOINTS)
    def test_cc_cannot_access(self, http_client, cc_headers, method, path):
        resp = getattr(http_client, method.lower())(f"{API}{path}", headers=cc_headers)
        assert resp.status_code == 403, f"CC should be 403 on {method} {path}, got {resp.status_code}"

    @pytest.mark.parametrize("method,path", ADMIN_ENDPOINTS)
    def test_admin_can_access(self, http_client, admin_headers, method, path):
        resp = getattr(http_client, method.lower())(f"{API}{path}", headers=admin_headers)
        assert resp.status_code == 200, f"Admin should be 200 on {method} {path}, got {resp.status_code}"


class TestCCOnlyEndpoints:
    """Verify course creator endpoints reject student/teacher."""

    def test_student_cannot_create_course(self, http_client, student_headers):
        resp = http_client.post(
            f"{API}/courses",
            json={"title": "TEST_should_not_create"},
            headers=student_headers,
        )
        assert resp.status_code == 403

    def test_teacher_cannot_create_course(self, http_client, teacher_headers):
        resp = http_client.post(
            f"{API}/courses",
            json={"title": "TEST_should_not_create"},
            headers=teacher_headers,
        )
        assert resp.status_code == 403

    def test_student_cannot_create_quiz(self, http_client, student_headers):
        resp = http_client.post(
            f"{API}/quizzes",
            json={"title": "TEST_quiz", "course_id": "00000000-0000-0000-0000-000000000000"},
            headers=student_headers,
        )
        assert resp.status_code == 403

    def test_teacher_cannot_create_quiz(self, http_client, teacher_headers):
        resp = http_client.post(
            f"{API}/quizzes",
            json={"title": "TEST_quiz", "course_id": "00000000-0000-0000-0000-000000000000"},
            headers=teacher_headers,
        )
        assert resp.status_code == 403


class TestStudentOnlyEndpoints:
    """Verify student-only endpoints reject admin/cc/teacher."""

    def test_admin_cannot_request_certificate(self, http_client, admin_headers):
        resp = http_client.post(
            f"{API}/certificates/request",
            json={"course_id": "00000000-0000-0000-0000-000000000000", "preferred_name": "TEST"},
            headers=admin_headers,
        )
        assert resp.status_code == 403

    def test_cc_cannot_request_certificate(self, http_client, cc_headers):
        resp = http_client.post(
            f"{API}/certificates/request",
            json={"course_id": "00000000-0000-0000-0000-000000000000", "preferred_name": "TEST"},
            headers=cc_headers,
        )
        assert resp.status_code == 403

    def test_teacher_cannot_request_certificate(self, http_client, teacher_headers):
        resp = http_client.post(
            f"{API}/certificates/request",
            json={"course_id": "00000000-0000-0000-0000-000000000000", "preferred_name": "TEST"},
            headers=teacher_headers,
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 2. Public Endpoint Tests (no auth needed, no rate limit risk)
# ---------------------------------------------------------------------------

class TestPublicEndpoints:
    """Verify public endpoints work without authentication."""

    def test_branding_public(self, http_client):
        resp = http_client.get(
            f"{API}/branding",
            headers={"X-Institute-Slug": INSTITUTE_SLUG},
        )
        assert resp.status_code == 200

    def test_branding_preset_themes(self, http_client):
        resp = http_client.get(f"{API}/branding/preset-themes")
        assert resp.status_code == 200

    def test_branding_certificate_design(self, http_client):
        resp = http_client.get(
            f"{API}/branding/certificate-design",
            headers={"X-Institute-Slug": INSTITUTE_SLUG},
        )
        assert resp.status_code == 200

    def test_health_endpoint(self, http_client):
        resp = http_client.get(f"{API.replace('/api/v1', '')}/api/health")
        assert resp.status_code == 200


class TestBrandingWriteAccess:
    """Verify only admin can write branding settings."""

    def test_student_cannot_update_branding(self, http_client, student_headers):
        resp = http_client.patch(
            f"{API}/branding",
            json={"institute_name": "TEST_should_not_update"},
            headers=student_headers,
        )
        assert resp.status_code == 403

    def test_cc_cannot_update_branding(self, http_client, cc_headers):
        resp = http_client.patch(
            f"{API}/branding",
            json={"institute_name": "TEST_should_not_update"},
            headers=cc_headers,
        )
        assert resp.status_code == 403

    def test_teacher_cannot_update_branding(self, http_client, teacher_headers):
        resp = http_client.patch(
            f"{API}/branding",
            json={"institute_name": "TEST_should_not_update"},
            headers=teacher_headers,
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 3. Auth Flow Tests (run LAST — these consume rate limit budget)
# ---------------------------------------------------------------------------

class TestZAuthFlow:
    """Test authentication endpoints.

    Named with Z prefix so pytest runs this after RBAC tests
    (which trigger token fixtures before rate limit is consumed).

    These tests make direct login calls and may hit the 5/min rate limiter.
    We accept 429 as valid for tests that make login calls.
    """

    def test_me_with_valid_token(self, http_client, admin_token):
        """Uses pre-obtained token, no login call."""
        resp = http_client.get(
            f"{API}/auth/me",
            headers=_auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == TEST_ACCOUNTS["admin"]["email"]

    def test_me_without_token(self, http_client):
        resp = http_client.get(
            f"{API}/auth/me",
            headers={"X-Institute-Slug": INSTITUTE_SLUG},
        )
        assert resp.status_code in (401, 403)

    def test_me_with_invalid_token(self, http_client):
        resp = http_client.get(
            f"{API}/auth/me",
            headers={
                "Authorization": "Bearer invalid.jwt.token",
                "X-Institute-Slug": INSTITUTE_SLUG,
            },
        )
        assert resp.status_code in (401, 403)

    def test_refresh_with_invalid_token(self, http_client):
        resp = http_client.post(
            f"{API}/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
            headers={"X-Institute-Slug": INSTITUTE_SLUG},
        )
        assert resp.status_code == 401

    def test_login_valid_credentials(self, http_client):
        resp = http_client.post(
            f"{API}/auth/login",
            json={"email": TEST_ACCOUNTS["admin"]["email"], "password": TEST_ACCOUNTS["admin"]["password"]},
            headers={"X-Institute-Slug": INSTITUTE_SLUG},
        )
        assert resp.status_code in (200, 429)
        if resp.status_code == 200:
            data = resp.json()
            assert "access_token" in data
            assert "refresh_token" in data
            assert data["token_type"] == "bearer"
            assert data["user"]["role"] == "admin"

    def test_login_wrong_password(self, http_client):
        resp = http_client.post(
            f"{API}/auth/login",
            json={"email": TEST_ACCOUNTS["admin"]["email"], "password": "wrongpassword"},
            headers={"X-Institute-Slug": INSTITUTE_SLUG},
        )
        assert resp.status_code in (401, 429)

    def test_login_nonexistent_email(self, http_client):
        resp = http_client.post(
            f"{API}/auth/login",
            json={"email": "nonexistent@fake.com", "password": "anypass"},
            headers={"X-Institute-Slug": INSTITUTE_SLUG},
        )
        assert resp.status_code in (401, 429)

    def test_institute_slug_scoping(self, http_client):
        """Login with wrong slug should fail."""
        resp = http_client.post(
            f"{API}/auth/login",
            json={"email": TEST_ACCOUNTS["admin"]["email"], "password": TEST_ACCOUNTS["admin"]["password"]},
            headers={"X-Institute-Slug": "nonexistent-institute-slug"},
        )
        assert resp.status_code in (401, 404, 429)


class TestZZRateLimiter:
    """Verify the login rate limiter is active. Runs last."""

    def test_rate_limiter_exists(self, http_client):
        """Rapidly hit login to confirm rate limiter blocks after threshold."""
        statuses = []
        for _ in range(7):
            resp = http_client.post(
                f"{API}/auth/login",
                json={"email": "ratelimit@test.com", "password": "wrong"},
                headers={"X-Institute-Slug": INSTITUTE_SLUG},
            )
            statuses.append(resp.status_code)
        # Should see at least one 429 in the responses
        assert 429 in statuses, f"Rate limiter not triggered. Statuses: {statuses}"
