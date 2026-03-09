import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.course import BatchMaterial
from app.models.user import User
from app.models.enums import MaterialFileType
from app.utils.formatters import format_file_size
from app.utils.transformers import to_db, to_api


async def list_materials(
    session: AsyncSession,
    batch_id: uuid.UUID,
    course_id: Optional[uuid.UUID] = None,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[dict], int]:
    query = select(BatchMaterial).where(
        BatchMaterial.batch_id == batch_id, BatchMaterial.deleted_at.is_(None)
    )
    count_query = select(func.count()).select_from(BatchMaterial).where(
        BatchMaterial.batch_id == batch_id, BatchMaterial.deleted_at.is_(None)
    )

    if course_id:
        query = query.where(BatchMaterial.course_id == course_id)
        count_query = count_query.where(BatchMaterial.course_id == course_id)

    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(BatchMaterial.created_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    materials = result.scalars().all()

    # Batch-fetch uploaders in one query instead of N+1
    uploader_ids = {m.uploaded_by for m in materials if m.uploaded_by}
    uploaders = {}
    if uploader_ids:
        r = await session.execute(select(User).where(User.id.in_(uploader_ids)))
        uploaders = {u.id: u for u in r.scalars().all()}

    items = []
    for m in materials:
        uploader = uploaders.get(m.uploaded_by)
        items.append({
            "id": m.id,
            "batch_id": m.batch_id,
            "course_id": m.course_id,
            "title": m.title,
            "description": m.description,
            "file_name": m.file_name,
            "file_type": m.file_type.value,
            "file_size": format_file_size(m.file_size),
            "file_size_bytes": m.file_size,
            "upload_date": m.created_at,
            "uploaded_by": m.uploaded_by,
            "uploaded_by_name": uploader.name if uploader else None,
            "uploaded_by_role": to_api(uploader.role.value) if uploader else None,
            "created_at": m.created_at,
        })

    return items, total


async def create_material(
    session: AsyncSession,
    object_key: str,
    title: str,
    file_name: str,
    file_type: str,
    batch_id: uuid.UUID,
    uploaded_by: uuid.UUID,
    description: Optional[str] = None,
    file_size_bytes: Optional[int] = None,
    course_id: Optional[uuid.UUID] = None,
    mime_type: Optional[str] = None,
) -> BatchMaterial:
    material = BatchMaterial(
        batch_id=batch_id,
        course_id=course_id,
        title=title,
        description=description,
        file_name=file_name,
        file_path=object_key,
        file_type=MaterialFileType(to_db(file_type)),
        file_size=file_size_bytes,
        mime_type=mime_type,
        uploaded_by=uploaded_by,
    )
    session.add(material)
    await session.commit()
    await session.refresh(material)
    return material


async def get_material(session: AsyncSession, material_id: uuid.UUID) -> BatchMaterial | None:
    result = await session.execute(
        select(BatchMaterial).where(
            BatchMaterial.id == material_id, BatchMaterial.deleted_at.is_(None)
        )
    )
    return result.scalar_one_or_none()


async def soft_delete_material(session: AsyncSession, material_id: uuid.UUID) -> None:
    material = await get_material(session, material_id)
    if not material:
        raise ValueError("Material not found")

    material.deleted_at = datetime.now(timezone.utc)
    session.add(material)
    await session.commit()
