"""Payment proof screenshot upload for the admissions onboarding wizard.

Two upload paths are exposed:

1. `POST /payment-proof/upload-url` — presigned-URL flow (kept for backward
   compatibility). Requires S3 bucket CORS to permit direct browser PUTs.
2. `POST /payment-proof/upload` — **primary path**. Browser posts multipart
   form-data to the LMS; the LMS uploads via boto3 server-side. No S3 CORS
   dependency. This is what the onboarding wizard uses today.

Admin + admissions_officer only. 30/min rate limit — onboardings are rare
but AOs may retry on flaky mobile connections.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.rbac.dependencies import require_permissions
from app.models.user import User
from app.utils.rate_limit import limiter
from app.utils.s3 import (
    generate_payment_proof_upload_url,
    generate_payment_proof_view_url,
    upload_payment_proof_bytes,
)

router = APIRouter()

CanUploadProof = Annotated[User, Depends(require_permissions("payment_proof.upload"))]
CanViewProof = Annotated[User, Depends(require_permissions("payment_proof.view"))]

# Hard cap — UI should also validate. Rejects at request-parsing time.
_MAX_FILENAME_LEN = 200
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_CT_PREFIXES = ("image/",)
_ALLOWED_CT_EXACT = {"application/pdf"}


class UploadUrlRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=_MAX_FILENAME_LEN)
    content_type: str = Field(min_length=1, max_length=128)
    fee_plan_id: uuid.UUID


class UploadUrlResponse(BaseModel):
    upload_url: str
    object_key: str
    view_url: str


class DirectUploadResponse(BaseModel):
    object_key: str
    view_url: str


def _validate_content_type(ct: str) -> None:
    ct_lower = ct.lower().strip()
    if ct_lower in _ALLOWED_CT_EXACT:
        return
    for prefix in _ALLOWED_CT_PREFIXES:
        if ct_lower.startswith(prefix):
            return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"content_type must be an image or PDF — got '{ct}'",
    )


@router.post(
    "/payment-proof/upload-url",
    response_model=UploadUrlResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("30/minute")
async def get_payment_proof_upload_url(
    request: Request,
    body: UploadUrlRequest,
    current_user: CanUploadProof,
):
    """Issue a presigned S3 PUT URL for a payment-proof screenshot.

    Direct-to-S3 upload path. Requires the bucket to have CORS configured to
    permit PUT from the admin frontend origin. Use ``/payment-proof/upload``
    instead if CORS is not configurable.
    """
    if current_user.institute_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admissions users must belong to an institute",
        )
    _validate_content_type(body.content_type)

    upload_url, object_key = generate_payment_proof_upload_url(
        file_name=body.file_name,
        content_type=body.content_type,
        institute_id=current_user.institute_id,
        fee_plan_id=body.fee_plan_id,
    )
    view_url = generate_payment_proof_view_url(object_key)

    return UploadUrlResponse(
        upload_url=upload_url,
        object_key=object_key,
        view_url=view_url,
    )


@router.post(
    "/payment-proof/upload",
    response_model=DirectUploadResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("30/minute")
async def upload_payment_proof(
    request: Request,
    current_user: CanUploadProof,
    file: UploadFile = File(...),
    fee_plan_id: str = Form(...),
):
    """Accept a payment-proof file directly and upload to S3 server-side.

    Bypasses S3 CORS by tunneling the upload through the LMS backend. The
    backend's IAM identity writes to the institute-scoped S3 prefix, the same
    path the presigned URL path would produce.
    """
    if current_user.institute_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admissions users must belong to an institute",
        )
    try:
        fee_plan_uuid = uuid.UUID(fee_plan_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="fee_plan_id must be a valid UUID",
        )

    ct = file.content_type or "application/octet-stream"
    _validate_content_type(ct)

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file",
        )
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {_MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
        )

    object_key = upload_payment_proof_bytes(
        data=data,
        file_name=file.filename or "payment_proof",
        content_type=ct,
        institute_id=current_user.institute_id,
        fee_plan_id=fee_plan_uuid,
    )
    view_url = generate_payment_proof_view_url(object_key)

    return DirectUploadResponse(object_key=object_key, view_url=view_url)
