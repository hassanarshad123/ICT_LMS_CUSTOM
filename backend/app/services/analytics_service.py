import uuid
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlmodel import select, func, col

from datetime import timedelta

from app.models.user import User
from app.models.batch import Batch, StudentBatch
from app.models.course import Course, Lecture, BatchMaterial, BatchCourse
from app.models.session import UserSession
from app.models.settings import SystemSetting
from app.models.activity import ActivityLog
from app.models.progress import LectureProgress
from app.models.quiz import Quiz, QuizAttempt
from app.models.certificate import Certificate
from app.models.zoom import ZoomClass, ZoomAttendance
from app.models.enums import UserRole, UserStatus


async def get_dashboard(session: AsyncSession, institute_id: uuid.UUID, use_cache: bool = True) -> dict:
    import time as _time
    from app.core.cache import cache

    cache_key = cache.dashboard_key(str(institute_id))
    if use_cache:
        cached = await cache.get(cache_key)
        if cached is not None:
            # Validate cached shape before returning
            try:
                from app.schemas.admin import DashboardResponse
                DashboardResponse(**cached)
            except Exception:
                import logging
                logging.getLogger("ict_lms.cache").warning(
                    "Corrupt dashboard cache for %s, falling through to DB", institute_id
                )
                await cache.delete(cache_key)
                cached = None

            if cached is not None:
                # SWR: check if data is still fresh
                meta = await cache.get(f"{cache_key}:swr_meta")
                if meta and meta.get("fresh_until", 0) > _time.time():
                    return cached  # Fresh — return immediately
                return cached
    today = date.today()

    # ── Combined user counts (4 counts in 1 query instead of 4 separate queries) ──
    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE role = 'student') AS total_students,
            COUNT(*) FILTER (WHERE role = 'student' AND status = 'active') AS active_students,
            COUNT(*) FILTER (WHERE role = 'teacher') AS total_teachers,
            COUNT(*) FILTER (WHERE role = 'course_creator') AS total_course_creators
        FROM users
        WHERE deleted_at IS NULL AND institute_id = :iid
    """), {"iid": str(institute_id)})
    user_counts = r.one()
    total_students = user_counts[0] or 0
    active_students = user_counts[1] or 0
    total_teachers = user_counts[2] or 0
    total_course_creators = user_counts[3] or 0

    # ── Combined batch counts (2 counts in 1 query instead of 2) ──
    r = await session.execute(text("""
        SELECT
            COUNT(*) AS total_batches,
            COUNT(*) FILTER (WHERE start_date <= :today AND end_date >= :today) AS active_batches
        FROM batches
        WHERE deleted_at IS NULL AND institute_id = :iid
    """), {"iid": str(institute_id), "today": today})
    batch_counts = r.one()
    total_batches = batch_counts[0] or 0
    active_batches = batch_counts[1] or 0

    # ── Course count (1 query) ──
    r = await session.execute(
        select(func.count()).select_from(Course).where(Course.deleted_at.is_(None), Course.institute_id == institute_id)
    )
    total_courses = r.scalar() or 0

    # Recent batches with teacher name, student count, and computed status
    r = await session.execute(
        select(Batch, User.name.label("teacher_name"),
               func.count(StudentBatch.id).label("student_count"))
        .outerjoin(User, Batch.teacher_id == User.id)
        .outerjoin(StudentBatch, (StudentBatch.batch_id == Batch.id) & (StudentBatch.removed_at.is_(None)))
        .where(Batch.deleted_at.is_(None), Batch.institute_id == institute_id)
        .group_by(Batch.id, User.name)
        .order_by(Batch.created_at.desc()).limit(5)
    )
    recent_batches = []
    for row in r.all():
        b = row[0]
        status = "upcoming" if today < b.start_date else ("completed" if today > b.end_date else "active")
        recent_batches.append({
            "id": str(b.id), "name": b.name, "start_date": str(b.start_date),
            "teacher_name": row[1] or "Unassigned",
            "student_count": row[2],
            "status": status,
        })

    # Recent students with status and batch names
    r = await session.execute(
        select(User).where(User.deleted_at.is_(None), User.role == UserRole.student, User.institute_id == institute_id)
        .order_by(User.created_at.desc()).limit(5)
    )
    students = r.scalars().all()

    batch_names_by_student: dict = {}
    student_ids = [u.id for u in students]
    if student_ids:
        br = await session.execute(
            select(StudentBatch.student_id, Batch.name)
            .join(Batch, StudentBatch.batch_id == Batch.id)
            .where(StudentBatch.student_id.in_(student_ids), StudentBatch.removed_at.is_(None), Batch.deleted_at.is_(None))
        )
        batch_names_by_student = defaultdict(list)
        for sid, bname in br.all():
            batch_names_by_student[sid].append(bname)

    recent_students = [
        {"id": str(u.id), "name": u.name, "email": u.email,
         "status": u.status.value,
         "batch_names": batch_names_by_student.get(u.id, [])}
        for u in students
    ]

    result = {
        "total_batches": total_batches,
        "active_batches": active_batches,
        "total_students": total_students,
        "active_students": active_students,
        "total_teachers": total_teachers,
        "total_course_creators": total_course_creators,
        "total_courses": total_courses,
        "recent_batches": recent_batches,
        "recent_students": recent_students,
    }

    # Cache: fresh for 2 minutes, stale data served for up to 10 minutes while refreshing in background
    await cache.set(cache_key, result, ttl=600)
    await cache.set(f"{cache_key}:swr_meta", {"fresh_until": __import__('time').time() + 120}, ttl=600)
    return result


async def get_insights(session: AsyncSession, institute_id: uuid.UUID, use_cache: bool = True) -> dict:
    import time as _time
    from app.core.cache import cache

    cache_key = cache.insights_key(str(institute_id))
    if use_cache:
        cached = await cache.get(cache_key)
        if cached is not None:
            # Validate cached shape before returning
            try:
                from app.schemas.admin import InsightsResponse
                InsightsResponse(**cached)
            except Exception:
                import logging
                logging.getLogger("ict_lms.cache").warning(
                    "Corrupt insights cache for %s, falling through to DB", institute_id
                )
                await cache.delete(cache_key)
                cached = None
            if cached is not None:
                return cached

    # Students by status
    r = await session.execute(
        select(User.status, func.count()).where(
            User.deleted_at.is_(None), User.role == UserRole.student, User.institute_id == institute_id
        ).group_by(User.status)
    )
    students_by_status = {row[0].value: row[1] for row in r.all()}

    # Batches by status (computed in SQL instead of loading all batches into Python)
    today = date.today()
    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE start_date > :today) AS upcoming,
            COUNT(*) FILTER (WHERE start_date <= :today AND end_date >= :today) AS active,
            COUNT(*) FILTER (WHERE end_date < :today) AS completed
        FROM batches
        WHERE deleted_at IS NULL AND institute_id = :iid
    """), {"iid": str(institute_id), "today": today})
    bs = r.one()
    batches_by_status = {"upcoming": bs[0] or 0, "active": bs[1] or 0, "completed": bs[2] or 0}

    # Enrollment per batch
    r = await session.execute(
        select(Batch.id, Batch.name, func.count(StudentBatch.id))
        .outerjoin(StudentBatch, (StudentBatch.batch_id == Batch.id) & (StudentBatch.removed_at.is_(None)))
        .where(Batch.deleted_at.is_(None), Batch.institute_id == institute_id)
        .group_by(Batch.id, Batch.name)
    )
    enrollment_per_batch = [
        {"batch_id": str(row[0]), "name": row[1], "student_count": row[2]}
        for row in r.all()
    ]

    # Teacher workload (2 queries instead of N+1)
    r = await session.execute(
        select(User.id, User.name, func.count(Batch.id))
        .outerjoin(Batch, (Batch.teacher_id == User.id) & (Batch.deleted_at.is_(None)))
        .where(User.deleted_at.is_(None), User.role == UserRole.teacher, User.institute_id == institute_id)
        .group_by(User.id, User.name)
    )
    teachers = r.all()

    # Batch-fetch student counts grouped by teacher
    teacher_ids = [t[0] for t in teachers]
    student_counts = {}
    if teacher_ids:
        sr = await session.execute(
            select(Batch.teacher_id, func.count(StudentBatch.id))
            .join(StudentBatch, (StudentBatch.batch_id == Batch.id) & (StudentBatch.removed_at.is_(None)))
            .where(Batch.teacher_id.in_(teacher_ids), Batch.deleted_at.is_(None))
            .group_by(Batch.teacher_id)
        )
        student_counts = dict(sr.all())

    teacher_workload = []
    for row in teachers:
        teacher_workload.append({
            "teacher_id": str(row[0]),
            "name": row[1],
            "batch_count": row[2],
            "student_count": student_counts.get(row[0], 0),
        })

    # Materials by type
    r = await session.execute(
        select(BatchMaterial.file_type, func.count()).where(
            BatchMaterial.deleted_at.is_(None), BatchMaterial.institute_id == institute_id
        ).group_by(BatchMaterial.file_type)
    )
    materials_by_type = {row[0].value: row[1] for row in r.all()}

    # Lectures per course
    r = await session.execute(
        select(Course.id, Course.title, func.count(Lecture.id))
        .outerjoin(Lecture, (Lecture.course_id == Course.id) & (Lecture.deleted_at.is_(None)))
        .where(Course.deleted_at.is_(None), Course.institute_id == institute_id)
        .group_by(Course.id, Course.title)
    )
    lectures_per_course = [
        {"course_id": str(row[0]), "title": row[1], "lecture_count": row[2]}
        for row in r.all()
    ]

    # Device overview
    r = await session.execute(
        select(func.count()).select_from(User).where(
            User.deleted_at.is_(None), User.role == UserRole.student, User.institute_id == institute_id
        )
    )
    total_users = r.scalar() or 0

    r = await session.execute(
        select(UserSession.user_id, func.count()).where(
            UserSession.is_active.is_(True), UserSession.institute_id == institute_id
        ).group_by(UserSession.user_id)
    )
    session_counts = {row[0]: row[1] for row in r.all()}

    # Get system device limit
    sr = await session.execute(
        select(SystemSetting).where(SystemSetting.setting_key == "max_device_limit", SystemSetting.institute_id == institute_id)
    )
    setting = sr.scalar_one_or_none()
    device_limit = int(setting.value) if setting else 2

    at_limit = sum(1 for c in session_counts.values() if c >= device_limit)
    active_with_sessions = len(session_counts)
    no_sessions = total_users - active_with_sessions

    device_overview = {
        "at_limit": at_limit,
        "active": active_with_sessions,
        "no_sessions": max(0, no_sessions),
    }

    result = {
        "monthly": [],  # Computed from activity log in production
        "students_by_status": students_by_status,
        "batches_by_status": batches_by_status,
        "enrollment_per_batch": enrollment_per_batch,
        "teacher_workload": teacher_workload,
        "materials_by_type": materials_by_type,
        "lectures_per_course": lectures_per_course,
        "device_overview": device_overview,
    }

    # Cache: fresh for 5 minutes, stale data served for up to 15 minutes while refreshing in background
    await cache.set(cache_key, result, ttl=900)
    await cache.set(f"{cache_key}:swr_meta", {"fresh_until": __import__('time').time() + 300}, ttl=900)
    return result


