"""S3 utility for pre-signed URLs and object operations."""
import uuid

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


def generate_upload_url(
    file_name: str,
    content_type: str,
    batch_id: uuid.UUID,
    expires_in: int = 3600,
) -> tuple[str, str]:
    """Returns (presigned_url, object_key)."""
    client = _get_client()
    object_key = f"materials/{batch_id}/{uuid.uuid4()}_{file_name}"

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


def generate_download_url(object_key: str, file_name: str, expires_in: int = 3600) -> str:
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
    client = _get_client()
    client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=object_key)
