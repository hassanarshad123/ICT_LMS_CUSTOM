"""Add institute_id indexes for performance

Revision ID: 016
Revises: 015
Create Date: 2026-03-24
"""
from alembic import op
from sqlalchemy import text

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use IF NOT EXISTS to be safe if indexes already exist
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_batches_institute_id ON batches (institute_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_batches_teacher_id ON batches (teacher_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_lectures_institute_id ON lectures (institute_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_courses_institute_id ON courses (institute_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_jobs_institute_id ON jobs (institute_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_job_applications_institute_id ON job_applications (institute_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_zoom_classes_institute_id ON zoom_classes (institute_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_user_sessions_institute_id ON user_sessions (institute_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_institute_id ON notifications (institute_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_lecture_progress_institute_id ON lecture_progress (institute_id)"))


def downgrade() -> None:
    op.execute(text("DROP INDEX IF EXISTS ix_lecture_progress_institute_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_notifications_institute_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_user_sessions_institute_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_zoom_classes_institute_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_job_applications_institute_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_jobs_institute_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_courses_institute_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_lectures_institute_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_batches_teacher_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_batches_institute_id"))