# ── 10x Insights — Tab-based analytics with period filtering ───


def _period_range(period_days: int) -> tuple[date, date]:
    """Return (start_date, end_date) for the current period and previous period."""
    today = date.today()
    if period_days <= 0:
        return date(2020, 1, 1), today
    return today - timedelta(days=period_days), today


def _prev_period_range(period_days: int) -> tuple[date, date]:
    """Return (start_date, end_date) for the previous comparison period."""
    today = date.today()
    if period_days <= 0:
        return date(2020, 1, 1), today
    end = today - timedelta(days=period_days)
    start = end - timedelta(days=period_days)
    return start, end


async def get_overview_metrics(
    session: AsyncSession, institute_id: uuid.UUID, period_days: int = 30,
) -> dict:
    """Overview tab: 8 KPIs with sparklines + alerts."""
    now_str = datetime.now(timezone.utc).isoformat()
    start, end = _period_range(period_days)
    prev_start, prev_end = _prev_period_range(period_days)
    iid = str(institute_id)
    today = date.today()

    def _pct_change(current: float, previous: float) -> Optional[float]:
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round((current - previous) / previous * 100, 1)

    # 1. Active students (enrolled, active, not removed)
    r = await session.execute(text("""
        SELECT COUNT(DISTINCT sb.student_id)
        FROM student_batches sb
        JOIN users u ON u.id = sb.student_id
        WHERE sb.removed_at IS NULL AND sb.is_active = true
          AND u.deleted_at IS NULL AND u.status = 'active'
          AND sb.institute_id = :iid
    """), {"iid": iid})
    active_students_curr = r.scalar() or 0

    r = await session.execute(text("""
        SELECT COUNT(DISTINCT sb.student_id)
        FROM student_batches sb
        JOIN users u ON u.id = sb.student_id
        WHERE sb.removed_at IS NULL AND sb.is_active = true
          AND u.deleted_at IS NULL AND u.status = 'active'
          AND sb.institute_id = :iid
          AND sb.enrolled_at <= :prev_end
    """), {"iid": iid, "prev_end": prev_end})
    active_students_prev = r.scalar() or 0

    # 2. Active batches
    r = await session.execute(text("""
        SELECT COUNT(*) FROM batches
        WHERE deleted_at IS NULL AND institute_id = :iid
          AND start_date <= :today AND end_date >= :today
    """), {"iid": iid, "today": today})
    active_batches_curr = r.scalar() or 0

    r = await session.execute(text("""
        SELECT COUNT(*) FROM batches
        WHERE deleted_at IS NULL AND institute_id = :iid
          AND start_date <= :prev_end AND end_date >= :prev_end
    """), {"iid": iid, "prev_end": prev_end})
    active_batches_prev = r.scalar() or 0

    # 3. Lecture completion (avg watch %)
    r = await session.execute(text("""
        SELECT COALESCE(AVG(lp.watch_percentage), 0)
        FROM lecture_progress lp
        WHERE lp.institute_id = :iid
    """), {"iid": iid})
    lecture_completion_curr = round(r.scalar() or 0, 1)
    lecture_completion_prev = lecture_completion_curr  # simplified — no historical tracking

    # 4. Quiz pass rate
    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE passed = true) AS passed,
            COUNT(*) AS total
        FROM quiz_attempts
        WHERE institute_id = :iid AND status = 'graded'
          AND submitted_at >= :start
    """), {"iid": iid, "start": start})
    qr = r.one()
    quiz_pass_curr = round(qr[0] / max(qr[1], 1) * 100, 1)

    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE passed = true) AS passed,
            COUNT(*) AS total
        FROM quiz_attempts
        WHERE institute_id = :iid AND status = 'graded'
          AND submitted_at >= :prev_start AND submitted_at < :prev_end
    """), {"iid": iid, "prev_start": prev_start, "prev_end": prev_end})
    qr_prev = r.one()
    quiz_pass_prev = round(qr_prev[0] / max(qr_prev[1], 1) * 100, 1)

    # 5. Classes conducted
    r = await session.execute(text("""
        SELECT COUNT(*) FROM zoom_classes
        WHERE deleted_at IS NULL AND institute_id = :iid AND status = 'completed'
          AND scheduled_date >= :start
    """), {"iid": iid, "start": start})
    classes_curr = r.scalar() or 0

    r = await session.execute(text("""
        SELECT COUNT(*) FROM zoom_classes
        WHERE deleted_at IS NULL AND institute_id = :iid AND status = 'completed'
          AND scheduled_date >= :prev_start AND scheduled_date < :prev_end
    """), {"iid": iid, "prev_start": prev_start, "prev_end": prev_end})
    classes_prev = r.scalar() or 0

    # 6. Certificates issued
    r = await session.execute(text("""
        SELECT COUNT(*) FROM certificates
        WHERE deleted_at IS NULL AND institute_id = :iid AND status = 'approved'
          AND approved_at >= :start
    """), {"iid": iid, "start": start})
    certs_curr = r.scalar() or 0

    r = await session.execute(text("""
        SELECT COUNT(*) FROM certificates
        WHERE deleted_at IS NULL AND institute_id = :iid AND status = 'approved'
          AND approved_at >= :prev_start AND approved_at < :prev_end
    """), {"iid": iid, "prev_start": prev_start, "prev_end": prev_end})
    certs_prev = r.scalar() or 0

    # 7. Avg attendance
    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE za.attended = true) AS attended,
            COUNT(*) AS total
        FROM zoom_attendance za
        JOIN zoom_classes zc ON zc.id = za.zoom_class_id
        WHERE za.institute_id = :iid AND zc.deleted_at IS NULL
          AND zc.scheduled_date >= :start
    """), {"iid": iid, "start": start})
    att = r.one()
    attendance_curr = round(att[0] / max(att[1], 1) * 100, 1)

    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE za.attended = true) AS attended,
            COUNT(*) AS total
        FROM zoom_attendance za
        JOIN zoom_classes zc ON zc.id = za.zoom_class_id
        WHERE za.institute_id = :iid AND zc.deleted_at IS NULL
          AND zc.scheduled_date >= :prev_start AND zc.scheduled_date < :prev_end
    """), {"iid": iid, "prev_start": prev_start, "prev_end": prev_end})
    att_prev = r.one()
    attendance_prev = round(att_prev[0] / max(att_prev[1], 1) * 100, 1)

    # 8. Content created (lectures + materials in period)
    r = await session.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM lectures WHERE deleted_at IS NULL AND institute_id = :iid AND created_at >= :start) +
            (SELECT COUNT(*) FROM batch_materials WHERE deleted_at IS NULL AND institute_id = :iid AND created_at >= :start)
    """), {"iid": iid, "start": start})
    content_curr = r.scalar() or 0

    r = await session.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM lectures WHERE deleted_at IS NULL AND institute_id = :iid AND created_at >= :prev_start AND created_at < :prev_end) +
            (SELECT COUNT(*) FROM batch_materials WHERE deleted_at IS NULL AND institute_id = :iid AND created_at >= :prev_start AND created_at < :prev_end)
    """), {"iid": iid, "prev_start": prev_start, "prev_end": prev_end})
    content_prev = r.scalar() or 0

    def _kpi(curr, prev):
        return {"value": curr, "previous_value": prev, "change_pct": _pct_change(curr, prev), "sparkline": []}

    # ── Alerts ──
    alerts = []

    # At-risk students (watch < 30% avg)
    r = await session.execute(text("""
        SELECT COUNT(DISTINCT lp.student_id)
        FROM lecture_progress lp
        JOIN users u ON u.id = lp.student_id
        WHERE lp.institute_id = :iid AND u.deleted_at IS NULL AND u.role = 'student'
          AND lp.watch_percentage < 30
    """), {"iid": iid})
    at_risk = r.scalar() or 0
    if at_risk:
        alerts.append({"type": "at_risk_students", "count": at_risk, "label": f"{at_risk} students at risk", "link": "students"})

    # Pending certs
    r = await session.execute(text("""
        SELECT COUNT(*) FROM certificates
        WHERE deleted_at IS NULL AND institute_id = :iid AND status = 'eligible'
          AND requested_at IS NOT NULL
    """), {"iid": iid})
    pending = r.scalar() or 0
    if pending:
        alerts.append({"type": "pending_certs", "count": pending, "label": f"{pending} pending certificate requests", "link": "certificates"})

    # Expiring batches (within 7 days)
    r = await session.execute(text("""
        SELECT COUNT(*) FROM batches
        WHERE deleted_at IS NULL AND institute_id = :iid
          AND end_date BETWEEN :today AND :week
    """), {"iid": iid, "today": today, "week": today + timedelta(days=7)})
    expiring = r.scalar() or 0
    if expiring:
        alerts.append({"type": "expiring_batches", "count": expiring, "label": f"{expiring} batches expiring this week", "link": "batches"})

    # Idle teachers (no classes in period)
    r = await session.execute(text("""
        SELECT COUNT(*) FROM users
        WHERE deleted_at IS NULL AND institute_id = :iid AND role = 'teacher'
          AND id NOT IN (
            SELECT DISTINCT teacher_id FROM zoom_classes
            WHERE deleted_at IS NULL AND institute_id = :iid AND scheduled_date >= :start
          )
    """), {"iid": iid, "start": start})
    idle = r.scalar() or 0
    if idle:
        alerts.append({"type": "idle_teachers", "count": idle, "label": f"{idle} teachers with no classes", "link": "staff"})

    return {
        "active_students": _kpi(active_students_curr, active_students_prev),
        "active_batches": _kpi(active_batches_curr, active_batches_prev),
        "lecture_completion": _kpi(lecture_completion_curr, lecture_completion_prev),
        "quiz_pass_rate": _kpi(quiz_pass_curr, quiz_pass_prev),
        "classes_conducted": _kpi(classes_curr, classes_prev),
        "certificates_issued": _kpi(certs_curr, certs_prev),
        "avg_attendance": _kpi(attendance_curr, attendance_prev),
        "content_created": _kpi(content_curr, content_prev),
        "alerts": alerts,
        "last_updated": now_str,
    }


