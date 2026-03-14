"""Unit tests for app.utils.security — JWT and password utilities.

These tests use the actual JWT_SECRET_KEY from .env via get_settings().
"""
import uuid
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from jose import jwt

from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_impersonation_token,
    create_password_reset_token,
    decode_token,
)
from app.config import get_settings

settings = get_settings()


class TestPasswordHashing:
    def test_hash_returns_string(self):
        hashed = hash_password("mypassword")
        assert isinstance(hashed, str)
        assert hashed != "mypassword"

    def test_verify_correct_password(self):
        hashed = hash_password("testpass123")
        assert verify_password("testpass123", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("testpass123")
        assert verify_password("wrongpass", hashed) is False

    def test_different_hashes_for_same_password(self):
        h1 = hash_password("samepass")
        h2 = hash_password("samepass")
        # bcrypt salts differ, so hashes differ
        assert h1 != h2
        # But both verify correctly
        assert verify_password("samepass", h1) is True
        assert verify_password("samepass", h2) is True


class TestAccessToken:
    def test_create_and_decode(self):
        user_id = uuid.uuid4()
        token = create_access_token(user_id, "admin")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == str(user_id)
        assert payload["role"] == "admin"
        assert payload["type"] == "access"

    def test_has_expiry(self):
        token = create_access_token(uuid.uuid4(), "student")
        payload = decode_token(token)
        assert "exp" in payload

    def test_expired_token_returns_none(self):
        user_id = uuid.uuid4()
        # Create token with past expiry
        expire = datetime.now(timezone.utc) - timedelta(minutes=1)
        payload = {
            "sub": str(user_id),
            "role": "admin",
            "type": "access",
            "exp": expire,
        }
        token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        assert decode_token(token) is None


class TestRefreshToken:
    def test_create_returns_tuple(self):
        user_id = uuid.uuid4()
        result = create_refresh_token(user_id)
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_token_has_refresh_type(self):
        user_id = uuid.uuid4()
        token, token_id = create_refresh_token(user_id)
        payload = decode_token(token)
        assert payload["type"] == "refresh"

    def test_token_has_jti(self):
        user_id = uuid.uuid4()
        token, token_id = create_refresh_token(user_id)
        payload = decode_token(token)
        assert payload["jti"] == token_id

    def test_token_id_is_uuid(self):
        _, token_id = create_refresh_token(uuid.uuid4())
        # Should be valid UUID string
        uuid.UUID(token_id)


class TestImpersonationToken:
    def test_has_imp_claim(self):
        target = uuid.uuid4()
        impersonator = uuid.uuid4()
        token = create_impersonation_token(target, impersonator)
        payload = decode_token(token)
        assert payload["imp"] == str(impersonator)

    def test_sub_is_target_user(self):
        target = uuid.uuid4()
        impersonator = uuid.uuid4()
        token = create_impersonation_token(target, impersonator)
        payload = decode_token(token)
        assert payload["sub"] == str(target)

    def test_type_is_access(self):
        token = create_impersonation_token(uuid.uuid4(), uuid.uuid4())
        payload = decode_token(token)
        assert payload["type"] == "access"


class TestPasswordResetToken:
    def test_type_is_password_reset(self):
        token = create_password_reset_token(uuid.uuid4())
        payload = decode_token(token)
        assert payload["type"] == "password_reset"

    def test_has_user_id(self):
        user_id = uuid.uuid4()
        token = create_password_reset_token(user_id)
        payload = decode_token(token)
        assert payload["sub"] == str(user_id)


class TestDecodeToken:
    def test_invalid_token_returns_none(self):
        assert decode_token("not.a.valid.token") is None

    def test_wrong_secret_returns_none(self):
        user_id = uuid.uuid4()
        payload = {"sub": str(user_id), "type": "access", "exp": datetime.now(timezone.utc) + timedelta(hours=1)}
        token = jwt.encode(payload, "wrong-secret-key", algorithm="HS256")
        assert decode_token(token) is None

    def test_tampered_token_returns_none(self):
        token = create_access_token(uuid.uuid4(), "admin")
        # Tamper with the token by changing a character
        parts = token.split(".")
        tampered = parts[0] + "." + parts[1] + "." + parts[2][:-1] + ("A" if parts[2][-1] != "A" else "B")
        assert decode_token(tampered) is None
