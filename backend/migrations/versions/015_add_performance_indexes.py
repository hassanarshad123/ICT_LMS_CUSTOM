"""Add composite performance indexes for multi-tenant queries

Revision ID: 015
Revises: 014
"""
from alembic import op
from sqlalchemy import text

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Composite indexes for institute-scoped soft-delete queries ───

    # 1. User queries by institute
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_users_institute_deleted "
        "ON users (institute_id, deleted_at)"
    ))

    # 2. Batch queries by institute
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_batches_institute_deleted "
        "ON batches (institute_id, deleted_at)"
    ))

    # 3. Course queries by institute
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_courses_institute_deleted "
        "ON courses (institute_id, deleted_at)"
    ))

    # 4. Lecture queries by batch within institute
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_lectures_batch_institute_deleted "
        "ON lectures (batch_id, institute_id, deleted_at)"
    ))

    # 5. Student enrollment — partial index for active enrollments only
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_student_batches_batch_institute_active "
        "ON student_batches (batch_id, institute_id) "
        "WHERE removed_at IS NULL"
    ))

    # 6. Session device limit check
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_user_sessions_user_active "
        "ON user_sessions (user_id, is_active)"
    ))

    # 7. Quiz queries by institute
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_quizzes_institute_deleted "
        "ON quizzes (institute_id, deleted_at)"
    ))

    # 8. Certificate queries by institute
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_certificates_institute_deleted "
        "ON certificates (institute_id, deleted_at)"
    ))

    # 9. Notification queries by user within institute
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_institute "
        "ON notifications (user_id, institute_id)"
    ))

    # 10. Announcement queries by institute
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_announcements_institute_deleted "
        "ON announcements (institute_id, deleted_at)"
    ))

    # 11. Handoff JTI replay prevention — index for device_info lookups
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_user_sessions_handoff_device_info "
        "ON user_sessions (device_info) "
        "WHERE device_info LIKE 'handoff:%'"
    ))


def downgrade() -> None:
    op.execute(text("DROP INDEX IF EXISTS ix_user_sessions_handoff_device_info"))
    op.execute(text("DROP INDEX IF EXISTS ix_announcements_institute_deleted"))
    op.execute(text("DROP INDEX IF EXISTS ix_notifications_user_institute"))
    op.execute(text("DROP INDEX IF EXISTS ix_certificates_institute_deleted"))
    op.execute(text("DROP INDEX IF EXISTS ix_quizzes_institute_deleted"))
    op.execute(text("DROP INDEX IF EXISTS ix_user_sessions_user_active"))
    op.execute(text("DROP INDEX IF EXISTS ix_student_batches_batch_institute_active"))
    op.execute(text("DROP INDEX IF EXISTS ix_lectures_batch_institute_deleted"))
    op.execute(text("DROP INDEX IF EXISTS ix_courses_institute_deleted"))
    op.execute(text("DROP INDEX IF EXISTS ix_batches_institute_deleted"))
    op.execute(text("DROP INDEX IF EXISTS ix_users_institute_deleted"))
