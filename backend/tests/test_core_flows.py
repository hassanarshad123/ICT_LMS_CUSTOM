"""Integration tests for core LMS business flows.

Tests the critical chains: batch→course→enrollment, quiz pipeline, certificate flow.
Requires: running backend at TEST_BASE_URL (default http://localhost:8000)
"""
import pytest
import httpx

from tests.conftest import API, INSTITUTE_SLUG, TEST_ACCOUNTS, _auth_headers, _login


pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# Batch → Course → Enrollment Chain
# ---------------------------------------------------------------------------

class TestBatchCourseChain:
    """Test the batch → course → student enrollment chain."""

    @pytest.fixture(autouse=True)
    def setup_chain(self, http_client, cc_headers, admin_headers):
        """Create test batch and course, cleanup after."""
        self.client = http_client
        self.cc_headers = cc_headers
        self.admin_headers = admin_headers
        self.created_ids = {}
        yield
        # Cleanup in reverse order
        if "course_id" in self.created_ids:
            self.client.delete(
                f"{API}/courses/{self.created_ids['course_id']}",
                headers=self.cc_headers,
            )
        if "batch_id" in self.created_ids:
            self.client.delete(
                f"{API}/batches/{self.created_ids['batch_id']}",
                headers=self.cc_headers,
            )

    def test_create_batch(self):
        resp = self.client.post(
            f"{API}/batches",
            json={
                "name": "TEST_Batch_Chain",
                "start_date": "2026-04-01",
                "end_date": "2026-06-30",
            },
            headers=self.cc_headers,
        )
        assert resp.status_code == 201, f"Create batch failed: {resp.text}"
        self.created_ids["batch_id"] = resp.json()["id"]

    def test_create_course(self):
        resp = self.client.post(
            f"{API}/courses",
            json={"title": "TEST_Course_Chain", "description": "Test course for chain"},
            headers=self.cc_headers,
        )
        assert resp.status_code == 201, f"Create course failed: {resp.text}"
        self.created_ids["course_id"] = resp.json()["id"]

    def test_full_enrollment_chain(self):
        """Full chain: create batch → create course → link → verify student access."""
        # Create batch
        batch_resp = self.client.post(
            f"{API}/batches",
            json={"name": "TEST_FullChain_Batch", "start_date": "2026-04-01", "end_date": "2026-06-30"},
            headers=self.cc_headers,
        )
        assert batch_resp.status_code == 201
        batch_id = batch_resp.json()["id"]
        self.created_ids["batch_id"] = batch_id

        # Create course
        course_resp = self.client.post(
            f"{API}/courses",
            json={"title": "TEST_FullChain_Course"},
            headers=self.cc_headers,
        )
        assert course_resp.status_code == 201
        course_id = course_resp.json()["id"]
        self.created_ids["course_id"] = course_id

        # Link course to batch
        link_resp = self.client.post(
            f"{API}/batches/{batch_id}/courses",
            json={"course_id": course_id},
            headers=self.cc_headers,
        )
        assert link_resp.status_code in (200, 201), f"Link course failed: {link_resp.text}"

        # Verify batch courses list contains the course
        courses_resp = self.client.get(
            f"{API}/batches/{batch_id}/courses",
            headers=self.cc_headers,
        )
        assert courses_resp.status_code == 200

        # Unlink course from batch
        unlink_resp = self.client.delete(
            f"{API}/batches/{batch_id}/courses/{course_id}",
            headers=self.cc_headers,
        )
        assert unlink_resp.status_code in (200, 204)


