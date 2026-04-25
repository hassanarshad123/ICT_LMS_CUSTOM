"""Service layer for the hard device-limit approval workflow.

Responsibilities:
- Create a pending DeviceLimitRequest from a waiting device (auth'd via email+password)
- Return the status of a request via opaque polling_token (no login needed)
- Mint fresh tokens on the first successful poll after admin approval
- List pending requests for admin/CC review, scoped per role
- Approve (atomically terminate the chosen old session + flag request ready)
- Reject (with optional reason)

All endpoints using this service MUST be rate-limited at the router level.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.config import get_settings
from app.models.user import User
from app.models.session import UserSession
from app.models.device_request import DeviceLimitRequest
from app.models.enums import (
    DeviceLimitRequestStatus,
    UserRole,
    UserStatus,
)
from app.services import activity_service, notification_service
from app.services.auth_service import (
    _hash_token,
    _HARD_MODE_EXEMPT_ROLES,
    _resolve_device_policy,
)
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
)

settings = get_settings()

# Roles whose device requests a course_creator is allowed to review.
# Mirrors the device-management CC boundary already shipped.
_CC_REVIEWABLE_ROLES: tuple[UserRole, ...] = (UserRole.student, UserRole.teacher)

# Rate limit: max 3 requests per user per 1 hour rolling window.
_RATE_LIMIT_COUNT = 3
_RATE_LIMIT_WINDOW = timedelta(hours=1)


class DeviceRequestError(Exception):
    """Generic service-layer error translated to 4xx at the router."""

    def __init__(self, code: str, message: str, http_status: int = 400) -> None:
        self.code = code
        self.message = message
        self.http_status = http_status
        super().__init__(message)


# ── Hashing helpers ─────────────────────────────────────────────────────────

def _hash_polling_token(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def _generate_polling_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hash). Raw token is returned once to the
    waiting device and never persisted in plaintext."""
    raw = secrets.token_urlsafe(32)
    return raw, _hash_polling_token(raw)


# ── Create request ──────────────────────────────────────────────────────────


async def create_request(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    device_info: Optional[str],
    ip_address: Optional[str],
    institute_id: Optional[uuid.UUID],
) -> tuple[DeviceLimitRequest, str]:
    """Create a pending device-limit request for an authenticated user.

    Re-validates email+password so an attacker cannot spam requests with
    just a user_id. The policy check ensures the institute is actually in
    hard mode and the user isn't exempt — otherwise we return an error
    ("wrong mode") so the frontend doesn't get stuck waiting.

    Returns ``(request, raw_polling_token)``. The raw token is only
    returned to the caller this once and sha256 is stored.
    """
    normalized_email = email.strip().lower()

    query = select(User).where(
        func.lower(User.email) == normalized_email,
        User.deleted_at.is_(None),
    )
    if institute_id is not None:
        query = query.where(User.institute_id == institute_id)
    else:
        query = query.where(User.institute_id.is_(None))
        query = query.where(User.role == UserRole.super_admin)

    result = await session.execute(query)
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise DeviceRequestError(
            code="invalid_credentials",
            message="Invalid email or password.",
            http_status=401,
        )

    if user.status != UserStatus.active:
        raise DeviceRequestError(
            code="account_deactivated",
            message="Account is deactivated.",
            http_status=403,
        )

    # Policy sanity check: institute must be in require_approval mode AND the
    # user must not be exempt. Otherwise the request is invalid — fall through
    # to regular login would have evicted oldest instead.
    _, mode = await _resolve_device_policy(session, user.institute_id)
    if mode.value != "require_approval" or user.role in _HARD_MODE_EXEMPT_ROLES:
        raise DeviceRequestError(
            code="approval_not_required",
            message="This account does not require device approval. Try logging in again.",
            http_status=400,
        )

    # Rate limit: max 3 requests in the last hour for this user.
    cutoff = datetime.now(timezone.utc) - _RATE_LIMIT_WINDOW
    count_result = await session.execute(
        select(func.count())
        .select_from(DeviceLimitRequest)
        .where(
            DeviceLimitRequest.user_id == user.id,
            DeviceLimitRequest.created_at >= cutoff,
        )
    )
    recent_count = count_result.scalar() or 0
    if recent_count >= _RATE_LIMIT_COUNT:
        raise DeviceRequestError(
            code="too_many_requests",
            message="Too many requests. Please try again later.",
            http_status=429,
        )

    raw_token, token_hash = _generate_polling_token()

    request = DeviceLimitRequest(
        user_id=user.id,
        institute_id=user.institute_id,
        requested_device_info=device_info,
        requested_ip=ip_address,
        status=DeviceLimitRequestStatus.pending,
        polling_token_hash=token_hash,
    )
    session.add(request)
    await session.flush()  # populate request.id before using it below

    # Notify admins (+ CCs if requesting user is student/teacher).
    await _notify_reviewers(session, user=user, request_id=request.id)

    await activity_service.log_activity(
        session,
        action="device_request_created",
        entity_type="device_limit_request",
        entity_id=request.id,
        user_id=user.id,
        institute_id=user.institute_id,
        ip_address=ip_address,
        details={"device_info": device_info},
    )

    await session.commit()
    await session.refresh(request)
    return request, raw_token


