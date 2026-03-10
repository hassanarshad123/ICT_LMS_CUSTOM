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
        _client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
            config=Config(signature_version="s3v4"),
        )
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


def delete_object(object_key: str) -> None:
    """Delete an S3 object. The object_key is already fully qualified."""
    client = _get_client()
    client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=object_key)
