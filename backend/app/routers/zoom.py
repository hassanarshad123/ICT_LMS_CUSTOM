import uuid
import hmac
import hashlib
import math
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.config import get_settings
from app.schemas.zoom import (
    ZoomAccountCreate, ZoomAccountUpdate, ZoomAccountOut, ZoomAccountAdminOut,
    ZoomClassCreate, ZoomClassUpdate, ZoomClassOut,
    AttendanceOut, RecordingOut,
)
from app.schemas.common import PaginatedResponse
from app.services import zoom_service
from app.middleware.auth import require_roles, get_current_user
from app.models.user import User
from app.models.enums import ZoomClassStatus

router = APIRouter()
settings = get_settings()

Admin = Annotated[User, Depends(require_roles("admin"))]
AdminOrTeacher = Annotated[User, Depends(require_roles("admin", "teacher"))]
Teacher = Annotated[User, Depends(require_roles("teacher"))]
AllRoles = Annotated[User, Depends(get_current_user)]


# --- Zoom Accounts ---

@router.get("/accounts")
async def list_accounts(
    current_user: AdminOrTeacher,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    accounts = await zoom_service.list_accounts(session)
    if current_user.role.value == "admin":
        return [
            ZoomAccountAdminOut(
                id=a.id, account_name=a.account_name, account_id=a.account_id,
                client_id=a.client_id, is_default=a.is_default,
                client_secret_masked=a.client_secret[:8] + "..." if a.client_secret else None,
                created_at=a.created_at,
            )
            for a in accounts
        ]
    return [
        ZoomAccountOut(
            id=a.id, account_name=a.account_name, is_default=a.is_default,
            created_at=a.created_at,
        )
        for a in accounts
    ]


@router.post("/accounts", response_model=ZoomAccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(
    body: ZoomAccountCreate,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.utils.encryption import encrypt
    account = await zoom_service.create_account(
        session, account_name=body.account_name, account_id=body.account_id,
        client_id=body.client_id, client_secret=encrypt(body.client_secret),
        is_default=body.is_default,
    )
    return ZoomAccountOut(
        id=account.id, account_name=account.account_name,
        account_id=account.account_id, client_id=account.client_id,
        is_default=account.is_default, created_at=account.created_at,
    )


@router.patch("/accounts/{account_id}", response_model=ZoomAccountOut)
async def update_account(
    account_id: uuid.UUID,
    body: ZoomAccountUpdate,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    fields = body.model_dump(exclude_unset=True)
    if "client_secret" in fields and fields["client_secret"]:
        from app.utils.encryption import encrypt
        fields["client_secret"] = encrypt(fields["client_secret"])

    try:
        account = await zoom_service.update_account(session, account_id, **fields)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ZoomAccountOut(
        id=account.id, account_name=account.account_name,
        account_id=account.account_id, client_id=account.client_id,
        is_default=account.is_default, created_at=account.created_at,
    )


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: uuid.UUID,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await zoom_service.soft_delete_account(session, account_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/accounts/{account_id}/set-default", response_model=ZoomAccountOut)
async def set_default_account(
    account_id: uuid.UUID,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        account = await zoom_service.set_default_account(session, account_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ZoomAccountOut(
        id=account.id, account_name=account.account_name,
        account_id=account.account_id, client_id=account.client_id,
        is_default=account.is_default, created_at=account.created_at,
    )


# --- Zoom Classes ---

@router.get("/classes", response_model=PaginatedResponse[ZoomClassOut])
async def list_classes(
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
    batch_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    teacher_id: Optional[uuid.UUID] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    items, total = await zoom_service.list_classes(
        session, current_user, batch_id=batch_id, status_filter=status,
        teacher_id=teacher_id, page=page, per_page=per_page,
    )
    return PaginatedResponse(
        data=[ZoomClassOut(**item) for item in items],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/classes", response_model=ZoomClassOut, status_code=status.HTTP_201_CREATED)
async def create_class(
    body: ZoomClassCreate,
    current_user: Teacher,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Get zoom account for API call
    account = await zoom_service.get_account(session, body.zoom_account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Zoom account not found")

    # Call Zoom API to create meeting
    zoom_meeting = None
    try:
        from app.utils.zoom_api import create_meeting
        from datetime import time as dt_time
        parts = body.scheduled_time.split(":")
        scheduled_dt = datetime.combine(
            body.scheduled_date, dt_time(int(parts[0]), int(parts[1])),
        )
        zoom_meeting = await create_meeting(
            account_id=account.account_id,
            client_id=account.client_id,
            encrypted_secret=account.client_secret,
            topic=body.title,
            start_time=scheduled_dt,
            duration=body.duration,
        )
    except Exception:
        # If Zoom API fails, still create without meeting details
        pass

    zc = await zoom_service.create_class(
        session, title=body.title, batch_id=body.batch_id,
        teacher_id=current_user.id, zoom_account_id=body.zoom_account_id,
        scheduled_date=body.scheduled_date, scheduled_time=body.scheduled_time,
        duration=body.duration,
        zoom_meeting_id=zoom_meeting["meeting_id"] if zoom_meeting else None,
        zoom_meeting_url=zoom_meeting["join_url"] if zoom_meeting else None,
        zoom_start_url=zoom_meeting["start_url"] if zoom_meeting else None,
    )

    from app.utils.formatters import format_duration
    from sqlmodel import select
    from app.models.batch import Batch

    r = await session.execute(select(Batch.name).where(Batch.id == zc.batch_id))
    batch_name = r.scalar_one_or_none()

    return ZoomClassOut(
        id=zc.id, title=zc.title, batch_id=zc.batch_id, batch_name=batch_name,
        teacher_id=zc.teacher_id, teacher_name=current_user.name,
        zoom_meeting_url=zc.zoom_meeting_url, zoom_start_url=zc.zoom_start_url,
        scheduled_date=zc.scheduled_date,
        scheduled_time=zc.scheduled_time.strftime("%H:%M") if zc.scheduled_time else body.scheduled_time,
        duration=zc.duration,
        duration_display=format_duration(zc.duration * 60) if zc.duration else None,
        status=zc.status.value, zoom_account_id=zc.zoom_account_id,
        created_at=zc.created_at,
    )


@router.patch("/classes/{class_id}", response_model=ZoomClassOut)
async def update_class(
    class_id: uuid.UUID,
    body: ZoomClassUpdate,
    current_user: AdminOrTeacher,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await zoom_service.update_class(session, class_id, **body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"detail": "Updated"}


@router.delete("/classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(
    class_id: uuid.UUID,
    current_user: AdminOrTeacher,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await zoom_service.soft_delete_class(session, class_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/classes/{class_id}/attendance", response_model=list[AttendanceOut])
async def get_attendance(
    class_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    items = await zoom_service.get_attendance(session, class_id)
    return [AttendanceOut(**item) for item in items]


@router.get("/classes/{class_id}/recordings", response_model=list[RecordingOut])
async def get_recordings(
    class_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    recordings = await zoom_service.get_recordings(session, class_id)
    return [
        RecordingOut(
            id=r.id, zoom_class_id=r.zoom_class_id,
            bunny_video_id=r.bunny_video_id, duration=r.duration,
            file_size=r.file_size, status=r.status.value,
            created_at=r.created_at,
        )
        for r in recordings
    ]


# --- Webhook ---

@router.post("/webhook")
async def zoom_webhook(request: Request):
    """Handle Zoom webhook events. Validated via HMAC-SHA256, not Bearer auth."""
    body = await request.body()
    data = await request.json()

    # Handle URL validation event
    if data.get("event") == "endpoint.url_validation":
        plain_token = data["payload"]["plainToken"]
        hash_value = hmac.HMAC(
            settings.ZOOM_WEBHOOK_SECRET.encode(),
            plain_token.encode(),
            hashlib.sha256,
        ).hexdigest()
        return {"plainToken": plain_token, "encryptedToken": hash_value}

    # Verify HMAC signature
    signature = request.headers.get("x-zm-signature", "")
    timestamp = request.headers.get("x-zm-request-timestamp", "")
    message = f"v0:{timestamp}:{body.decode()}"
    expected = "v0=" + hmac.HMAC(
        settings.ZOOM_WEBHOOK_SECRET.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event = data.get("event", "")
    payload = data.get("payload", {}).get("object", {})
    meeting_id = str(payload.get("id", ""))

    from app.database import async_session
    async with async_session() as session:
        if event == "meeting.started":
            await zoom_service.update_class_status(session, meeting_id, ZoomClassStatus.live)
        elif event == "meeting.ended":
            await zoom_service.update_class_status(session, meeting_id, ZoomClassStatus.completed)
        elif event == "recording.completed":
            # Find the class by meeting ID and create recording
            from sqlmodel import select
            from app.models.zoom import ZoomClass
            r = await session.execute(
                select(ZoomClass).where(ZoomClass.zoom_meeting_id == meeting_id)
            )
            zc = r.scalar_one_or_none()
            if zc:
                recordings = payload.get("recording_files", [])
                for rec in recordings:
                    if rec.get("recording_type") == "shared_screen_with_speaker_view":
                        await zoom_service.create_recording(
                            session,
                            zoom_class_id=zc.id,
                            original_download_url=rec.get("download_url"),
                            duration=rec.get("recording_end", 0),
                            file_size=rec.get("file_size"),
                        )

    return {"status": "ok"}
