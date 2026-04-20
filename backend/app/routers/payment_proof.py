"""Payment proof screenshot upload for the admissions onboarding wizard.

Two-step signed-URL flow:
  1. POST /payment-proof/upload-url — returns (upload_url, object_key, view_url)
  2. Browser PUTs bytes directly to upload_url with the declared content_type
  3. Frontend passes object_key + view_url to the onboarding submit

Admin + admissions_officer only. 30/min rate limit — onboardings are rare
but AOs may retry on flaky mobile connections.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.middleware.auth import require_roles
from app.models.user import User
from app.utils.rate_limit import limiter
from app.utils.s3 import (
    generate_payment_proof_upload_url,
    generate_payment_proof_view_url,
)

router = APIRouter()

AdminOrAO = Annotated[User, Depends(require_roles("admin", "admissions_officer"))]

# Hard cap — UI should also validate. Rejects at request-parsing time.
_MAX_FILENAME_LEN = 200
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
    current_user: AdminOrAO,
):
    """Issue a presigned S3 PUT URL for a payment-proof screenshot.

    The returned ``object_key`` must be passed back on the onboarding submit
    so the LMS can persist it on the FeePayment row.
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
