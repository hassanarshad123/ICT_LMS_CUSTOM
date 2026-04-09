"""Pydantic DTOs for the device-limit approval workflow.

These schemas shape the JSON boundary for:
- the unauthenticated POST /auth/device-request (creation)
- the unauthenticated GET /auth/device-request/{id}/status (polling)
- the authenticated admin review endpoints (list/approve/reject)
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Creation / polling (unauthenticated, user-facing) ───────────────────────


class DeviceRequestCreate(BaseModel):
    """Payload posted by the waiting device after the login 403."""

    email: str
    password: str


class DeviceRequestCreateResponse(BaseModel):
    """Returned ONCE to the waiting device. Raw polling_token is never
    persisted server-side in plaintext — only sha256 lives in the DB."""

    request_id: uuid.UUID
    polling_token: str
    poll_interval_seconds: int = 5
    poll_timeout_seconds: int = 300


class DeviceRequestPendingResponse(BaseModel):
    status: str = "pending"


class DeviceRequestRejectedResponse(BaseModel):
    status: str = "rejected"
    reason: Optional[str] = None


class DeviceRequestApprovedResponse(BaseModel):
    """Delivered on the first successful poll after admin approval."""

    status: str = "approved"
    access_token: str
    refresh_token: str
    user: dict  # matches the existing /auth/login user envelope


class DeviceRequestConsumedResponse(BaseModel):
    status: str = "consumed"


# ── Admin review (authenticated) ────────────────────────────────────────────


class DeviceSessionSummary(BaseModel):
    """Subset of UserSession fields an admin needs to pick which to drop."""

    id: uuid.UUID
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    logged_in_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None


class PendingDeviceRequestOut(BaseModel):
    """One row on the admin "Pending Requests" tab.

    Embeds the requesting user's current active sessions so the admin can
    pick which one to drop without an extra round-trip.
    """

    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    user_email: str
    user_role: str
    requested_device_info: Optional[str] = None
    requested_ip: Optional[str] = None
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    active_sessions: list[DeviceSessionSummary] = Field(default_factory=list)


class DeviceRequestApprove(BaseModel):
    terminated_session_id: uuid.UUID


class DeviceRequestReject(BaseModel):
    reason: Optional[str] = None
