"""Tenant isolation guard utilities.

These functions enforce multi-tenant data isolation at the service layer.
They provide defense-in-depth: even if a router forgets to pass institute_id,
the service layer will reject the request rather than returning all tenants' data.
"""
import uuid
from typing import Optional


def require_institute_id(
    institute_id: Optional[uuid.UUID],
    *,
    allow_none: bool = False,
) -> Optional[uuid.UUID]:
    """Validate institute_id at the service boundary.

    For protected endpoints (called from authenticated routes):
        require_institute_id(institute_id)  # Raises if None

    For SA-accessible or public paths:
        require_institute_id(institute_id, allow_none=True)  # Permits None

    Returns the institute_id unchanged for convenient inline use.
    """
    if institute_id is None and not allow_none:
        raise ValueError(
            "institute_id is required for this operation — "
            "this is a bug: the calling route must pass current_user.institute_id"
        )
    return institute_id


def check_institute_ownership(
    user_institute_id: Optional[uuid.UUID],
    resource_institute_id: Optional[uuid.UUID],
) -> bool:
    """Check whether a user can access a resource based on institute membership.

    Rules:
      - Super admin (user_institute_id is None) can access any resource.
      - Non-SA users must have a matching institute_id.
      - A resource with institute_id=None is only accessible to SA.

    Returns True if access is allowed, False otherwise.
    """
    if user_institute_id is None:
        return True  # Super admin bypass
    return resource_institute_id == user_institute_id
