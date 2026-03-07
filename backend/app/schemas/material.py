import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MaterialUploadUrlRequest(BaseModel):
    file_name: str
    content_type: str
    batch_id: uuid.UUID
    course_id: Optional[uuid.UUID] = None


class MaterialUploadUrlResponse(BaseModel):
    upload_url: str
    object_key: str


class MaterialCreate(BaseModel):
    object_key: str
    title: str
    description: Optional[str] = None
    file_name: str
    file_type: str
    file_size_bytes: Optional[int] = None
    batch_id: uuid.UUID
    course_id: Optional[uuid.UUID] = None


class MaterialOut(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    course_id: Optional[uuid.UUID] = None
    title: str
    description: Optional[str] = None
    file_name: str
    file_type: str
    file_size: Optional[str] = None
    file_size_bytes: Optional[int] = None
    upload_date: Optional[datetime] = None
    uploaded_by: Optional[uuid.UUID] = None
    uploaded_by_name: Optional[str] = None
    uploaded_by_role: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MaterialDownloadUrlResponse(BaseModel):
    download_url: str
    file_name: str