async def _notify_reviewers(
    session: AsyncSession,
    *,
    user: User,
    request_id: uuid.UUID,
) -> None:
    """Notify institute admins — plus CCs if the requester is student/teacher."""
    roles_to_notify: list[UserRole] = [UserRole.admin]
    if user.role in _CC_REVIEWABLE_ROLES:
        roles_to_notify.append(UserRole.course_creator)

    reviewer_query = select(User.id).where(
        User.role.in_(roles_to_notify),
        User.status == UserStatus.active,
        User.deleted_at.is_(None),
    )
    if user.institute_id is not None:
        reviewer_query = reviewer_query.where(User.institute_id == user.institute_id)
    else:
        reviewer_query = reviewer_query.where(User.institute_id.is_(None))

    result = await session.execute(reviewer_query)
    reviewer_ids = list(result.scalars().all())
    if not reviewer_ids:
        return

    await notification_service.create_bulk_notifications(
        session,
        user_ids=reviewer_ids,
        type="device_limit_request",
        title="Device access request",
        message=f"{user.name} ({user.email}) is requesting to log in from a new device.",
        link=f"/devices?tab=pending-requests&request={request_id}",
        institute_id=user.institute_id,
    )


# ── Status polling ──────────────────────────────────────────────────────────


async def get_request_status(
    session: AsyncSession,
    *,
    request_id: uuid.UUID,
    polling_token: str,
) -> dict:
    """Return a status payload for the waiting device.

    On the first poll after approval this mints fresh tokens, creates a new
    UserSession row, and flips status to ``consumed`` so the tokens cannot
    be redeemed twice. On subsequent polls the status is just ``consumed``.
    """
    token_hash = _hash_polling_token(polling_token)

    # Lock the row to make the approved→consumed transition atomic.
    result = await session.execute(
        select(DeviceLimitRequest)
        .where(DeviceLimitRequest.id == request_id)
        .with_for_update()
    )
    request = result.scalar_one_or_none()

    if not request or request.polling_token_hash != token_hash:
        # Never leak whether the request_id exists
        raise DeviceRequestError(
            code="not_found",
            message="Request not found.",
            http_status=404,
        )

    if request.status == DeviceLimitRequestStatus.pending:
        return {"status": "pending"}

    if request.status == DeviceLimitRequestStatus.rejected:
        return {
            "status": "rejected",
            "reason": request.rejection_reason,
        }

    if request.status == DeviceLimitRequestStatus.consumed:
        # Tokens already delivered on a prior poll.
        return {"status": "consumed"}

    # Status is approved — mint tokens now and flip to consumed.
    user_result = await session.execute(
        select(User).where(
            User.id == request.user_id,
            User.deleted_at.is_(None),
        )
    )
    user = user_result.scalar_one_or_none()

    if not user or user.status != UserStatus.active:
        # Turn an approved request for a now-deactivated user into a rejection
        request.status = DeviceLimitRequestStatus.rejected
        request.rejection_reason = "Account no longer active."
        request.updated_at = datetime.now(timezone.utc)
        session.add(request)
        await session.commit()
        return {"status": "rejected", "reason": request.rejection_reason}

    # Reset failed_login_attempts — the user completed the full approval loop.
    if user.failed_login_attempts > 0 or user.locked_until is not None:
        user.failed_login_attempts = 0
        user.locked_until = None
        session.add(user)

    # Mint new tokens + create a fresh session row for this device.
    access_token = create_access_token(user.id, user.role.value, user.token_version)
    refresh_token, token_id = create_refresh_token(user.id)
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS,
    )
    new_session_row = UserSession(
        user_id=user.id,
        session_token=_hash_token(token_id),
        device_info=request.requested_device_info,
        ip_address=request.requested_ip,
        expires_at=expires_at,
        institute_id=user.institute_id,
    )
    session.add(new_session_row)

    # Flip request to consumed so subsequent polls don't re-mint.
    request.status = DeviceLimitRequestStatus.consumed
    request.consumed_at = datetime.now(timezone.utc)
    request.updated_at = datetime.now(timezone.utc)
    session.add(request)

    await activity_service.log_activity(
        session,
        action="device_request_consumed",
        entity_type="device_limit_request",
        entity_id=request.id,
        user_id=user.id,
        institute_id=user.institute_id,
    )

    await session.commit()

    return {
        "status": "approved",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": user.role.value.replace("_", "-"),
            "institute_id": str(user.institute_id) if user.institute_id else None,
        },
    }


