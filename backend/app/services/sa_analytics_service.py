import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def get_platform_overview(session: AsyncSession, period: int = 30) -> dict:
    """Platform-wide totals with previous-period comparison for trend arrows."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=period)
    prev_cutoff = cutoff - timedelta(days=period)

    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE role != 'super_admin' AND deleted_at IS NULL) AS total_users,
            COUNT(*) FILTER (WHERE role != 'super_admin' AND deleted_at IS NULL
                             AND created_at < :cutoff) AS prev_users
        FROM users
    """), {"cutoff": cutoff})
    row = r.one()
    total_users = row[0] or 0
    prev_users = row[1] or 0

    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total,
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at < :cutoff) AS prev
        FROM courses
    """), {"cutoff": cutoff})
    row = r.one()
    total_courses = row[0] or 0
    prev_courses = row[1] or 0

    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total,
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at < :cutoff) AS prev
        FROM batches
    """), {"cutoff": cutoff})
    row = r.one()
    total_batches = row[0] or 0
    prev_batches = row[1] or 0

    r = await session.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total,
            COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at < :cutoff) AS prev
        FROM certificates
    """), {"cutoff": cutoff})
    row = r.one()
    total_certificates = row[0] or 0
    prev_certificates = row[1] or 0

    r = await session.execute(text("""
        SELECT COUNT(*) FROM lectures WHERE deleted_at IS NULL
    """))
    total_lectures = r.scalar_one() or 0

    r = await session.execute(text("""
        SELECT
            COALESCE(SUM(current_storage_bytes), 0),
            COALESCE(SUM(current_video_bytes), 0)
        FROM institute_usage
    """))
    agg = r.one()
    total_storage_gb = round((agg[0] or 0) / (1024 ** 3), 2)
    total_video_gb = round((agg[1] or 0) / (1024 ** 3), 2)

    r = await session.execute(text("""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'active') AS active,
            COUNT(*) FILTER (WHERE status = 'suspended') AS suspended,
            COUNT(*) FILTER (WHERE status = 'trial') AS trial
        FROM institutes
        WHERE deleted_at IS NULL
    """))
    inst = r.one()

    return {
        "total_users": total_users,
        "total_users_prev": prev_users,
        "total_courses": total_courses,
        "total_courses_prev": prev_courses,
        "total_batches": total_batches,
        "total_batches_prev": prev_batches,
        "total_certificates": total_certificates,
        "total_certificates_prev": prev_certificates,
        "total_lectures": total_lectures,
        "total_storage_gb": total_storage_gb,
        "total_video_gb": total_video_gb,
        "total_institutes": inst[0] or 0,
        "active_institutes": inst[1] or 0,
        "suspended_institutes": inst[2] or 0,
        "trial_institutes": inst[3] or 0,
    }


async def get_growth_trends(session: AsyncSession, period: int = 30) -> dict:
    """Daily new users and new institutes over the given period."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=period)

    r = await session.execute(text("""
        SELECT created_at::date AS day, COUNT(*) AS cnt
        FROM users
        WHERE deleted_at IS NULL
          AND role != 'super_admin'
          AND created_at >= :cutoff
        GROUP BY day
        ORDER BY day
    """), {"cutoff": cutoff})
    new_users = [{"date": row[0].isoformat(), "count": row[1]} for row in r.all()]

    r = await session.execute(text("""
        SELECT created_at::date AS day, COUNT(*) AS cnt
        FROM institutes
        WHERE deleted_at IS NULL
          AND created_at >= :cutoff
        GROUP BY day
        ORDER BY day
    """), {"cutoff": cutoff})
    new_institutes = [{"date": row[0].isoformat(), "count": row[1]} for row in r.all()]

    return {"new_users": new_users, "new_institutes": new_institutes}


async def get_plan_distribution(session: AsyncSession) -> dict:
    """Count of institutes by plan tier."""
    r = await session.execute(text("""
        SELECT plan_tier, COUNT(*) AS cnt
        FROM institutes
        WHERE deleted_at IS NULL
        GROUP BY plan_tier
    """))
    result = {"free": 0, "basic": 0, "pro": 0, "enterprise": 0}
    for row in r.all():
        result[row[0]] = row[1]
    return result


