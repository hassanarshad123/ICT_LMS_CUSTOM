"""Unit tests for app.utils.formatters — duration and file size formatting."""
from app.utils.formatters import format_duration, format_file_size


class TestFormatDuration:
    def test_none_returns_none(self):
        assert format_duration(None) is None

    def test_zero_seconds(self):
        assert format_duration(0) == "0 min"

    def test_minutes_only(self):
        assert format_duration(300) == "5 min"

    def test_one_hour_exact(self):
        assert format_duration(3600) == "1 hours"

    def test_hours_and_minutes(self):
        # 1 hour 30 min → 1.5 hours
        result = format_duration(5400)
        assert "1" in result
        assert "hours" in result

    def test_large_duration(self):
        # 10 hours
        result = format_duration(36000)
        assert "10" in result
        assert "hours" in result


class TestFormatFileSize:
    def test_none_returns_none(self):
        assert format_file_size(None) is None

    def test_bytes(self):
        assert format_file_size(500) == "500 B"

    def test_zero_bytes(self):
        assert format_file_size(0) == "0 B"

    def test_kilobytes(self):
        result = format_file_size(2048)
        assert "KB" in result
        assert "2.0" in result

    def test_megabytes(self):
        result = format_file_size(5 * 1024 * 1024)
        assert "MB" in result
        assert "5.0" in result

    def test_gigabytes(self):
        result = format_file_size(2 * 1024 * 1024 * 1024)
        assert "GB" in result
        assert "2.0" in result

    def test_boundary_kb(self):
        # Exactly 1024 bytes = 1.0 KB
        result = format_file_size(1024)
        assert "KB" in result
        assert "1.0" in result

    def test_boundary_mb(self):
        result = format_file_size(1024 * 1024)
        assert "MB" in result
        assert "1.0" in result
