"""Add unique constraints to prevent duplicate enrollments and applications.

Revision ID: 002
Revises: 001
Create Date: 2026-03-09
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect, text

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _constraint_exists(conn, table_name: str, constraint_name: str) -> bool:
    """Check if a constraint or index already exists."""
    result = conn.execute(text(
        "SELECT 1 FROM pg_constraint WHERE conname = :name "
        "UNION SELECT 1 FROM pg_indexes WHERE indexname = :name"
    ), {"name": constraint_name})
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # LectureProgress: one progress record per student per lecture
    if not _constraint_exists(conn, "lecture_progress", "uq_lecture_progress_student_lecture"):
        op.create_unique_constraint(
            "uq_lecture_progress_student_lecture",
            "lecture_progress",
            ["student_id", "lecture_id"],
        )

    # JobApplication: one application per student per job
    if not _constraint_exists(conn, "job_applications", "uq_job_application_job_student"):
        op.create_unique_constraint(
            "uq_job_application_job_student",
            "job_applications",
            ["job_id", "student_id"],
        )

    # StudentBatch: one active enrollment per student per batch (partial unique index)
    if not _constraint_exists(conn, "student_batches", "uq_student_batch_active"):
        op.create_index(
            "uq_student_batch_active",
            "student_batches",
            ["student_id", "batch_id"],
            unique=True,
            postgresql_where="removed_at IS NULL",
        )


def downgrade() -> None:
    op.drop_index("uq_student_batch_active", table_name="student_batches")
    op.drop_constraint("uq_job_application_job_student", "job_applications", type_="unique")
    op.drop_constraint("uq_lecture_progress_student_lecture", "lecture_progress", type_="unique")