async def get_top_institutes(
    session: AsyncSession, metric: str = "users", limit: int = 5
) -> list[dict]:
    """Top institutes ranked by a given metric."""
    metric_queries = {
        "users": """
            SELECT i.id, i.name, i.slug, i.plan_tier,
                   COALESCE(u.current_users, 0)::float AS value
            FROM institutes i
            LEFT JOIN institute_usage u ON u.institute_id = i.id
            WHERE i.deleted_at IS NULL
            ORDER BY value DESC
            LIMIT :lim
        """,
        "storage": """
            SELECT i.id, i.name, i.slug, i.plan_tier,
                   ROUND(COALESCE(u.current_storage_bytes, 0) / (1024.0^3), 2) AS value
            FROM institutes i
            LEFT JOIN institute_usage u ON u.institute_id = i.id
            WHERE i.deleted_at IS NULL
            ORDER BY value DESC
            LIMIT :lim
        """,
        "video": """
            SELECT i.id, i.name, i.slug, i.plan_tier,
                   ROUND(COALESCE(u.current_video_bytes, 0) / (1024.0^3), 2) AS value
            FROM institutes i
            LEFT JOIN institute_usage u ON u.institute_id = i.id
            WHERE i.deleted_at IS NULL
            ORDER BY value DESC
            LIMIT :lim
        """,
        "courses": """
            SELECT i.id, i.name, i.slug, i.plan_tier,
                   COUNT(c.id)::float AS value
            FROM institutes i
            LEFT JOIN courses c ON c.institute_id = i.id AND c.deleted_at IS NULL
            WHERE i.deleted_at IS NULL
            GROUP BY i.id, i.name, i.slug, i.plan_tier
            ORDER BY value DESC
            LIMIT :lim
        """,
        "certificates": """
            SELECT i.id, i.name, i.slug, i.plan_tier,
                   COUNT(cert.id)::float AS value
            FROM institutes i
            LEFT JOIN certificates cert ON cert.institute_id = i.id AND cert.deleted_at IS NULL
            WHERE i.deleted_at IS NULL
            GROUP BY i.id, i.name, i.slug, i.plan_tier
            ORDER BY value DESC
            LIMIT :lim
        """,
    }

    query = metric_queries.get(metric)
    if not query:
        query = metric_queries["users"]

    r = await session.execute(text(query), {"lim": limit})
    return [
        {
            "institute_id": str(row[0]),
            "name": row[1],
            "slug": row[2],
            "plan_tier": row[3],
            "value": float(row[4] or 0),
        }
        for row in r.all()
    ]


async def get_quota_utilization(session: AsyncSession) -> list[dict]:
    """Institutes using >60% of any quota, sorted by highest usage."""
    r = await session.execute(text("""
        SELECT
            i.id, i.name, i.slug,
            CASE WHEN i.max_users > 0
                 THEN ROUND(COALESCE(u.current_users, 0)::numeric / i.max_users * 100, 1)
                 ELSE 0 END AS users_pct,
            CASE WHEN i.max_storage_gb > 0
                 THEN ROUND(COALESCE(u.current_storage_bytes, 0)::numeric / (i.max_storage_gb * 1024^3) * 100, 1)
                 ELSE 0 END AS storage_pct,
            CASE WHEN i.max_video_gb > 0
                 THEN ROUND(COALESCE(u.current_video_bytes, 0)::numeric / (i.max_video_gb * 1024^3) * 100, 1)
                 ELSE 0 END AS video_pct
        FROM institutes i
        LEFT JOIN institute_usage u ON u.institute_id = i.id
        WHERE i.deleted_at IS NULL
        ORDER BY GREATEST(
            CASE WHEN i.max_users > 0
                 THEN COALESCE(u.current_users, 0)::numeric / i.max_users * 100
                 ELSE 0 END,
            CASE WHEN i.max_storage_gb > 0
                 THEN COALESCE(u.current_storage_bytes, 0)::numeric / (i.max_storage_gb * 1024^3) * 100
                 ELSE 0 END,
            CASE WHEN i.max_video_gb > 0
                 THEN COALESCE(u.current_video_bytes, 0)::numeric / (i.max_video_gb * 1024^3) * 100
                 ELSE 0 END
        ) DESC
        LIMIT 10
    """))
    return [
        {
            "institute_id": str(row[0]),
            "name": row[1],
            "slug": row[2],
            "users_used_pct": float(row[3] or 0),
            "storage_used_pct": float(row[4] or 0),
            "video_used_pct": float(row[5] or 0),
            "highest_pct": float(max(row[3] or 0, row[4] or 0, row[5] or 0)),
        }
        for row in r.all()
    ]
