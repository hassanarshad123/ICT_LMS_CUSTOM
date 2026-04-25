import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.announcement import Announcement
from app.models.batch import Batch, StudentBatch
from app.models.course import BatchCourse
from app.models.user import User
from app.models.enums import AnnouncementScope, UserRole


async def list_announcements(
    session: AsyncSession,
    current_user: User,
    scope: Optional[str] = None,
    batch_id: Optional[uuid.UUID] = None,
    course_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    query = select(Announcement).where(Announcement.deleted_at.is_(None), Announcement.institute_id == current_user.institute_id)
    count_query = select(func.count()).select_from(Announcement).where(Announcement.deleted_at.is_(None), Announcement.institute_id == current_user.institute_id)

    if search:
        term = f"%{search}%"
        query = query.where(Announcement.title.ilike(term))
        count_query = count_query.where(Announcement.title.ilike(term))

    if scope:
        query = query.where(Announcement.scope == AnnouncementScope(scope))
        count_query = count_query.where(Announcement.scope == AnnouncementScope(scope))

    if batch_id:
        query = query.where(Announcement.batch_id == batch_id)
        count_query = count_query.where(Announcement.batch_id == batch_id)

    if course_id:
        query = query.where(Announcement.course_id == course_id)
        count_query = count_query.where(Announcement.course_id == course_id)

    # Resolve effective role for custom role users
    _effective_role = current_user.role
    if current_user.role == UserRole.custom:
        _vt = getattr(current_user, "_view_type", None)
        if _vt == "admin_view":
            _effective_role = UserRole.admin
        elif _vt == "staff_view":
            _effective_role = UserRole.teacher
        else:
            _effective_role = UserRole.student

    # Role scoping for students/teachers
    if _effective_role == UserRole.student:
        my_batch_ids = (
            select(StudentBatch.batch_id)
            .join(Batch, StudentBatch.batch_id == Batch.id)
            .where(
                StudentBatch.student_id == current_user.id,
                StudentBatch.removed_at.is_(None),
                StudentBatch.is_active.is_(True),
                func.coalesce(StudentBatch.extended_end_date, Batch.end_date) >= date.today(),
            )
        )
        my_course_ids = select(BatchCourse.course_id).where(
            BatchCourse.batch_id.in_(my_batch_ids), BatchCourse.deleted_at.is_(None)
        )
        from sqlalchemy import or_
        scope_filter = or_(
            Announcement.scope == AnnouncementScope.institute,
            Announcement.batch_id.in_(my_batch_ids),
            Announcement.course_id.in_(my_course_ids),
        )
        query = query.where(scope_filter)
        count_query = count_query.where(scope_filter)
    elif _effective_role == UserRole.teacher:
        my_batch_ids = select(Batch.id).where(
            Batch.teacher_id == current_user.id, Batch.deleted_at.is_(None)
        )
        from sqlalchemy import or_
        scope_filter = or_(
            Announcement.scope == AnnouncementScope.institute,
            Announcement.batch_id.in_(my_batch_ids),
        )
        query = query.where(scope_filter)
        count_query = count_query.where(scope_filter)

    result = await session.execute(count_query)
    total = result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(Announcement.created_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    announcements = result.scalars().all()

    # Batch-fetch poster names in one query instead of N+1
    poster_ids = {a.posted_by for a in announcements if a.posted_by}
    poster_names = {}
    if poster_ids:
        r = await session.execute(select(User.id, User.name).where(User.id.in_(poster_ids)))
        poster_names = dict(r.all())

    items = []
    for a in announcements:
        items.append({
            "id": a.id,
            "title": a.title,
            "content": a.content,
            "scope": a.scope.value,
            "batch_id": a.batch_id,
            "course_id": a.course_id,
            "posted_by": a.posted_by,
            "posted_by_name": poster_names.get(a.posted_by),
            "expires_at": a.expires_at,
            "created_at": a.created_at,
        })

    return items, total


async def create_announcement(
    session: AsyncSession,
    title: str,
    content: str,
    scope: str,
    posted_by: uuid.UUID,
    batch_id: Optional[uuid.UUID] = None,
    course_id: Optional[uuid.UUID] = None,
    expires_at: Optional[datetime] = None,
    institute_id: Optional[uuid.UUID] = None,
) -> Announcement:
    ann_scope = AnnouncementScope(scope)

    # Validate scope constraints
    if ann_scope == AnnouncementScope.institute and (batch_id or course_id):
        raise ValueError("Institute scope must not have batch_id or course_id")
    if ann_scope == AnnouncementScope.batch and not batch_id:
        raise ValueError("Batch scope requires batch_id")
    if ann_scope == AnnouncementScope.course and not course_id:
        raise ValueError("Course scope requires course_id")

    announcement = Announcement(
        title=title,
        content=content,
        scope=ann_scope,
        batch_id=batch_id,
        course_id=course_id,
        posted_by=posted_by,
        expires_at=expires_at,
        institute_id=institute_id,
    )
    session.add(announcement)
    await session.commit()
    await session.refresh(announcement)
    return announcement


async def update_announcement(
    session: AsyncSession, announcement_id: uuid.UUID, institute_id: uuid.UUID = None, **fields
) -> Announcement:
    query = select(Announcement).where(
        Announcement.id == announcement_id, Announcement.deleted_at.is_(None)
    )
    if institute_id is not None:
        query = query.where(Announcement.institute_id == institute_id)
    result = await session.execute(query)
    ann = result.scalar_one_or_none()
    if not ann:
        raise ValueError("Announcement not found")

    for key, value in fields.items():
        if value is not None and hasattr(ann, key):
            setattr(ann, key, value)

    ann.updated_at = datetime.now(timezone.utc)
    session.add(ann)
    await session.commit()
    await session.refresh(ann)
    return ann


async def soft_delete_announcement(session: AsyncSession, announcement_id: uuid.UUID, institute_id: uuid.UUID = None) -> None:
    query = select(Announcement).where(
        Announcement.id == announcement_id, Announcement.deleted_at.is_(None)
    )
    if institute_id is not None:
        query = query.where(Announcement.institute_id == institute_id)
    result = await session.execute(query)
    ann = result.scalar_one_or_none()
    if not ann:
        raise ValueError("Announcement not found")

    ann.deleted_at = datetime.now(timezone.utc)
    session.add(ann)
    await session.commit()
