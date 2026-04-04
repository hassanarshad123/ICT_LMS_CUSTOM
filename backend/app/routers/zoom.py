import asyncio
import logging
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
    AttendanceOut, RecordingOut, RecordingListOut, RecordingSignedUrlOut,
)
from app.schemas.common import PaginatedResponse
from app.services import zoom_service, webhook_event_service
from app.middleware.auth import require_roles, get_current_user
from app.middleware.access_control import verify_zoom_class_access
from app.models.user import User
from app.models.enums import ZoomClassStatus
from app.utils.rate_limit import limiter
from app.utils.tenant import check_institute_ownership

router = APIRouter()
settings = get_settings()
logger = logging.getLogger("ict_lms.zoom")

Admin = Annotated[User, Depends(require_roles("admin"))]
AdminOrCourseCreator = Annotated[User, Depends(require_roles("admin", "course_creator"))]
CourseCreator = Annotated[User, Depends(require_roles("admin", "course_creator"))]
AllRoles = Annotated[User, Depends(get_current_user)]


# --- Zoom Accounts ---

@router.get("/accounts")
async def list_accounts(
    current_user: AdminOrCourseCreator,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    accounts = await zoom_service.list_accounts(session, institute_id=current_user.institute_id)
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
        session, institute_id=current_user.institute_id,
        account_name=body.account_name, account_id=body.account_id,
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
    # Verify institute ownership
    existing = await zoom_service.get_account(session, account_id, institute_id=current_user.institute_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Zoom account not found")

    fields = body.model_dump(exclude_unset=True)
    if "client_secret" in fields and fields["client_secret"]:
        from app.utils.encryption import encrypt
        fields["client_secret"] = encrypt(fields["client_secret"])

    try:
        account = await zoom_service.update_account(session, account_id, institute_id=current_user.institute_id, **fields)
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
    # Verify institute ownership
    existing = await zoom_service.get_account(session, account_id, institute_id=current_user.institute_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Zoom account not found")
    try:
        await zoom_service.soft_delete_account(session, account_id, institute_id=current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/accounts/{account_id}/set-default", response_model=ZoomAccountOut)
async def set_default_account(
    account_id: uuid.UUID,
    current_user: Admin,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Verify institute ownership
    existing = await zoom_service.get_account(session, account_id, institute_id=current_user.institute_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Zoom account not found")
    try:
        account = await zoom_service.set_default_account(session, account_id, institute_id=current_user.institute_id)
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
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    items, total = await zoom_service.list_classes(
        session, current_user, batch_id=batch_id, status_filter=status,
        teacher_id=teacher_id, search=search, page=page, per_page=per_page,
        institute_id=current_user.institute_id,
    )
    return PaginatedResponse(
        data=[ZoomClassOut(**item) for item in items],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/classes", response_model=ZoomClassOut, status_code=status.HTTP_201_CREATED)
async def create_class(
    body: ZoomClassCreate,
    current_user: CourseCreator,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Get zoom account for API call
    account = await zoom_service.get_account(session, body.zoom_account_id)
    if not account or not check_institute_ownership(current_user.institute_id, account.institute_id):
        raise HTTPException(status_code=404, detail="Zoom account not found")

    # Validate batch belongs to this course creator
    from sqlmodel import select
    from app.models.batch import Batch
    from app.models.enums import UserRole
    r = await session.execute(select(Batch).where(
        Batch.id == body.batch_id,
        Batch.deleted_at.is_(None),
        *([Batch.institute_id == current_user.institute_id] if current_user.institute_id else []),
    ))
    batch = r.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    # Admins can schedule for any batch in their institute; CCs only for their own
    if current_user.role.value == "course_creator" and batch.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="You can only schedule classes for your own batches")

    # Validate teacher_id exists, is a teacher, and belongs to the same institute
    r = await session.execute(select(User).where(
        User.id == body.teacher_id,
        User.deleted_at.is_(None),
        User.institute_id == current_user.institute_id,
    ))
    teacher = r.scalar_one_or_none()
    if not teacher or teacher.role != UserRole.teacher:
        raise HTTPException(status_code=400, detail="Invalid teacher selected")

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
    except Exception as e:
        logger.error("Zoom API meeting creation failed: %s", e)

    zc = await zoom_service.create_class(
        session, title=body.title, batch_id=body.batch_id,
        teacher_id=body.teacher_id, zoom_account_id=body.zoom_account_id,
        scheduled_date=body.scheduled_date, scheduled_time=body.scheduled_time,
        duration=body.duration,
        zoom_meeting_id=zoom_meeting["meeting_id"] if zoom_meeting else None,
        zoom_meeting_url=zoom_meeting["join_url"] if zoom_meeting else None,
        zoom_start_url=zoom_meeting["start_url"] if zoom_meeting else None,
        institute_id=current_user.institute_id,
    )

    if current_user.institute_id:
        await webhook_event_service.queue_webhook_event(
            session, current_user.institute_id, "class.scheduled",
            {"class_id": str(zc.id), "title": zc.title, "batch_id": str(zc.batch_id),
             "teacher_id": str(zc.teacher_id), "scheduled_date": str(zc.scheduled_date),
             "duration": zc.duration},
        )
        await session.commit()

    # Notify enrolled students + teacher
    try:
        from app.services.zoom_notification_service import notify_class_scheduled
        await notify_class_scheduled(session, zc, batch.name, teacher.name)
    except Exception as e:
        logger.warning("Failed to send class-scheduled notifications: %s", e)

    from app.utils.formatters import format_duration

    return ZoomClassOut(
        id=zc.id, title=zc.title, batch_id=zc.batch_id, batch_name=batch.name,
        teacher_id=zc.teacher_id, teacher_name=teacher.name,
        zoom_meeting_url=zc.zoom_meeting_url, zoom_start_url=zc.zoom_start_url,
        scheduled_date=zc.scheduled_date,
        scheduled_time=zc.scheduled_time.strftime("%H:%M") if zc.scheduled_time else body.scheduled_time,
        duration=zc.duration,
        duration_display=format_duration(zc.duration * 60) if zc.duration else None,
        status=zc.status.value, zoom_account_id=zc.zoom_account_id,
        created_at=zc.created_at,
    )


# --- Phase 3B: Update class + sync Zoom meeting ---

@router.patch("/classes/{class_id}", response_model=ZoomClassOut)
async def update_class(
    class_id: uuid.UUID,
    body: ZoomClassUpdate,
    current_user: AdminOrCourseCreator,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Course creators can only update classes in their own batches
    if current_user.role.value == "course_creator":
        from sqlmodel import select as sel
        from app.models.zoom import ZoomClass as ZC
        from app.models.batch import Batch as B
        r = await session.execute(
            sel(ZC).join(B, ZC.batch_id == B.id).where(
                ZC.id == class_id, ZC.deleted_at.is_(None), B.created_by == current_user.id
            )
        )
        if not r.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="You can only update classes in your own batches")

    update_fields = body.model_dump(exclude_unset=True)

    # Capture old schedule for rescheduled notification
    old_date = old_time = None
    if any(k in update_fields for k in ("scheduled_date", "scheduled_time")):
        from sqlmodel import select as sel2
        from app.models.zoom import ZoomClass as ZC2
        r2 = await session.execute(sel2(ZC2).where(ZC2.id == class_id, ZC2.deleted_at.is_(None)))
        old_zc = r2.scalar_one_or_none()
        if old_zc:
            old_date = str(old_zc.scheduled_date)
            old_time = old_zc.scheduled_time.strftime("%H:%M") if old_zc.scheduled_time else None

    try:
        zc = await zoom_service.update_class(session, class_id, institute_id=current_user.institute_id, **update_fields)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Sync changes to Zoom meeting
    if zc.zoom_meeting_id and any(k in update_fields for k in ("title", "scheduled_date", "scheduled_time", "duration")):
        try:
            account = await zoom_service.get_account(session, zc.zoom_account_id)
            if account:
                from app.utils.zoom_api import update_meeting
                from datetime import time as dt_time

                start_time = None
                if "scheduled_date" in update_fields or "scheduled_time" in update_fields:
                    start_time = datetime.combine(zc.scheduled_date, zc.scheduled_time)

                await update_meeting(
                    account_id=account.account_id,
                    client_id=account.client_id,
                    encrypted_secret=account.client_secret,
                    meeting_id=zc.zoom_meeting_id,
                    topic=update_fields.get("title"),
                    start_time=start_time,
                    duration=update_fields.get("duration"),
                )
        except Exception as e:
            logger.warning("Failed to update Zoom meeting %s: %s", zc.zoom_meeting_id, e)

    from app.utils.formatters import format_duration
    from sqlmodel import select
    from app.models.batch import Batch

    r = await session.execute(select(Batch.name).where(Batch.id == zc.batch_id))
    batch_name = r.scalar_one_or_none()

    teacher_name = None
    r = await session.execute(select(User.name).where(User.id == zc.teacher_id))
    teacher_name = r.scalar_one_or_none()

    # Send rescheduled notification if date/time changed
    if old_date is not None and (str(old_date) != str(zc.scheduled_date) or str(old_time) != str(zc.scheduled_time)):
        try:
            from app.services.zoom_notification_service import notify_class_rescheduled
            await notify_class_rescheduled(session, zc, batch_name, old_date, old_time)
        except Exception as e:
            logger.warning("Failed to send class-rescheduled notifications: %s", e)

    return ZoomClassOut(
        id=zc.id, title=zc.title, batch_id=zc.batch_id, batch_name=batch_name,
        teacher_id=zc.teacher_id, teacher_name=teacher_name,
        zoom_meeting_url=zc.zoom_meeting_url, zoom_start_url=zc.zoom_start_url,
        scheduled_date=zc.scheduled_date,
        scheduled_time=zc.scheduled_time.strftime("%H:%M") if zc.scheduled_time else None,
        duration=zc.duration,
        duration_display=format_duration(zc.duration * 60) if zc.duration else None,
        status=zc.status.value, zoom_account_id=zc.zoom_account_id,
        created_at=zc.created_at,
    )


@router.delete("/classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(
    class_id: uuid.UUID,
    current_user: AdminOrCourseCreator,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Course creators can only delete classes in their own batches
    if current_user.role.value == "course_creator":
        from sqlmodel import select as sel
        from app.models.zoom import ZoomClass as ZC
        from app.models.batch import Batch as B
        r = await session.execute(
            sel(ZC).join(B, ZC.batch_id == B.id).where(
                ZC.id == class_id, ZC.deleted_at.is_(None), B.created_by == current_user.id
            )
        )
        if not r.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="You can only delete classes in your own batches")

    # Snapshot class data before deletion for cancellation notification
    from sqlmodel import select as sel_del
    from app.models.zoom import ZoomClass as ZC_del
    from app.models.batch import Batch as B_del
    r_del = await session.execute(
        sel_del(ZC_del, B_del.name).join(B_del, ZC_del.batch_id == B_del.id, isouter=True).where(
            ZC_del.id == class_id, ZC_del.deleted_at.is_(None)
        )
    )
    del_row = r_del.one_or_none()
    # Snapshot scalar values before soft-delete expires the ORM object
    notif_snapshot = None
    if del_row:
        zc_obj, b_name = del_row
        notif_snapshot = {
            "title": zc_obj.title, "batch_id": zc_obj.batch_id,
            "teacher_id": zc_obj.teacher_id, "institute_id": zc_obj.institute_id,
            "scheduled_date": zc_obj.scheduled_date, "scheduled_time": zc_obj.scheduled_time,
            "batch_name": b_name,
        }

    try:
        await zoom_service.soft_delete_class(session, class_id, institute_id=current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Send cancellation notification using snapshot (ORM object may be expired after commit)
    if notif_snapshot:
        try:
            from app.services.zoom_notification_service import notify_class_cancelled_from_snapshot
            await notify_class_cancelled_from_snapshot(session, notif_snapshot)
        except Exception as e:
            logger.warning("Failed to send class-cancelled notifications: %s", e)


@router.get("/classes/{class_id}/attendance", response_model=list[AttendanceOut])
async def get_attendance(
    class_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    await verify_zoom_class_access(session, current_user, class_id)
    items = await zoom_service.get_attendance(session, class_id, institute_id=current_user.institute_id)
    return [AttendanceOut(**item) for item in items]


@router.get("/classes/{class_id}/recordings", response_model=list[RecordingOut])
async def get_recordings(
    class_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    await verify_zoom_class_access(session, current_user, class_id)
    recordings = await zoom_service.get_recordings(session, class_id, institute_id=current_user.institute_id)
    return [
        RecordingOut(
            id=r.id, zoom_class_id=r.zoom_class_id,
            bunny_video_id=r.bunny_video_id, duration=r.duration,
            file_size=r.file_size, status=r.status.value,
            created_at=r.created_at,
        )
        for r in recordings
    ]


# --- Phase 4C: Manual attendance sync ---

@router.post("/classes/{class_id}/sync-attendance")
async def sync_attendance(
    class_id: uuid.UUID,
    current_user: AdminOrCourseCreator,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    count = await zoom_service.sync_attendance(session, class_id, institute_id=current_user.institute_id)

    if current_user.institute_id is not None and count:
        await webhook_event_service.queue_webhook_event(
            session, current_user.institute_id, "attendance.recorded",
            {"class_id": str(class_id), "records_synced": count},
        )
        await session.commit()

    return {"synced": count}


# --- Fresh start URL for teachers ---

@router.post("/classes/{class_id}/start-url")
async def get_fresh_start_url(
    class_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Fetch a fresh start_url from Zoom with a valid zak token.
    The stored start_url expires after ~2 hours, so this endpoint
    fetches a new one on demand when the teacher clicks Start Class."""
    await verify_zoom_class_access(session, current_user, class_id)

    from sqlmodel import select as sel
    from app.models.zoom import ZoomClass as ZC
    r = await session.execute(
        sel(ZC).where(ZC.id == class_id, ZC.deleted_at.is_(None),
                      ZC.institute_id == current_user.institute_id)
    )
    zc = r.scalar_one_or_none()
    if not zc or not zc.zoom_meeting_id:
        raise HTTPException(status_code=404, detail="Class not found or no Zoom meeting linked")

    account = await zoom_service.get_account(session, zc.zoom_account_id, institute_id=current_user.institute_id)
    if not account:
        raise HTTPException(status_code=404, detail="Zoom account not found")

    from app.utils.zoom_api import get_meeting
    try:
        logger.info("Fetching fresh start_url: class=%s meeting_id=%s account=%s",
                     class_id, zc.zoom_meeting_id, account.account_name)
        meeting = await get_meeting(
            account.account_id, account.client_id,
            account.client_secret, zc.zoom_meeting_id,
        )
    except Exception as e:
        logger.warning("Failed to fetch fresh meeting URLs for %s: %s — falling back to stored URLs",
                       zc.zoom_meeting_id, e)
        meeting = None

    # Use fresh URLs if available, otherwise fall back to stored URLs
    start_url = (meeting.get("start_url") if meeting else None) or zc.zoom_start_url
    join_url = (meeting.get("join_url") if meeting else None) or zc.zoom_meeting_url

    if not start_url and not join_url:
        raise HTTPException(status_code=404, detail="No meeting URL available")

    # Update stored URLs with fresh ones if we got them
    if meeting:
        if meeting.get("start_url"):
            zc.zoom_start_url = meeting["start_url"]
        if meeting.get("join_url"):
            zc.zoom_meeting_url = meeting["join_url"]
        session.add(zc)
        await session.commit()

    return {
        "start_url": start_url,
        "join_url": join_url,
    }


# --- Phase 1A: Global recordings endpoints ---

@router.get("/recordings", response_model=PaginatedResponse[RecordingListOut])
async def list_recordings(
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    items, total = await zoom_service.list_all_recordings(
        session, current_user, page=page, per_page=per_page,
        institute_id=current_user.institute_id,
    )
    return PaginatedResponse(
        data=[RecordingListOut(**item) for item in items],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/recordings/{recording_id}/signed-url", response_model=RecordingSignedUrlOut)
@limiter.limit("30/minute")
async def get_recording_signed_url(
    request: Request,
    recording_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    # Verify the user has access to this recording's class (enrollment/ownership check)
    from app.models.zoom import ClassRecording as CR
    from sqlmodel import select as sel
    rec_row = await session.execute(
        sel(CR.zoom_class_id).where(CR.id == recording_id)
    )
    class_id = rec_row.scalar_one_or_none()
    if not class_id:
        raise HTTPException(status_code=404, detail="Recording not found")
    await verify_zoom_class_access(session, current_user, class_id)

    try:
        result = await zoom_service.get_recording_signed_url(session, recording_id, institute_id=current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return RecordingSignedUrlOut(**result)


# --- Analytics ---

@router.get("/analytics")
@limiter.limit("30/minute")
async def zoom_analytics(
    request: Request,
    current_user: AdminOrCourseCreator,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await zoom_service.get_zoom_analytics(session, institute_id=current_user.institute_id)


# --- Webhook ---

@router.post("/webhook")
async def zoom_webhook(request: Request):
    """Handle Zoom webhook events. Validated via HMAC-SHA256, not Bearer auth."""
    body = await request.body()
    data = await request.json()

    # Verify HMAC signature FIRST — before handling any event type
    signature = request.headers.get("x-zm-signature", "")
    timestamp = request.headers.get("x-zm-request-timestamp", "")

    # Replay protection — reject timestamps older than 5 minutes
    import time
    try:
        ts = int(timestamp)
        if abs(time.time() - ts) > 300:
            raise HTTPException(status_code=401, detail="Stale timestamp")
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid timestamp")

    message = f"v0:{timestamp}:{body.decode()}"
    expected = "v0=" + hmac.HMAC(
        settings.ZOOM_WEBHOOK_SECRET.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event = data.get("event", "")
    payload_obj = data.get("payload", {}).get("object", {})
    logger.info("Zoom webhook: event=%s meeting_id=%s", event, payload_obj.get("id", ""))

    # Handle URL validation event (after signature verified)
    if event == "endpoint.url_validation":
        plain_token = data["payload"]["plainToken"]
        hash_value = hmac.HMAC(
            settings.ZOOM_WEBHOOK_SECRET.encode(),
            plain_token.encode(),
            hashlib.sha256,
        ).hexdigest()
        return {"plainToken": plain_token, "encryptedToken": hash_value}
    payload = data.get("payload", {}).get("object", {})
    meeting_id = str(payload.get("id", ""))

    from app.database import async_session
    async with async_session() as session:
        if event == "meeting.started":
            zc_live = await zoom_service.update_class_status(session, meeting_id, ZoomClassStatus.live)
            if zc_live:
                try:
                    from app.services.zoom_notification_service import notify_class_live
                    await notify_class_live(session, zc_live)
                except Exception as e:
                    logger.warning("Failed to send class-live notifications: %s", e)

        elif event == "meeting.ended":
            await zoom_service.update_class_status(session, meeting_id, ZoomClassStatus.completed)

            # Phase 4B: Sync attendance after a delay (Zoom needs time to finalize data)
            async def _delayed_attendance_sync(mid: str):
                await asyncio.sleep(180)  # 3-minute delay
                async with async_session() as s:
                    from sqlmodel import select
                    from app.models.zoom import ZoomClass
                    r = await s.execute(
                        select(ZoomClass).where(ZoomClass.zoom_meeting_id == mid)
                    )
                    zc = r.scalar_one_or_none()
                    if zc:
                        try:
                            await zoom_service.sync_attendance(s, zc.id)
                            logger.info("Auto-synced attendance for class %s", zc.id)
                        except Exception as e:
                            logger.error("Auto attendance sync failed for class %s: %s", zc.id, e)

            asyncio.create_task(_delayed_attendance_sync(meeting_id))

        elif event == "recording.completed":
            # Find the class by meeting ID and create recording
            from sqlmodel import select
            from app.models.zoom import ZoomClass
            r = await session.execute(
                select(ZoomClass).where(
                    ZoomClass.zoom_meeting_id == meeting_id,
                    ZoomClass.deleted_at.is_(None),
                )
            )
            zc = r.scalar_one_or_none()
            if zc:
                recording_files = payload.get("recording_files", [])
                mp4_files = [r for r in recording_files if r.get("file_type") == "MP4"]

                if not mp4_files:
                    logger.warning("No MP4 recording files in webhook for meeting %s (types: %s)",
                                   meeting_id, [r.get("recording_type") for r in recording_files])

                # Save and process ALL MP4 recordings from the class
                for rec in mp4_files:
                    # Compute duration in minutes from recording_start/recording_end timestamps
                    rec_duration = None
                    try:
                        rec_start = rec.get("recording_start", "")
                        rec_end = rec.get("recording_end", "")
                        if rec_start and rec_end:
                            from datetime import datetime as dt
                            start_dt = dt.fromisoformat(rec_start.replace("Z", "+00:00"))
                            end_dt = dt.fromisoformat(rec_end.replace("Z", "+00:00"))
                            rec_duration = max(int((end_dt - start_dt).total_seconds() / 60), 1)
                    except Exception:
                        rec_duration = payload.get("duration")  # fallback to meeting duration

                    logger.info("Processing recording type=%s duration=%s for meeting %s",
                                rec.get("recording_type"), rec_duration, meeting_id)
                    recording = await zoom_service.create_recording(
                        session,
                        zoom_class_id=zc.id,
                        original_download_url=rec.get("download_url"),
                        duration=rec_duration,
                        file_size=rec.get("file_size"),
                        institute_id=zc.institute_id,
                    )

                    # Process recording in background (upload to Bunny)
                    async def _process_rec(rec_id):
                        async with async_session() as s:
                            try:
                                await zoom_service.process_recording(s, rec_id)
                            except Exception as e:
                                logger.error("Background recording processing failed for %s: %s", rec_id, e)

                    asyncio.create_task(_process_rec(recording.id))

    return {"status": "ok"}