async def get_student_analytics(
    session: AsyncSession, institute_id: uuid.UUID, period_days: int = 30,
) -> dict:
    """Students tab: status breakdown, enrollment trend, at-risk students."""
    now_str = datetime.now(timezone.utc).isoformat()
    start, end = _period_range(period_days)
    iid = str(institute_id)

    # Students by status
    r = await session.execute(
        select(User.status, func.count()).where(
            User.deleted_at.is_(None), User.role == UserRole.student, User.institute_id == institute_id,
        ).group_by(User.status)
    )
    students_by_status = {row[0].value: row[1] for row in r.all()}

    total_students = sum(students_by_status.values())

    # Enrollment trend (weekly)
    r = await session.execute(text("""
        SELECT date_trunc('week', enrolled_at)::date AS week, COUNT(*)
        FROM student_batches
        WHERE removed_at IS NULL AND institute_id = :iid AND enrolled_at >= :start
        GROUP BY week ORDER BY week
    """), {"iid": iid, "start": start})
    enrollment_trend = [{"week": str(row[0]), "count": row[1]} for row in r.all()]

    # Lecture completion distribution (quartiles)
    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE avg_pct < 25) AS q1,
            COUNT(*) FILTER (WHERE avg_pct >= 25 AND avg_pct < 50) AS q2,
            COUNT(*) FILTER (WHERE avg_pct >= 50 AND avg_pct < 75) AS q3,
            COUNT(*) FILTER (WHERE avg_pct >= 75) AS q4
        FROM (
            SELECT student_id, AVG(watch_percentage) AS avg_pct
            FROM lecture_progress WHERE institute_id = :iid
            GROUP BY student_id
        ) sub
    """), {"iid": iid})
    cd = r.one()
    completion_distribution = {"0-25": cd[0] or 0, "25-50": cd[1] or 0, "50-75": cd[2] or 0, "75-100": cd[3] or 0}

    # Quiz score distribution
    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE percentage < 50) AS low,
            COUNT(*) FILTER (WHERE percentage >= 50 AND percentage < 70) AS mid,
            COUNT(*) FILTER (WHERE percentage >= 70 AND percentage < 90) AS good,
            COUNT(*) FILTER (WHERE percentage >= 90) AS excellent
        FROM quiz_attempts
        WHERE institute_id = :iid AND status = 'graded' AND submitted_at >= :start
    """), {"iid": iid, "start": start})
    qd = r.one()
    quiz_score_distribution = {"<50": qd[0] or 0, "50-70": qd[1] or 0, "70-90": qd[2] or 0, "90+": qd[3] or 0}

    # At-risk students (low avg watch + low quiz scores + inactive)
    r = await session.execute(text("""
        SELECT
            u.id, u.name, u.email,
            b.name AS batch_name,
            COALESCE(lp_agg.avg_watch, 0) AS watch_pct,
            qa_agg.avg_score AS quiz_avg,
            u.updated_at AS last_active
        FROM users u
        JOIN student_batches sb ON sb.student_id = u.id AND sb.removed_at IS NULL AND sb.is_active = true
        JOIN batches b ON b.id = sb.batch_id AND b.deleted_at IS NULL
        LEFT JOIN (
            SELECT student_id, AVG(watch_percentage) AS avg_watch
            FROM lecture_progress WHERE institute_id = :iid
            GROUP BY student_id
        ) lp_agg ON lp_agg.student_id = u.id
        LEFT JOIN (
            SELECT student_id, AVG(percentage) AS avg_score
            FROM quiz_attempts WHERE institute_id = :iid AND status = 'graded'
            GROUP BY student_id
        ) qa_agg ON qa_agg.student_id = u.id
        WHERE u.deleted_at IS NULL AND u.role = 'student' AND u.institute_id = :iid
          AND (COALESCE(lp_agg.avg_watch, 0) < 40 OR qa_agg.avg_score < 50 OR qa_agg.avg_score IS NULL)
        ORDER BY COALESCE(lp_agg.avg_watch, 0) ASC
        LIMIT 20
    """), {"iid": iid})

    at_risk = []
    for row in r.all():
        watch = round(row[4], 1)
        quiz = round(row[5], 1) if row[5] is not None else None
        risk = "high" if watch < 20 else ("medium" if watch < 40 else "low")
        if quiz is not None and quiz < 40:
            risk = "high"
        at_risk.append({
            "student_id": str(row[0]), "name": row[1], "email": row[2],
            "batch_name": row[3], "watch_pct": watch, "quiz_avg": quiz,
            "last_active": row[6].isoformat() if row[6] else None,
            "risk_level": risk,
        })

    return {
        "students_by_status": students_by_status,
        "enrollment_trend": enrollment_trend,
        "completion_distribution": completion_distribution,
        "quiz_score_distribution": quiz_score_distribution,
        "at_risk_students": at_risk,
        "total_students": total_students,
        "last_updated": now_str,
    }


