"""Unit tests for tenant isolation guard utilities."""
import uuid
import pytest

from app.utils.tenant import require_institute_id, check_institute_ownership


# ── require_institute_id ─────────────────────────────────────────────

class TestRequireInstituteId:
    def test_with_valid_uuid(self):
        iid = uuid.uuid4()
        assert require_institute_id(iid) == iid

    def test_with_none_raises_by_default(self):
        with pytest.raises(ValueError, match="institute_id is required"):
            require_institute_id(None)

    def test_with_none_allowed(self):
        assert require_institute_id(None, allow_none=True) is None

    def test_with_valid_uuid_and_allow_none(self):
        iid = uuid.uuid4()
        assert require_institute_id(iid, allow_none=True) == iid

    def test_returns_same_uuid_object(self):
        iid = uuid.uuid4()
        result = require_institute_id(iid)
        assert result is iid


# ── check_institute_ownership ────────────────────────────────────────

class TestCheckInstituteOwnership:
    def test_sa_bypass_any_resource(self):
        """Super admin (institute_id=None) can access any resource."""
        resource_id = uuid.uuid4()
        assert check_institute_ownership(None, resource_id) is True

    def test_sa_bypass_none_resource(self):
        """Super admin can access resources with no institute (global)."""
        assert check_institute_ownership(None, None) is True

    def test_matching_institute(self):
        """User with matching institute_id can access."""
        iid = uuid.uuid4()
        assert check_institute_ownership(iid, iid) is True

    def test_mismatched_institute(self):
        """User with different institute_id is denied."""
        user_iid = uuid.uuid4()
        resource_iid = uuid.uuid4()
        assert check_institute_ownership(user_iid, resource_iid) is False

    def test_user_cannot_access_global_resource(self):
        """Non-SA user cannot access resource with institute_id=None."""
        user_iid = uuid.uuid4()
        assert check_institute_ownership(user_iid, None) is False

    def test_same_uuid_value_different_objects(self):
        """Ownership check works with UUID equality, not identity."""
        raw = "12345678-1234-5678-1234-567812345678"
        user_iid = uuid.UUID(raw)
        resource_iid = uuid.UUID(raw)
        assert user_iid is not resource_iid  # Different objects
        assert check_institute_ownership(user_iid, resource_iid) is True
