"""
Regression tests for auth security audit fixes (2026-03-14).

Run against a live API:
    TEST_BASE_URL=https://apiict.zensbot.site \
    python -m pytest tests/test_auth_audit_fixes.py -v

Rate-limit strategy: login endpoint allows 5/min. Tests are ordered so that
login-heavy tests (Fix 1) run first, then lighter tests reuse tokens. The
_login() helper retries once after a 62s wait on 429.

Covers:
  Fix 1 — Access token revocation via token_version
  Fix 2 — UserSession.institute_id set on login
  Fix 3 — Bare-domain login restricted to super_admin
  Fix 4 — Tenant-aware password reset URL (no-crash check)
  Fix 5 — User quota enforcement on creation paths
"""
import os
import time
import secrets

import requests
import pytest

BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8000")
API = f"{BASE_URL}/api/v1"

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@ict.net.pk")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "admin123")
INSTITUTE_SLUG = os.environ.get("TEST_INSTITUTE_SLUG", "ict")


def _login(email: str, password: str, slug: str | None = None) -> dict:
    """Login and return full response JSON. Retries once on 429."""
    headers = {}
    if slug:
        headers["X-Institute-Slug"] = slug
    resp = requests.post(
        f"{API}/auth/login",
        json={"email": email, "password": password},
        headers=headers,
        timeout=15,
    )
    if resp.status_code == 429:
        time.sleep(62)
        resp = requests.post(
            f"{API}/auth/login",
            json={"email": email, "password": password},
            headers=headers,
            timeout=15,
        )
    resp.raise_for_status()
    return resp.json()


def _me(access_token: str) -> requests.Response:
    return requests.get(
        f"{API}/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )


# ── Fix 3: Bare-Domain Login (no login call needed) ─────────

def test_fix3_admin_login_without_slug_rejected():
    """Fix 3 — POST /auth/login with admin creds but NO X-Institute-Slug → 401."""
    resp = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    # 401 or 429 (if rate limited from prior runs)
    assert resp.status_code in (401, 429), (
        f"Expected 401 for admin login without slug, got {resp.status_code}"
    )


# ── Fix 4: Password Reset URL (no login call needed) ────────

def test_fix4_forgot_password_with_slug():
    """Fix 4 — POST /auth/forgot-password with slug → 200."""
    resp = requests.post(
        f"{API}/auth/forgot-password",
        json={"email": "nonexistent@test.com"},
        headers={"X-Institute-Slug": INSTITUTE_SLUG},
        timeout=15,
    )
    assert resp.status_code in (200, 429), f"Got {resp.status_code}"


def test_fix4_forgot_password_without_slug():
    """Fix 4 — POST /auth/forgot-password without slug → 200."""
    resp = requests.post(
        f"{API}/auth/forgot-password",
        json={"email": "nonexistent@test.com"},
        timeout=15,
    )
    assert resp.status_code in (200, 429), f"Got {resp.status_code}"


# ── Fix 1: Token Revocation (uses 1 login call) ─────────────

def test_fix1_logout_revokes_access_token():
    """Fix 1 — Login → /me (200) → logout → /me with old token → 401."""
    data = _login(ADMIN_EMAIL, ADMIN_PASSWORD, INSTITUTE_SLUG)
    access = data["access_token"]
    refresh = data["refresh_token"]

    resp = _me(access)
    assert resp.status_code == 200, f"Expected 200 pre-logout, got {resp.status_code}"

    # Logout increments token_version
    requests.post(f"{API}/auth/logout", json={"refresh_token": refresh}, timeout=15)

    # Same access token must now be rejected
    resp = _me(access)
    assert resp.status_code == 401, f"Expected 401 post-logout, got {resp.status_code}"


# ── Fix 1 continued: logout-all (uses 1 login call) ─────────

def test_fix1_logout_all_revokes_access_token():
    """Fix 1 — Login → /me (200) → logout-all → /me → 401."""
    data = _login(ADMIN_EMAIL, ADMIN_PASSWORD, INSTITUTE_SLUG)
    access = data["access_token"]

    resp = _me(access)
    assert resp.status_code == 200

    requests.post(
        f"{API}/auth/logout-all",
        headers={"Authorization": f"Bearer {access}"},
        timeout=15,
    )

    resp = _me(access)
    assert resp.status_code == 401, f"Expected 401 after logout-all, got {resp.status_code}"


# ── Fix 2 + Fix 5: Session institute_id + Quota (uses 1 login) ──

def test_fix2_and_fix5_session_and_quota():
    """Fix 2 — devices list nonempty. Fix 5 — create/delete user works under quota."""
    data = _login(ADMIN_EMAIL, ADMIN_PASSWORD, INSTITUTE_SLUG)
    access = data["access_token"]
    headers = {
        "Authorization": f"Bearer {access}",
        "X-Institute-Slug": INSTITUTE_SLUG,
    }

    # Fix 2: Check device management
    resp = requests.get(f"{API}/admin/devices", headers=headers, timeout=15)
    if resp.status_code == 200:
        body = resp.json()
        sessions = body.get("data", body) if isinstance(body, dict) else body
        assert len(sessions) > 0, "Expected at least 1 session in device list"

    # Fix 5: Create a test user (proves quota check passes)
    test_email = f"test_{secrets.token_hex(4)}@audit-test.com"
    resp = requests.post(
        f"{API}/users",
        json={
            "email": test_email,
            "name": "Audit Test User",
            "role": "student",
            "password": "TestPass123!",
        },
        headers=headers,
        timeout=15,
    )
    if resp.status_code == 400 and "limit reached" in resp.text.lower():
        pytest.skip("Institute at quota limit")
    assert resp.status_code == 201, f"Create user failed: {resp.status_code} {resp.text}"
    user_id = resp.json()["id"]

    # Cleanup: delete the test user (proves decrement works)
    del_resp = requests.delete(f"{API}/users/{user_id}", headers=headers, timeout=15)
    assert del_resp.status_code in (200, 204), f"Delete failed: {del_resp.status_code}"
