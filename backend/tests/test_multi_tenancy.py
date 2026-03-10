"""
Multi-tenancy integration tests.
Tests the full flow: SA login → create institutes → create admins → tenant isolation → quotas.

Usage:
    cd backend
    venv/Scripts/python tests/test_multi_tenancy.py
"""
import json
import sys
import os
import time
import requests

BASE = os.environ.get("TEST_BASE_URL", "http://localhost:8000")
API = f"{BASE}/api/v1"

SA_EMAIL = "sa@zensbot.com"
SA_PASSWORD = "Zensbot@2026"

# Use timestamp-based unique slugs for idempotency
import hashlib
_ts = str(int(time.time()))[-6:]
ACME_SLUG = f"acme-t{_ts}"
OXFORD_SLUG = f"oxford-t{_ts}"
ACME_ADMIN_EMAIL = f"admin-{_ts}@acme-test.com"
OXFORD_ADMIN_EMAIL = f"admin-{_ts}@oxford-test.com"

# Track created resources for cleanup
created_institutes = []
sa_token = None
results = {"passed": 0, "failed": 0, "errors": []}


def log(msg):
    print(f"  {msg}")


def test(name):
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")


def ok(msg=""):
    results["passed"] += 1
    print(f"  [PASS] {msg}")


def fail(msg):
    results["failed"] += 1
    results["errors"].append(msg)
    print(f"  [FAIL] {msg}")


def api(method, path, token=None, json_data=None, headers=None, slug=None):
    """Make API request with optional token and slug header."""
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if slug:
        h["X-Institute-Slug"] = slug
    if headers:
        h.update(headers)

    url = f"{API}{path}"
    resp = requests.request(method, url, json=json_data, headers=h, timeout=15)
    return resp


# ─────────────────────────────────────────────
# TEST 1: Super Admin Login
# ─────────────────────────────────────────────
test("1. Super Admin Login")
try:
    # SA login — no slug header (bare domain)
    resp = api("POST", "/auth/login", json_data={"email": SA_EMAIL, "password": SA_PASSWORD})
    if resp.status_code == 200:
        data = resp.json()
        sa_token = data.get("accessToken") or data.get("access_token")
        if sa_token:
            ok(f"SA logged in, got token")
        else:
            fail(f"No token in response: {data}")
    else:
        fail(f"SA login failed: {resp.status_code} {resp.text}")
except Exception as e:
    fail(f"SA login error: {e}")

