"""Unit tests for Pydantic schema validation."""
import uuid
import pytest
from pydantic import ValidationError

from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.schemas.common import PaginatedResponse, ErrorResponse


class TestLoginRequest:
    def test_valid_login(self):
        req = LoginRequest(email="test@example.com", password="pass123")
        assert req.email == "test@example.com"
        assert req.password == "pass123"
        assert req.device_info is None

    def test_with_device_info(self):
        req = LoginRequest(email="test@example.com", password="pass", device_info="Chrome/Win")
        assert req.device_info == "Chrome/Win"

    def test_missing_email_raises(self):
        with pytest.raises(ValidationError):
            LoginRequest(password="pass123")

    def test_missing_password_raises(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="test@example.com")


class TestRefreshRequest:
    def test_valid(self):
        req = RefreshRequest(refresh_token="some.jwt.token")
        assert req.refresh_token == "some.jwt.token"

    def test_missing_token_raises(self):
        with pytest.raises(ValidationError):
            RefreshRequest()


class TestChangePasswordRequest:
    def test_valid(self):
        req = ChangePasswordRequest(current_password="old", new_password="new")
        assert req.current_password == "old"
        assert req.new_password == "new"

    def test_missing_fields(self):
        with pytest.raises(ValidationError):
            ChangePasswordRequest(current_password="old")


class TestForgotPasswordRequest:
    def test_valid(self):
        req = ForgotPasswordRequest(email="user@test.com")
        assert req.email == "user@test.com"

    def test_missing_email(self):
        with pytest.raises(ValidationError):
            ForgotPasswordRequest()


class TestResetPasswordRequest:
    def test_valid(self):
        req = ResetPasswordRequest(token="jwt.token.here", new_password="newpass")
        assert req.token == "jwt.token.here"

    def test_missing_fields(self):
        with pytest.raises(ValidationError):
            ResetPasswordRequest(token="abc")


class TestPaginatedResponse:
    def test_valid(self):
        resp = PaginatedResponse(data=[], total=0, page=1, per_page=10, total_pages=0)
        assert resp.data == []
        assert resp.total == 0

    def test_with_data(self):
        resp = PaginatedResponse(data=[{"id": 1}], total=1, page=1, per_page=10, total_pages=1)
        assert len(resp.data) == 1


class TestErrorResponse:
    def test_valid(self):
        resp = ErrorResponse(detail="Not found")
        assert resp.detail == "Not found"
