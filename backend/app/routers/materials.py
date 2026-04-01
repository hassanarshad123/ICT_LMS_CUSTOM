import uuid
import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.material import (
    MaterialUploadUrlRequest, MaterialUploadUrlResponse,
    MaterialCreate, MaterialOut, MaterialDownloadUrlResponse,
)
from app.schemas.common import PaginatedResponse
from app.services import material_service
from app.middleware.auth import require_roles, get_current_user
from app.middleware.access_control import verify_batch_access
from app.models.user import User
from app.models.enums import UserRole
from app.utils.tenant import check_institute_ownership

router = APIRouter()

CCOrTeacher = Annotated[User, Depends(require_roles("admin", "course_creator", "teacher"))]
AllRoles = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=PaginatedResponse[MaterialOut])
async def list_materials(
    batch_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
    course_id: Optional[uuid.UUID] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    await verify_batch_access(session, current_user, batch_id, check_active=True)
    items, total = await material_service.list_materials(
        session, batch_id, course_id=course_id, page=page, per_page=per_page,
        institute_id=current_user.institute_id,
    )
    return PaginatedResponse(
        data=[MaterialOut(**item) for item in items],
        total=total, page=page, per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/upload-url", response_model=MaterialUploadUrlResponse)
async def get_upload_url(
    body: MaterialUploadUrlRequest,
    current_user: CCOrTeacher,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    import logging as _logging
    from app.utils.s3 import generate_upload_url

    # Atomically check storage quota and pre-increment (locked with FOR UPDATE)
    if current_user.institute_id:
        from app.services.institute_service import check_and_increment_storage_quota
        try:
            await check_and_increment_storage_quota(session, current_user.institute_id, body.file_size or 0)
        except ValueError as e:
            raise HTTPException(status_code=402, detail=str(e))

    try:
        url, object_key = generate_upload_url(
            file_name=body.file_name,
            content_type=body.content_type,
            batch_id=body.batch_id,
            institute_id=current_user.institute_id,
        )
    except Exception as exc:
        _logging.getLogger(__name__).error("S3 upload URL generation failed: %s", exc)
        raise HTTPException(status_code=503, detail="File storage service unavailable")
    return MaterialUploadUrlResponse(upload_url=url, object_key=object_key)


@router.post("", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
async def create_material(
    body: MaterialCreate,
    current_user: CCOrTeacher,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    material = await material_service.create_material(
        session, object_key=body.object_key, title=body.title,
        file_name=body.file_name, file_type=body.file_type,
        batch_id=body.batch_id, uploaded_by=current_user.id,
        description=body.description, file_size_bytes=body.file_size_bytes,
        course_id=body.course_id,
        institute_id=current_user.institute_id,
    )
    from app.utils.formatters import format_file_size
    from app.utils.transformers import to_api
    return MaterialOut(
        id=material.id, batch_id=material.batch_id, course_id=material.course_id,
        title=material.title, description=material.description,
        file_name=material.file_name, file_type=material.file_type.value,
        file_size=format_file_size(material.file_size),
        file_size_bytes=material.file_size, upload_date=material.created_at,
        uploaded_by=material.uploaded_by, created_at=material.created_at,
        uploaded_by_name=current_user.name,
        uploaded_by_role=to_api(current_user.role.value),
    )


@router.get("/{material_id}/download-url", response_model=MaterialDownloadUrlResponse)
async def get_download_url(
    material_id: uuid.UUID,
    current_user: AllRoles,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from app.utils.s3 import generate_download_url

    material = await material_service.get_material(session, material_id, institute_id=current_user.institute_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Students must have active, non-expired batch access to download
    if current_user.role == UserRole.student:
        from app.middleware.access_control import verify_batch_access
        await verify_batch_access(session, current_user, material.batch_id, check_active=True, check_expiry=True)

    try:
        url = generate_download_url(material.file_path, material.file_name)
    except Exception as exc:
        import logging as _logging
        _logging.getLogger(__name__).error("S3 download URL generation failed: %s", exc)
        raise HTTPException(status_code=503, detail="File storage service unavailable")
    return MaterialDownloadUrlResponse(download_url=url, file_name=material.file_name)


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_material(
    material_id: uuid.UUID,
    current_user: CCOrTeacher,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    material = await material_service.get_material(session, material_id, institute_id=current_user.institute_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Teachers can only delete own uploads
    if current_user.role.value == "teacher" and material.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete own uploads")

    try:
        await material_service.soft_delete_material(session, material_id, institute_id=current_user.institute_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Decrement storage usage and commit (soft_delete_material commits internally,
    # so decrement needs its own commit to persist)
    if current_user.institute_id and material.file_size:
        from app.services.institute_service import decrement_usage
        await decrement_usage(session, current_user.institute_id, storage_bytes=material.file_size)
        await session.commit()
