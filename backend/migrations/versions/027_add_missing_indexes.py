"""Add 19 missing indexes for performance optimization

Revision ID: 027
Revises: 026
Create Date: 2026-04-04

Uses CREATE INDEX CONCURRENTLY to avoid write-locking tables on production.
Must run outside a transaction (AUTOCOMMIT).
"""
from alembic import op

revision = "027"
down_revision = "026"


def upgrade() -> None:
    # CONCURRENTLY requires AUTOCOMMIT (no transaction block)
    op.execute("COMMIT")

    # ── CRITICAL ──────────────────────────────────────────────────────────

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_zoom_classes_zoom_meeting_id
        ON zoom_classes (zoom_meeting_id)
        WHERE deleted_at IS NULL AND zoom_meeting_id IS NOT NULL
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_user_sessions_token_active
        ON user_sessions (session_token)
        WHERE is_active = TRUE
    """)

    # Note: ix_user_sessions_user_active already exists from 015 on (user_id, is_active).
    # This is a different index on (user_id, logged_in_at) — use a distinct name.
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_user_sessions_user_login_order
        ON user_sessions (user_id, logged_in_at)
        WHERE is_active = TRUE
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_notifications_user_cursor
        ON notifications (user_id, created_at DESC, id DESC)
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_notifications_user_unread
        ON notifications (user_id)
        WHERE read = FALSE
    """)

    # ── HIGH ──────────────────────────────────────────────────────────────

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_zoom_attendance_student_id
        ON zoom_attendance (student_id)
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_zoom_attendance_institute_id
        ON zoom_attendance (institute_id)
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_lecture_progress_lecture_id
        ON lecture_progress (lecture_id)
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_invoices_institute_id
        ON invoices (institute_id)
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_invoices_status_due_date
        ON invoices (institute_id, status, due_date)
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_payments_institute_id
        ON payments (institute_id)
    """)

    # Replace non-partial ix_payments_invoice_id (from 021) with partial version
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_payments_invoice_id")
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_payments_invoice_id_partial
        ON payments (invoice_id)
        WHERE invoice_id IS NOT NULL
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_webhook_deliveries_pending_queue
        ON webhook_deliveries (next_retry_at)
        WHERE status IN ('pending', 'retrying')
    """)

    # ── MEDIUM ────────────────────────────────────────────────────────────

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_announcements_institute_id
        ON announcements (institute_id)
        WHERE deleted_at IS NULL
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_announcements_institute_scope_created
        ON announcements (institute_id, scope, created_at DESC)
        WHERE deleted_at IS NULL
    """)

    # ── LOW ───────────────────────────────────────────────────────────────

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_student_batch_history_institute_id
        ON student_batch_history (institute_id)
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_certificates_institute_id
        ON certificates (institute_id)
        WHERE deleted_at IS NULL
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_certificates_institute_status
        ON certificates (institute_id, status)
        WHERE deleted_at IS NULL
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_job_applications_student_id
        ON job_applications (student_id)
        WHERE deleted_at IS NULL
    """)

    # ── AUTOVACUUM TUNING for high-write tables ──────────────────────────

    op.execute("""
        ALTER TABLE notifications SET (
            autovacuum_vacuum_scale_factor = 0.05,
            autovacuum_analyze_scale_factor = 0.02
        )
    """)
    op.execute("""
        ALTER TABLE user_sessions SET (
            autovacuum_vacuum_scale_factor = 0.05,
            autovacuum_analyze_scale_factor = 0.02
        )
    """)
    op.execute("""
        ALTER TABLE webhook_deliveries SET (
            autovacuum_vacuum_scale_factor = 0.05,
            autovacuum_analyze_scale_factor = 0.02
        )
    """)


def downgrade() -> None:
    op.execute("COMMIT")

    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_job_applications_student_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_certificates_institute_status")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_certificates_institute_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_student_batch_history_institute_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_announcements_institute_scope_created")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_announcements_institute_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_webhook_deliveries_pending_queue")
    # Restore original non-partial index from 021
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_payments_invoice_id_partial")
    op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_payments_invoice_id ON payments (invoice_id)")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_payments_institute_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_invoices_status_due_date")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_invoices_institute_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_lecture_progress_lecture_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_zoom_attendance_institute_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_zoom_attendance_student_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_notifications_user_unread")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_notifications_user_cursor")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_user_sessions_user_login_order")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_user_sessions_token_active")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_zoom_classes_zoom_meeting_id")

    # Revert autovacuum to defaults
    op.execute("ALTER TABLE notifications RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor)")
    op.execute("ALTER TABLE user_sessions RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor)")
    op.execute("ALTER TABLE webhook_deliveries RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor)")
