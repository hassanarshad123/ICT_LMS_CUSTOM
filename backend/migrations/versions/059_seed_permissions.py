"""Seed permission registry with all LMS permissions.

Revision ID: 059
Revises: 058
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "059"
down_revision = "058"
branch_labels = None
depends_on = None

permissions_table = sa.table(
    "permissions",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("code", sa.String),
    sa.column("module", sa.String),
    sa.column("action", sa.String),
    sa.column("description", sa.String),
)

PERMISSIONS = [
    ("dashboard.view", "dashboard", "view", "View dashboard"),
    ("dashboard.view_insights", "dashboard", "view_insights", "View analytics insights"),
    ("users.view", "users", "view", "View user list and details"),
    ("users.create", "users", "create", "Create users"),
    ("users.edit", "users", "edit", "Edit user profiles"),
    ("users.delete", "users", "delete", "Soft-delete users"),
    ("users.reset_password", "users", "reset_password", "Reset user passwords"),
    ("users.force_logout", "users", "force_logout", "Force logout users"),
    ("users.bulk_import", "users", "bulk_import", "Bulk import users via CSV"),
    ("courses.view", "courses", "view", "View courses"),
    ("courses.create", "courses", "create", "Create courses"),
    ("courses.edit", "courses", "edit", "Edit courses"),
    ("courses.delete", "courses", "delete", "Delete courses"),
    ("courses.clone", "courses", "clone", "Clone courses"),
    ("batches.view", "batches", "view", "View batches"),
    ("batches.create", "batches", "create", "Create batches"),
    ("batches.edit", "batches", "edit", "Edit batches"),
    ("batches.delete", "batches", "delete", "Delete batches"),
    ("batches.manage_students", "batches", "manage_students", "Enroll, remove, or toggle students"),
    ("batches.manage_courses", "batches", "manage_courses", "Link or unlink courses to batches"),
    ("batches.manage_access", "batches", "manage_access", "Extend or adjust student access"),
    ("batches.view_expiry", "batches", "view_expiry", "View expiry summary and history"),
    ("lectures.view", "lectures", "view", "View lectures"),
    ("lectures.create", "lectures", "create", "Create and upload lectures"),
    ("lectures.edit", "lectures", "edit", "Edit and reorder lectures"),
    ("lectures.delete", "lectures", "delete", "Delete lectures"),
    ("lectures.track_progress", "lectures", "track_progress", "Track watch progress"),
    ("materials.view", "materials", "view", "View and download materials"),
    ("materials.create", "materials", "create", "Upload materials"),
    ("materials.edit", "materials", "edit", "Edit materials"),
    ("materials.delete", "materials", "delete", "Delete materials"),
    ("curriculum.view", "curriculum", "view", "View curriculum modules"),
    ("curriculum.manage", "curriculum", "manage", "Create, edit, delete, reorder modules"),
    ("quizzes.view", "quizzes", "view", "View quizzes"),
    ("quizzes.create", "quizzes", "create", "Create quizzes"),
    ("quizzes.edit", "quizzes", "edit", "Edit quizzes and questions"),
    ("quizzes.delete", "quizzes", "delete", "Delete quizzes"),
    ("quizzes.grade", "quizzes", "grade", "Grade quiz attempts"),
    ("quizzes.attempt", "quizzes", "attempt", "Take and submit quizzes"),
    ("zoom.view_accounts", "zoom", "view_accounts", "View Zoom accounts"),
    ("zoom.manage_accounts", "zoom", "manage_accounts", "Manage Zoom accounts"),
    ("zoom.view_classes", "zoom", "view_classes", "View scheduled classes"),
    ("zoom.create_classes", "zoom", "create_classes", "Schedule new classes"),
    ("zoom.edit_classes", "zoom", "edit_classes", "Edit classes"),
    ("zoom.delete_classes", "zoom", "delete_classes", "Delete classes"),
    ("zoom.view_recordings", "zoom", "view_recordings", "View recordings"),
    ("zoom.manage_recordings", "zoom", "manage_recordings", "Edit or delete recordings"),
    ("zoom.view_attendance", "zoom", "view_attendance", "View class attendance"),
    ("announcements.view", "announcements", "view", "View announcements"),
    ("announcements.create", "announcements", "create", "Create announcements"),
    ("announcements.edit", "announcements", "edit", "Edit announcements"),
    ("announcements.delete", "announcements", "delete", "Delete announcements"),
    ("notifications.view", "notifications", "view", "View notifications"),
    ("notifications.manage", "notifications", "manage", "Mark as read and clear"),
    ("certificates.view", "certificates", "view", "View certificates"),
    ("certificates.manage", "certificates", "manage", "Approve, revoke, batch-approve"),
    ("certificates.request", "certificates", "request", "Request a certificate"),
    ("certificates.download", "certificates", "download", "Download certificate PDF"),
    ("jobs.view", "jobs", "view", "View job postings"),
    ("jobs.create", "jobs", "create", "Create job postings"),
    ("jobs.edit", "jobs", "edit", "Edit job postings"),
    ("jobs.delete", "jobs", "delete", "Delete job postings"),
    ("jobs.manage_applications", "jobs", "manage_applications", "Review and manage applications"),
    ("jobs.apply", "jobs", "apply", "Apply to jobs"),
    ("admissions.view_students", "admissions", "view_students", "View admissions student list"),
    ("admissions.onboard", "admissions", "onboard", "Onboard new students"),
    ("admissions.edit_students", "admissions", "edit_students", "Edit student profiles"),
    ("admissions.manage_enrollment", "admissions", "manage_enrollment", "Add or remove enrollments"),
    ("admissions.suspend_reactivate", "admissions", "suspend_reactivate", "Suspend or reactivate students"),
    ("admissions.delete_students", "admissions", "delete_students", "Delete students"),
    ("admissions.record_payment", "admissions", "record_payment", "Record manual payments"),
    ("admissions.view_payments", "admissions", "view_payments", "View payment history"),
    ("admissions.view_stats", "admissions", "view_stats", "View admissions team stats"),
    ("admissions.view_quota", "admissions", "view_quota", "View student quota"),
    ("fees.view_own", "fees", "view_own", "View own fee plans and receipts"),
    ("fees.download_receipt", "fees", "download_receipt", "Download payment receipts"),
    ("payment_proof.upload", "payment_proof", "upload", "Upload payment proof"),
    ("payment_proof.view", "payment_proof", "view", "View payment proofs"),
    ("devices.view", "devices", "view", "View device sessions"),
    ("devices.terminate", "devices", "terminate", "Terminate device sessions"),
    ("devices.manage_requests", "devices", "manage_requests", "Approve or reject device limit requests"),
    ("settings.view", "settings", "view", "View institute settings"),
    ("settings.edit", "settings", "edit", "Edit institute settings"),
    ("branding.edit", "branding", "edit", "Edit branding and logo"),
    ("branding.edit_certificate", "branding", "edit_certificate", "Edit certificate design"),
    ("email_templates.view", "email_templates", "view", "View email templates"),
    ("email_templates.edit", "email_templates", "edit", "Edit email templates"),
    ("monitoring.view_errors", "monitoring", "view_errors", "View error logs"),
    ("monitoring.resolve_errors", "monitoring", "resolve_errors", "Resolve or unresolve errors"),
    ("monitoring.report_errors", "monitoring", "report_errors", "Report client-side errors"),
    ("api_keys.view", "api_keys", "view", "View API keys"),
    ("api_keys.create", "api_keys", "create", "Create API keys"),
    ("api_keys.delete", "api_keys", "delete", "Revoke API keys"),
    ("webhooks.view", "webhooks", "view", "View webhooks"),
    ("webhooks.create", "webhooks", "create", "Create webhooks"),
    ("webhooks.edit", "webhooks", "edit", "Edit webhooks"),
    ("webhooks.delete", "webhooks", "delete", "Delete webhooks"),
    ("webhooks.test", "webhooks", "test", "Test webhooks"),
    ("integrations.view", "integrations", "view", "View integration config"),
    ("integrations.manage", "integrations", "manage", "Configure integrations"),
    ("integrations.sync", "integrations", "sync", "Trigger and view sync tasks"),
    ("billing.view", "billing", "view", "View billing overview and invoices"),
    ("billing.manage_addons", "billing", "manage_addons", "Activate or cancel addons"),
    ("search.global", "search", "global", "Use global search"),
    ("feedback.submit", "feedback", "submit", "Submit feedback"),
    ("feedback.view_own", "feedback", "view_own", "View own feedback"),
    ("activity_log.view", "activity_log", "view", "View activity log"),
    ("export.data", "export", "data", "Export data to CSV"),
    ("roles.view", "roles", "view", "View custom roles"),
    ("roles.create", "roles", "create", "Create custom roles"),
    ("roles.edit", "roles", "edit", "Edit custom roles"),
    ("roles.delete", "roles", "delete", "Delete custom roles"),
    ("roles.assign", "roles", "assign", "Assign roles to users"),
    ("upgrade.request", "upgrade", "request", "Request plan upgrade"),
]


def upgrade() -> None:
    op.bulk_insert(
        permissions_table,
        [
            {"code": code, "module": module, "action": action, "description": desc}
            for code, module, action, desc in PERMISSIONS
        ],
    )


def downgrade() -> None:
    op.execute("DELETE FROM permissions")
