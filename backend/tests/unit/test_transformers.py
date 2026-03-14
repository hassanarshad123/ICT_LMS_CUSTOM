"""Unit tests for app.utils.transformers — kebab/snake enum conversion."""
import pytest
from app.utils.transformers import to_api, to_db


class TestToApi:
    """to_api: snake_case → kebab-case"""

    def test_single_word(self):
        assert to_api("admin") == "admin"

    def test_two_words(self):
        assert to_api("course_creator") == "course-creator"

    def test_three_words(self):
        assert to_api("full_time_job") == "full-time-job"

    def test_empty_string(self):
        assert to_api("") == ""

    def test_already_kebab(self):
        # If already kebab-case, underscores absent, no change
        assert to_api("course-creator") == "course-creator"


class TestToDb:
    """to_db: kebab-case → snake_case"""

    def test_single_word(self):
        assert to_db("admin") == "admin"

    def test_two_words(self):
        assert to_db("course-creator") == "course_creator"

    def test_three_words(self):
        assert to_db("full-time-job") == "full_time_job"

    def test_empty_string(self):
        assert to_db("") == ""

    def test_already_snake(self):
        assert to_db("course_creator") == "course_creator"


class TestRoundTrip:
    """Verify round-trip conversion consistency."""

    @pytest.mark.parametrize("snake,kebab", [
        ("course_creator", "course-creator"),
        ("full_time", "full-time"),
        ("admin", "admin"),
        ("super_admin", "super-admin"),
    ])
    def test_roundtrip(self, snake, kebab):
        assert to_api(snake) == kebab
        assert to_db(kebab) == snake
