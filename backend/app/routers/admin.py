import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.utils.rate_limit import limiter

from app.database import get_session
from app.schemas.admin import (
    DashboardResponse, InsightsResponse,
    UserDeviceSummary, DevicesListResponse, SettingsResponse, SettingsUpdate,
    ActivityLogOut, ExportResponse,
)
from app.schemas.device_request import (
    PendingDeviceRequestOut,
    DeviceRequestApprove,
    DeviceRequestReject,
)
from app.schemas.common import PaginatedResponse
from app.services import analytics_service, admin_service, device_request_service
from app.services.device_request_service import DeviceRequestError
from app.rbac.dependencies import require_permissions
from app.models.user import User
import math

router = APIRouter()

CanViewDashboard = Annotated[User, Depends(require_permissions("dashboard.view"))]
CanViewInsights = Annotated[User, Depends(require_permissions("dashboard.view_insights"))]
CanViewDevices = Annotated[User, Depends(require_permissions("devices.view"))]
CanManageDevices = Annotated[User, Depends(require_permissions("devices.terminate"))]
CanManageDeviceRequests = Annotated[User, Depends(require_permissions("devices.manage_requests"))]
CanViewSettings = Annotated[User, Depends(require_permissions("settings.view"))]
CanEditSettings = Annotated[User, Depends(require_permissions("settings.edit"))]
CanViewActivityLog = Annotated[User, Depends(require_permissions("activity_log.view"))]
CanExportData = Annotated[User, Depends(require_permissions("export.data"))]
CanBulkImport = Annotated[User, Depends(require_permissions("users.bulk_import"))]


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(
    current_user: CanViewDashboard,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await analytics_service.get_dashboard(session, current_user.institute_id)


@router.get("/insights", response_model=InsightsResponse)
async def insights(
    current_user: CanViewInsights,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    return await analytics_service.get_insights(session, current_user.institute_id)


# ── 10x Insights — Tab-based analytics ─────────────────────────

from app.schemas.analytics import (
    OverviewResponse, StudentsResponse, StaffResponse, CoursesResponse, EngagementResponse,
)


@router.get("/insights/overview", response_model=OverviewResponse)
async def insights_overview(
    current_user: CanViewInsights,
    session: Annotated[AsyncSession, Depends(get_session)],
    period: int = Query(30, ge=0, le=365),
):
    return await analytics_service.get_overview_metrics(session, current_user.institute_id, period)


@router.get("/insights/students", response_model=StudentsResponse)
async def insights_students(
    current_user: CanViewInsights,
    session: Annotated[AsyncSession, Depends(get_session)],
    period: int = Query(30, ge=0, le=365),
):
    return await analytics_service.get_student_analytics(session, current_user.institute_id, period)


@router.get("/insights/staff", response_model=StaffResponse)
async def insights_staff(
    current_user: CanViewInsights,
    session: Annotated[AsyncSession, Depends(get_session)],
    period: int = Query(30, ge=0, le=365),
):
    return await analytics_service.get_staff_analytics(session, current_user.institute_id, period)


@router.get("/insights/courses", response_model=CoursesResponse)
async def insights_courses(
    current_user: CanViewInsights,
    session: Annotated[AsyncSession, Depends(get_session)],
    period: int = Query(30, ge=0, le=365),
):
    return await analytics_service.get_course_analytics(session, current_user.institute_id, period)


@router.get("/insights/engagement", response_model=EngagementResponse)
async def insights_engagement(
    current_user: CanViewInsights,
    session: Annotated[AsyncSession, Depends(get_session)],
    period: int = Query(30, ge=0, le=365),
):
    return await analytics_service.get_engagement_analytics(session, current_user.institute_id, period)


@router.get("/devices", response_model=DevicesListResponse)
async def list_devices(
    current_user: CanViewDevices,
    session: Annotated[AsyncSession, Depends(get_session)],
    role: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    return await admin_service.list_devices(
        session,
        institute_id=current_user.institute_id,
        caller_role=current_user.role.value,
        role=role,
        search=search,
        page=page,
        per_page=per_page,
        caller_view_type=getattr(current_user, "_view_type", None),
    )


@router.delete("/devices/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def terminate_session(
    session_id: uuid.UUID,
    current_user: CanManageDevices,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    found = await admin_service.terminate_session(
        session,
        session_id=session_id,
        institute_id=current_user.institute_id,
        caller_role=current_user.role.value,
        caller_view_type=getattr(current_user, "_view_type", None),
    )
    if not found:
        raise HTTPException(status_code=404, detail="Session not found")


@router.delete("/devices/user/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def terminate_all_user_sessions(
    user_id: uuid.UUID,
    current_user: CanManageDevices,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    found = await admin_service.terminate_all_user_sessions(
        session,
        user_id=user_id,
        institute_id=current_user.institute_id,
        caller_role=current_user.role.value,
        caller_view_type=getattr(current_user, "_view_type", None),
    )
    if not found:
        raise HTTPException(status_code=404, detail="User not found")


# ── Device limit approval requests ─────────────────────────────────────────


@router.get(
    "/device-requests",
    response_model=PaginatedResponse[PendingDeviceRequestOut],
)
async def list_device_requests(
    current_user: CanViewDevices,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    items, total = await device_request_service.list_pending_for_reviewer(
        session,
        reviewer=current_user,
        page=page,
        per_page=per_page,
    )
    return PaginatedResponse(
        data=[PendingDeviceRequestOut(**item) for item in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post(
    "/device-requests/{request_id}/approve",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def approve_device_request(
    request_id: uuid.UUID,
    body: DeviceRequestApprove,
    current_user: CanManageDeviceRequests,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await device_request_service.approve_request(
            session,
            reviewer=current_user,
            request_id=request_id,
            terminated_session_id=body.terminated_session_id,
        )
    except DeviceRequestError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        )


@router.post(
    "/device-requests/{request_id}/reject",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def reject_device_request(
    request_id: uuid.UUID,
    body: DeviceRequestReject,
    current_user: CanManageDeviceRequests,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        await device_request_service.reject_request(
            session,
            reviewer=current_user,
            request_id=request_id,
            reason=body.reason,
        )
    except DeviceRequestError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={"code": exc.code, "message": exc.message},
        )


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    current_user: CanViewSettings,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    settings_dict = await admin_service.get_settings(session, current_user.institute_id)
    return SettingsResponse(settings=settings_dict)


@router.patch("/settings", response_model=SettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    current_user: CanEditSettings,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    settings_dict = await admin_service.upsert_settings(
        session,
        institute_id=current_user.institute_id,
        settings=body.settings,
    )
    # Invalidate branding cache if a branding-related setting was changed
    if any(k.startswith("branding_") for k in body.settings):
        from app.core.cache import cache
        if current_user.institute_id:
            await cache.delete(cache.branding_key(str(current_user.institute_id)))
    return SettingsResponse(settings=settings_dict)


@router.get("/activity-log", response_model=PaginatedResponse[ActivityLogOut])
async def get_activity_log(
    current_user: CanViewActivityLog,
    session: Annotated[AsyncSession, Depends(get_session)],
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    return await admin_service.get_activity_log(
        session,
        institute_id=current_user.institute_id,
        action=action,
        entity_type=entity_type,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        per_page=per_page,
    )


@router.get("/export/{entity_type}")
async def export_data(
    entity_type: str,
    current_user: CanExportData,
    session: Annotated[AsyncSession, Depends(get_session)],
    format: str = Query("csv", pattern="^(csv|pdf)$"),
):
    if format != "csv":
        raise HTTPException(status_code=400, detail="Only CSV export is currently supported")

    try:
        result = await admin_service.export_data(
            session,
            institute_id=current_user.institute_id,
            entity_type=entity_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if result.is_s3:
        return ExportResponse(
            download_url=result.download_url,
            expires_at=result.expires_at,
        )

    # S3 unavailable — stream CSV inline
    return StreamingResponse(
        iter([result.csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=export_{entity_type}.csv",
        },
    )


# ─── Bulk CSV import (Phase 6) ───────────────────────────────────────
# Accepts a multipart CSV upload and processes rows synchronously for up to
# 5k rows. Large institutes onboarding 500+ legacy students/payments use this
# before flipping Frappe sync on.

@router.get("/bulk-import/template/{entity_type}", response_class=PlainTextResponse)
async def bulk_import_template(
    entity_type: str,
    current_user: CanBulkImport,
):
    from app.services.bulk_import_service import TEMPLATES
    if entity_type not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Unknown entity type")
    return PlainTextResponse(
        TEMPLATES[entity_type],
        headers={"Content-Disposition": f"attachment; filename={entity_type}_template.csv"},
    )


@router.post("/bulk-import/{entity_type}")
@limiter.limit("10/hour")
async def bulk_import_upload(
    request: Request,
    entity_type: str,
    current_user: CanBulkImport,
    session: Annotated[AsyncSession, Depends(get_session)],
    file: Annotated[UploadFile, File(description="UTF-8 CSV with header row")],
):
    from app.services import bulk_import_service
    from app.services.bulk_import_service import BulkImportError

    csv_bytes = await file.read()
    try:
        job = await bulk_import_service.create_job(
            session,
            institute_id=current_user.institute_id,
            created_by=current_user.id,
            entity_type=entity_type,
            csv_bytes=csv_bytes,
        )
        job = await bulk_import_service.run_job(
            session, job_id=job.id, csv_bytes=csv_bytes,
        )
    except BulkImportError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "job_id": str(job.id),
        "entity_type": job.entity_type,
        "status": job.status,
        "total_rows": job.total_rows,
        "success_rows": job.success_rows,
        "failed_rows": job.failed_rows,
        "errors": job.errors or [],
    }


@router.get("/bulk-import/jobs/{job_id}")
async def bulk_import_job_status(
    job_id: uuid.UUID,
    current_user: CanBulkImport,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.models.integration import BulkImportJob

    job = await session.get(BulkImportJob, job_id)
    if job is None or job.institute_id != current_user.institute_id:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": str(job.id),
        "entity_type": job.entity_type,
        "status": job.status,
        "total_rows": job.total_rows,
        "processed_rows": job.processed_rows,
        "success_rows": job.success_rows,
        "failed_rows": job.failed_rows,
        "errors": job.errors or [],
        "created_at": job.created_at,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
    }


@router.get("/bulk-import/jobs")
async def bulk_import_jobs_list(
    current_user: CanBulkImport,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    from sqlalchemy import func as sa_func
    from app.models.integration import BulkImportJob

    base_filter = BulkImportJob.institute_id == current_user.institute_id

    total = (await session.execute(
        select(sa_func.count(BulkImportJob.id)).where(base_filter)
    )).scalar_one()

    rows = (await session.execute(
        select(BulkImportJob)
        .where(base_filter)
        .order_by(BulkImportJob.created_at.desc())
        .limit(per_page).offset((page - 1) * per_page)
    )).scalars().all()

    return {
        "data": [
            {
                "job_id": str(r.id),
                "entity_type": r.entity_type,
                "status": r.status,
                "total_rows": r.total_rows,
                "success_rows": r.success_rows,
                "failed_rows": r.failed_rows,
                "created_at": r.created_at,
                "completed_at": r.completed_at,
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }
