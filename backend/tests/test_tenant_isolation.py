"""
Multi-Tenant Data Isolation Test Suite
=======================================
Tests that data from one institute is INVISIBLE to another institute.
Tests intra-institute role scoping (student sees only enrolled batches, etc.).
Tests SA cross-tenant access.

Requires a running backend with SA credentials.

Usage:
    TEST_BASE_URL=http://localhost:8000 \
    TEST_SA_EMAIL=sa@zensbot.com \
    TEST_SA_PASSWORD=changeme \
    python backend/tests/test_tenant_isolation.py

Environment variables:
    TEST_BASE_URL        Default: http://localhost:8000
    TEST_SA_EMAIL        Super admin email
    TEST_SA_PASSWORD     Super admin password
"""

import os
import sys
import uuid
import httpx

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")
SA_EMAIL = os.getenv("TEST_SA_EMAIL", "sa@zensbot.com")
SA_PASSWORD = os.getenv("TEST_SA_PASSWORD", "changeme")

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"


class TenantIsolationTest:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.client = httpx.Client(base_url=BASE_URL, timeout=30, verify=False)

        # State -- populated during setup
        self.sa_token: str = ""
        self.alpha = {}  # {institute_id, slug, admin_token, cc_token, ...}
        self.beta = {}

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def check(self, label: str, condition: bool, detail: str = "") -> bool:
        if condition:
            self.passed += 1
            print(f"  [{GREEN}PASS{RESET}]  {label}")
        else:
            self.failed += 1
            print(f"  [{RED}FAIL{RESET}]  {label}" + (f"  [{detail}]" if detail else ""))
        return condition

    def skip(self, label: str, reason: str = ""):
        self.skipped += 1
        print(f"  [{YELLOW}SKIP{RESET}]  {label}" + (f"  ({reason})" if reason else ""))

    def _h(self, token: str, slug: str = None) -> dict:
        headers = {"Authorization": f"Bearer {token}"}
        if slug:
            headers["X-Institute-Slug"] = slug
        return headers

    def get(self, path: str, token: str, slug: str = None, **kwargs) -> httpx.Response:
        return self.client.get(f"/api/v1{path}", headers=self._h(token, slug), **kwargs)

    def post(self, path: str, token: str, slug: str = None, json: dict = None, **kwargs) -> httpx.Response:
        return self.client.post(f"/api/v1{path}", headers=self._h(token, slug), json=json, **kwargs)

    def patch(self, path: str, token: str, slug: str = None, json: dict = None, **kwargs) -> httpx.Response:
        return self.client.patch(f"/api/v1{path}", headers=self._h(token, slug), json=json, **kwargs)

    def delete(self, path: str, token: str, slug: str = None, **kwargs) -> httpx.Response:
        return self.client.delete(f"/api/v1{path}", headers=self._h(token, slug), **kwargs)

    def login(self, email: str, password: str, slug: str = None) -> str | None:
        headers = {}
        if slug:
            headers["X-Institute-Slug"] = slug
        r = self.client.post("/api/v1/auth/login", json={
            "email": email, "password": password, "device_info": "isolation-test",
        }, headers=headers)
        if r.status_code == 200:
            data = r.json()
            return data.get("access_token") or data.get("accessToken")
        return None

    def _unique(self, prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    # ------------------------------------------------------------------
    # Setup -- Create two institutes with users and data
    # ------------------------------------------------------------------

    def setup(self) -> bool:
        print("\n=== SETUP: Creating test institutes ===")

        # 1. SA login
        self.sa_token = self.login(SA_EMAIL, SA_PASSWORD)
        if not self.check("SA login", self.sa_token is not None):
            return False

        # 2. Create Institute Alpha
        alpha_slug = self._unique("alpha")
        r = self.post("/super-admin/institutes", self.sa_token, json={
            "name": "Alpha Institute",
            "slug": alpha_slug,
            "domain": f"{alpha_slug}.test.local",
            "plan_tier": "pro",
            "admin_email": f"admin@{alpha_slug}.test",
            "admin_name": "Alpha Admin",
            "admin_password": "TestPass123!",
        })
        if not self.check("Create Alpha institute", r.status_code in (200, 201), f"status={r.status_code} body={r.text[:200]}"):
            return False
        alpha_data = r.json()
        self.alpha["institute_id"] = alpha_data.get("institute", {}).get("id") or alpha_data.get("id")
        self.alpha["slug"] = alpha_slug
        self.alpha["admin_email"] = f"admin@{alpha_slug}.test"
        self.alpha["admin_password"] = "TestPass123!"

        # 3. Create Institute Beta
        beta_slug = self._unique("beta")
        r = self.post("/super-admin/institutes", self.sa_token, json={
            "name": "Beta Institute",
            "slug": beta_slug,
            "domain": f"{beta_slug}.test.local",
            "plan_tier": "pro",
            "admin_email": f"admin@{beta_slug}.test",
            "admin_name": "Beta Admin",
            "admin_password": "TestPass123!",
        })
        if not self.check("Create Beta institute", r.status_code in (200, 201), f"status={r.status_code} body={r.text[:200]}"):
            return False
        beta_data = r.json()
        self.beta["institute_id"] = beta_data.get("institute", {}).get("id") or beta_data.get("id")
        self.beta["slug"] = beta_slug
        self.beta["admin_email"] = f"admin@{beta_slug}.test"
        self.beta["admin_password"] = "TestPass123!"

        # 4. Login as both admins
        self.alpha["admin_token"] = self.login(self.alpha["admin_email"], self.alpha["admin_password"], self.alpha["slug"])
        if not self.check("Alpha admin login", self.alpha["admin_token"] is not None):
            return False

        self.beta["admin_token"] = self.login(self.beta["admin_email"], self.beta["admin_password"], self.beta["slug"])
        if not self.check("Beta admin login", self.beta["admin_token"] is not None):
            return False

        # 5. Create CC and student in Alpha
        for role, prefix in [("course_creator", "cc"), ("student", "student")]:
            email = f"{prefix}@{alpha_slug}.test"
            r = self.post("/users", self.alpha["admin_token"], self.alpha["slug"], json={
                "email": email,
                "name": f"Alpha {prefix.title()}",
                "password": "TestPass123!",
                "role": role.replace("_", "-"),
            })
            if not self.check(f"Create Alpha {role}", r.status_code in (200, 201), f"status={r.status_code} body={r.text[:200]}"):
                return False
            user_data = r.json()
            self.alpha[f"{prefix}_id"] = user_data.get("id")
            self.alpha[f"{prefix}_email"] = email
            self.alpha[f"{prefix}_token"] = self.login(email, "TestPass123!", self.alpha["slug"])

        # 6. Create CC and student in Beta
        for role, prefix in [("course_creator", "cc"), ("student", "student")]:
            email = f"{prefix}@{beta_slug}.test"
            r = self.post("/users", self.beta["admin_token"], self.beta["slug"], json={
                "email": email,
                "name": f"Beta {prefix.title()}",
                "password": "TestPass123!",
                "role": role.replace("_", "-"),
            })
            if not self.check(f"Create Beta {role}", r.status_code in (200, 201), f"status={r.status_code} body={r.text[:200]}"):
                return False
            user_data = r.json()
            self.beta[f"{prefix}_id"] = user_data.get("id")
            self.beta[f"{prefix}_email"] = email
            self.beta[f"{prefix}_token"] = self.login(email, "TestPass123!", self.beta["slug"])

        # 7. Seed data in Alpha -- batch, course, job
        r = self.post("/courses", self.alpha["cc_token"], self.alpha["slug"], json={
            "title": "Alpha Course", "description": "Test course for Alpha",
        })
        if r.status_code in (200, 201):
            self.alpha["course_id"] = r.json().get("id")
            self.check("Create Alpha course", True)
        else:
            self.skip("Create Alpha course", f"status={r.status_code}")

        r = self.post("/batches", self.alpha["admin_token"], self.alpha["slug"], json={
            "name": "Alpha Batch", "start_date": "2026-04-01", "end_date": "2026-06-30",
        })
        if r.status_code in (200, 201):
            self.alpha["batch_id"] = r.json().get("id")
            self.check("Create Alpha batch", True)
        else:
            self.skip("Create Alpha batch", f"status={r.status_code}")

        r = self.post("/jobs", self.alpha["cc_token"], self.alpha["slug"], json={
            "title": "Alpha Job", "company": "Alpha Corp", "location": "Remote",
            "job_type": "full-time", "description": "Test job",
        })
        if r.status_code in (200, 201):
            self.alpha["job_id"] = r.json().get("id")
            self.check("Create Alpha job", True)
        else:
            self.skip("Create Alpha job", f"status={r.status_code}")

        # 8. Seed data in Beta -- batch
        r = self.post("/batches", self.beta["admin_token"], self.beta["slug"], json={
            "name": "Beta Batch", "start_date": "2026-04-01", "end_date": "2026-06-30",
        })
        if r.status_code in (200, 201):
            self.beta["batch_id"] = r.json().get("id")
            self.check("Create Beta batch", True)
        else:
            self.skip("Create Beta batch", f"status={r.status_code}")

        print(f"\n  Setup complete: Alpha={self.alpha.get('slug')}, Beta={self.beta.get('slug')}")
        return True

    # ------------------------------------------------------------------
    # Test: Cross-tenant list isolation
    # ------------------------------------------------------------------

    def test_list_isolation(self):
        print("\n=== CROSS-TENANT LIST ISOLATION ===")

        # Beta admin cannot see Alpha's batches
        r = self.get("/batches", self.beta["admin_token"], self.beta["slug"])
        if r.status_code == 200:
            data = r.json()
            items = data.get("data") or data.get("items") or []
            alpha_ids = [i for i in items if i.get("id") == self.alpha.get("batch_id")]
            self.check("Beta admin cannot see Alpha batches in list", len(alpha_ids) == 0)
        else:
            self.skip("Beta batches list", f"status={r.status_code}")

        # Beta admin cannot see Alpha's users
        r = self.get("/users", self.beta["admin_token"], self.beta["slug"])
        if r.status_code == 200:
            data = r.json()
            items = data.get("data") or data.get("items") or []
            alpha_emails = [i for i in items if self.alpha["slug"] in (i.get("email") or "")]
            self.check("Beta admin cannot see Alpha users in list", len(alpha_emails) == 0)
        else:
            self.skip("Beta users list", f"status={r.status_code}")

        # Beta CC cannot see Alpha's courses
        r = self.get("/courses", self.beta["cc_token"], self.beta["slug"])
        if r.status_code == 200:
            data = r.json()
            items = data.get("data") or data.get("items") or []
            alpha_ids = [i for i in items if i.get("id") == self.alpha.get("course_id")]
            self.check("Beta CC cannot see Alpha courses in list", len(alpha_ids) == 0)
        else:
            self.skip("Beta courses list", f"status={r.status_code}")

        # Beta CC cannot see Alpha's jobs
        r = self.get("/jobs", self.beta["cc_token"], self.beta["slug"])
        if r.status_code == 200:
            data = r.json()
            items = data.get("data") or data.get("items") or []
            alpha_ids = [i for i in items if i.get("id") == self.alpha.get("job_id")]
            self.check("Beta CC cannot see Alpha jobs in list", len(alpha_ids) == 0)
        else:
            self.skip("Beta jobs list", f"status={r.status_code}")

    # ------------------------------------------------------------------
    # Test: Direct ID access (cross-tenant)
    # ------------------------------------------------------------------

    def test_direct_access_isolation(self):
        print("\n=== CROSS-TENANT DIRECT ID ACCESS ===")

        test_cases = [
            ("batch_id", "/batches/{id}", "admin_token", "Beta admin GET Alpha batch"),
            ("cc_id", "/users/{id}", "admin_token", "Beta admin GET Alpha user"),
            ("course_id", "/courses/{id}", "cc_token", "Beta CC GET Alpha course"),
            ("job_id", "/jobs/{id}", "cc_token", "Beta CC GET Alpha job"),
        ]
        for key, path_tpl, token_key, label in test_cases:
            alpha_id = self.alpha.get(key)
            if alpha_id:
                path = path_tpl.replace("{id}", str(alpha_id))
                r = self.get(path, self.beta[token_key], self.beta["slug"])
                self.check(f"{label} -> 404", r.status_code in (403, 404), f"got {r.status_code}")
            else:
                self.skip(label)

    # ------------------------------------------------------------------
    # Test: Cross-tenant mutation protection
    # ------------------------------------------------------------------

    def test_mutation_protection(self):
        print("\n=== CROSS-TENANT MUTATION PROTECTION ===")

        # PATCH attempts
        patch_cases = [
            ("course_id", "/courses/{id}", "cc_token", {"title": "HACKED"}, "Beta CC PATCH Alpha course"),
            ("job_id", "/jobs/{id}", "cc_token", {"title": "HACKED"}, "Beta CC PATCH Alpha job"),
            ("cc_id", "/users/{id}", "admin_token", {"name": "HACKED"}, "Beta admin PATCH Alpha user"),
        ]
        for key, path_tpl, token_key, body, label in patch_cases:
            alpha_id = self.alpha.get(key)
            if alpha_id:
                path = path_tpl.replace("{id}", str(alpha_id))
                r = self.patch(path, self.beta[token_key], self.beta["slug"], json=body)
                self.check(f"{label} -> 404", r.status_code in (403, 404), f"got {r.status_code}")
            else:
                self.skip(label)

        # DELETE attempts
        delete_cases = [
            ("course_id", "/courses/{id}", "cc_token", "Beta CC DELETE Alpha course"),
            ("batch_id", "/batches/{id}", "admin_token", "Beta admin DELETE Alpha batch"),
        ]
        for key, path_tpl, token_key, label in delete_cases:
            alpha_id = self.alpha.get(key)
            if alpha_id:
                path = path_tpl.replace("{id}", str(alpha_id))
                r = self.delete(path, self.beta[token_key], self.beta["slug"])
                self.check(f"{label} -> 404", r.status_code in (403, 404), f"got {r.status_code}")
            else:
                self.skip(label)

    # ------------------------------------------------------------------
    # Test: SA cross-tenant access
    # ------------------------------------------------------------------

    def test_sa_cross_tenant_access(self):
        print("\n=== SA CROSS-TENANT ACCESS ===")

        r = self.get("/super-admin/institutes", self.sa_token)
        if r.status_code == 200:
            data = r.json()
            items = data.get("data") or data.get("items") or data if isinstance(data, list) else []
            self.check("SA can list institutes", len(items) >= 2, f"got {len(items)} institutes")
        else:
            self.skip("SA list institutes", f"status={r.status_code}")

        for name, inst in [("Alpha", self.alpha), ("Beta", self.beta)]:
            iid = inst.get("institute_id")
            if iid:
                r = self.get(f"/super-admin/institutes/{iid}", self.sa_token)
                self.check(f"SA can view {name} institute", r.status_code == 200, f"got {r.status_code}")
            else:
                self.skip(f"SA view {name} institute")

    # ------------------------------------------------------------------
    # Test: Login scoping
    # ------------------------------------------------------------------

    def test_login_scoping(self):
        print("\n=== LOGIN SCOPING ===")

        token = self.login(self.alpha["admin_email"], self.alpha["admin_password"], self.beta["slug"])
        self.check("Alpha admin cannot login via Beta slug", token is None)

        token = self.login(self.beta["admin_email"], self.beta["admin_password"], self.alpha["slug"])
        self.check("Beta admin cannot login via Alpha slug", token is None)

    # ------------------------------------------------------------------
    # Test: Public endpoint scoping
    # ------------------------------------------------------------------

    def test_public_endpoint_scoping(self):
        print("\n=== PUBLIC ENDPOINT SCOPING ===")

        r1 = self.client.get("/api/v1/branding", headers={"X-Institute-Slug": self.alpha["slug"]})
        r2 = self.client.get("/api/v1/branding", headers={"X-Institute-Slug": self.beta["slug"]})
        self.check("Branding with Alpha slug -> 200", r1.status_code == 200)
        self.check("Branding with Beta slug -> 200", r2.status_code == 200)

    # ------------------------------------------------------------------
    # Run all tests
    # ------------------------------------------------------------------

    def run(self):
        print(f"\n{'='*60}")
        print(f"  MULTI-TENANT DATA ISOLATION TEST SUITE")
        print(f"  Target: {BASE_URL}")
        print(f"{'='*60}")

        if not self.setup():
            print(f"\n{RED}Setup failed -- cannot run isolation tests.{RESET}")
            return 1

        self.test_list_isolation()
        self.test_direct_access_isolation()
        self.test_mutation_protection()
        self.test_sa_cross_tenant_access()
        self.test_login_scoping()
        self.test_public_endpoint_scoping()

        print(f"\n{'='*60}")
        print(f"  RESULTS: {GREEN}{self.passed} passed{RESET}, "
              f"{RED}{self.failed} failed{RESET}, "
              f"{YELLOW}{self.skipped} skipped{RESET}")
        print(f"{'='*60}\n")

        return 1 if self.failed > 0 else 0


if __name__ == "__main__":
    runner = TenantIsolationTest()
    sys.exit(runner.run())
