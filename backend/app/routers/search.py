import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.batch import Batch, StudentBatch
from app.models.course import Course, BatchCourse
from app.models.other import Announcement
from app.models.enums import UserRole, AnnouncementScope

router = APIRouter()

AllRoles = Annotated[User, Depends(get_current_user)]


@router.get("")
async def global_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(5, ge=1, le=10),
    current_user: AllRoles = None,
    session: AsyncSession = Depends(get_session),
):
    term = f"%{q}%"
    results: dict = {}

    # ── Users (admin only) ──────────────────────────────────────
    if current_user.role == UserRole.admin:
        stmt = (
            select(User)
            .where(
                User.deleted_at.is_(None),
                or_(User.name.ilike(term), User.email.ilike(term)),
            )
            .limit(limit)
        )
        rows = (await session.execute(stmt)).scalars().all()
        results["users"] = [
            {
                "id": str(u.id),
                "name": u.name,
                "email": u.email,
                "role": u.role.value,
                "type": "user",
            }
            for u in rows
        ]
    else:
        results["users"] = []

    # ── Batches (role-scoped) ───────────────────────────────────
    batch_stmt = select(Batch).where(
        Batch.deleted_at.is_(None),
        Batch.name.ilike(term),
    )

    if current_user.role == UserRole.course_creator:
        batch_stmt = batch_stmt.where(Batch.created_by == current_user.id)
    elif current_user.role == UserRole.teacher:
        batch_stmt = batch_stmt.where(Batch.teacher_id == current_user.id)
    elif current_user.role == UserRole.student:
        my_batch_ids = select(StudentBatch.batch_id).where(
            StudentBatch.student_id == current_user.id,
            StudentBatch.removed_at.is_(None),
        )
        batch_stmt = batch_stmt.where(Batch.id.in_(my_batch_ids))
    # admin: no extra filter

    batch_stmt = batch_stmt.limit(limit)
    batch_rows = (await session.execute(batch_stmt)).scalars().all()
    results["batches"] = [
        {"id": str(b.id), "name": b.name, "type": "batch"}
        for b in batch_rows
    ]

    # ── Courses (role-scoped via BatchCourse → Batch) ───────────
    course_stmt = select(Course).where(
        Course.deleted_at.is_(None),
        Course.title.ilike(term),
    )

    if current_user.role == UserRole.admin:
        pass  # see all
    elif current_user.role == UserRole.course_creator:
        cc_batch_ids = select(Batch.id).where(
            Batch.created_by == current_user.id,
            Batch.deleted_at.is_(None),
        )
        cc_course_ids = select(BatchCourse.course_id).where(
            BatchCourse.batch_id.in_(cc_batch_ids),
            BatchCourse.deleted_at.is_(None),
        )
        course_stmt = course_stmt.where(
            or_(
                Course.created_by == current_user.id,
                Course.id.in_(cc_course_ids),
            )
        )
    elif current_user.role == UserRole.teacher:
        teacher_batch_ids = select(Batch.id).where(
            Batch.teacher_id == current_user.id,
            Batch.deleted_at.is_(None),
        )
        teacher_course_ids = select(BatchCourse.course_id).where(
            BatchCourse.batch_id.in_(teacher_batch_ids),
            BatchCourse.deleted_at.is_(None),
        )
        course_stmt = course_stmt.where(Course.id.in_(teacher_course_ids))
    elif current_user.role == UserRole.student:
        student_batch_ids = select(StudentBatch.batch_id).where(
            StudentBatch.student_id == current_user.id,
            StudentBatch.removed_at.is_(None),
        )
        student_course_ids = select(BatchCourse.course_id).where(
            BatchCourse.batch_id.in_(student_batch_ids),
            BatchCourse.deleted_at.is_(None),
        )
        course_stmt = course_stmt.where(Course.id.in_(student_course_ids))

    course_stmt = course_stmt.limit(limit)
    course_rows = (await session.execute(course_stmt)).scalars().all()
    results["courses"] = [
        {"id": str(c.id), "title": c.title, "type": "course"}
        for c in course_rows
    ]

    # ── Announcements (role-scoped, matches announcement_service) ──
    ann_stmt = select(Announcement).where(
        Announcement.deleted_at.is_(None),
        Announcement.title.ilike(term),
    )

    if current_user.role == UserRole.student:
        s_batch_ids = select(StudentBatch.batch_id).where(
            StudentBatch.student_id == current_user.id,
            StudentBatch.removed_at.is_(None),
        )
        s_course_ids = select(BatchCourse.course_id).where(
            BatchCourse.batch_id.in_(s_batch_ids),
            BatchCourse.deleted_at.is_(None),
        )
        ann_stmt = ann_stmt.where(
            or_(
                Announcement.scope == AnnouncementScope.institute,
                Announcement.batch_id.in_(s_batch_ids),
                Announcement.course_id.in_(s_course_ids),
            )
        )
    elif current_user.role == UserRole.teacher:
        t_batch_ids = select(Batch.id).where(
            Batch.teacher_id == current_user.id,
            Batch.deleted_at.is_(None),
        )
        ann_stmt = ann_stmt.where(
            or_(
                Announcement.scope == AnnouncementScope.institute,
                Announcement.batch_id.in_(t_batch_ids),
            )
        )
    # admin / course_creator: see all announcements

    ann_stmt = ann_stmt.limit(limit)
    ann_rows = (await session.execute(ann_stmt)).scalars().all()
    results["announcements"] = [
        {
            "id": str(a.id),
            "title": a.title,
            "scope": a.scope.value,
            "type": "announcement",
        }
        for a in ann_rows
    ]

    return results