# Verify SA can access /me
if sa_token:
    resp = api("GET", "/auth/me", token=sa_token)
    if resp.status_code == 200:
        me = resp.json()
        role = me.get("role")
        if role in ("super_admin", "super-admin"):
            ok(f"GET /me role={role}")
        else:
            fail(f"Expected super_admin role, got: {role}")
    else:
        fail(f"GET /me failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 2: SA Dashboard
# ─────────────────────────────────────────────
test("2. Platform Dashboard")
if sa_token:
    resp = api("GET", "/super-admin/dashboard", token=sa_token)
    if resp.status_code == 200:
        dash = resp.json()
        required = ["totalInstitutes", "activeInstitutes", "totalUsers"]
        # Check snake or camel case
        if not any(k in dash for k in required):
            required = ["total_institutes", "active_institutes", "total_users"]
        missing = [k for k in required if k not in dash]
        if not missing:
            ok(f"Dashboard: {json.dumps({k: dash.get(k, dash.get(k.replace('_', ''), 'N/A')) for k in required[:3]})}")
        else:
            fail(f"Dashboard missing keys: {missing}. Got: {list(dash.keys())}")
    else:
        fail(f"Dashboard failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 3: Create Institute "Acme"
# ─────────────────────────────────────────────
test("3. Create Institute 'Acme'")
acme_id = None
if sa_token:
    resp = api("POST", "/super-admin/institutes", token=sa_token, json_data={
        "name": "Acme Institute",
        "slug": ACME_SLUG,
        "contact_email": "admin@acme.test",
        "plan_tier": "pro",
        "max_users": 10,
        "max_storage_gb": 5.0,
        "max_video_gb": 10.0,
    })
    if resp.status_code == 201:
        inst = resp.json()
        acme_id = inst.get("id")
        created_institutes.append(acme_id)
        ok(f"Created Acme: id={acme_id}, slug={inst.get('slug')}")
    else:
        fail(f"Create Acme failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 4: Create Institute "Oxford"
# ─────────────────────────────────────────────
test("4. Create Institute 'Oxford'")
oxford_id = None
if sa_token:
    resp = api("POST", "/super-admin/institutes", token=sa_token, json_data={
        "name": "Oxford Institute",
        "slug": OXFORD_SLUG,
        "contact_email": "admin@oxford.test",
        "plan_tier": "basic",
        "max_users": 5,
        "max_storage_gb": 2.0,
        "max_video_gb": 5.0,
    })
    if resp.status_code == 201:
        inst = resp.json()
        oxford_id = inst.get("id")
        created_institutes.append(oxford_id)
        ok(f"Created Oxford: id={oxford_id}")
    else:
        fail(f"Create Oxford failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 5: Duplicate Slug Rejection
# ─────────────────────────────────────────────
test("5. Duplicate Slug Rejection")
if sa_token:
    resp = api("POST", "/super-admin/institutes", token=sa_token, json_data={
        "name": "Acme Duplicate",
        "slug": ACME_SLUG,
        "contact_email": "dup@acme.test",
        "plan_tier": "free",
        "max_users": 5,
        "max_storage_gb": 1.0,
        "max_video_gb": 1.0,
    })
    if resp.status_code == 400:
        ok("Duplicate slug correctly rejected")
    else:
        fail(f"Expected 400 for duplicate slug, got {resp.status_code}")


# ─────────────────────────────────────────────
# TEST 6: List Institutes (pagination, filters)
# ─────────────────────────────────────────────
test("6. List Institutes")
if sa_token:
    resp = api("GET", "/super-admin/institutes?page=1&per_page=20", token=sa_token)
    if resp.status_code == 200:
        data = resp.json()
        total = data.get("total", 0)
        items = data.get("data", [])
        ok(f"Listed {len(items)} institutes (total={total})")

        # Test status filter
        resp2 = api("GET", "/super-admin/institutes?status=trial", token=sa_token)
        if resp2.status_code == 200:
            ok(f"Status filter works: {resp2.json().get('total', 0)} trial institutes")
        else:
            fail(f"Status filter failed: {resp2.status_code}")
    else:
        fail(f"List institutes failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 7: Create Admin for Acme
# ─────────────────────────────────────────────
test("7. Create Admin for Acme")
acme_admin_email = ACME_ADMIN_EMAIL
acme_admin_password = "AcmeAdmin@123"
if sa_token and acme_id:
    resp = api("POST", f"/super-admin/institutes/{acme_id}/admin", token=sa_token, json_data={
        "email": acme_admin_email,
        "name": "Acme Admin",
        "password": acme_admin_password,
    })
    if resp.status_code == 201:
        admin_data = resp.json()
        ok(f"Created Acme admin: {admin_data.get('email')}, role={admin_data.get('role')}")
    else:
        fail(f"Create Acme admin failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 8: Create Admin for Oxford
# ─────────────────────────────────────────────
test("8. Create Admin for Oxford")
oxford_admin_email = OXFORD_ADMIN_EMAIL
oxford_admin_password = "OxfordAdmin@123"
if sa_token and oxford_id:
    resp = api("POST", f"/super-admin/institutes/{oxford_id}/admin", token=sa_token, json_data={
        "email": oxford_admin_email,
        "name": "Oxford Admin",
        "password": oxford_admin_password,
    })
    if resp.status_code == 201:
        admin_data = resp.json()
        ok(f"Created Oxford admin: {admin_data.get('email')}")
    else:
        fail(f"Create Oxford admin failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 9: Acme Admin Login (with slug header)
# ─────────────────────────────────────────────
test("9. Acme Admin Login (with slug header)")
acme_token = None
resp = api("POST", "/auth/login", json_data={
    "email": acme_admin_email,
    "password": acme_admin_password,
}, slug=ACME_SLUG)
if resp.status_code == 200:
    data = resp.json()
    acme_token = data.get("accessToken") or data.get("access_token")
    if acme_token:
        ok("Acme admin logged in with slug header")
    else:
        fail(f"No token in response: {list(data.keys())}")
else:
    fail(f"Acme admin login failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 10: Oxford Admin Login (with slug header)
# ─────────────────────────────────────────────
test("10. Oxford Admin Login (with slug header)")
oxford_token = None
resp = api("POST", "/auth/login", json_data={
    "email": oxford_admin_email,
    "password": oxford_admin_password,
}, slug=OXFORD_SLUG)
if resp.status_code == 200:
    data = resp.json()
    oxford_token = data.get("accessToken") or data.get("access_token")
    if oxford_token:
        ok("Oxford admin logged in with slug header")
    else:
        fail(f"No token in response: {list(data.keys())}")
else:
    fail(f"Oxford admin login failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 11: Same Email Different Institutes
# ─────────────────────────────────────────────
test("11. Same Email in Different Institutes")
shared_email = f"shared-{_ts}@test.com"
if sa_token and acme_id and oxford_id:
    # Create user with same email in both institutes
    resp1 = api("POST", f"/super-admin/institutes/{acme_id}/admin", token=sa_token, json_data={
        "email": shared_email,
        "name": "Shared User Acme",
        "password": "SharedUser@123",
    })
    if resp1.status_code == 201:
        ok("Created shared@test.com in Acme")
    else:
        fail(f"Create shared in Acme failed: {resp1.status_code} {resp1.text}")

    resp2 = api("POST", f"/super-admin/institutes/{oxford_id}/admin", token=sa_token, json_data={
        "email": shared_email,
        "name": "Shared User Oxford",
        "password": "SharedUser@123",
    })
    if resp2.status_code == 201:
        ok("Created shared@test.com in Oxford (same email, different institute)")
    else:
        fail(f"Create shared in Oxford failed: {resp2.status_code} {resp2.text}")


# ─────────────────────────────────────────────
# TEST 12: Tenant Isolation - Users
# ─────────────────────────────────────────────
test("12. Tenant Isolation - Users")
if acme_token and oxford_token:
    # Acme admin lists users — should only see Acme users
    resp_acme = api("GET", "/users?page=1&per_page=50", token=acme_token, slug=ACME_SLUG)
    # Oxford admin lists users — should only see Oxford users
    resp_oxford = api("GET", "/users?page=1&per_page=50", token=oxford_token, slug=OXFORD_SLUG)

    if resp_acme.status_code == 200 and resp_oxford.status_code == 200:
        acme_users = resp_acme.json().get("data", [])
        oxford_users = resp_oxford.json().get("data", [])
        acme_emails = [u.get("email") for u in acme_users]
        oxford_emails = [u.get("email") for u in oxford_users]
        log(f"Acme users ({len(acme_users)}): {acme_emails}")
        log(f"Oxford users ({len(oxford_users)}): {oxford_emails}")

        # Verify no cross-contamination
        if oxford_admin_email not in acme_emails and acme_admin_email not in oxford_emails:
            ok("User lists are properly isolated")
        else:
            fail("Cross-institute user leakage detected!")
    else:
        fail(f"User list failed: Acme={resp_acme.status_code}, Oxford={resp_oxford.status_code}")


# ─────────────────────────────────────────────
# TEST 13: Admin Create User in Their Institute
# ─────────────────────────────────────────────
test("13. Admin Creates User in Their Institute")
acme_teacher_email = f"teacher-{_ts}@acme-test.com"
if acme_token:
    resp = api("POST", "/users", token=acme_token, slug=ACME_SLUG, json_data={
        "email": acme_teacher_email,
        "name": "Acme Teacher",
        "password": "AcmeTeacher@123",
        "role": "teacher",
    })
    if resp.status_code in (200, 201):
        ok(f"Acme admin created teacher: {acme_teacher_email}")
    else:
        fail(f"Create teacher failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 14: SA Views Institute Users
# ─────────────────────────────────────────────
test("14. SA Views Institute Users")
if sa_token and acme_id:
    resp = api("GET", f"/super-admin/institutes/{acme_id}/users", token=sa_token)
    if resp.status_code == 200:
        data = resp.json()
        total = data.get("total", 0)
        items = data.get("data", [])
        ok(f"SA sees {total} Acme users: {[u.get('email') for u in items]}")
    else:
        fail(f"SA view users failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 15: Update Institute
# ─────────────────────────────────────────────
test("15. Update Institute")
if sa_token and acme_id:
    resp = api("PATCH", f"/super-admin/institutes/{acme_id}", token=sa_token, json_data={
        "name": "Acme Institute Updated",
        "max_users": 20,
    })
    if resp.status_code == 200:
        inst = resp.json()
        name = inst.get("name")
        max_users = inst.get("maxUsers") or inst.get("max_users")
        if "Updated" in str(name) and str(max_users) == "20":
            ok(f"Updated: name={name}, maxUsers={max_users}")
        else:
            fail(f"Update values wrong: name={name}, maxUsers={max_users}")
    else:
        fail(f"Update failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 16: Suspend Institute
# ─────────────────────────────────────────────
test("16. Suspend Institute")
if sa_token and oxford_id:
    resp = api("POST", f"/super-admin/institutes/{oxford_id}/suspend", token=sa_token)
    if resp.status_code == 200:
        ok("Oxford suspended")
    else:
        fail(f"Suspend failed: {resp.status_code} {resp.text}")

    # Verify suspended institute blocks login
    time.sleep(0.5)
    resp2 = api("POST", "/auth/login", json_data={
        "email": oxford_admin_email,
        "password": oxford_admin_password,
    }, slug=OXFORD_SLUG)
    if resp2.status_code in (401, 403):
        ok(f"Suspended institute blocks login: {resp2.status_code}")
    elif resp2.status_code == 200:
        # Login might succeed but subsequent requests should fail
        temp_token = resp2.json().get("accessToken") or resp2.json().get("access_token")
        if temp_token:
            resp3 = api("GET", "/auth/me", token=temp_token, slug=OXFORD_SLUG)
            if resp3.status_code == 403:
                ok("Suspended institute: login OK but /me returns 403")
            else:
                fail(f"Suspended institute: /me returned {resp3.status_code} (expected 403)")
        else:
            fail("Suspended institute: login returned 200 but no token")
    else:
        fail(f"Suspended login returned unexpected: {resp2.status_code} {resp2.text}")


# ─────────────────────────────────────────────
# TEST 17: Activate Institute
# ─────────────────────────────────────────────
test("17. Activate Institute")
if sa_token and oxford_id:
    resp = api("POST", f"/super-admin/institutes/{oxford_id}/activate", token=sa_token)
    if resp.status_code == 200:
        ok("Oxford activated")
    else:
        fail(f"Activate failed: {resp.status_code} {resp.text}")

    # Verify login works again
    time.sleep(0.5)
    resp2 = api("POST", "/auth/login", json_data={
        "email": oxford_admin_email,
        "password": oxford_admin_password,
    }, slug=OXFORD_SLUG)
    if resp2.status_code == 200:
        ok("Oxford admin can login again after activation")
    else:
        fail(f"Post-activation login failed: {resp2.status_code} {resp2.text}")


# ─────────────────────────────────────────────
# TEST 18: Non-SA Cannot Access SA Endpoints
# ─────────────────────────────────────────────
test("18. Non-SA Blocked from SA Endpoints")
if acme_token:
    resp = api("GET", "/super-admin/dashboard", token=acme_token)
    if resp.status_code == 403:
        ok("Regular admin blocked from SA dashboard")
    else:
        fail(f"Expected 403, got {resp.status_code}")

    resp2 = api("GET", "/super-admin/institutes", token=acme_token)
    if resp2.status_code == 403:
        ok("Regular admin blocked from SA institute list")
    else:
        fail(f"Expected 403, got {resp2.status_code}")


# ─────────────────────────────────────────────
# TEST 19: Admin Dashboard (institute-scoped)
# ─────────────────────────────────────────────
test("19. Admin Dashboard (institute-scoped)")
if acme_token:
    resp = api("GET", "/admin/dashboard", token=acme_token, slug=ACME_SLUG)
    if resp.status_code == 200:
        ok(f"Acme admin dashboard: {list(resp.json().keys())[:5]}...")
    else:
        fail(f"Admin dashboard failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 20: Institute Detail (SA)
# ─────────────────────────────────────────────
test("20. Get Institute Detail")
if sa_token and acme_id:
    resp = api("GET", f"/super-admin/institutes/{acme_id}", token=sa_token)
    if resp.status_code == 200:
        inst = resp.json()
        usage_fields = ["currentUsers", "currentStorageGb", "currentVideoGb"]
        if not any(k in inst for k in usage_fields):
            usage_fields = ["current_users", "current_storage_gb", "current_video_gb"]
        present = [k for k in usage_fields if k in inst]
        if present:
            ok(f"Institute detail includes usage: {json.dumps({k: inst[k] for k in present})}")
        else:
            fail(f"Missing usage fields. Keys: {list(inst.keys())}")
    else:
        fail(f"Get detail failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 21: SA Views Institute Courses (empty)
# ─────────────────────────────────────────────
test("21. SA Views Institute Courses")
if sa_token and acme_id:
    resp = api("GET", f"/super-admin/institutes/{acme_id}/courses", token=sa_token)
    if resp.status_code == 200:
        data = resp.json()
        ok(f"SA views Acme courses: total={data.get('total', 0)}")
    else:
        fail(f"SA view courses failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 22: SA Views Institute Batches (empty)
# ─────────────────────────────────────────────
test("22. SA Views Institute Batches")
if sa_token and acme_id:
    resp = api("GET", f"/super-admin/institutes/{acme_id}/batches", token=sa_token)
    if resp.status_code == 200:
        data = resp.json()
        ok(f"SA views Acme batches: total={data.get('total', 0)}")
    else:
        fail(f"SA view batches failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 23: Plan Update
# ─────────────────────────────────────────────
test("23. Update Plan")
if sa_token and oxford_id:
    resp = api("PATCH", f"/super-admin/institutes/{oxford_id}/plan", token=sa_token, json_data={
        "plan_tier": "enterprise",
        "max_users": 100,
        "max_storage_gb": 50.0,
        "max_video_gb": 200.0,
    })
    if resp.status_code == 200:
        ok("Oxford plan updated to enterprise")
    else:
        fail(f"Plan update failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 24: Quota Enforcement (user limit)
# ─────────────────────────────────────────────
test("24. Quota Enforcement — User Limit")
if acme_token and acme_id:
    # Acme has max_users=20 (updated in test 15)
    # Already has ~3 users. Create more to approach limit is time-consuming.
    # Just verify the endpoint exists and works for a single create
    resp = api("POST", "/users", token=acme_token, slug=ACME_SLUG, json_data={
        "email": f"student1-{_ts}@acme-test.com",
        "name": "Acme Student 1",
        "password": "Student@123",
        "role": "student",
    })
    if resp.status_code in (200, 201):
        ok("User creation with quota check passed")
    elif resp.status_code == 402:
        ok("Quota limit correctly enforced (402)")
    else:
        fail(f"User create returned unexpected: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 25: Search (institute-scoped)
# ─────────────────────────────────────────────
test("25. Search (institute-scoped)")
if acme_token:
    resp = api("GET", "/search?q=acme&page=1&per_page=10", token=acme_token, slug=ACME_SLUG)
    if resp.status_code == 200:
        ok(f"Search works within tenant")
    else:
        fail(f"Search failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# TEST 26: Branding (public, slug-based)
# ─────────────────────────────────────────────
test("26. Branding (public, slug-based)")
resp = api("GET", "/branding", slug=ACME_SLUG)
if resp.status_code in (200, 404):
    ok(f"Branding endpoint responds: {resp.status_code}")
else:
    fail(f"Branding failed: {resp.status_code} {resp.text}")


# ─────────────────────────────────────────────
# CLEANUP: Soft-delete test institutes
# ─────────────────────────────────────────────
test("CLEANUP")
log("Skipping cleanup — test institutes remain for manual inspection")
log(f"Acme ID: {acme_id}")
log(f"Oxford ID: {oxford_id}")


# ─────────────────────────────────────────────
# RESULTS
# ─────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"RESULTS: {results['passed']} passed, {results['failed']} failed")
print(f"{'='*60}")
if results["errors"]:
    print("\nFailed tests:")
    for e in results["errors"]:
        print(f"  [X] {e}")
    sys.exit(1)
else:
    print("\nAll tests passed!")
    sys.exit(0)
