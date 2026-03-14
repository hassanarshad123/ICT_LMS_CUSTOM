"""
Shared test fixtures for ICT LMS backend tests.

Usage:
    pytest tests/unit/ -v          # Unit tests (no server needed)
    pytest tests/ -v -m integration  # Integration tests (server required)
"""
import os
import time
import uuid
import pytest
import httpx

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")
API = f"{BASE_URL}/api/v1"
INSTITUTE_SLUG = os.getenv("TEST_INSTITUTE_SLUG", "ict")

# Test accounts (from seed_ict_data.py)
TEST_ACCOUNTS = {
    "admin": {"email": "admin@ict.net.pk", "password": "admin123"},
    "cc": {"email": "cc@ict.net.pk", "password": "cc123456"},
    "teacher": {"email": "teacher@ict.net.pk", "password": "teacher123"},
    "student": {"email": "student@ict.net.pk", "password": "student123"},
}

# Track test-created resource IDs for cleanup
_created_resources: list[dict] = []


def _register_for_cleanup(resource_type: str, resource_id: str, token: str):
    """Register a resource for cleanup after test suite."""
    _created_resources.append({
        "type": resource_type,
        "id": resource_id,
        "token": token,
    })


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _login_with_retry(client: httpx.Client, role: str, max_retries: int = 3) -> dict:
    """Login with retry on rate limit (429). Waits before retrying."""
    account = TEST_ACCOUNTS[role]
    for attempt in range(max_retries):
        resp = client.post(
            f"{API}/auth/login",
            json={"email": account["email"], "password": account["password"]},
            headers={"X-Institute-Slug": INSTITUTE_SLUG},
        )
        if resp.status_code == 429:
            # Rate limited — wait and retry
            retry_after = int(resp.headers.get("Retry-After", 60))
            wait = min(retry_after, 65)
            print(f"  [conftest] Rate limited on login for {role}, waiting {wait}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()
    # Final attempt without catch
    resp = client.post(
        f"{API}/auth/login",
        json={"email": account["email"], "password": account["password"]},
        headers={"X-Institute-Slug": INSTITUTE_SLUG},
    )
    resp.raise_for_status()
    return resp.json()


def _login(client: httpx.Client, role: str) -> dict:
    """Login and return the full response data (no retry)."""
    account = TEST_ACCOUNTS[role]
    resp = client.post(
        f"{API}/auth/login",
        json={"email": account["email"], "password": account["password"]},
        headers={"X-Institute-Slug": INSTITUTE_SLUG},
    )
    resp.raise_for_status()
    return resp.json()


def _get_token(client: httpx.Client, role: str) -> str:
    """Get access token for a role (with rate-limit retry)."""
    data = _login_with_retry(client, role)
    return data["access_token"]


def _auth_headers(token: str) -> dict:
    """Build auth + institute headers."""
    return {
        "Authorization": f"Bearer {token}",
        "X-Institute-Slug": INSTITUTE_SLUG,
    }


# ---------------------------------------------------------------------------
# Fixtures — session-scoped tokens are obtained FIRST with retry
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def http_client():
    """Session-scoped httpx client."""
    with httpx.Client(timeout=30.0) as client:
        yield client


@pytest.fixture(scope="session")
def all_tokens(http_client):
    """Obtain all role tokens at once to minimize rate-limit hits.
    Returns dict: {role: access_token}
    """
    tokens = {}
    for role in ["admin", "cc", "teacher", "student"]:
        tokens[role] = _get_token(http_client, role)
    return tokens


@pytest.fixture(scope="session")
def admin_token(all_tokens):
    return all_tokens["admin"]


@pytest.fixture(scope="session")
def cc_token(all_tokens):
    return all_tokens["cc"]


@pytest.fixture(scope="session")
def teacher_token(all_tokens):
    return all_tokens["teacher"]


@pytest.fixture(scope="session")
def student_token(all_tokens):
    return all_tokens["student"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return _auth_headers(admin_token)


@pytest.fixture(scope="session")
def cc_headers(cc_token):
    return _auth_headers(cc_token)


@pytest.fixture(scope="session")
def teacher_headers(teacher_token):
    return _auth_headers(teacher_token)


@pytest.fixture(scope="session")
def student_headers(student_token):
    return _auth_headers(student_token)


@pytest.fixture
def api_url():
    """Return the API base URL."""
    return API


@pytest.fixture
def institute_slug():
    return INSTITUTE_SLUG


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

DELETE_ENDPOINTS = {
    "user": "/users/{id}",
    "batch": "/batches/{id}",
    "course": "/courses/{id}",
    "quiz": "/quizzes/{id}",
}


@pytest.fixture(scope="session", autouse=True)
def cleanup_after_all(http_client):
    """Cleanup test-created resources after all tests complete."""
    yield
    for resource in reversed(_created_resources):
        endpoint = DELETE_ENDPOINTS.get(resource["type"])
        if endpoint:
            url = f"{API}{endpoint.format(id=resource['id'])}"
            try:
                http_client.delete(url, headers=_auth_headers(resource["token"]))
            except Exception:
                pass
    _created_resources.clear()