# ── Admin list / approve / reject ───────────────────────────────────────────


async def list_pending_for_reviewer(
    session: AsyncSession,
    *,
    reviewer: User,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """Return paginated pending requests visible to this reviewer.

    Scope:
        admin          → all pending requests in the institute
        course_creator → only pending requests from students/teachers
    """
    base = (
        select(DeviceLimitRequest, User)
        .join(User, User.id == DeviceLimitRequest.user_id)
        .where(
            DeviceLimitRequest.status == DeviceLimitRequestStatus.pending,
            DeviceLimitRequest.institute_id == reviewer.institute_id,
        )
    )

    count_base = (
        select(func.count())
        .select_from(DeviceLimitRequest)
        .join(User, User.id == DeviceLimitRequest.user_id)
        .where(
            DeviceLimitRequest.status == DeviceLimitRequestStatus.pending,
            DeviceLimitRequest.institute_id == reviewer.institute_id,
        )
    )

    _reviewer_effective_role = reviewer.role
    if reviewer.role == UserRole.custom:
        _vt = getattr(reviewer, "_view_type", None)
        if _vt == "admin_view":
            _reviewer_effective_role = UserRole.admin
        elif _vt == "staff_view":
            _reviewer_effective_role = UserRole.course_creator
        else:
            _reviewer_effective_role = UserRole.student

    if _reviewer_effective_role == UserRole.course_creator:
        base = base.where(User.role.in_(_CC_REVIEWABLE_ROLES))
        count_base = count_base.where(User.role.in_(_CC_REVIEWABLE_ROLES))

    total_result = await session.execute(count_base)
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    page_query = (
        base.order_by(DeviceLimitRequest.created_at.asc())
        .offset(offset)
        .limit(per_page)
    )
    rows_result = await session.execute(page_query)
    rows = rows_result.all()

    # Batch-fetch active sessions for all users on this page.
    user_ids = [req.user_id for req, _ in rows]
    sessions_by_user: dict[uuid.UUID, list[UserSession]] = {uid: [] for uid in user_ids}
    if user_ids:
        sessions_result = await session.execute(
            select(UserSession).where(
                UserSession.user_id.in_(user_ids),
                UserSession.is_active.is_(True),
            )
        )
        for s in sessions_result.scalars().all():
            sessions_by_user.setdefault(s.user_id, []).append(s)

    items: list[dict] = []
    for req, user in rows:
        items.append(
            {
                "id": req.id,
                "user_id": user.id,
                "user_name": user.name,
                "user_email": user.email,
                "user_role": user.role.value,
                "requested_device_info": req.requested_device_info,
                "requested_ip": req.requested_ip,
                "status": req.status.value,
                "created_at": req.created_at,
                "reviewed_at": req.reviewed_at,
                "rejection_reason": req.rejection_reason,
                "active_sessions": [
                    {
                        "id": s.id,
                        "device_info": s.device_info,
                        "ip_address": s.ip_address,
                        "logged_in_at": s.logged_in_at,
                        "last_active_at": s.last_active_at,
                    }
                    for s in sessions_by_user.get(user.id, [])
                ],
            }
        )

    return items, total


async def approve_request(
    session: AsyncSession,
    *,
    reviewer: User,
    request_id: uuid.UUID,
    terminated_session_id: uuid.UUID,
) -> None:
    """Atomically: terminate the chosen session, flip request to approved,
    notify the requesting user, log the activity.

    Does NOT mint tokens — those are minted lazily on the waiting device's
    next poll so the credentials are fresh at redemption time.
    """
    # Lock the request row
    result = await session.execute(
        select(DeviceLimitRequest)
        .where(DeviceLimitRequest.id == request_id)
        .with_for_update()
    )
    request = result.scalar_one_or_none()
    if not request:
        raise DeviceRequestError("not_found", "Request not found.", 404)

    # Scope: must be in the reviewer's institute
    if request.institute_id != reviewer.institute_id:
        raise DeviceRequestError("not_found", "Request not found.", 404)

    # State check
    if request.status != DeviceLimitRequestStatus.pending:
        raise DeviceRequestError(
            "invalid_state",
            f"Request is already {request.status.value}.",
            409,
        )

    # Fetch requesting user for role check + notifications
    user_result = await session.execute(
        select(User).where(User.id == request.user_id)
    )
    requesting_user = user_result.scalar_one_or_none()
    if not requesting_user:
        raise DeviceRequestError("not_found", "Request not found.", 404)

    # Resolve effective role for custom reviewer
    _reviewer_eff = reviewer.role
    if reviewer.role == UserRole.custom:
        _vt = getattr(reviewer, "_view_type", None)
        if _vt == "admin_view":
            _reviewer_eff = UserRole.admin
        elif _vt == "staff_view":
            _reviewer_eff = UserRole.course_creator
        else:
            _reviewer_eff = UserRole.student

    # CC can only review student/teacher requests
    if (
        _reviewer_eff == UserRole.course_creator
        and requesting_user.role not in _CC_REVIEWABLE_ROLES
    ):
        raise DeviceRequestError("not_found", "Request not found.", 404)

    # Verify the chosen session belongs to the requesting user AND is active
    sess_result = await session.execute(
        select(UserSession)
        .where(
            UserSession.id == terminated_session_id,
            UserSession.user_id == requesting_user.id,
            UserSession.is_active.is_(True),
        )
        .with_for_update()
    )
    target_session = sess_result.scalar_one_or_none()
    if not target_session:
        raise DeviceRequestError(
            "session_not_found",
            "The selected device is no longer active.",
            404,
        )

    # Terminate the chosen session
    target_session.is_active = False
    session.add(target_session)

    # Flip the request
    now = datetime.now(timezone.utc)
    request.status = DeviceLimitRequestStatus.approved
    request.reviewed_by = reviewer.id
    request.reviewed_at = now
    request.terminated_session_id = target_session.id
    request.updated_at = now
    session.add(request)

    # Notify the requesting user
    await notification_service.create_notification(
        session,
        user_id=requesting_user.id,
        type="device_limit_request_approved",
        title="Device access approved",
        message="Your new device has been approved. You can continue to the app.",
        institute_id=requesting_user.institute_id,
    )

    await activity_service.log_activity(
        session,
        action="device_request_approved",
        entity_type="device_limit_request",
        entity_id=request.id,
        user_id=reviewer.id,
        institute_id=reviewer.institute_id,
        details={
            "requester_id": str(requesting_user.id),
            "terminated_session_id": str(target_session.id),
        },
    )

    await session.commit()


async def reject_request(
    session: AsyncSession,
    *,
    reviewer: User,
    request_id: uuid.UUID,
    reason: Optional[str] = None,
) -> None:
    """Reject a pending request with an optional human-readable reason."""
    result = await session.execute(
        select(DeviceLimitRequest)
        .where(DeviceLimitRequest.id == request_id)
        .with_for_update()
    )
    request = result.scalar_one_or_none()
    if not request:
        raise DeviceRequestError("not_found", "Request not found.", 404)

    if request.institute_id != reviewer.institute_id:
        raise DeviceRequestError("not_found", "Request not found.", 404)

    if request.status != DeviceLimitRequestStatus.pending:
        raise DeviceRequestError(
            "invalid_state",
            f"Request is already {request.status.value}.",
            409,
        )

    user_result = await session.execute(
        select(User).where(User.id == request.user_id)
    )
    requesting_user = user_result.scalar_one_or_none()
    if not requesting_user:
        raise DeviceRequestError("not_found", "Request not found.", 404)

    # Resolve effective role for custom reviewer
    _reviewer_eff = reviewer.role
    if reviewer.role == UserRole.custom:
        _vt = getattr(reviewer, "_view_type", None)
        if _vt == "admin_view":
            _reviewer_eff = UserRole.admin
        elif _vt == "staff_view":
            _reviewer_eff = UserRole.course_creator
        else:
            _reviewer_eff = UserRole.student

    if (
        _reviewer_eff == UserRole.course_creator
        and requesting_user.role not in _CC_REVIEWABLE_ROLES
    ):
        raise DeviceRequestError("not_found", "Request not found.", 404)

    now = datetime.now(timezone.utc)
    request.status = DeviceLimitRequestStatus.rejected
    request.reviewed_by = reviewer.id
    request.reviewed_at = now
    request.rejection_reason = reason
    request.updated_at = now
    session.add(request)

    await notification_service.create_notification(
        session,
        user_id=requesting_user.id,
        type="device_limit_request_rejected",
        title="Device access denied",
        message=reason or "Your device request was denied.",
        institute_id=requesting_user.institute_id,
    )

    await activity_service.log_activity(
        session,
        action="device_request_rejected",
        entity_type="device_limit_request",
        entity_id=request.id,
        user_id=reviewer.id,
        institute_id=reviewer.institute_id,
        details={
            "requester_id": str(requesting_user.id),
            "reason": reason,
        },
    )

    await session.commit()