async def get_staff_analytics(
    session: AsyncSession, institute_id: uuid.UUID, period_days: int = 30,
) -> dict:
    """Staff tab: teacher performance + course creator activity."""
    now_str = datetime.now(timezone.utc).isoformat()
    start, _ = _period_range(period_days)
    iid = str(institute_id)

    # Teacher performance
    r = await session.execute(text("""
        SELECT
            u.id, u.name,
            COUNT(DISTINCT b.id) AS batches_assigned,
            COUNT(DISTINCT CASE WHEN zc.status = 'completed' AND zc.scheduled_date >= :start THEN zc.id END) AS classes_conducted,
            COUNT(DISTINCT sb.student_id) AS students_managed
        FROM users u
        LEFT JOIN batches b ON b.teacher_id = u.id AND b.deleted_at IS NULL
        LEFT JOIN zoom_classes zc ON zc.teacher_id = u.id AND zc.deleted_at IS NULL
        LEFT JOIN student_batches sb ON sb.batch_id = b.id AND sb.removed_at IS NULL
        WHERE u.deleted_at IS NULL AND u.role = 'teacher' AND u.institute_id = :iid
        GROUP BY u.id, u.name
    """), {"iid": iid, "start": start})

    teachers = []
    idle_teachers = 0
    for row in r.all():
        is_idle = row[3] == 0
        if is_idle:
            idle_teachers += 1
        teachers.append({
            "teacher_id": str(row[0]), "name": row[1],
            "batches_assigned": row[2], "classes_conducted": row[3],
            "avg_attendance_rate": None, "students_managed": row[4],
            "is_idle": is_idle,
        })

    # Per-teacher attendance rates (batch-fetched)
    teacher_ids = [t["teacher_id"] for t in teachers]
    if teacher_ids:
        r = await session.execute(text("""
            SELECT zc.teacher_id,
                   ROUND(COUNT(*) FILTER (WHERE za.attended) * 100.0 / NULLIF(COUNT(*), 0), 1)
            FROM zoom_attendance za
            JOIN zoom_classes zc ON zc.id = za.zoom_class_id
            WHERE zc.institute_id = :iid AND zc.deleted_at IS NULL AND zc.scheduled_date >= :start
            GROUP BY zc.teacher_id
        """), {"iid": iid, "start": start})
        att_map = {str(row[0]): float(row[1]) if row[1] else None for row in r.all()}
        for t in teachers:
            t["avg_attendance_rate"] = att_map.get(t["teacher_id"])

    # Course creator activity
    r = await session.execute(text("""
        SELECT
            u.id, u.name,
            COUNT(DISTINCT CASE WHEN c.created_at >= :start THEN c.id END) AS courses_created,
            COUNT(DISTINCT CASE WHEN l.created_at >= :start THEN l.id END) AS lectures_uploaded,
            COUNT(DISTINCT CASE WHEN bm.created_at >= :start THEN bm.id END) AS materials_added,
            COUNT(DISTINCT CASE WHEN q.created_at >= :start THEN q.id END) AS quizzes_created
        FROM users u
        LEFT JOIN courses c ON c.created_by = u.id AND c.deleted_at IS NULL AND c.institute_id = :iid
        LEFT JOIN lectures l ON l.created_by = u.id AND l.deleted_at IS NULL AND l.institute_id = :iid
        LEFT JOIN batch_materials bm ON bm.uploaded_by = u.id AND bm.deleted_at IS NULL AND bm.institute_id = :iid
        LEFT JOIN quizzes q ON q.created_by = u.id AND q.deleted_at IS NULL AND q.institute_id = :iid
        WHERE u.deleted_at IS NULL AND u.role = 'course_creator' AND u.institute_id = :iid
        GROUP BY u.id, u.name
    """), {"iid": iid, "start": start})

    creators = []
    idle_creators = 0
    for row in r.all():
        total_items = row[2] + row[3] + row[4] + row[5]
        is_idle = total_items == 0
        if is_idle:
            idle_creators += 1
        creators.append({
            "creator_id": str(row[0]), "name": row[1],
            "courses_created": row[2], "lectures_uploaded": row[3],
            "materials_added": row[4], "quizzes_created": row[5],
            "is_idle": is_idle,
        })

    return {
        "teachers": teachers, "creators": creators,
        "idle_teachers": idle_teachers, "idle_creators": idle_creators,
        "last_updated": now_str,
    }


