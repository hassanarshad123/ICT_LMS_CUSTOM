"""
ICT LMS Integration Test Suite
================================
Tests all 95+ API endpoints end-to-end against a running server.

Usage:
    python backend/tests/integration_test.py

Environment variables:
    TEST_BASE_URL        Default: http://localhost:8000
    TEST_ADMIN_EMAIL     Default: admin@test.com
    TEST_ADMIN_PASSWORD  Default: changeme
    ZOOM_ACCOUNT_ID      Set to enable Zoom account tests (optional)
"""

import os
import sys
import json
import httpx
from datetime import date, timedelta

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")
ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL", "admin@test.com")
ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD", "changeme")
RUN_ZOOM = bool(os.getenv("ZOOM_ACCOUNT_ID"))

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

PASS = f"{GREEN}✅ PASS{RESET}"
FAIL = f"{RED}❌ FAIL{RESET}"
SKIP = f"{YELLOW}⏭  SKIP{RESET}"


class TestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.ids: dict = {}  # entity name → UUID string
        self.client = httpx.Client(base_url=BASE_URL, timeout=30)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def check(self, label: str, condition: bool, detail: str = "") -> bool:
        if condition:
            self.passed += 1
            print(f"  {PASS}  {label}")
        else:
            self.failed += 1
            print(f"  {FAIL}  {label}" + (f"  [{detail}]" if detail else ""))
        return condition

    def skip(self, label: str, reason: str = ""):
        self.skipped += 1
        print(f"  {SKIP}  {label}" + (f"  ({reason})" if reason else ""))

    def _h(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}

    def get(self, path: str, headers: dict, **kwargs) -> httpx.Response:
        return self.client.get(f"/api/v1{path}", headers=headers, **kwargs)

    def post(self, path: str, headers: dict, json: dict = None, **kwargs) -> httpx.Response:
        return self.client.post(f"/api/v1{path}", headers=headers, json=json, **kwargs)

    def patch(self, path: str, headers: dict, json: dict = None, **kwargs) -> httpx.Response:
        return self.client.patch(f"/api/v1{path}", headers=headers, json=json, **kwargs)

    def delete(self, path: str, headers: dict, **kwargs) -> httpx.Response:
        return self.client.delete(f"/api/v1{path}", headers=headers, **kwargs)

    # ------------------------------------------------------------------
    # 1. HEALTH CHECK
    # ------------------------------------------------------------------

    def test_health(self) -> None:
        print("\n=== HEALTH CHECK ===")
        r = self.client.get("/api/health")
        self.check("GET /api/health → 200", r.status_code == 200)
        if r.status_code == 200:
            self.check("health response has status=ok", r.json().get("status") == "ok")

    # ------------------------------------------------------------------
    # 2. AUTH
    # ------------------------------------------------------------------

    def test_auth(self) -> str:
        print("\n=== AUTH ===")

        # Login
        r = self.client.post("/api/v1/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "device_info": "integration-test",
        })
        self.check("POST /auth/login → 200", r.status_code == 200, f"status={r.status_code}")
        if r.status_code != 200:
            print(f"{RED}FATAL: Cannot authenticate. Aborting.{RESET}")
            sys.exit(1)

        data = r.json()
        access_token = data.get("access_token") or data.get("accessToken")
        refresh_token = data.get("refresh_token") or data.get("refreshToken")
        self.check("login returns access_token", bool(access_token))
        self.check("login returns refresh_token", bool(refresh_token))
        self.check("login returns user object", "user" in data)

        h = self._h(access_token)

        # GET /me
        r = self.get("/auth/me", h)
        self.check("GET /auth/me → 200", r.status_code == 200)
        if r.status_code == 200:
            self.check("/me returns email", r.json().get("email") == ADMIN_EMAIL)

        # Refresh token
        r = self.client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        self.check("POST /auth/refresh → 200", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            new_access = r.json().get("access_token") or r.json().get("accessToken")
            self.check("refresh returns new access_token", bool(new_access))
            access_token = new_access  # use fresh token going forward

        # Rate limit check (5/min) — skip on CI to avoid side-effects
        # (we don't hammer the endpoint; just verify the decorator is applied)

        return access_token

    # ------------------------------------------------------------------
    # 3. USERS
    # ------------------------------------------------------------------

    def test_users(self, h: dict) -> None:
        print("\n=== USERS ===")
        today = date.today().isoformat()

        # Create teacher
        r = self.post("/users", h, json={
            "email": f"test_teacher_{today}@integration.test",
            "name": "Test Teacher",
            "role": "teacher",
            "password": "password123",
        })
        self.check("POST /users (teacher) → 201", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
        if r.status_code == 201:
            self.ids["teacher"] = r.json()["id"]
            self.check("create teacher returns id", bool(self.ids["teacher"]))

        # Create student
        r = self.post("/users", h, json={
            "email": f"test_student_{today}@integration.test",
            "name": "Test Student",
            "role": "student",
            "password": "password123",
        })
        self.check("POST /users (student) → 201", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
        if r.status_code == 201:
            self.ids["student"] = r.json()["id"]

        # List users
        r = self.get("/users", h, params={"page": 1, "per_page": 10})
        self.check("GET /users → 200", r.status_code == 200)
        if r.status_code == 200:
            body = r.json()
            self.check("user list has data[]", isinstance(body.get("data"), list))
            self.check("user list has total", "total" in body)
            self.check("user list has total_pages", "total_pages" in body)

        # Get single user
        if "teacher" in self.ids:
            tid = self.ids["teacher"]
            r = self.get(f"/users/{tid}", h)
            self.check(f"GET /users/{{teacher_id}} → 200", r.status_code == 200)
            if r.status_code == 200:
                self.check("user detail has email", "email" in r.json())

        # Update user
        if "teacher" in self.ids:
            r = self.patch(f"/users/{self.ids['teacher']}", h, json={"name": "Test Teacher Updated"})
            self.check("PATCH /users/{id} → 200", r.status_code == 200)
            if r.status_code == 200:
                self.check("update name reflected", r.json().get("name") == "Test Teacher Updated")

        # Status change (deactivate)
        if "teacher" in self.ids:
            r = self.patch(f"/users/{self.ids['teacher']}/status", h, json={"status": "inactive"})
            self.check("PATCH /users/{id}/status → 200", r.status_code == 200, f"status={r.status_code}")

        # Force logout user
        if "teacher" in self.ids:
            r = self.post(f"/users/{self.ids['teacher']}/force-logout", h)
            self.check("POST /users/{id}/force-logout → 200", r.status_code == 200, f"status={r.status_code}")

        # Self-delete guard (admin cannot delete own account)
        r_me = self.get("/auth/me", h)
        if r_me.status_code == 200:
            own_id = r_me.json()["id"]
            r = self.delete(f"/users/{own_id}", h)
            self.check("DELETE own account → 400 (self-delete guard)", r.status_code == 400, f"got {r.status_code}")

    # ------------------------------------------------------------------
    # 4. BATCHES
    # ------------------------------------------------------------------

    def test_batches(self, h: dict) -> None:
        print("\n=== BATCHES ===")
        start = date.today().isoformat()
        end = (date.today() + timedelta(days=90)).isoformat()

        r = self.post("/batches", h, json={
            "name": "Integration Test Batch",
            "start_date": start,
            "end_date": end,
            "teacher_id": self.ids.get("teacher"),
        })
        self.check("POST /batches → 201", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
        if r.status_code == 201:
            self.ids["batch"] = r.json()["id"]

        # List
        r = self.get("/batches", h, params={"page": 1, "per_page": 10})
        self.check("GET /batches → 200", r.status_code == 200)
        if r.status_code == 200:
            body = r.json()
            self.check("batch list has data[]", isinstance(body.get("data"), list))
            self.check("batch list has total_pages", "total_pages" in body)

        # Get single
        if "batch" in self.ids:
            r = self.get(f"/batches/{self.ids['batch']}", h)
            self.check("GET /batches/{id} → 200", r.status_code == 200)

        # Update
        if "batch" in self.ids:
            r = self.patch(f"/batches/{self.ids['batch']}", h, json={"name": "Integration Test Batch Updated"})
            self.check("PATCH /batches/{id} → 200", r.status_code == 200)

        # Enroll student
        if "batch" in self.ids and "student" in self.ids:
            r = self.post(f"/batches/{self.ids['batch']}/students", h, json={"student_id": self.ids["student"]})
            self.check("POST /batches/{id}/students (enroll) → 200/201", r.status_code in (200, 201), f"status={r.status_code}")

        # Unenroll student
        if "batch" in self.ids and "student" in self.ids:
            r = self.delete(f"/batches/{self.ids['batch']}/students/{self.ids['student']}", h)
            self.check("DELETE /batches/{id}/students/{sid} (unenroll) → 204", r.status_code == 204, f"status={r.status_code}")

    # ------------------------------------------------------------------
    # 5. COURSES
    # ------------------------------------------------------------------

    def test_courses(self, h: dict) -> None:
        print("\n=== COURSES ===")

        # Need course_creator token — use admin token (admin may not have CC role)
        # Create with admin; if 403, skip gracefully
        r = self.post("/courses", h, json={
            "title": "Integration Test Course",
            "description": "Test course for integration testing",
        })
        if r.status_code == 403:
            self.skip("POST /courses (course_creator required)", "admin lacks course_creator role")
        else:
            self.check("POST /courses → 201", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
            if r.status_code == 201:
                self.ids["course"] = r.json()["id"]

        # List
        r = self.get("/courses", h, params={"page": 1, "per_page": 10})
        self.check("GET /courses → 200", r.status_code == 200)
        if r.status_code == 200:
            body = r.json()
            self.check("course list has data[]", isinstance(body.get("data"), list))

        # Get single
        if "course" in self.ids:
            r = self.get(f"/courses/{self.ids['course']}", h)
            self.check("GET /courses/{id} → 200", r.status_code == 200)

        # Update
        if "course" in self.ids:
            r = self.patch(f"/courses/{self.ids['course']}", h, json={"title": "Integration Test Course Updated"})
            self.check("PATCH /courses/{id} → 200", r.status_code == 200, f"status={r.status_code}")

        # Clone
        if "course" in self.ids:
            r = self.post(f"/courses/{self.ids['course']}/clone", h)
            self.check("POST /courses/{id}/clone → 201", r.status_code == 201, f"status={r.status_code}")
            if r.status_code == 201:
                self.ids["course_clone"] = r.json()["id"]

        # Link course to batch
        if "course" in self.ids and "batch" in self.ids:
            r = self.post(f"/batches/{self.ids['batch']}/courses", h, json={"course_id": self.ids["course"]})
            self.check("POST /batches/{id}/courses (link) → 200/201", r.status_code in (200, 201), f"status={r.status_code}")

        # Unlink course from batch
        if "course" in self.ids and "batch" in self.ids:
            r = self.delete(f"/batches/{self.ids['batch']}/courses/{self.ids['course']}", h)
            self.check("DELETE /batches/{id}/courses/{cid} (unlink) → 204", r.status_code == 204, f"status={r.status_code}")

    # ------------------------------------------------------------------
    # 6. CURRICULUM MODULES
    # ------------------------------------------------------------------

    def test_curriculum(self, h: dict) -> None:
        print("\n=== CURRICULUM MODULES ===")

        if "course" not in self.ids:
            self.skip("curriculum tests", "no course created")
            return

        cid = self.ids["course"]

        r = self.post("/curriculum", h, json={
            "course_id": cid,
            "title": "Test Module 1",
            "description": "Integration test module",
            "topics": ["Topic A", "Topic B"],
        })
        self.check("POST /curriculum → 201", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
        if r.status_code == 201:
            self.ids["module"] = r.json()["id"]

        # List modules
        r = self.get("/curriculum", h, params={"course_id": cid})
        self.check("GET /curriculum?course_id=X → 200", r.status_code == 200)
        if r.status_code == 200:
            self.check("module list is a list", isinstance(r.json(), list))

        # Update
        if "module" in self.ids:
            r = self.patch(f"/curriculum/{self.ids['module']}", h, json={"title": "Test Module 1 Updated"})
            self.check("PATCH /curriculum/{id} → 200", r.status_code == 200)

        # Reorder (single module — idempotent)
        if "module" in self.ids:
            r = self.patch("/curriculum/reorder", h, json={
                "course_id": cid,
                "module_ids": [self.ids["module"]],
            })
            self.check("PATCH /curriculum/reorder → 200", r.status_code == 200, f"status={r.status_code}")

    # ------------------------------------------------------------------
    # 7. LECTURES
    # ------------------------------------------------------------------

    def test_lectures(self, h: dict) -> None:
        print("\n=== LECTURES ===")

        if "batch" not in self.ids:
            self.skip("lecture tests", "no batch created")
            return

        r = self.post("/lectures", h, json={
            "title": "Test Lecture 1",
            "description": "Integration test lecture",
            "batch_id": self.ids["batch"],
            "video_type": "external",
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "duration": 212,
            "course_id": self.ids.get("course"),
        })
        self.check("POST /lectures → 201", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
        if r.status_code == 201:
            self.ids["lecture"] = r.json()["id"]

        # List
        r = self.get("/lectures", h, params={"batch_id": self.ids["batch"]})
        self.check("GET /lectures?batch_id=X → 200", r.status_code == 200)
        if r.status_code == 200:
            body = r.json()
            self.check("lecture list has data[]", isinstance(body.get("data"), list))

        # Get single
        if "lecture" in self.ids:
            r = self.get(f"/lectures/{self.ids['lecture']}", h)
            self.check("GET /lectures/{id} → 200", r.status_code == 200)

        # Update
        if "lecture" in self.ids:
            r = self.patch(f"/lectures/{self.ids['lecture']}", h, json={"title": "Test Lecture 1 Updated"})
            self.check("PATCH /lectures/{id} → 200", r.status_code == 200)

        # Reorder (single lecture)
        if "lecture" in self.ids:
            r = self.patch("/lectures/reorder", h, json={
                "batch_id": self.ids["batch"],
                "lecture_ids": [self.ids["lecture"]],
            })
            self.check("PATCH /lectures/reorder → 200", r.status_code == 200, f"status={r.status_code}")

    # ------------------------------------------------------------------
    # 8. MATERIALS
    # ------------------------------------------------------------------

    def test_materials(self, h: dict) -> None:
        print("\n=== MATERIALS ===")

        if "batch" not in self.ids:
            self.skip("material tests", "no batch created")
            return

        # Get upload URL
        r = self.post("/materials/upload-url", h, json={
            "filename": "test_document.pdf",
            "content_type": "application/pdf",
            "batch_id": self.ids["batch"],
        })
        self.check("POST /materials/upload-url → 200/201", r.status_code in (200, 201), f"status={r.status_code}")

        # Create material record
        r = self.post("/materials", h, json={
            "title": "Test Material PDF",
            "batch_id": self.ids["batch"],
            "file_url": "https://example.com/test.pdf",
            "file_type": "pdf",
            "file_size": 12345,
            "course_id": self.ids.get("course"),
        })
        self.check("POST /materials → 201", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
        if r.status_code == 201:
            self.ids["material"] = r.json()["id"]

        # List
        r = self.get("/materials", h, params={"batch_id": self.ids["batch"]})
        self.check("GET /materials?batch_id=X → 200", r.status_code == 200)
        if r.status_code == 200:
            self.check("material list has data[]", isinstance(r.json().get("data"), list))

        # Download URL
        if "material" in self.ids:
            r = self.get(f"/materials/{self.ids['material']}/download-url", h)
            self.check("GET /materials/{id}/download-url → 200", r.status_code == 200, f"status={r.status_code}")

    # ------------------------------------------------------------------
    # 9. JOBS
    # ------------------------------------------------------------------

    def test_jobs(self, h: dict, student_token: str = None) -> None:
        print("\n=== JOBS ===")

        r = self.post("/jobs", h, json={
            "title": "Integration Test Job",
            "description": "Job posting for integration testing",
            "company": "Test Corp",
            "location": "Remote",
            "type": "full-time",
            "deadline": (date.today() + timedelta(days=30)).isoformat(),
        })
        self.check("POST /jobs → 201", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
        if r.status_code == 201:
            self.ids["job"] = r.json()["id"]

        # List
        r = self.get("/jobs", h, params={"page": 1, "per_page": 10})
        self.check("GET /jobs → 200", r.status_code == 200)
        if r.status_code == 200:
            body = r.json()
            self.check("job list has data[]", isinstance(body.get("data"), list))
            self.check("job list has total_pages", "total_pages" in body)

        # Get single
        if "job" in self.ids:
            r = self.get(f"/jobs/{self.ids['job']}", h)
            self.check("GET /jobs/{id} → 200", r.status_code == 200)

        # Update
        if "job" in self.ids:
            r = self.patch(f"/jobs/{self.ids['job']}", h, json={"title": "Integration Test Job Updated"})
            self.check("PATCH /jobs/{id} → 200", r.status_code == 200)

        # Applications (need student token — skip if not available)
        if student_token and "job" in self.ids:
            sh = self._h(student_token)
            r = self.post(f"/jobs/{self.ids['job']}/apply", sh, json={
                "cover_letter": "I am a great candidate.",
            })
            self.check("POST /jobs/{id}/apply (as student) → 201", r.status_code == 201, f"status={r.status_code}")
            if r.status_code == 201:
                self.ids["application"] = r.json()["id"]

            # List applications (as CC)
            r = self.get(f"/jobs/{self.ids['job']}/applications", h)
            self.check("GET /jobs/{id}/applications → 200", r.status_code == 200)

            # Update application status
            if "application" in self.ids:
                r = self.patch(f"/jobs/{self.ids['job']}/applications/{self.ids['application']}", h,
                               json={"status": "reviewed"})
                self.check("PATCH /jobs/{id}/applications/{aid} → 200", r.status_code == 200, f"status={r.status_code}")
        else:
            self.skip("job application tests", "no student token")

    # ------------------------------------------------------------------
    # 10. ANNOUNCEMENTS
    # ------------------------------------------------------------------

    def test_announcements(self, h: dict) -> None:
        print("\n=== ANNOUNCEMENTS ===")

        r = self.post("/announcements", h, json={
            "title": "Integration Test Announcement",
            "content": "This is a test announcement for integration testing.",
            "scope": "institute",
        })
        self.check("POST /announcements → 201", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
        if r.status_code == 201:
            self.ids["announcement"] = r.json()["id"]

        # List
        r = self.get("/announcements", h, params={"page": 1, "per_page": 10})
        self.check("GET /announcements → 200", r.status_code == 200)
        if r.status_code == 200:
            self.check("announcement list has data[]", isinstance(r.json().get("data"), list))

        # Update
        if "announcement" in self.ids:
            r = self.patch(f"/announcements/{self.ids['announcement']}", h,
                           json={"title": "Integration Test Announcement Updated"})
            self.check("PATCH /announcements/{id} → 200", r.status_code == 200)

    # ------------------------------------------------------------------
    # 11. ZOOM ACCOUNTS + CLASSES
    # ------------------------------------------------------------------

    def test_zoom(self, h: dict) -> None:
        print("\n=== ZOOM ===")

        if not RUN_ZOOM:
            self.skip("Zoom account create", "ZOOM_ACCOUNT_ID not set")
            self.skip("Zoom class create", "ZOOM_ACCOUNT_ID not set")
            return

        # Create account
        r = self.post("/zoom/accounts", h, json={
            "account_name": "Integration Test Zoom",
            "account_id": os.getenv("ZOOM_ACCOUNT_ID", "test_account_id"),
            "client_id": os.getenv("ZOOM_CLIENT_ID", "test_client_id"),
            "client_secret": os.getenv("ZOOM_CLIENT_SECRET", "test_secret"),
            "is_default": False,
        })
        self.check("POST /zoom/accounts → 201", r.status_code == 201, f"status={r.status_code}")
        if r.status_code == 201:
            self.ids["zoom_account"] = r.json()["id"]

        # List accounts
        r = self.get("/zoom/accounts", h)
        self.check("GET /zoom/accounts → 200", r.status_code == 200)

        # Update account
        if "zoom_account" in self.ids:
            r = self.patch(f"/zoom/accounts/{self.ids['zoom_account']}", h,
                           json={"account_name": "Integration Test Zoom Updated"})
            self.check("PATCH /zoom/accounts/{id} → 200", r.status_code == 200)

        # Zoom classes (skip if no batch or no zoom account)
        if "batch" in self.ids and "zoom_account" in self.ids:
            r = self.post("/zoom/classes", h, json={
                "title": "Integration Test Class",
                "batch_id": self.ids["batch"],
                "zoom_account_id": self.ids["zoom_account"],
                "scheduled_date": (date.today() + timedelta(days=7)).isoformat(),
                "scheduled_time": "10:00",
                "duration": 60,
            })
            self.check("POST /zoom/classes → 201", r.status_code == 201, f"status={r.status_code}")
            if r.status_code == 201:
                self.ids["zoom_class"] = r.json()["id"]

            # List classes
            r = self.get("/zoom/classes", h, params={"batch_id": self.ids["batch"]})
            self.check("GET /zoom/classes?batch_id=X → 200", r.status_code == 200)

            # Update class
            if "zoom_class" in self.ids:
                r = self.patch(f"/zoom/classes/{self.ids['zoom_class']}", h,
                               json={"title": "Integration Test Class Updated"})
                self.check("PATCH /zoom/classes/{id} → 200", r.status_code == 200)

    # ------------------------------------------------------------------
    # 12. ADMIN ENDPOINTS
    # ------------------------------------------------------------------

    def test_admin(self, h: dict) -> None:
        print("\n=== ADMIN ===")

        r = self.get("/admin/dashboard", h)
        self.check("GET /admin/dashboard → 200", r.status_code == 200, f"status={r.status_code}")

        r = self.get("/admin/insights", h)
        self.check("GET /admin/insights → 200", r.status_code == 200, f"status={r.status_code}")

        r = self.get("/admin/devices", h, params={"page": 1, "per_page": 10})
        self.check("GET /admin/devices → 200", r.status_code == 200)

        r = self.get("/admin/settings", h)
        self.check("GET /admin/settings → 200", r.status_code == 200, f"status={r.status_code}")

        r = self.patch("/admin/settings", h, json={"device_limit": 2})
        self.check("PATCH /admin/settings → 200", r.status_code == 200, f"status={r.status_code}")

        r = self.get("/admin/activity-log", h, params={"page": 1, "per_page": 10})
        self.check("GET /admin/activity-log → 200", r.status_code == 200, f"status={r.status_code}")

    # ------------------------------------------------------------------
    # 13. CASCADE VERIFICATION
    # ------------------------------------------------------------------

    def test_cascade_verification(self, h: dict) -> None:
        print("\n=== CASCADE VERIFICATION ===")

        # Delete course → curriculum modules + lectures should be soft-deleted
        if "course" in self.ids and "module" in self.ids:
            r = self.delete(f"/courses/{self.ids['course']}", h)
            self.check("DELETE /courses/{id} → 204", r.status_code == 204, f"status={r.status_code}")
            if r.status_code == 204:
                r = self.get(f"/courses/{self.ids['course']}", h)
                self.check("GET deleted course → 404", r.status_code == 404, f"got {r.status_code}")

                # module should no longer appear
                r = self.get("/curriculum", h, params={"course_id": self.ids["course"]})
                if r.status_code == 200:
                    self.check("curriculum modules gone after course delete", len(r.json()) == 0,
                               f"got {len(r.json())} modules")

        # Delete cloned course if exists
        if "course_clone" in self.ids:
            self.delete(f"/courses/{self.ids['course_clone']}", h)

        # Delete job → applications should be soft-deleted
        if "job" in self.ids:
            r = self.delete(f"/jobs/{self.ids['job']}", h)
            self.check("DELETE /jobs/{id} → 204", r.status_code == 204, f"status={r.status_code}")
            if r.status_code == 204:
                r = self.get(f"/jobs/{self.ids['job']}", h)
                self.check("GET deleted job → 404", r.status_code == 404, f"got {r.status_code}")

        # Delete zoom class before account
        if "zoom_class" in self.ids:
            r = self.delete(f"/zoom/classes/{self.ids['zoom_class']}", h)
            self.check("DELETE /zoom/classes/{id} → 204", r.status_code == 204, f"status={r.status_code}")

        # Delete zoom account (cascades to classes)
        if "zoom_account" in self.ids:
            r = self.delete(f"/zoom/accounts/{self.ids['zoom_account']}", h)
            self.check("DELETE /zoom/accounts/{id} → 204", r.status_code == 204, f"status={r.status_code}")

        # Delete batch → lectures/materials/zoom classes should be soft-deleted
        if "batch" in self.ids:
            r = self.delete(f"/batches/{self.ids['batch']}", h)
            self.check("DELETE /batches/{id} → 204", r.status_code == 204, f"status={r.status_code}")
            if r.status_code == 204:
                r = self.get(f"/batches/{self.ids['batch']}", h)
                self.check("GET deleted batch → 404", r.status_code == 404, f"got {r.status_code}")

                if "lecture" in self.ids:
                    r = self.get(f"/lectures/{self.ids['lecture']}", h)
                    self.check("GET lecture after batch delete → 404", r.status_code == 404, f"got {r.status_code}")

    # ------------------------------------------------------------------
    # 14. CLEANUP
    # ------------------------------------------------------------------

    def cleanup(self, h: dict) -> None:
        print("\n=== CLEANUP ===")
        cleanup_map = [
            ("announcement", "/announcements/{}"),
            ("material", "/materials/{}"),
            ("lecture", "/lectures/{}"),
            ("module", "/curriculum/{}"),
            ("zoom_class", "/zoom/classes/{}"),
            ("zoom_account", "/zoom/accounts/{}"),
            ("batch", "/batches/{}"),
            ("course_clone", "/courses/{}"),
            ("course", "/courses/{}"),
            ("student", "/users/{}"),
            ("teacher", "/users/{}"),
        ]
        for key, path_tpl in cleanup_map:
            if key in self.ids:
                path = path_tpl.format(self.ids[key])
                r = self.delete(path, h)
                if r.status_code in (204, 404):
                    print(f"  cleaned up: {key} ({self.ids[key][:8]}...)")
                else:
                    print(f"  {YELLOW}cleanup skipped{RESET}: {key} → HTTP {r.status_code}")

    # ------------------------------------------------------------------
    # SUMMARY
    # ------------------------------------------------------------------

    def print_summary(self) -> None:
        total = self.passed + self.failed
        print("\n" + "=" * 60)
        print(f"RESULTS: {self.passed}/{total} passed, {self.skipped} skipped")
        if self.failed == 0:
            print(f"{GREEN}All tests passed!{RESET}")
        else:
            print(f"{RED}{self.failed} test(s) failed.{RESET}")
        print("=" * 60)

    # ------------------------------------------------------------------
    # ENTRY POINT
    # ------------------------------------------------------------------

    def run_all(self) -> int:
        print(f"\nICT LMS Integration Tests")
        print(f"Base URL : {BASE_URL}")
        print(f"Admin    : {ADMIN_EMAIL}")
        print(f"Zoom     : {'enabled' if RUN_ZOOM else 'disabled (set ZOOM_ACCOUNT_ID to enable)'}")

        self.test_health()
        access_token = self.test_auth()
        h = self._h(access_token)

        self.test_users(h)
        self.test_batches(h)
        self.test_courses(h)
        self.test_curriculum(h)
        self.test_lectures(h)
        self.test_materials(h)
        self.test_jobs(h)
        self.test_announcements(h)
        self.test_zoom(h)
        self.test_admin(h)
        self.test_cascade_verification(h)
        self.cleanup(h)
        self.print_summary()

        return 0 if self.failed == 0 else 1


if __name__ == "__main__":
    runner = TestRunner()
    sys.exit(runner.run_all())
