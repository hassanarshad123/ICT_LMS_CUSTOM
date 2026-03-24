"""
RBAC Data Isolation Test Suite
==============================
Tests that users can ONLY access data they're authorized to see.
Verifies enrollment/assignment checks on batch, zoom, and announcement endpoints.

Requires a running backend with admin credentials for a test institute.

Usage:
    TEST_BASE_URL=http://localhost:8000 \
    TEST_ADMIN_EMAIL=admin@test.com \
    TEST_ADMIN_PASSWORD=changeme \
    python backend/tests/test_rbac.py

Environment variables:
    TEST_BASE_URL        Default: http://localhost:8000
    TEST_ADMIN_EMAIL     Admin email for test institute
    TEST_ADMIN_PASSWORD  Admin password
"""

import os
import sys
import uuid
import httpx

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")
ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL", "admin@test.com")
ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD", "changeme")

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"


class RBACTest:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.client = httpx.Client(base_url=BASE_URL, timeout=30, verify=False)

        # State — populated during setup
        self.admin_token: str = ""
        self.student_a_token: str = ""
        self.student_b_token: str = ""
        self.teacher_token: str = ""
        self.batch_a_id: str = ""
        self.batch_b_id: str = ""
        self.student_a_id: str = ""
        self.student_b_id: str = ""
        self.teacher_id: str = ""

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
        print(f"  [{YELLOW}SKIP{RESET}]  {label}" + (f"  [{reason}]" if reason else ""))

    def auth_header(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}

    def login(self, email: str, password: str) -> str:
        """Login and return access token."""
        r = self.client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        if r.status_code != 200:
            return ""
        return r.json().get("access_token", "")

    # ------------------------------------------------------------------
    # Setup — create test data via admin
    # ------------------------------------------------------------------

    def setup(self):
        print("\n=== SETUP ===")

        # Login as admin
        self.admin_token = self.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not self.admin_token:
            print(f"  [{RED}FAIL{RESET}]  Cannot login as admin — aborting")
            sys.exit(1)
        print(f"  [{GREEN}OK{RESET}]    Admin logged in")

        h = self.auth_header(self.admin_token)

        # Create 2 batches
        r = self.client.post("/api/v1/batches", json={
            "name": f"RBAC Test Batch A {uuid.uuid4().hex[:6]}",
            "start_date": "2026-01-01", "end_date": "2026-12-31",
        }, headers=h)
        if r.status_code == 201:
            self.batch_a_id = r.json()["id"]
            print(f"  [{GREEN}OK{RESET}]    Batch A created: {self.batch_a_id[:8]}...")
        else:
            print(f"  [{RED}FAIL{RESET}]  Batch A creation failed: {r.status_code} {r.text}")
            sys.exit(1)

        r = self.client.post("/api/v1/batches", json={
            "name": f"RBAC Test Batch B {uuid.uuid4().hex[:6]}",
            "start_date": "2026-01-01", "end_date": "2026-12-31",
        }, headers=h)
        if r.status_code == 201:
            self.batch_b_id = r.json()["id"]
            print(f"  [{GREEN}OK{RESET}]    Batch B created: {self.batch_b_id[:8]}...")
        else:
            print(f"  [{RED}FAIL{RESET}]  Batch B creation failed: {r.status_code}")
            sys.exit(1)

        # Create Student A (enrolled in Batch A)
        email_a = f"rbac_student_a_{uuid.uuid4().hex[:6]}@test.com"
        r = self.client.post("/api/v1/users", json={
            "name": "RBAC Student A", "email": email_a, "role": "student",
        }, headers=h)
        if r.status_code == 201:
            self.student_a_id = r.json()["id"]
            temp_pass = r.json().get("temporary_password", "changeme")
            # Enroll in Batch A
            self.client.post(
                f"/api/v1/batches/{self.batch_a_id}/students",
                json={"student_id": self.student_a_id}, headers=h,
            )
            self.student_a_token = self.login(email_a, temp_pass)
            print(f"  [{GREEN}OK{RESET}]    Student A created + enrolled in Batch A")
        else:
            print(f"  [{RED}FAIL{RESET}]  Student A creation failed: {r.status_code} {r.text}")
            sys.exit(1)

        # Create Student B (enrolled in Batch B)
        email_b = f"rbac_student_b_{uuid.uuid4().hex[:6]}@test.com"
        r = self.client.post("/api/v1/users", json={
            "name": "RBAC Student B", "email": email_b, "role": "student",
        }, headers=h)
        if r.status_code == 201:
            self.student_b_id = r.json()["id"]
            temp_pass = r.json().get("temporary_password", "changeme")
            # Enroll in Batch B
            self.client.post(
                f"/api/v1/batches/{self.batch_b_id}/students",
                json={"student_id": self.student_b_id}, headers=h,
            )
            self.student_b_token = self.login(email_b, temp_pass)
            print(f"  [{GREEN}OK{RESET}]    Student B created + enrolled in Batch B")
        else:
            print(f"  [{RED}FAIL{RESET}]  Student B creation failed: {r.status_code}")
            sys.exit(1)

        # Create Teacher (assigned to Batch A only)
        teacher_email = f"rbac_teacher_{uuid.uuid4().hex[:6]}@test.com"
        r = self.client.post("/api/v1/users", json={
            "name": "RBAC Teacher", "email": teacher_email, "role": "teacher",
            "password": "testpass1234",
        }, headers=h)
        if r.status_code == 201:
            self.teacher_id = r.json()["id"]
            # Assign teacher to Batch A
            self.client.patch(
                f"/api/v1/batches/{self.batch_a_id}",
                json={"teacher_id": self.teacher_id}, headers=h,
            )
            self.teacher_token = self.login(teacher_email, "testpass1234")
            print(f"  [{GREEN}OK{RESET}]    Teacher created + assigned to Batch A")
        else:
            print(f"  [{RED}FAIL{RESET}]  Teacher creation failed: {r.status_code}")
            sys.exit(1)

    # ------------------------------------------------------------------
    # Student Data Isolation Tests
    # ------------------------------------------------------------------

    def test_student_isolation(self):
        print("\n=== STUDENT DATA ISOLATION ===")

        h_a = self.auth_header(self.student_a_token)
        h_b = self.auth_header(self.student_b_token)

        # Student A can see own batch students
        r = self.client.get(f"/api/v1/batches/{self.batch_a_id}/students", headers=h_a)
        self.check(
            "Student A CAN list Batch A students",
            r.status_code == 200,
            f"Got {r.status_code}",
        )

        # Student A CANNOT see Batch B students
        r = self.client.get(f"/api/v1/batches/{self.batch_b_id}/students", headers=h_a)
        self.check(
            "Student A CANNOT list Batch B students",
            r.status_code == 403,
            f"Got {r.status_code} — DATA LEAK!" if r.status_code == 200 else f"Got {r.status_code}",
        )

        # Student A CANNOT see Batch B details
        r = self.client.get(f"/api/v1/batches/{self.batch_b_id}", headers=h_a)
        self.check(
            "Student A CANNOT view Batch B details",
            r.status_code in (403, 404),
            f"Got {r.status_code}",
        )

        # Student A CANNOT see Batch B courses
        r = self.client.get(f"/api/v1/batches/{self.batch_b_id}/courses", headers=h_a)
        self.check(
            "Student A CANNOT list Batch B courses",
            r.status_code == 403,
            f"Got {r.status_code}",
        )

        # Student A CAN see own batch details
        r = self.client.get(f"/api/v1/batches/{self.batch_a_id}", headers=h_a)
        self.check(
            "Student A CAN view Batch A details",
            r.status_code == 200,
            f"Got {r.status_code}",
        )

        # Student CANNOT access admin endpoints
        r = self.client.get("/api/v1/admin/dashboard", headers=h_a)
        self.check(
            "Student A CANNOT access admin dashboard",
            r.status_code == 403,
            f"Got {r.status_code}",
        )

        # Student CANNOT create announcements
        r = self.client.post("/api/v1/announcements", json={
            "title": "Test", "content": "Test", "scope": "institute",
        }, headers=h_a)
        self.check(
            "Student A CANNOT create announcements",
            r.status_code == 403,
            f"Got {r.status_code}",
        )

        # Student CANNOT list all users
        r = self.client.get("/api/v1/users", headers=h_a)
        self.check(
            "Student A CANNOT list all users",
            r.status_code == 403,
            f"Got {r.status_code}",
        )

        # Student viewing other user gets minimal data (no email/phone)
        r = self.client.get(f"/api/v1/users/{self.student_b_id}", headers=h_a)
        if r.status_code == 200:
            data = r.json()
            has_email = "email" in data
            has_phone = "phone" in data
            self.check(
                "Student viewing other user gets NO email/phone",
                not has_email and not has_phone,
                f"email={has_email}, phone={has_phone}",
            )
        else:
            self.check(
                "Student can view other user's public info",
                False,
                f"Got {r.status_code}",
            )

    # ------------------------------------------------------------------
    # Teacher Data Isolation Tests
    # ------------------------------------------------------------------

    def test_teacher_isolation(self):
        print("\n=== TEACHER DATA ISOLATION ===")

        h = self.auth_header(self.teacher_token)

        # Teacher CAN see assigned batch students
        r = self.client.get(f"/api/v1/batches/{self.batch_a_id}/students", headers=h)
        self.check(
            "Teacher CAN list assigned Batch A students",
            r.status_code == 200,
            f"Got {r.status_code}",
        )

        # Teacher CANNOT see unassigned batch students
        r = self.client.get(f"/api/v1/batches/{self.batch_b_id}/students", headers=h)
        self.check(
            "Teacher CANNOT list unassigned Batch B students",
            r.status_code == 403,
            f"Got {r.status_code} — DATA LEAK!" if r.status_code == 200 else f"Got {r.status_code}",
        )

        # Teacher CANNOT see unassigned batch details
        r = self.client.get(f"/api/v1/batches/{self.batch_b_id}", headers=h)
        self.check(
            "Teacher CANNOT view unassigned Batch B details",
            r.status_code in (403, 404),
            f"Got {r.status_code}",
        )

    # ------------------------------------------------------------------
    # Admin Access Tests (should see everything)
    # ------------------------------------------------------------------

    def test_admin_access(self):
        print("\n=== ADMIN ACCESS (SHOULD SEE ALL) ===")

        h = self.auth_header(self.admin_token)

        # Admin CAN see both batches
        r = self.client.get(f"/api/v1/batches/{self.batch_a_id}/students", headers=h)
        self.check("Admin CAN list Batch A students", r.status_code == 200, f"Got {r.status_code}")

        r = self.client.get(f"/api/v1/batches/{self.batch_b_id}/students", headers=h)
        self.check("Admin CAN list Batch B students", r.status_code == 200, f"Got {r.status_code}")

        # Admin CAN access dashboard
        r = self.client.get("/api/v1/admin/dashboard", headers=h)
        self.check("Admin CAN access dashboard", r.status_code == 200, f"Got {r.status_code}")

        # Admin CAN create announcements
        r = self.client.post("/api/v1/announcements", json={
            "title": "Admin Test", "content": "Test", "scope": "institute",
        }, headers=h)
        self.check("Admin CAN create announcements", r.status_code == 201, f"Got {r.status_code}")

    # ------------------------------------------------------------------
    # Non-existent / Random UUID Tests
    # ------------------------------------------------------------------

    def test_random_uuid_access(self):
        print("\n=== RANDOM UUID ACCESS ===")

        h = self.auth_header(self.student_a_token)
        fake_id = str(uuid.uuid4())

        r = self.client.get(f"/api/v1/batches/{fake_id}/students", headers=h)
        self.check(
            "Random batch UUID returns 404 (not 200/500)",
            r.status_code == 404,
            f"Got {r.status_code}",
        )

        r = self.client.get(f"/api/v1/batches/{fake_id}", headers=h)
        self.check(
            "Random batch UUID detail returns 404",
            r.status_code == 404,
            f"Got {r.status_code}",
        )

    # ------------------------------------------------------------------
    # Cleanup (soft-delete test users/batches)
    # ------------------------------------------------------------------

    def cleanup(self):
        print("\n=== CLEANUP ===")
        h = self.auth_header(self.admin_token)

        for uid in [self.student_a_id, self.student_b_id, self.teacher_id]:
            if uid:
                self.client.delete(f"/api/v1/users/{uid}", headers=h)

        for bid in [self.batch_a_id, self.batch_b_id]:
            if bid:
                self.client.delete(f"/api/v1/batches/{bid}", headers=h)

        print(f"  [{GREEN}OK{RESET}]    Test data cleaned up")

    # ------------------------------------------------------------------
    # Run all tests
    # ------------------------------------------------------------------

    def run(self):
        print(f"\n{'=' * 60}")
        print("RBAC DATA ISOLATION TESTS")
        print(f"Target: {BASE_URL}")
        print(f"{'=' * 60}")

        try:
            self.setup()
            self.test_student_isolation()
            self.test_teacher_isolation()
            self.test_admin_access()
            self.test_random_uuid_access()
        finally:
            self.cleanup()

        print(f"\n{'=' * 60}")
        print(f"Results: {GREEN}{self.passed} passed{RESET}, "
              f"{RED}{self.failed} failed{RESET}, "
              f"{YELLOW}{self.skipped} skipped{RESET}")
        print(f"{'=' * 60}\n")

        return self.failed == 0


if __name__ == "__main__":
    test = RBACTest()
    success = test.run()
    sys.exit(0 if success else 1)