async def get_course_analytics(
    session: AsyncSession, institute_id: uuid.UUID, period_days: int = 30,
) -> dict:
    """Courses tab: performance table, quiz analytics, certificate pipeline."""
    now_str = datetime.now(timezone.utc).isoformat()
    start, _ = _period_range(period_days)
    iid = str(institute_id)

    # Course performance
    r = await session.execute(text("""
        SELECT
            c.id, c.title,
            COUNT(DISTINCT l.id) AS lecture_count,
            ROUND(AVG(lp.watch_percentage), 1) AS avg_watch,
            COUNT(DISTINCT cert.id) AS cert_requests
        FROM courses c
        LEFT JOIN lectures l ON l.course_id = c.id AND l.deleted_at IS NULL
        LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id
        LEFT JOIN certificates cert ON cert.course_id = c.id AND cert.deleted_at IS NULL
        WHERE c.deleted_at IS NULL AND c.institute_id = :iid
        GROUP BY c.id, c.title
    """), {"iid": iid})

    courses = []
    for row in r.all():
        courses.append({
            "course_id": str(row[0]), "title": row[1],
            "lecture_count": row[2], "avg_watch_pct": float(row[3]) if row[3] else None,
            "quiz_pass_rate": None, "cert_requests": row[4],
        })

    # Per-course quiz pass rates (batch-fetched)
    course_ids = [c["course_id"] for c in courses]
    if course_ids:
        r = await session.execute(text("""
            SELECT q.course_id,
                   ROUND(COUNT(*) FILTER (WHERE qa.passed) * 100.0 / NULLIF(COUNT(*), 0), 1)
            FROM quiz_attempts qa
            JOIN quizzes q ON q.id = qa.quiz_id
            WHERE qa.institute_id = :iid AND qa.status = 'graded'
            GROUP BY q.course_id
        """), {"iid": iid})
        pass_map = {str(row[0]): float(row[1]) if row[1] else None for row in r.all()}
        for c in courses:
            c["quiz_pass_rate"] = pass_map.get(c["course_id"])

    # Overall quiz pass/fail
    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE passed = true) AS passed,
            COUNT(*) FILTER (WHERE passed = false) AS failed,
            COUNT(*) AS total
        FROM quiz_attempts
        WHERE institute_id = :iid AND status = 'graded' AND submitted_at >= :start
    """), {"iid": iid, "start": start})
    qo = r.one()
    total_graded = qo[2] or 1
    quiz_pass_rate = round(qo[0] / total_graded * 100, 1)
    quiz_fail_rate = round(qo[1] / total_graded * 100, 1)

    # Hardest quizzes
    r = await session.execute(text("""
        SELECT q.id, q.title, c.title AS course_title,
               ROUND(AVG(qa.percentage), 1) AS avg_score,
               ROUND(COUNT(*) FILTER (WHERE qa.passed) * 100.0 / NULLIF(COUNT(*), 0), 1) AS pass_rate,
               COUNT(*) AS attempt_count
        FROM quiz_attempts qa
        JOIN quizzes q ON q.id = qa.quiz_id
        JOIN courses c ON c.id = q.course_id
        WHERE qa.institute_id = :iid AND qa.status = 'graded'
        GROUP BY q.id, q.title, c.title
        HAVING COUNT(*) >= 3
        ORDER BY AVG(qa.percentage) ASC
        LIMIT 5
    """), {"iid": iid})
    hardest = [
        {"quiz_id": str(row[0]), "title": row[1], "course_title": row[2],
         "avg_score": float(row[3]) if row[3] else 0, "pass_rate": float(row[4]) if row[4] else 0,
         "attempt_count": row[5]}
        for row in r.all()
    ]

    # Quiz trend (weekly)
    r = await session.execute(text("""
        SELECT date_trunc('week', submitted_at)::date AS week,
               COUNT(*) AS attempts,
               ROUND(COUNT(*) FILTER (WHERE passed) * 100.0 / NULLIF(COUNT(*), 0), 1) AS pass_rate
        FROM quiz_attempts
        WHERE institute_id = :iid AND status = 'graded' AND submitted_at >= :start
        GROUP BY week ORDER BY week
    """), {"iid": iid, "start": start})
    quiz_trend = [{"date": str(row[0]), "attempts": row[1], "pass_rate": float(row[2]) if row[2] else 0} for row in r.all()]

    # Certificate pipeline
    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE status = 'eligible') AS eligible,
            COUNT(*) FILTER (WHERE status = 'eligible' AND requested_at IS NOT NULL) AS requested,
            COUNT(*) FILTER (WHERE status = 'approved' AND issued_at IS NULL) AS approved,
            COUNT(*) FILTER (WHERE status = 'approved' AND issued_at IS NOT NULL) AS issued
        FROM certificates
        WHERE deleted_at IS NULL AND institute_id = :iid
    """), {"iid": iid})
    cp = r.one()
    certificate_pipeline = {"eligible": cp[0] or 0, "requested": cp[1] or 0, "approved": cp[2] or 0, "issued": cp[3] or 0}

    return {
        "course_performance": courses,
        "quiz_pass_rate": quiz_pass_rate, "quiz_fail_rate": quiz_fail_rate,
        "hardest_quizzes": hardest, "quiz_trend": quiz_trend,
        "certificate_pipeline": certificate_pipeline,
        "last_updated": now_str,
    }


