"""
Production smoke test for Quiz API (read-only operations).

Tests that quiz endpoints are accessible and return valid data
without creating or modifying anything.

Usage:
    TEST_BASE_URL=https://apiict.zensbot.site \
    TEST_STUDENT_EMAIL=student@test.com \
    TEST_STUDENT_PASSWORD=changeme \
    python backend/scripts/test_quiz_production.py
"""

import os
import sys
import requests

BASE = os.getenv("TEST_BASE_URL", "https://apiict.zensbot.site").rstrip("/")
API = f"{BASE}/api/v1"

STUDENT_EMAIL = os.getenv("TEST_STUDENT_EMAIL", "student@test.com")
STUDENT_PASS = os.getenv("TEST_STUDENT_PASSWORD", "changeme")
SLUG = os.getenv("TEST_INSTITUTE_SLUG", "")
HEADERS_SLUG = {"X-Institute-Slug": SLUG} if SLUG else {}

passed = 0
failed = 0


def login(email: str, password: str) -> str:
    r = requests.post(
        f"{API}/auth/login",
        json={"email": email, "password": password},
        headers=HEADERS_SLUG,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code}"
    return r.json()["accessToken"]


def auth(token: str) -> dict:
    h = {"Authorization": f"Bearer {token}"}
    h.update(HEADERS_SLUG)
    return h


def test(name: str):
    def decorator(fn):
        global passed, failed
        try:
            fn()
            print(f"  ✓ {name}")
            passed += 1
        except Exception as e:
            print(f"  ✗ {name}: {e}")
            failed += 1
    return decorator


def main():
    global passed, failed
    print(f"\n=== Quiz API Production Smoke Test ({API}) ===\n")

    try:
        token = login(STUDENT_EMAIL, STUDENT_PASS)
    except AssertionError as e:
        print(f"Login failed: {e}")
        sys.exit(1)

    headers = auth(token)

    # Get a course to test with
    r = requests.get(f"{API}/courses", params={"page": 1, "per_page": 1}, headers=headers)
    if r.status_code != 200 or not r.json().get("data"):
        print("No courses available. Skipping.")
        sys.exit(0)
    course_id = r.json()["data"][0]["id"]

    quiz_id = None

    @test("GET /quizzes?course_id returns 200")
    def _():
        nonlocal quiz_id
        r = requests.get(
            f"{API}/quizzes",
            params={"course_id": course_id},
            headers=headers,
        )
        assert r.status_code == 200, f"Status: {r.status_code}"
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        if data:
            quiz_id = data[0]["id"]

    if quiz_id:
        @test("GET /quizzes/{id}/questions returns 200, no correctAnswer")
        def _():
            r = requests.get(
                f"{API}/quizzes/{quiz_id}/questions",
                headers=headers,
            )
            assert r.status_code == 200, f"Status: {r.status_code}"
            for q in r.json():
                assert "correctAnswer" not in q

    @test("GET /quizzes/my-attempts returns 200")
    def _():
        r = requests.get(
            f"{API}/quizzes/my-attempts",
            headers=headers,
        )
        assert r.status_code == 200, f"Status: {r.status_code}"
        data = r.json()
        assert isinstance(data, list)

        # If past attempts exist, test detail endpoint
        if data:
            att_id = data[0]["id"]

            @test(f"GET /quizzes/attempts/{att_id} returns 200 with answers")
            def _inner():
                r2 = requests.get(
                    f"{API}/quizzes/attempts/{att_id}",
                    headers=headers,
                )
                assert r2.status_code == 200
                assert "answers" in r2.json()

    total = passed + failed
    print(f"\n{'=' * 40}")
    print(f"Results: {passed}/{total} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
