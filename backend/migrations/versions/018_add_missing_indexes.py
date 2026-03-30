"""Add missing indexes on frequently-queried FK columns

Tables with zero indexes on query-hot columns:
- curriculum_modules: course_id (every curriculum list/read)
- batch_materials: batch_id, course_id (list_materials endpoint)
- class_recordings: zoom_class_id (joined on recording loads)
- student_batch_history: student_id, batch_id (audit trail queries)

Performance indexes for monitoring/admin:
- error_logs: (institute_id, level, created_at DESC) for dashboard
- activity_log: institute_id for admin activity feed

Revision ID: 018
Revises: 017
Create Date: 2026-03-30
"""
from alembic import op
from sqlalchemy import text

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- FK indexes on tables that had none ---
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_curriculum_modules_course_id ON curriculum_modules (course_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_batch_materials_batch_id ON batch_materials (batch_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_batch_materials_course_id ON batch_materials (course_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_class_recordings_zoom_class_id ON class_recordings (zoom_class_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_student_batch_history_student_id ON student_batch_history (student_id)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_student_batch_history_batch_id ON student_batch_history (batch_id)"))

    # --- Composite/performance indexes ---
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_error_logs_institute_level_created ON error_logs (institute_id, level, created_at DESC)"))
    op.execute(text("CREATE INDEX IF NOT EXISTS ix_activity_log_institute_id ON activity_log (institute_id)"))


def downgrade() -> None:
    op.execute(text("DROP INDEX IF EXISTS ix_activity_log_institute_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_error_logs_institute_level_created"))
    op.execute(text("DROP INDEX IF EXISTS ix_student_batch_history_batch_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_student_batch_history_student_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_class_recordings_zoom_class_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_batch_materials_course_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_batch_materials_batch_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_curriculum_modules_course_id"))