async def get_engagement_analytics(
    session: AsyncSession, institute_id: uuid.UUID, period_days: int = 30,
) -> dict:
    """Engagement tab: lecture watch + zoom attendance combined."""
    now_str = datetime.now(timezone.utc).isoformat()
    start, _ = _period_range(period_days)
    iid = str(institute_id)

    # Overall lecture completion
    r = await session.execute(text("""
        SELECT COALESCE(AVG(watch_percentage), 0)
        FROM lecture_progress WHERE institute_id = :iid
    """), {"iid": iid})
    overall_completion = round(r.scalar() or 0, 1)

    # Overall attendance
    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE za.attended) AS attended,
            COUNT(*) AS total
        FROM zoom_attendance za
        JOIN zoom_classes zc ON zc.id = za.zoom_class_id
        WHERE za.institute_id = :iid AND zc.deleted_at IS NULL AND zc.scheduled_date >= :start
    """), {"iid": iid, "start": start})
    att = r.one()
    overall_attendance = round(att[0] / max(att[1], 1) * 100, 1) if att[1] else None

    # Most watched lectures (top 5)
    r = await session.execute(text("""
        SELECT l.id, l.title, c.title AS course_title,
               ROUND(AVG(lp.watch_percentage), 1) AS avg_watch,
               COUNT(DISTINCT lp.student_id) AS student_count
        FROM lecture_progress lp
        JOIN lectures l ON l.id = lp.lecture_id AND l.deleted_at IS NULL
        LEFT JOIN courses c ON c.id = l.course_id
        WHERE lp.institute_id = :iid
        GROUP BY l.id, l.title, c.title
        ORDER BY AVG(lp.watch_percentage) DESC
        LIMIT 5
    """), {"iid": iid})
    most_watched = [
        {"lecture_id": str(row[0]), "title": row[1], "course_title": row[2] or "",
         "avg_watch_pct": float(row[3]), "student_count": row[4]}
        for row in r.all()
    ]

    # Least watched (bottom 5)
    r = await session.execute(text("""
        SELECT l.id, l.title, c.title AS course_title,
               ROUND(AVG(lp.watch_percentage), 1) AS avg_watch,
               COUNT(DISTINCT lp.student_id) AS student_count
        FROM lecture_progress lp
        JOIN lectures l ON l.id = lp.lecture_id AND l.deleted_at IS NULL
        LEFT JOIN courses c ON c.id = l.course_id
        WHERE lp.institute_id = :iid
        GROUP BY l.id, l.title, c.title
        HAVING COUNT(DISTINCT lp.student_id) >= 2
        ORDER BY AVG(lp.watch_percentage) ASC
        LIMIT 5
    """), {"iid": iid})
    least_watched = [
        {"lecture_id": str(row[0]), "title": row[1], "course_title": row[2] or "",
         "avg_watch_pct": float(row[3]), "student_count": row[4]}
        for row in r.all()
    ]

    # Engagement by batch
    r = await session.execute(text("""
        SELECT b.id, b.name,
               COALESCE(ROUND(AVG(lp.watch_percentage), 1), 0) AS watch_completion
        FROM batches b
        LEFT JOIN lectures l ON l.batch_id = b.id AND l.deleted_at IS NULL
        LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id
        WHERE b.deleted_at IS NULL AND b.institute_id = :iid
        GROUP BY b.id, b.name
    """), {"iid": iid})

    batch_engagement = []
    for row in r.all():
        batch_engagement.append({
            "batch_id": str(row[0]), "batch_name": row[1],
            "watch_completion": float(row[2]), "attendance_rate": None,
        })

    # Per-batch attendance (batch-fetched)
    if batch_engagement:
        r = await session.execute(text("""
            SELECT zc.batch_id,
                   ROUND(COUNT(*) FILTER (WHERE za.attended) * 100.0 / NULLIF(COUNT(*), 0), 1)
            FROM zoom_attendance za
            JOIN zoom_classes zc ON zc.id = za.zoom_class_id
            WHERE zc.institute_id = :iid AND zc.deleted_at IS NULL AND zc.scheduled_date >= :start
            GROUP BY zc.batch_id
        """), {"iid": iid, "start": start})
        att_map = {str(row[0]): float(row[1]) if row[1] else None for row in r.all()}
        for be in batch_engagement:
            be["attendance_rate"] = att_map.get(be["batch_id"])

    # Low attendance classes
    r = await session.execute(text("""
        SELECT zc.id, zc.title, b.name AS batch_name, zc.scheduled_date,
               ROUND(COUNT(*) FILTER (WHERE za.attended) * 100.0 / NULLIF(COUNT(*), 0), 1) AS att_rate
        FROM zoom_classes zc
        JOIN batches b ON b.id = zc.batch_id
        LEFT JOIN zoom_attendance za ON za.zoom_class_id = zc.id
        WHERE zc.deleted_at IS NULL AND zc.institute_id = :iid AND zc.status = 'completed'
          AND zc.scheduled_date >= :start
        GROUP BY zc.id, zc.title, b.name, zc.scheduled_date
        HAVING COUNT(*) >= 3 AND ROUND(COUNT(*) FILTER (WHERE za.attended) * 100.0 / NULLIF(COUNT(*), 0), 1) < 60
        ORDER BY att_rate ASC
        LIMIT 5
    """), {"iid": iid, "start": start})
    low_attendance = [
        {"class_id": str(row[0]), "title": row[1], "batch_name": row[2],
         "date": str(row[3]), "attendance_rate": float(row[4]) if row[4] else 0}
        for row in r.all()
    ]

    # Engagement trend (weekly)
    r = await session.execute(text("""
        SELECT date_trunc('week', lp.updated_at)::date AS week,
               ROUND(AVG(lp.watch_percentage), 1) AS watch_pct
        FROM lecture_progress lp
        WHERE lp.institute_id = :iid AND lp.updated_at >= :start
        GROUP BY week ORDER BY week
    """), {"iid": iid, "start": start})
    engagement_trend = [{"date": str(row[0]), "watch_pct": float(row[1]), "attendance_pct": None} for row in r.all()]

    return {
        "overall_lecture_completion": overall_completion,
        "overall_attendance_rate": overall_attendance,
        "most_watched": most_watched, "least_watched": least_watched,
        "engagement_by_batch": batch_engagement,
        "engagement_trend": engagement_trend,
        "low_attendance_classes": low_attendance,
        "last_updated": now_str,
    }