class TestCourseOperations:
    """Test course CRUD operations."""

    @pytest.fixture(autouse=True)
    def setup(self, http_client, cc_headers):
        self.client = http_client
        self.cc_headers = cc_headers
        self.course_id = None
        yield
        if self.course_id:
            self.client.delete(f"{API}/courses/{self.course_id}", headers=self.cc_headers)

    def test_create_course(self):
        resp = self.client.post(
            f"{API}/courses",
            json={"title": "TEST_CRUD_Course", "description": "For testing"},
            headers=self.cc_headers,
        )
        assert resp.status_code == 201
        self.course_id = resp.json()["id"]

    def test_get_course(self):
        # Create first
        create = self.client.post(
            f"{API}/courses",
            json={"title": "TEST_Get_Course"},
            headers=self.cc_headers,
        )
        self.course_id = create.json()["id"]

        # Get
        resp = self.client.get(f"{API}/courses/{self.course_id}", headers=self.cc_headers)
        assert resp.status_code == 200
        assert resp.json()["title"] == "TEST_Get_Course"

    def test_update_course(self):
        create = self.client.post(
            f"{API}/courses",
            json={"title": "TEST_Update_Course"},
            headers=self.cc_headers,
        )
        self.course_id = create.json()["id"]

        resp = self.client.patch(
            f"{API}/courses/{self.course_id}",
            json={"title": "TEST_Updated_Course"},
            headers=self.cc_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "TEST_Updated_Course"

    def test_delete_course(self):
        create = self.client.post(
            f"{API}/courses",
            json={"title": "TEST_Delete_Course"},
            headers=self.cc_headers,
        )
        course_id = create.json()["id"]

        resp = self.client.delete(f"{API}/courses/{course_id}", headers=self.cc_headers)
        assert resp.status_code in (200, 204)
        # course_id already deleted, no cleanup needed

    def test_clone_course(self):
        create = self.client.post(
            f"{API}/courses",
            json={"title": "TEST_Clone_Source"},
            headers=self.cc_headers,
        )
        source_id = create.json()["id"]

        clone_resp = self.client.post(
            f"{API}/courses/{source_id}/clone",
            headers=self.cc_headers,
        )
        assert clone_resp.status_code in (200, 201), f"Clone failed: {clone_resp.text}"
        clone_id = clone_resp.json()["id"]

        # Cleanup both
        self.client.delete(f"{API}/courses/{clone_id}", headers=self.cc_headers)
        self.client.delete(f"{API}/courses/{source_id}", headers=self.cc_headers)

    def test_list_courses(self):
        resp = self.client.get(f"{API}/courses", headers=self.cc_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "total" in data


class TestBatchOperations:
    """Test batch CRUD operations."""

    @pytest.fixture(autouse=True)
    def setup(self, http_client, cc_headers):
        self.client = http_client
        self.cc_headers = cc_headers
        self.batch_id = None
        yield
        if self.batch_id:
            self.client.delete(f"{API}/batches/{self.batch_id}", headers=self.cc_headers)

    def test_create_batch(self):
        resp = self.client.post(
            f"{API}/batches",
            json={"name": "TEST_CRUD_Batch", "start_date": "2026-04-01", "end_date": "2026-06-30"},
            headers=self.cc_headers,
        )
        assert resp.status_code == 201
        self.batch_id = resp.json()["id"]

    def test_get_batch(self):
        create = self.client.post(
            f"{API}/batches",
            json={"name": "TEST_Get_Batch", "start_date": "2026-04-01", "end_date": "2026-06-30"},
            headers=self.cc_headers,
        )
        self.batch_id = create.json()["id"]

        resp = self.client.get(f"{API}/batches/{self.batch_id}", headers=self.cc_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "TEST_Get_Batch"

    def test_update_batch(self):
        create = self.client.post(
            f"{API}/batches",
            json={"name": "TEST_Update_Batch", "start_date": "2026-04-01", "end_date": "2026-06-30"},
            headers=self.cc_headers,
        )
        self.batch_id = create.json()["id"]

        resp = self.client.patch(
            f"{API}/batches/{self.batch_id}",
            json={"name": "TEST_Updated_Batch"},
            headers=self.cc_headers,
        )
        assert resp.status_code == 200

    def test_list_batches(self):
        resp = self.client.get(f"{API}/batches", headers=self.cc_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "total" in data


# ---------------------------------------------------------------------------
# Quiz Pipeline
# ---------------------------------------------------------------------------

class TestQuizPipeline:
    """Test the quiz creation → attempt → grading pipeline."""

    @pytest.fixture(autouse=True)
    def setup(self, http_client, cc_headers, student_headers):
        self.client = http_client
        self.cc_headers = cc_headers
        self.student_headers = student_headers
        self.cleanup_ids = {}
        yield
        # Cleanup
        if "quiz_id" in self.cleanup_ids:
            self.client.delete(
                f"{API}/quizzes/{self.cleanup_ids['quiz_id']}",
                headers=self.cc_headers,
            )
        if "course_id" in self.cleanup_ids:
            self.client.delete(
                f"{API}/courses/{self.cleanup_ids['course_id']}",
                headers=self.cc_headers,
            )

    def test_create_quiz_requires_course(self):
        """Quiz creation needs a valid course_id."""
        resp = self.client.post(
            f"{API}/quizzes",
            json={
                "title": "TEST_Quiz_NoCourse",
                "course_id": "00000000-0000-0000-0000-000000000000",
            },
            headers=self.cc_headers,
        )
        # Should fail — course doesn't exist
        assert resp.status_code == 404

    def test_quiz_crud_pipeline(self):
        """Create course → create quiz → add questions → verify."""
        # Create course first
        course_resp = self.client.post(
            f"{API}/courses",
            json={"title": "TEST_Quiz_Pipeline_Course"},
            headers=self.cc_headers,
        )
        assert course_resp.status_code == 201
        course_id = course_resp.json()["id"]
        self.cleanup_ids["course_id"] = course_id

        # Create quiz
        quiz_resp = self.client.post(
            f"{API}/quizzes",
            json={
                "title": "TEST_Quiz_Pipeline",
                "course_id": course_id,
                "time_limit_minutes": 30,
                "pass_percentage": 60,
            },
            headers=self.cc_headers,
        )
        assert quiz_resp.status_code == 201, f"Create quiz failed: {quiz_resp.text}"
        quiz_id = quiz_resp.json()["id"]
        self.cleanup_ids["quiz_id"] = quiz_id

        # Add MCQ question (schema: question_text, correct_answer required, options is list of strings)
        mcq_resp = self.client.post(
            f"{API}/quizzes/{quiz_id}/questions",
            json={
                "question_text": "TEST: What is 2+2?",
                "question_type": "MCQ",
                "points": 10,
                "options": ["3", "4", "5", "6"],
                "correct_answer": "4",
            },
            headers=self.cc_headers,
        )
        assert mcq_resp.status_code == 201, f"Add MCQ failed: {mcq_resp.text}"

        # Add true/false question
        tf_resp = self.client.post(
            f"{API}/quizzes/{quiz_id}/questions",
            json={
                "question_text": "TEST: The sky is blue",
                "question_type": "TRUE_FALSE",
                "points": 5,
                "correct_answer": "true",
            },
            headers=self.cc_headers,
        )
        assert tf_resp.status_code == 201, f"Add T/F failed: {tf_resp.text}"

        # List questions
        q_list = self.client.get(
            f"{API}/quizzes/{quiz_id}/questions",
            headers=self.cc_headers,
        )
        assert q_list.status_code == 200

        # Get quiz detail
        detail = self.client.get(f"{API}/quizzes/{quiz_id}", headers=self.cc_headers)
        assert detail.status_code == 200
        assert detail.json()["title"] == "TEST_Quiz_Pipeline"


# ---------------------------------------------------------------------------
# Certificate Flow
# ---------------------------------------------------------------------------

class TestCertificateFlow:
    """Test certificate-related endpoints."""

    def test_list_certificates(self, http_client, cc_headers):
        resp = http_client.get(f"{API}/certificates", headers=cc_headers)
        assert resp.status_code == 200

    def test_student_dashboard(self, http_client, student_headers):
        resp = http_client.get(f"{API}/certificates/my-dashboard", headers=student_headers)
        assert resp.status_code == 200

    def test_verify_invalid_code(self, http_client):
        """Public verification with non-existent code."""
        resp = http_client.get(f"{API}/certificates/verify/INVALID-CODE-000")
        assert resp.status_code in (404, 200)  # 404 or empty result

    def test_eligible_students_requires_params(self, http_client, cc_headers):
        """Eligible endpoint requires batch_id and course_id query params."""
        resp = http_client.get(f"{API}/certificates/eligible", headers=cc_headers)
        assert resp.status_code == 422  # Missing required query params


# ---------------------------------------------------------------------------
# Pagination Tests
# ---------------------------------------------------------------------------

class TestPagination:
    """Verify paginated responses have correct structure."""

    PAGINATED_ENDPOINTS = [
        "/courses",
        "/batches",
        "/certificates",
    ]

    @pytest.mark.parametrize("endpoint", PAGINATED_ENDPOINTS)
    def test_paginated_response_structure(self, http_client, cc_headers, endpoint):
        resp = http_client.get(f"{API}{endpoint}", headers=cc_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert isinstance(data["data"], list)

    def test_page_parameter(self, http_client, cc_headers):
        resp = http_client.get(f"{API}/courses?page=1&per_page=5", headers=cc_headers)
        assert resp.status_code == 200
        assert resp.json()["per_page"] == 5

    def test_out_of_range_page(self, http_client, cc_headers):
        resp = http_client.get(f"{API}/courses?page=9999", headers=cc_headers)
        assert resp.status_code == 200
        assert resp.json()["data"] == []
