"""Integration test for Public API + Webhook system.

Usage:
    TEST_BASE_URL=http://localhost:8000 TEST_ADMIN_EMAIL=admin@test.com TEST_ADMIN_PASSWORD=changeme python tests/test_integration_api.py
"""
import httpx
import json
import os
import sys
import time

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8000") + "/api/v1"
SLUG = os.environ.get("TEST_INSTITUTE_SLUG", "test-prod-v2")
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@test.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "changeme")

passed = 0
failed = 0


def ok(name):
    global passed
    passed += 1
    print(f"  PASS  {name}")


def fail(name, detail=""):
    global failed
    failed += 1
    print(f"  FAIL  {name}: {detail}")


def headers_jwt(token):
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Institute-Slug": SLUG,
    }


def headers_api_key(key):
    return {
        "X-API-Key": key,
        "Content-Type": "application/json",
    }


def main():
    global passed, failed
    client = httpx.Client(timeout=15, follow_redirects=True)

    # ── 0. Login ────────────────────────────────────────────
    print("\n=== Login as Admin ===")
    r = client.post(f"{BASE}/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD,
    }, headers={"Content-Type": "application/json", "X-Institute-Slug": SLUG})

    if r.status_code != 200:
        print(f"Login failed: {r.status_code} {r.text}")
        sys.exit(1)

    token = r.json()["access_token"]
    ok(f"Login (got token)")

    # ── 1. Create API Key ───────────────────────────────────
    print("\n=== API Key Management ===")
    r = client.post(f"{BASE}/admin/api-keys", json={
        "name": "Integration Test Key",
    }, headers=headers_jwt(token))

    if r.status_code == 201:
        data = r.json()
        api_key = data["api_key"]
        key_id = data["id"]
        ok(f"Create API Key (prefix={data['key_prefix']}, starts with ict_pk_={api_key.startswith('ict_pk_')})")
    else:
        fail("Create API Key", f"{r.status_code}: {r.text}")
        print("Cannot continue without API key")
        sys.exit(1)

    # ── 2. List API Keys ────────────────────────────────────
    r = client.get(f"{BASE}/admin/api-keys", headers=headers_jwt(token))
    if r.status_code == 200:
        keys = r.json()
        ok(f"List API Keys (count={len(keys)})")
    else:
        fail("List API Keys", f"{r.status_code}")

    # ── 3. Auth rejection tests ─────────────────────────────
    print("\n=== Auth Rejection ===")
    r = client.get(f"{BASE}/public/students", headers={"Content-Type": "application/json"})
    if r.status_code == 401:
        ok("No API key -> 401")
    else:
        fail("No API key -> 401", f"got {r.status_code}")

    r = client.get(f"{BASE}/public/students", headers=headers_api_key("ict_pk_invalidfakekey1234567890abcdef1234567890abcdef"))
    if r.status_code == 401:
        ok("Invalid API key -> 401")
    else:
        fail("Invalid API key -> 401", f"got {r.status_code}")

    # ── 4. Public API - Students ────────────────────────────
    print("\n=== Public API: Students ===")
    r = client.get(f"{BASE}/public/students", headers=headers_api_key(api_key))
    if r.status_code == 200:
        data = r.json()
        ok(f"List Students (total={data['total']})")
    else:
        fail("List Students", f"{r.status_code}: {r.text[:100]}")

    # Create a student
    test_email = f"api-test-{int(time.time())}@example.com"
    r = client.post(f"{BASE}/public/students", json={
        "email": test_email, "name": "API Test Student",
    }, headers=headers_api_key(api_key))
    student_id = None
    if r.status_code == 201:
        data = r.json()
        student_id = data["id"]
        ok(f"Create Student (id={student_id[:8]}..., email={data['email']})")
    else:
        fail("Create Student", f"{r.status_code}: {r.text[:100]}")

    # Get student
    if student_id:
        r = client.get(f"{BASE}/public/students/{student_id}", headers=headers_api_key(api_key))
        if r.status_code == 200:
            ok(f"Get Student ({r.json()['name']})")
        else:
            fail("Get Student", f"{r.status_code}")

    # Update student
    if student_id:
        r = client.patch(f"{BASE}/public/students/{student_id}", json={
            "name": "API Test Student Updated", "phone": "+1234567890",
        }, headers=headers_api_key(api_key))
        if r.status_code == 200 and r.json()["name"] == "API Test Student Updated":
            ok("Update Student")
        else:
            fail("Update Student", f"{r.status_code}: {r.text[:100]}")

    # ── 5. Public API - Batches ─────────────────────────────
    print("\n=== Public API: Batches ===")
    r = client.get(f"{BASE}/public/batches", headers=headers_api_key(api_key))
    if r.status_code == 200:
        data = r.json()
        ok(f"List Batches (total={data['total']})")
        if data["data"]:
            batch = data["data"][0]
            bid = batch["id"]
            r2 = client.get(f"{BASE}/public/batches/{bid}", headers=headers_api_key(api_key))
            if r2.status_code == 200:
                ok(f"Get Batch (name={r2.json()['name']}, students={r2.json()['student_count']})")
            else:
                fail("Get Batch", f"{r2.status_code}")
    else:
        fail("List Batches", f"{r.status_code}")

    # ── 6. Public API - Courses ─────────────────────────────
    print("\n=== Public API: Courses ===")
    r = client.get(f"{BASE}/public/courses", headers=headers_api_key(api_key))
    if r.status_code == 200:
        data = r.json()
        ok(f"List Courses (total={data['total']})")
        if data["data"]:
            cid = data["data"][0]["id"]
            r2 = client.get(f"{BASE}/public/courses/{cid}", headers=headers_api_key(api_key))
            if r2.status_code == 200:
                detail = r2.json()
                ok(f"Get Course Detail (title={detail['title']}, modules={len(detail.get('modules', []))})")
            else:
                fail("Get Course Detail", f"{r2.status_code}")
    else:
        fail("List Courses", f"{r.status_code}")

    # ── 7. Public API - Enrollments ─────────────────────────
    print("\n=== Public API: Enrollments ===")
    r = client.get(f"{BASE}/public/enrollments", headers=headers_api_key(api_key))
    if r.status_code == 200:
        data = r.json()
        ok(f"List Enrollments (total={data['total']})")
    else:
        fail("List Enrollments", f"{r.status_code}")

    # ── 8. Public API - Certificates ────────────────────────
    print("\n=== Public API: Certificates ===")
    r = client.get(f"{BASE}/public/certificates", headers=headers_api_key(api_key))
    if r.status_code == 200:
        data = r.json()
        ok(f"List Certificates (total={data['total']})")
    else:
        fail("List Certificates", f"{r.status_code}")

    # ── 9. Public API - Classes ─────────────────────────────
    print("\n=== Public API: Classes ===")
    r = client.get(f"{BASE}/public/classes", headers=headers_api_key(api_key))
    if r.status_code == 200:
        data = r.json()
        ok(f"List Classes (total={data['total']})")
        if data["data"]:
            cid = data["data"][0]["id"]
            r2 = client.get(f"{BASE}/public/classes/{cid}/attendance", headers=headers_api_key(api_key))
            if r2.status_code == 200:
                ok(f"Get Attendance (records={len(r2.json())})")
            else:
                fail("Get Attendance", f"{r2.status_code}")
    else:
        fail("List Classes", f"{r.status_code}")

    # ── 10. Public API - Announcements ──────────────────────
    print("\n=== Public API: Announcements ===")
    r = client.get(f"{BASE}/public/announcements", headers=headers_api_key(api_key))
    if r.status_code == 200:
        ok(f"List Announcements (total={r.json()['total']})")
    else:
        fail("List Announcements", f"{r.status_code}")

    r = client.post(f"{BASE}/public/announcements", json={
        "title": "API Test Announcement",
        "content": "This is a test announcement from the public API.",
        "scope": "institute",
    }, headers=headers_api_key(api_key))
    if r.status_code == 201:
        ok(f"Create Announcement (id={r.json()['id'][:8]}...)")
    else:
        fail("Create Announcement", f"{r.status_code}: {r.text[:100]}")

    # ── 11. Public API - Jobs ───────────────────────────────
    print("\n=== Public API: Jobs ===")
    r = client.get(f"{BASE}/public/jobs", headers=headers_api_key(api_key))
    if r.status_code == 200:
        ok(f"List Jobs (total={r.json()['total']})")
    else:
        fail("List Jobs", f"{r.status_code}")

    # ── 12. Webhook Management ──────────────────────────────
    print("\n=== Webhook Management ===")
    r = client.post(f"{BASE}/admin/webhooks", json={
        "url": "https://webhook.site/test-placeholder",
        "events": ["user.created", "enrollment.created"],
        "description": "Integration test webhook",
    }, headers=headers_jwt(token))
    webhook_id = None
    if r.status_code == 201:
        data = r.json()
        webhook_id = data["id"]
        ok(f"Create Webhook (id={webhook_id[:8]}..., events={data['events']})")
    else:
        fail("Create Webhook", f"{r.status_code}: {r.text[:100]}")

    # List webhooks
    r = client.get(f"{BASE}/admin/webhooks", headers=headers_jwt(token))
    if r.status_code == 200:
        ok(f"List Webhooks (count={len(r.json())})")
    else:
        fail("List Webhooks", f"{r.status_code}")

    # Get webhook
    if webhook_id:
        r = client.get(f"{BASE}/admin/webhooks/{webhook_id}", headers=headers_jwt(token))
        if r.status_code == 200:
            ok(f"Get Webhook (url={r.json()['url']})")
        else:
            fail("Get Webhook", f"{r.status_code}")

    # Update webhook
    if webhook_id:
        r = client.patch(f"{BASE}/admin/webhooks/{webhook_id}", json={
            "description": "Updated test webhook",
            "events": ["user.created", "user.updated", "enrollment.created"],
        }, headers=headers_jwt(token))
        if r.status_code == 200:
            ok(f"Update Webhook (events={r.json()['events']})")
        else:
            fail("Update Webhook", f"{r.status_code}: {r.text[:100]}")

    # Test webhook (will fail since URL is fake, but endpoint should work)
    if webhook_id:
        r = client.post(f"{BASE}/admin/webhooks/{webhook_id}/test", headers=headers_jwt(token))
        if r.status_code == 200:
            data = r.json()
            ok(f"Test Webhook (success={data['success']}, delivery_id={data['delivery_id'][:8]}...)")
        else:
            fail("Test Webhook", f"{r.status_code}: {r.text[:100]}")

    # List deliveries
    if webhook_id:
        r = client.get(f"{BASE}/admin/webhooks/{webhook_id}/deliveries", headers=headers_jwt(token))
        if r.status_code == 200:
            data = r.json()
            ok(f"List Deliveries (total={data['total']})")
        else:
            fail("List Deliveries", f"{r.status_code}")

    # ── 13. Revoke API Key ──────────────────────────────────
    print("\n=== Cleanup ===")

    # Delete webhook
    if webhook_id:
        r = client.delete(f"{BASE}/admin/webhooks/{webhook_id}", headers=headers_jwt(token))
        if r.status_code == 204:
            ok("Delete Webhook")
        else:
            fail("Delete Webhook", f"{r.status_code}")

    # Revoke API key
    r = client.delete(f"{BASE}/admin/api-keys/{key_id}", headers=headers_jwt(token))
    if r.status_code == 204:
        ok("Revoke API Key")
    else:
        fail("Revoke API Key", f"{r.status_code}")

    # Verify revoked key is rejected
    r = client.get(f"{BASE}/public/students", headers=headers_api_key(api_key))
    if r.status_code == 401:
        ok("Revoked key -> 401")
    else:
        fail("Revoked key -> 401", f"got {r.status_code}")

    # ── Summary ─────────────────────────────────────────────
    print(f"\n{'='*50}")
    print(f"RESULTS: {passed} passed, {failed} failed")
    print(f"{'='*50}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
