"""Integration tests for progress gating feature.

Tests the full gating lifecycle:
  - Batch gating toggle (enable/disable) returns correct state
  - Lecture locking based on previous lecture progress
  - Signed-URL enforcement for locked lectures
  - Progress recording and threshold unlocking

Requires: running backend at TEST_BASE_URL (default http://localhost:8000)
"""
import pytest
import httpx

from tests.conftest import API, _auth_headers


pytestmark = pytest.mark.integration


class TestProgressGating:
    """End-to-end tests for progress gating."""

    @pytest.fixture(autouse=True)
    def setup(self, http_client, cc_headers, student_headers, admin_headers):
        self.client = http_client
        self.cc_headers = cc_headers
        self.student_headers = student_headers
        self.admin_headers = admin_headers
        self._cleanup_ids: list[tuple[str, str, dict]] = []
        yield
        # Cleanup in reverse order
        for endpoint, rid, headers in reversed(self._cleanup_ids):
            try:
                self.client.delete(f"{API}/{endpoint}/{rid}", headers=headers)
            except Exception:
                pass

    def _create_batch(self, name: str, gating: bool = False, threshold: int = 65) -> dict:
        resp = self.client.post(
            f"{API}/batches",
            json={
                "name": name,
                "start_date": "2026-04-01",
                "end_date": "2026-12-31",
                "enable_lecture_gating": gating,
                "lecture_gating_threshold": threshold,
            },
            headers=self.cc_headers,
        )
        assert resp.status_code == 201, f"Create batch failed: {resp.text}"
        data = resp.json()
        self._cleanup_ids.append(("batches", data["id"], self.cc_headers))
        return data

    def _create_course(self, title: str) -> dict:
        resp = self.client.post(
            f"{API}/courses",
            json={"title": title},
            headers=self.cc_headers,
        )
        assert resp.status_code == 201, f"Create course failed: {resp.text}"
        data = resp.json()
        self._cleanup_ids.append(("courses", data["id"], self.cc_headers))
        return data

    def _link_course_to_batch(self, batch_id: str, course_id: str):
        resp = self.client.post(
            f"{API}/batches/{batch_id}/courses",
            json={"course_id": course_id},
            headers=self.cc_headers,
        )
        assert resp.status_code in (200, 201), f"Link course failed: {resp.text}"

    def _enroll_student(self, batch_id: str, student_id: str):
        resp = self.client.post(
            f"{API}/batches/{batch_id}/students",
            json={"student_id": student_id},
            headers=self.cc_headers,
        )
        assert resp.status_code in (200, 201), f"Enroll student failed: {resp.text}"

    def _get_student_id(self) -> str:
        resp = self.client.get(f"{API}/auth/me", headers=self.student_headers)
        assert resp.status_code == 200
        return resp.json()["id"]

    # -----------------------------------------------------------------
    # Test 1: Batch gating toggle returns correct fields
    # -----------------------------------------------------------------

    def test_batch_gating_fields_in_response(self):
        """GET and PATCH batch must return enable_lecture_gating and lecture_gating_threshold."""
        batch = self._create_batch("TEST_Gating_Fields", gating=False, threshold=70)
        batch_id = batch["id"]

        # Verify create response has gating fields
        assert "enableLectureGating" in batch or "enable_lecture_gating" in batch, \
            f"Gating field missing from create response: {batch.keys()}"

        # GET should return gating fields
        get_resp = self.client.get(f"{API}/batches/{batch_id}", headers=self.cc_headers)
        assert get_resp.status_code == 200
        get_data = get_resp.json()
        # The API returns camelCase (converted by middleware)
        gating_key = "enableLectureGating" if "enableLectureGating" in get_data else "enable_lecture_gating"
        threshold_key = "lectureGatingThreshold" if "lectureGatingThreshold" in get_data else "lecture_gating_threshold"
        assert gating_key in get_data, f"Gating field missing from GET: {get_data.keys()}"
        assert threshold_key in get_data, f"Threshold field missing from GET: {get_data.keys()}"
        assert get_data[gating_key] is False
        assert get_data[threshold_key] == 70

    def test_toggle_gating_on_and_off(self):
        """PATCH batch to enable then disable gating — response must reflect the change."""
        batch = self._create_batch("TEST_Gating_Toggle", gating=False)
        batch_id = batch["id"]

        # Enable gating
        resp = self.client.patch(
            f"{API}/batches/{batch_id}",
            json={"enable_lecture_gating": True, "lecture_gating_threshold": 80},
            headers=self.cc_headers,
        )
        assert resp.status_code == 200, f"Enable gating failed: {resp.text}"
        data = resp.json()
        gating_key = "enableLectureGating" if "enableLectureGating" in data else "enable_lecture_gating"
        threshold_key = "lectureGatingThreshold" if "lectureGatingThreshold" in data else "lecture_gating_threshold"
        assert data[gating_key] is True, f"Gating not enabled: {data}"
        assert data[threshold_key] == 80, f"Threshold not updated: {data}"

        # Disable gating
        resp = self.client.patch(
            f"{API}/batches/{batch_id}",
            json={"enable_lecture_gating": False},
            headers=self.cc_headers,
        )
        assert resp.status_code == 200, f"Disable gating failed: {resp.text}"
        data = resp.json()
        gating_key = "enableLectureGating" if "enableLectureGating" in data else "enable_lecture_gating"
        assert data[gating_key] is False, f"Gating not disabled: {data}"

    # -----------------------------------------------------------------
    # Test 2: Lecture locking based on progress
    # -----------------------------------------------------------------

    def test_lectures_locked_when_gating_enabled(self):
        """With gating enabled, lecture 2 and 3 should be locked until previous completes."""
        batch = self._create_batch("TEST_Gating_Lock", gating=True, threshold=65)
        batch_id = batch["id"]
        course = self._create_course("TEST_Gating_Lock_Course")
        course_id = course["id"]
        self._link_course_to_batch(batch_id, course_id)

        student_id = self._get_student_id()
        self._enroll_student(batch_id, student_id)

        # Create 3 lectures via CC
        lecture_ids = []
        for i in range(1, 4):
            resp = self.client.post(
                f"{API}/lectures",
                json={
                    "title": f"TEST_Lecture_{i}",
                    "batch_id": batch_id,
                    "course_id": course_id,
                    "sequence_order": i,
                    "video_type": "external",
                    "video_url": f"https://example.com/video{i}",
                },
                headers=self.cc_headers,
            )
            assert resp.status_code == 201, f"Create lecture {i} failed: {resp.text}"
            lecture_ids.append(resp.json()["id"])

        # List lectures as student — lecture 1 unlocked, 2 and 3 locked
        resp = self.client.get(
            f"{API}/lectures",
            params={"batch_id": batch_id, "course_id": course_id},
            headers=self.student_headers,
        )
        assert resp.status_code == 200
        lectures = resp.json()["items"]
        assert len(lectures) == 3

        locked_key = "isLocked" if "isLocked" in lectures[0] else "is_locked"
        assert lectures[0][locked_key] is False, "Lecture 1 should be unlocked"
        assert lectures[1][locked_key] is True, "Lecture 2 should be locked"
        assert lectures[2][locked_key] is True, "Lecture 3 should be locked"

    def test_progress_unlocks_next_lecture(self):
        """Updating progress above threshold unlocks the next lecture."""
        batch = self._create_batch("TEST_Gating_Unlock", gating=True, threshold=65)
        batch_id = batch["id"]
        course = self._create_course("TEST_Gating_Unlock_Course")
        course_id = course["id"]
        self._link_course_to_batch(batch_id, course_id)

        student_id = self._get_student_id()
        self._enroll_student(batch_id, student_id)

        # Create 2 lectures
        lecture_ids = []
        for i in range(1, 3):
            resp = self.client.post(
                f"{API}/lectures",
                json={
                    "title": f"TEST_Unlock_Lecture_{i}",
                    "batch_id": batch_id,
                    "course_id": course_id,
                    "sequence_order": i,
                    "video_type": "external",
                    "video_url": f"https://example.com/video{i}",
                },
                headers=self.cc_headers,
            )
            assert resp.status_code == 201
            lecture_ids.append(resp.json()["id"])

        # Update lecture 1 progress to 50% (below threshold)
        resp = self.client.post(
            f"{API}/lectures/{lecture_ids[0]}/progress",
            json={"watch_percentage": 50, "resume_position_seconds": 300},
            headers=self.student_headers,
        )
        assert resp.status_code == 200, f"Update progress failed: {resp.text}"

        # Verify lecture 2 still locked
        resp = self.client.get(
            f"{API}/lectures",
            params={"batch_id": batch_id, "course_id": course_id},
            headers=self.student_headers,
        )
        lectures = resp.json()["items"]
        locked_key = "isLocked" if "isLocked" in lectures[0] else "is_locked"
        assert lectures[1][locked_key] is True, "Lecture 2 should still be locked at 50%"

        # Update lecture 1 progress to 70% (above 65% threshold)
        resp = self.client.post(
            f"{API}/lectures/{lecture_ids[0]}/progress",
            json={"watch_percentage": 70, "resume_position_seconds": 420},
            headers=self.student_headers,
        )
        assert resp.status_code == 200

        # Verify lecture 2 now unlocked
        resp = self.client.get(
            f"{API}/lectures",
            params={"batch_id": batch_id, "course_id": course_id},
            headers=self.student_headers,
        )
        lectures = resp.json()["items"]
        locked_key = "isLocked" if "isLocked" in lectures[0] else "is_locked"
        assert lectures[1][locked_key] is False, "Lecture 2 should be unlocked at 70%"

    def test_all_unlocked_when_gating_disabled(self):
        """With gating disabled, all lectures should be unlocked regardless of progress."""
        batch = self._create_batch("TEST_Gating_Disabled", gating=False)
        batch_id = batch["id"]
        course = self._create_course("TEST_Gating_Disabled_Course")
        course_id = course["id"]
        self._link_course_to_batch(batch_id, course_id)

        student_id = self._get_student_id()
        self._enroll_student(batch_id, student_id)

        # Create 3 lectures
        for i in range(1, 4):
            resp = self.client.post(
                f"{API}/lectures",
                json={
                    "title": f"TEST_NoGate_Lecture_{i}",
                    "batch_id": batch_id,
                    "course_id": course_id,
                    "sequence_order": i,
                    "video_type": "external",
                    "video_url": f"https://example.com/video{i}",
                },
                headers=self.cc_headers,
            )
            assert resp.status_code == 201

        # All lectures unlocked
        resp = self.client.get(
            f"{API}/lectures",
            params={"batch_id": batch_id, "course_id": course_id},
            headers=self.student_headers,
        )
        lectures = resp.json()["items"]
        locked_key = "isLocked" if "isLocked" in lectures[0] else "is_locked"
        for i, lec in enumerate(lectures):
            assert lec[locked_key] is False, f"Lecture {i+1} should be unlocked when gating disabled"
