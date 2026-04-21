"""S3 utility for pre-signed URLs and object operations."""
import uuid
from typing import Optional

import boto3
from botocore.config import Config

from app.config import get_settings

settings = get_settings()

_client = None


def _get_client():
    global _client
    if _client is None:
        kwargs: dict = {
            "region_name": settings.AWS_REGION,
            # Use regional endpoint so pre-signed URLs resolve directly without
            # a 307 redirect (which breaks signed URLs in <img> tags).
            "endpoint_url": f"https://s3.{settings.AWS_REGION}.amazonaws.com",
            "config": Config(signature_version="s3v4"),
        }
        # Only pass explicit credentials when set. When empty, boto3 uses the
        # default credential chain (env vars → AWS config → EC2 instance profile).
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
        _client = boto3.client("s3", **kwargs)
    return _client


def _prefix(institute_id: Optional[uuid.UUID], path: str) -> str:
    """Prefix an S3 key with the institute_id for multi-tenant isolation."""
    if institute_id:
        return f"{institute_id}/{path}"
    return path


def generate_upload_url(
    file_name: str,
    content_type: str,
    batch_id: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
    expires_in: int = 3600,
) -> tuple[str, str]:
    """Returns (presigned_url, object_key)."""
    client = _get_client()
    object_key = _prefix(institute_id, f"materials/{batch_id}/{uuid.uuid4()}_{file_name}")

    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    return url, object_key


def generate_certificate_key(
    cert_id: str,
    institute_id: Optional[uuid.UUID] = None,
) -> str:
    """Return the S3 object key for a certificate PDF."""
    return _prefix(institute_id, f"certificates/{cert_id}.pdf")


def generate_download_url(object_key: str, file_name: str, expires_in: int = 3600) -> str:
    """Generate a presigned download URL.

    The object_key is already fully qualified (includes institute prefix if applicable),
    so no further prefixing is needed here.
    """
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": object_key,
            "ResponseContentDisposition": f'attachment; filename="{file_name}"',
        },
        ExpiresIn=expires_in,
    )


def generate_view_url(object_key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for inline viewing (no download header).

    Unlike generate_download_url, this does NOT set Content-Disposition,
    so browsers will display the image inline in <img> tags.
    """
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": object_key,
        },
        ExpiresIn=expires_in,
    )


def upload_object(file_bytes: bytes, object_key: str, content_type: str) -> None:
    """Upload bytes directly to S3."""
    client = _get_client()
    client.put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=object_key,
        Body=file_bytes,
        ContentType=content_type,
    )


def delete_object(object_key: str) -> None:
    """Delete an S3 object. The object_key is already fully qualified."""
    client = _get_client()
    client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=object_key)


def generate_payment_proof_upload_url(
    file_name: str,
    content_type: str,
    institute_id: uuid.UUID,
    fee_plan_id: uuid.UUID,
    expires_in: int = 3600,
) -> tuple[str, str]:
    """Return (presigned_put_url, object_key) for a payment-proof attachment.

    The caller is expected to PUT the file bytes directly to the URL within
    ``expires_in`` seconds with a Content-Type header matching ``content_type``.
    The returned object_key should be persisted on the FeePayment row so a
    signed GET URL can be regenerated later without tracking the upload URL.
    """
    client = _get_client()
    safe_name = file_name.replace("/", "_").replace("\\", "_")[:80]
    object_key = _prefix(
        institute_id,
        f"admissions/payment-proof/{fee_plan_id}/{uuid.uuid4()}_{safe_name}",
    )
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    return url, object_key


def generate_payment_proof_view_url(
    object_key: str,
    expires_in_seconds: int = 7 * 24 * 3600,
) -> str:
    """Return a presigned GET URL (default 7-day) for viewing a payment proof.

    Used by the Frappe Sales Order sync to populate the
    ``custom_zensbot_payment_proof_url`` custom field, and by the LMS frontend
    to display the thumbnail to the admissions officer after upload.
    """
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": object_key,
        },
        ExpiresIn=expires_in_seconds,
    )


def download_payment_proof_bytes(object_key: str) -> tuple[bytes, str, str]:
    """Fetch a payment-proof file from S3. Returns (body, content_type, file_name).

    Used by the Frappe Payment Entry sync to attach the screenshot directly
    to the PE doc in Frappe (not just link it via custom_zensbot_payment_proof_url).
    The returned file_name is the user's original upload name; the <uuid>_
    prefix the upload path adds is stripped.
    """
    import os
    client = _get_client()
    obj = client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=object_key)
    body = obj["Body"].read()
    content_type = obj.get("ContentType") or "application/octet-stream"
    tail = os.path.basename(object_key)
    file_name = tail.split("_", 1)[1] if "_" in tail else tail
    return body, content_type, file_name


def upload_payment_proof_bytes(
    *,
    data: bytes,
    file_name: str,
    content_type: str,
    institute_id: uuid.UUID,
    fee_plan_id: uuid.UUID,
) -> str:
    """Upload a payment-proof file to S3 server-side and return the object key.

    Used by the direct-upload endpoint (POST /payment-proof/upload) that
    tunnels the upload through the LMS backend to bypass S3 CORS.
    Key shape mirrors ``generate_payment_proof_upload_url``.
    """
    client = _get_client()
    safe_name = file_name.replace("/", "_").replace("\\", "_")[:80]
    object_key = _prefix(
        institute_id,
        f"admissions/payment-proof/{fee_plan_id}/{uuid.uuid4()}_{safe_name}",
    )
    client.put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=object_key,
        Body=data,
        ContentType=content_type,
    )
    return object_key
