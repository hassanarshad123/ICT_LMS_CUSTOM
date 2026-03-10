import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.course import CurriculumModule


async def list_modules(
    session: AsyncSession, course_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> list[CurriculumModule]:
    query = (
        select(CurriculumModule)
        .where(
            CurriculumModule.course_id == course_id,
            CurriculumModule.deleted_at.is_(None),
        )
        .order_by(CurriculumModule.sequence_order)
    )
    if institute_id is not None:
        query = query.where(CurriculumModule.institute_id == institute_id)
    result = await session.execute(query)
    return list(result.scalars().all())


async def create_module(
    session: AsyncSession,
    course_id: uuid.UUID,
    title: str,
    description: Optional[str],
    topics: Optional[list[str]],
    created_by: uuid.UUID,
    institute_id: Optional[uuid.UUID] = None,
) -> CurriculumModule:
    # Auto-assign sequence_order
    result = await session.execute(
        select(func.coalesce(func.max(CurriculumModule.sequence_order), 0)).where(
            CurriculumModule.course_id == course_id,
            CurriculumModule.deleted_at.is_(None),
        )
    )
    max_order = result.scalar() or 0

    module = CurriculumModule(
        course_id=course_id,
        title=title,
        description=description,
        topics=topics,
        sequence_order=max_order + 1,
        created_by=created_by,
        institute_id=institute_id,
    )
    session.add(module)
    await session.commit()
    await session.refresh(module)
    return module


async def update_module(
    session: AsyncSession, module_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None, **fields
) -> CurriculumModule:
    query = select(CurriculumModule).where(
        CurriculumModule.id == module_id, CurriculumModule.deleted_at.is_(None)
    )
    if institute_id is not None:
        query = query.where(CurriculumModule.institute_id == institute_id)
    result = await session.execute(query)
    module = result.scalar_one_or_none()
    if not module:
        raise ValueError("Module not found")

    for key, value in fields.items():
        if value is not None and hasattr(module, key):
            setattr(module, key, value)

    module.updated_at = datetime.now(timezone.utc)
    session.add(module)
    await session.commit()
    await session.refresh(module)
    return module


async def soft_delete_module(
    session: AsyncSession, module_id: uuid.UUID, institute_id: Optional[uuid.UUID] = None
) -> None:
    query = select(CurriculumModule).where(
        CurriculumModule.id == module_id, CurriculumModule.deleted_at.is_(None)
    )
    if institute_id is not None:
        query = query.where(CurriculumModule.institute_id == institute_id)
    result = await session.execute(query)
    module = result.scalar_one_or_none()
    if not module:
        raise ValueError("Module not found")

    module.deleted_at = datetime.now(timezone.utc)
    session.add(module)
    await session.commit()


async def reorder_module(
    session: AsyncSession, module_id: uuid.UUID, new_order: int,
    institute_id: Optional[uuid.UUID] = None,
) -> CurriculumModule:
    query = select(CurriculumModule).where(
        CurriculumModule.id == module_id, CurriculumModule.deleted_at.is_(None)
    )
    if institute_id is not None:
        query = query.where(CurriculumModule.institute_id == institute_id)
    result = await session.execute(query)
    module = result.scalar_one_or_none()
    if not module:
        raise ValueError("Module not found")

    old_order = module.sequence_order
    if old_order == new_order:
        return module

    # Shift other modules
    if new_order < old_order:
        r = await session.execute(
            select(CurriculumModule).where(
                CurriculumModule.course_id == module.course_id,
                CurriculumModule.deleted_at.is_(None),
                CurriculumModule.sequence_order >= new_order,
                CurriculumModule.sequence_order < old_order,
                CurriculumModule.id != module_id,
            )
        )
        for m in r.scalars().all():
            m.sequence_order += 1
            session.add(m)
    else:
        r = await session.execute(
            select(CurriculumModule).where(
                CurriculumModule.course_id == module.course_id,
                CurriculumModule.deleted_at.is_(None),
                CurriculumModule.sequence_order > old_order,
                CurriculumModule.sequence_order <= new_order,
                CurriculumModule.id != module_id,
            )
        )
        for m in r.scalars().all():
            m.sequence_order -= 1
            session.add(m)

    module.sequence_order = new_order
    session.add(module)
    await session.commit()
    await session.refresh(module)
    return module
