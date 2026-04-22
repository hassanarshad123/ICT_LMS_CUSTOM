from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.institute import Institute, InstituteUsage, InstituteStatus
from app.models.user import User
from app.models.session import UserSession
from app.models.activity import ActivityLog
from app.models.notification import Notification
from app.models.batch import Batch, StudentBatch
from app.models.course import Course, BatchCourse, Lecture, CurriculumModule, BatchMaterial
from app.models.progress import LectureProgress
from app.models.certificate import Certificate
from app.models.billing import Invoice, Payment, InstituteBilling
from app.models.feedback import Feedback
from app.core.cache import cache

logger = logging.getLogger("ict_lms.purge")


@dataclass
class PurgeReport:
    institute_id: str = ""
    institute_name: str = ""
    sessions: int = 0
    activity_logs: int = 0
    notifications: int = 0
    lecture_progress: int = 0
    student_batches: int = 0
    materials: int = 0
    lectures: int = 0
    curriculum_modules: int = 0
    batch_courses: int = 0
    courses: int = 0
    batches: int = 0
    certificates: int = 0
    invoices: int = 0
    payments: int = 0
    billing_configs: int = 0
    feedback: int = 0
    users: int = 0
    usage_rows: int = 0
    institute_deleted: bool = False

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}


async def purge_institute(
    session: AsyncSession,
    institute_id: uuid.UUID,
    sa_id: uuid.UUID,
) -> PurgeReport:
    inst = await session.get(Institute, institute_id)
    if not inst:
        raise ValueError("Institute not found")
    if inst.status != InstituteStatus.archived:
        raise ValueError("Only archived institutes can be purged")

    report = PurgeReport(institute_id=str(institute_id), institute_name=inst.name)

    user_ids_result = await session.execute(
        select(User.id).where(User.institute_id == institute_id)
    )
    user_ids = [r[0] for r in user_ids_result.all()]

    r = await session.execute(delete(UserSession).where(UserSession.institute_id == institute_id))
    report.sessions = r.rowcount

    r = await session.execute(delete(ActivityLog).where(ActivityLog.institute_id == institute_id))
    report.activity_logs = r.rowcount

    r = await session.execute(delete(Notification).where(Notification.institute_id == institute_id))
    report.notifications = r.rowcount

    if user_ids:
        r = await session.execute(delete(LectureProgress).where(LectureProgress.user_id.in_(user_ids)))
        report.lecture_progress = r.rowcount

    batch_ids_result = await session.execute(
        select(Batch.id).where(Batch.institute_id == institute_id)
    )
    batch_ids = [r[0] for r in batch_ids_result.all()]

    if batch_ids:
        r = await session.execute(delete(StudentBatch).where(StudentBatch.batch_id.in_(batch_ids)))
        report.student_batches = r.rowcount

        r = await session.execute(delete(BatchMaterial).where(BatchMaterial.batch_id.in_(batch_ids)))
        report.materials = r.rowcount

    course_ids_result = await session.execute(
        select(Course.id).where(Course.institute_id == institute_id)
    )
    course_ids = [r[0] for r in course_ids_result.all()]

    if course_ids:
        r = await session.execute(delete(Lecture).where(Lecture.course_id.in_(course_ids)))
        report.lectures = r.rowcount

        r = await session.execute(delete(CurriculumModule).where(CurriculumModule.course_id.in_(course_ids)))
        report.curriculum_modules = r.rowcount

    if batch_ids and course_ids:
        r = await session.execute(delete(BatchCourse).where(BatchCourse.batch_id.in_(batch_ids)))
        report.batch_courses = r.rowcount

    r = await session.execute(delete(Course).where(Course.institute_id == institute_id))
    report.courses = r.rowcount

    r = await session.execute(delete(Batch).where(Batch.institute_id == institute_id))
    report.batches = r.rowcount

    r = await session.execute(delete(Certificate).where(Certificate.institute_id == institute_id))
    report.certificates = r.rowcount

    r = await session.execute(delete(Payment).where(Payment.institute_id == institute_id))
    report.payments = r.rowcount

    r = await session.execute(delete(Invoice).where(Invoice.institute_id == institute_id))
    report.invoices = r.rowcount

    r = await session.execute(delete(InstituteBilling).where(InstituteBilling.institute_id == institute_id))
    report.billing_configs = r.rowcount

    r = await session.execute(delete(Feedback).where(Feedback.institute_id == institute_id))
    report.feedback = r.rowcount

    r = await session.execute(delete(User).where(User.institute_id == institute_id))
    report.users = r.rowcount

    r = await session.execute(delete(InstituteUsage).where(InstituteUsage.institute_id == institute_id))
    report.usage_rows = r.rowcount

    await session.execute(delete(Institute).where(Institute.id == institute_id))
    report.institute_deleted = True

    purge_log = ActivityLog(
        user_id=sa_id,
        action="institute_purged",
        entity_type="institute",
        entity_id=institute_id,
        details=report.to_dict(),
        institute_id=None,
    )
    session.add(purge_log)

    await session.flush()

    try:
        await cache.invalidate_dashboard(str(institute_id))
    except Exception:
        pass

    logger.info("Institute %s purged: %s", institute_id, report.to_dict())
    return report
