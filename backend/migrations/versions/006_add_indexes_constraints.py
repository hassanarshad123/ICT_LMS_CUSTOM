"""Add indexes, unique constraints, check constraints, and updated_at trigger

Revision ID: 006
Revises: 005
Create Date: 2026-03-10
"""

from alembic import op
from sqlalchemy import text

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    # ── Indexes on foreign key columns ────────────────────────────────

    op.execute(text("CREATE INDEX IF NOT EXISTS ix_student_batches_batch_id ON student_batches (batch_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_student_batches_student_id ON student_batches (student_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_batch_courses_batch_id ON batch_courses (batch_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_batch_courses_course_id ON batch_courses (course_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_lectures_batch_id ON lectures (batch_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_lectures_course_id ON lectures (course_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_lecture_progress_student_id ON lecture_progress (student_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id ON user_sessions (user_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_zoom_classes_batch_id ON zoom_classes (batch_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_certificates_student_id ON certificates (student_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_announcements_batch_id ON announcements (batch_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_activity_log_user_id_created_at ON activity_log (user_id, created_at)"))

    # ── Unique constraints ────────────────────────────────────────────

    # Partial unique index (IF NOT EXISTS handles idempotency)
    op.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_batch_course_active "
        "ON batch_courses (batch_id, course_id) WHERE deleted_at IS NULL"
    ))

    # Partial unique index on zoom_accounts
    op.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_zoom_account_active "
        "ON zoom_accounts (account_id) WHERE deleted_at IS NULL"
    ))

    # For regular UNIQUE constraints, use op.create_unique_constraint
    # which handles the ALTER TABLE safely
    op.create_unique_constraint("uq_zoom_attendance_class_student", "zoom_attendance", ["zoom_class_id", "student_id"])
    op.create_unique_constraint("uq_user_sessions_token", "user_sessions", ["session_token"])

    # ── Check constraints ─────────────────────────────────────────────

    op.create_check_constraint(
        "ck_lecture_progress_watch_pct", "lecture_progress",
        "watch_percentage >= 0 AND watch_percentage <= 100",
    )
    op.create_check_constraint(
        "ck_certificate_completion_pct", "certificates",
        "completion_percentage >= 0 AND completion_percentage <= 100",
    )

    # ── Auto-update updated_at trigger ────────────────────────────────

    # Create the trigger function
    op.execute(text(
        "CREATE OR REPLACE FUNCTION set_updated_at() "
        "RETURNS TRIGGER AS $$ "
        "BEGIN NEW.updated_at = NOW(); RETURN NEW; END; "
        "$$ LANGUAGE plpgsql"
    ))

    # Attach to all tables that have an updated_at column
    # Each statement must be separate for asyncpg compatibility
    tables_with_updated_at = [
        "users", "batches", "student_batches", "courses", "batch_courses",
        "lectures", "curriculum_modules", "batch_materials", "zoom_accounts",
        "zoom_classes", "class_recordings", "announcements", "lecture_progress",
        "jobs", "job_applications", "system_settings", "certificates",
    ]
    for table in tables_with_updated_at:
        op.execute(text(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table}"))
        op.execute(text(
            f"CREATE TRIGGER trg_{table}_updated_at "
            f"BEFORE UPDATE ON {table} "
            f"FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
        ))


def downgrade():
    # Drop triggers
    tables_with_updated_at = [
        "users", "batches", "student_batches", "courses", "batch_courses",
        "lectures", "curriculum_modules", "batch_materials", "zoom_accounts",
        "zoom_classes", "class_recordings", "announcements", "lecture_progress",
        "jobs", "job_applications", "system_settings", "certificates",
    ]
    for table in tables_with_updated_at:
        op.execute(text(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table}"))

    op.execute(text("DROP FUNCTION IF EXISTS set_updated_at()"))

    # Drop check constraints
    op.drop_constraint("ck_certificate_completion_pct", "certificates", type_="check")
    op.drop_constraint("ck_lecture_progress_watch_pct", "lecture_progress", type_="check")

    # Drop unique constraints
    op.drop_constraint("uq_user_sessions_token", "user_sessions", type_="unique")
    op.drop_constraint("uq_zoom_attendance_class_student", "zoom_attendance", type_="unique")
    op.execute(text("DROP INDEX IF EXISTS uq_zoom_account_active"))
    op.execute(text("DROP INDEX IF EXISTS uq_batch_course_active"))

    # Drop indexes
    op.execute(text("DROP INDEX IF EXISTS ix_activity_log_user_id_created_at"))
    op.execute(text("DROP INDEX IF EXISTS ix_announcements_batch_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_certificates_student_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_zoom_classes_batch_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_user_sessions_user_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_lecture_progress_student_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_lectures_course_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_lectures_batch_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_batch_courses_course_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_batch_courses_batch_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_student_batches_student_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_student_batches_batch_id"))
