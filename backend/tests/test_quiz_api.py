"""
Integration tests for Quiz API — student-facing endpoints.

Requires a running backend.  Set these environment variables:
    TEST_BASE_URL   (default: http://localhost:8000)
    TEST_ADMIN_EMAIL
    TEST_ADMIN_PASSWORD
    TEST_CC_EMAIL       (course creator)
    TEST_CC_PASSWORD
    TEST_STUDENT_EMAIL
    TEST_STUDENT_PASSWORD

Usage:
    cd backend
    python tests/test_quiz_api.py
"""

import os
import sys
import json
import requests

BASE = os.getenv("TEST_BASE_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE}/api/v1"

ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL", "admin@test.com")
ADMIN_PASS = os.getenv("TEST_ADMIN_PASSWORD", "changeme")
CC_EMAIL = os.getenv("TEST_CC_EMAIL", "cc@test.com")
CC_PASS = os.getenv("TEST_CC_PASSWORD", "changeme")
STUDENT_EMAIL = os.getenv("TEST_STUDENT_EMAIL", "student@test.com")
STUDENT_PASS = os.getenv("TEST_STUDENT_PASSWORD", "changeme")

SLUG = os.getenv("TEST_INSTITUTE_SLUG", "")
HEADERS_SLUG = {"X-Institute-Slug": SLUG} if SLUG else {}

passed = 0
failed = 0


def login(email: str, password: str) -> str:
    """Login and return access token."""
    r = requests.post(
        f"{API}/auth/login",
        json={"email": email, "password": password},
        headers=HEADERS_SLUG,
    )
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["accessToken"]


def auth(token: str) -> dict:
    """Return Authorization + slug headers."""
    h = {"Authorization": f"Bearer {token}"}
    h.update(HEADERS_SLUG)
    return h


def test(name: str):
    """Decorator to register and run a test."""
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
    print(f"\n=== Quiz API Integration Tests ({API}) ===\n")

    # ----- Login -----
    try:
        cc_token = login(CC_EMAIL, CC_PASS)
        student_token = login(STUDENT_EMAIL, STUDENT_PASS)
    except AssertionError as e:
        print(f"Setup failed: {e}")
        print("Ensure test users exist and backend is running.")
        sys.exit(1)

    cc_h = auth(cc_token)
    student_h = auth(student_token)

    # ----- Get a course to use -----
    r = requests.get(f"{API}/courses", params={"page": 1, "per_page": 1}, headers=cc_h)
    assert r.status_code == 200, f"List courses failed: {r.text}"
    courses = r.json().get("data", [])
    if not courses:
        print("No courses found. Skipping quiz tests.")
        sys.exit(0)
    course_id = courses[0]["id"]
    print(f"Using course: {courses[0]['title']} ({course_id})")

    quiz_id = None
    question_ids = []
    attempt_id = None

    # ----- CC: Create quiz -----
    @test("CC creates a quiz")
    def _():
        nonlocal quiz_id
        r = requests.post(
            f"{API}/quizzes",
            json={
                "courseId": course_id,
                "title": "Integration Test Quiz",
                "description": "Auto-created by test_quiz_api.py",
                "timeLimitMinutes": 10,
                "passPercentage": 50,
                "maxAttempts": 3,
            },
            headers=cc_h,
        )
        assert r.status_code in (200, 201), f"Create quiz: {r.status_code} {r.text}"
        quiz_id = r.json()["id"]

    if not quiz_id:
        print("Cannot proceed without quiz. Aborting.")
        sys.exit(1)

    # ----- CC: Add questions -----
    @test("CC adds MCQ question")
    def _():
        r = requests.post(
            f"{API}/quizzes/{quiz_id}/questions",
            json={
                "quizId": quiz_id,
                "questionType": "mcq",
                "questionText": "What is 2+2?",
                "options": {"a": "3", "b": "4", "c": "5", "d": "6"},
                "correctAnswer": "b",
                "points": 5,
            },
            headers=cc_h,
        )
        assert r.status_code in (200, 201), f"Add MCQ: {r.status_code} {r.text}"
        question_ids.append(r.json()["id"])

    @test("CC adds true/false question")
    def _():
        r = requests.post(
            f"{API}/quizzes/{quiz_id}/questions",
            json={
                "quizId": quiz_id,
                "questionType": "true_false",
                "questionText": "The sky is blue.",
                "correctAnswer": "true",
                "points": 3,
            },
            headers=cc_h,
        )
        assert r.status_code in (200, 201), f"Add TF: {r.status_code} {r.text}"
        question_ids.append(r.json()["id"])

    @test("CC adds short answer question")
    def _():
        r = requests.post(
            f"{API}/quizzes/{quiz_id}/questions",
            json={
                "quizId": quiz_id,
                "questionType": "short_answer",
                "questionText": "Explain polymorphism briefly.",
                "correctAnswer": "polymorphism",
                "points": 5,
                "explanation": "OOP concept allowing many forms.",
            },
            headers=cc_h,
        )
        assert r.status_code in (200, 201), f"Add SA: {r.status_code} {r.text}"
        question_ids.append(r.json()["id"])

    # ----- CC: Publish quiz -----
    @test("CC publishes quiz")
    def _():
        r = requests.patch(
            f"{API}/quizzes/{quiz_id}",
            json={"isPublished": True},
            headers=cc_h,
        )
        assert r.status_code == 200, f"Publish: {r.status_code} {r.text}"
        assert r.json()["isPublished"] is True

    # ----- Student: List quizzes (only published visible) -----
    @test("Student sees published quiz in list")
    def _():
        r = requests.get(
            f"{API}/quizzes",
            params={"course_id": course_id},
            headers=student_h,
        )
        assert r.status_code == 200, f"List: {r.status_code} {r.text}"
        ids = [q["id"] for q in r.json()]
        assert quiz_id in ids

    # ----- Student: Get questions (no correct_answer) -----
    @test("Student gets questions without correct_answer")
    def _():
        r = requests.get(
            f"{API}/quizzes/{quiz_id}/questions",
            headers=student_h,
        )
        assert r.status_code == 200, f"Questions: {r.status_code} {r.text}"
        questions = r.json()
        assert len(questions) == 3
        for q in questions:
            assert "correctAnswer" not in q, f"Student sees correctAnswer: {q}"
            assert "explanation" not in q, f"Student sees explanation: {q}"

    # ----- Student: Start attempt -----
    @test("Student starts quiz attempt")
    def _():
        nonlocal attempt_id
        r = requests.post(
            f"{API}/quizzes/{quiz_id}/attempts",
            headers=student_h,
        )
        assert r.status_code in (200, 201), f"Start: {r.status_code} {r.text}"
        data = r.json()
        assert data["status"] == "in_progress"
        attempt_id = data["id"]

    if not attempt_id:
        print("Cannot proceed without attempt.")
        sys.exit(1)

    # ----- Student: Submit attempt -----
    @test("Student submits attempt and gets auto-graded")
    def _():
        r = requests.post(
            f"{API}/quizzes/attempts/{attempt_id}/submit",
            json={
                "answers": [
                    {"questionId": question_ids[0], "answerText": "b"},
                    {"questionId": question_ids[1], "answerText": "true"},
                    {"questionId": question_ids[2], "answerText": "A pattern where objects take many forms"},
                ],
            },
            headers=student_h,
        )
        assert r.status_code == 200, f"Submit: {r.status_code} {r.text}"
        data = r.json()
        # MCQ and TF should be auto-graded; SA needs manual
        assert data["status"] in ("submitted", "graded"), f"Status: {data['status']}"

    # ----- Student: Get attempt detail -----
    @test("Student gets attempt detail with answers")
    def _():
        r = requests.get(
            f"{API}/quizzes/attempts/{attempt_id}",
            headers=student_h,
        )
        assert r.status_code == 200, f"Detail: {r.status_code} {r.text}"
        data = r.json()
        assert "answers" in data
        assert len(data["answers"]) == 3

    # ----- Student: My attempts -----
    @test("Student my-attempts returns the attempt")
    def _():
        r = requests.get(
            f"{API}/quizzes/my-attempts",
            params={"course_id": course_id},
            headers=student_h,
        )
        assert r.status_code == 200, f"My attempts: {r.status_code} {r.text}"
        ids = [a["id"] for a in r.json()]
        assert attempt_id in ids

    # ----- Cleanup: Delete quiz -----
    @test("CC deletes test quiz")
    def _():
        r = requests.delete(f"{API}/quizzes/{quiz_id}", headers=cc_h)
        assert r.status_code in (200, 204), f"Delete: {r.status_code} {r.text}"

    # ----- Summary -----
    total = passed + failed
    print(f"\n{'=' * 40}")
    print(f"Results: {passed}/{total} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
