"""Permission registry and system role permission seeds.

System role permissions are immutable code constants (not stored in DB).
The `permissions` DB table is the canonical registry for the permission matrix UI.
"""

from __future__ import annotations

from app.models.enums import UserRole

# ---------------------------------------------------------------------------
# Permission registry — every permission in the system, grouped by module.
# Format: (code, module, action, description)
# ---------------------------------------------------------------------------

PERMISSION_REGISTRY: list[tuple[str, str, str, str]] = [
    # ── Dashboard ──────────────────────────────────────────────────
    ("dashboard.view", "dashboard", "view", "View dashboard"),
    ("dashboard.view_insights", "dashboard", "view_insights", "View analytics insights"),

    # ── Users ──────────────────────────────────────────────────────
    ("users.view", "users", "view", "View user list and details"),
    ("users.create", "users", "create", "Create users"),
    ("users.edit", "users", "edit", "Edit user profiles"),
    ("users.delete", "users", "delete", "Soft-delete users"),
    ("users.reset_password", "users", "reset_password", "Reset user passwords"),
    ("users.force_logout", "users", "force_logout", "Force logout users"),
    ("users.bulk_import", "users", "bulk_import", "Bulk import users via CSV"),

    # ── Courses ────────────────────────────────────────────────────
    ("courses.view", "courses", "view", "View courses"),
    ("courses.create", "courses", "create", "Create courses"),
    ("courses.edit", "courses", "edit", "Edit courses"),
    ("courses.delete", "courses", "delete", "Delete courses"),
    ("courses.clone", "courses", "clone", "Clone courses"),

    # ── Batches ────────────────────────────────────────────────────
    ("batches.view", "batches", "view", "View batches"),
    ("batches.create", "batches", "create", "Create batches"),
    ("batches.edit", "batches", "edit", "Edit batches"),
    ("batches.delete", "batches", "delete", "Delete batches"),
    ("batches.manage_students", "batches", "manage_students", "Enroll, remove, or toggle students"),
    ("batches.manage_courses", "batches", "manage_courses", "Link or unlink courses to batches"),
    ("batches.manage_access", "batches", "manage_access", "Extend or adjust student access"),
    ("batches.view_expiry", "batches", "view_expiry", "View expiry summary and history"),

    # ── Lectures ───────────────────────────────────────────────────
    ("lectures.view", "lectures", "view", "View lectures"),
    ("lectures.create", "lectures", "create", "Create and upload lectures"),
    ("lectures.edit", "lectures", "edit", "Edit and reorder lectures"),
    ("lectures.delete", "lectures", "delete", "Delete lectures"),
    ("lectures.track_progress", "lectures", "track_progress", "Track watch progress"),

    # ── Materials ──────────────────────────────────────────────────
    ("materials.view", "materials", "view", "View and download materials"),
    ("materials.create", "materials", "create", "Upload materials"),
    ("materials.edit", "materials", "edit", "Edit materials"),
    ("materials.delete", "materials", "delete", "Delete materials"),

    # ── Curriculum ─────────────────────────────────────────────────
    ("curriculum.view", "curriculum", "view", "View curriculum modules"),
    ("curriculum.manage", "curriculum", "manage", "Create, edit, delete, reorder modules"),

    # ── Quizzes ────────────────────────────────────────────────────
    ("quizzes.view", "quizzes", "view", "View quizzes"),
    ("quizzes.create", "quizzes", "create", "Create quizzes"),
    ("quizzes.edit", "quizzes", "edit", "Edit quizzes and questions"),
    ("quizzes.delete", "quizzes", "delete", "Delete quizzes"),
    ("quizzes.grade", "quizzes", "grade", "Grade quiz attempts"),
    ("quizzes.attempt", "quizzes", "attempt", "Take and submit quizzes"),

    # ── Zoom ───────────────────────────────────────────────────────
    ("zoom.view_accounts", "zoom", "view_accounts", "View Zoom accounts"),
    ("zoom.manage_accounts", "zoom", "manage_accounts", "Manage Zoom accounts"),
    ("zoom.view_classes", "zoom", "view_classes", "View scheduled classes"),
    ("zoom.create_classes", "zoom", "create_classes", "Schedule new classes"),
    ("zoom.edit_classes", "zoom", "edit_classes", "Edit classes"),
    ("zoom.delete_classes", "zoom", "delete_classes", "Delete classes"),
    ("zoom.view_recordings", "zoom", "view_recordings", "View recordings"),
    ("zoom.manage_recordings", "zoom", "manage_recordings", "Edit or delete recordings"),
    ("zoom.view_attendance", "zoom", "view_attendance", "View class attendance"),

    # ── Announcements ──────────────────────────────────────────────
    ("announcements.view", "announcements", "view", "View announcements"),
    ("announcements.create", "announcements", "create", "Create announcements"),
    ("announcements.edit", "announcements", "edit", "Edit announcements"),
    ("announcements.delete", "announcements", "delete", "Delete announcements"),

    # ── Notifications ───────────────────────────��──────────────────
    ("notifications.view", "notifications", "view", "View notifications"),
    ("notifications.manage", "notifications", "manage", "Mark as read and clear"),

    # ── Certificates ───────────────────────────────────────────────
    ("certificates.view", "certificates", "view", "View certificates"),
    ("certificates.manage", "certificates", "manage", "Approve, revoke, batch-approve"),
    ("certificates.request", "certificates", "request", "Request a certificate"),
    ("certificates.download", "certificates", "download", "Download certificate PDF"),

    # ── Jobs ───────────────────────────────────────────────────────
    ("jobs.view", "jobs", "view", "View job postings"),
    ("jobs.create", "jobs", "create", "Create job postings"),
    ("jobs.edit", "jobs", "edit", "Edit job postings"),
    ("jobs.delete", "jobs", "delete", "Delete job postings"),
    ("jobs.manage_applications", "jobs", "manage_applications", "Review and manage applications"),
    ("jobs.apply", "jobs", "apply", "Apply to jobs"),

    # ── Admissions ─────────────────────────────────────────────────
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

    # ── Fees (student self-service) ────────────────────────────────
    ("fees.view_own", "fees", "view_own", "View own fee plans and receipts"),
    ("fees.download_receipt", "fees", "download_receipt", "Download payment receipts"),

    # ── Payment Proof ──────────────────────────────────────────────
    ("payment_proof.upload", "payment_proof", "upload", "Upload payment proof"),
    ("payment_proof.view", "payment_proof", "view", "View payment proofs"),

    # ── Devices ────────────────────────────────────────────────────
    ("devices.view", "devices", "view", "View device sessions"),
    ("devices.terminate", "devices", "terminate", "Terminate device sessions"),
    ("devices.manage_requests", "devices", "manage_requests", "Approve or reject device limit requests"),

    # ── Settings ───────────────────────────────────────────────────
    ("settings.view", "settings", "view", "View institute settings"),
    ("settings.edit", "settings", "edit", "Edit institute settings"),

    # ── Branding ───────────────────────────────────────────────────
    ("branding.edit", "branding", "edit", "Edit branding and logo"),
    ("branding.edit_certificate", "branding", "edit_certificate", "Edit certificate design"),

    # ── Email Templates ────────────────────────────────────────────
    ("email_templates.view", "email_templates", "view", "View email templates"),
    ("email_templates.edit", "email_templates", "edit", "Edit email templates"),

    # ── Monitoring ─────────────────────────────────────────────────
    ("monitoring.view_errors", "monitoring", "view_errors", "View error logs"),
    ("monitoring.resolve_errors", "monitoring", "resolve_errors", "Resolve or unresolve errors"),
    ("monitoring.report_errors", "monitoring", "report_errors", "Report client-side errors"),

    # ── API Keys ───────────────────────────────────────────────────
    ("api_keys.view", "api_keys", "view", "View API keys"),
    ("api_keys.create", "api_keys", "create", "Create API keys"),
    ("api_keys.delete", "api_keys", "delete", "Revoke API keys"),

    # ── Webhooks ───────────────────────────────────────────────────
    ("webhooks.view", "webhooks", "view", "View webhooks"),
    ("webhooks.create", "webhooks", "create", "Create webhooks"),
    ("webhooks.edit", "webhooks", "edit", "Edit webhooks"),
    ("webhooks.delete", "webhooks", "delete", "Delete webhooks"),
    ("webhooks.test", "webhooks", "test", "Test webhooks"),

    # ── Integrations (Frappe) ──────────────────────────────────────
    ("integrations.view", "integrations", "view", "View integration config"),
    ("integrations.manage", "integrations", "manage", "Configure integrations"),
    ("integrations.sync", "integrations", "sync", "Trigger and view sync tasks"),

    # ── Billing (institute-level) ──────────────────────────────────
    ("billing.view", "billing", "view", "View billing overview and invoices"),
    ("billing.manage_addons", "billing", "manage_addons", "Activate or cancel addons"),

    # ── Search ─────────────────────────────────────────────────────
    ("search.global", "search", "global", "Use global search"),

    # ── Feedback ───────────────────────────────────────────────────
    ("feedback.submit", "feedback", "submit", "Submit feedback"),
    ("feedback.view_own", "feedback", "view_own", "View own feedback"),

    # ── Activity Log ───────────────────────────────────────────────
    ("activity_log.view", "activity_log", "view", "View activity log"),

    # ── Export ─────────────────────────────────────────────────────
    ("export.data", "export", "data", "Export data to CSV"),

    # ── Roles (admin-only) ─────────────────────────────────────────
    ("roles.view", "roles", "view", "View custom roles"),
    ("roles.create", "roles", "create", "Create custom roles"),
    ("roles.edit", "roles", "edit", "Edit custom roles"),
    ("roles.delete", "roles", "delete", "Delete custom roles"),
    ("roles.assign", "roles", "assign", "Assign roles to users"),

    # ── Upgrade ────────────────────────────────────────────────────
    ("upgrade.request", "upgrade", "request", "Request plan upgrade"),
]

ALL_PERMISSION_CODES: frozenset[str] = frozenset(code for code, _, _, _ in PERMISSION_REGISTRY)

# ---------------------------------------------------------------------------
# System role permission seeds (immutable)
# ---------------------------------------------------------------------------

ADMIN_PERMISSIONS: frozenset[str] = ALL_PERMISSION_CODES

COURSE_CREATOR_PERMISSIONS: frozenset[str] = frozenset({
    "dashboard.view",
    "users.view", "users.create", "users.edit", "users.bulk_import",
    "courses.view", "courses.create", "courses.edit", "courses.delete", "courses.clone",
    "batches.view", "batches.create", "batches.edit", "batches.delete",
    "batches.manage_students", "batches.manage_courses", "batches.manage_access", "batches.view_expiry",
    "lectures.view", "lectures.create", "lectures.edit", "lectures.delete",
    "materials.view", "materials.create", "materials.edit", "materials.delete",
    "curriculum.view", "curriculum.manage",
    "quizzes.view", "quizzes.create", "quizzes.edit", "quizzes.delete", "quizzes.grade",
    "zoom.view_accounts", "zoom.view_classes", "zoom.create_classes",
    "zoom.edit_classes", "zoom.delete_classes",
    "zoom.view_recordings", "zoom.manage_recordings", "zoom.view_attendance",
    "announcements.view", "announcements.create", "announcements.edit", "announcements.delete",
    "notifications.view", "notifications.manage",
    "certificates.view", "certificates.manage",
    "jobs.view", "jobs.create", "jobs.edit", "jobs.delete", "jobs.manage_applications",
    "devices.view", "devices.terminate", "devices.manage_requests",
    "search.global",
    "feedback.submit", "feedback.view_own",
})

TEACHER_PERMISSIONS: frozenset[str] = frozenset({
    "dashboard.view",
    "batches.view",
    "courses.view",
    "lectures.view",
    "materials.view", "materials.create", "materials.edit", "materials.delete",
    "quizzes.view", "quizzes.grade",
    "announcements.view", "announcements.create", "announcements.edit", "announcements.delete",
    "zoom.view_classes", "zoom.view_recordings", "zoom.view_attendance",
    "certificates.view",
    "notifications.view", "notifications.manage",
    "search.global",
    "feedback.submit", "feedback.view_own",
})

STUDENT_PERMISSIONS: frozenset[str] = frozenset({
    "dashboard.view",
    "batches.view",
    "courses.view",
    "lectures.view", "lectures.track_progress",
    "materials.view",
    "quizzes.view", "quizzes.attempt",
    "certificates.view", "certificates.request", "certificates.download",
    "jobs.view", "jobs.apply",
    "announcements.view",
    "zoom.view_classes", "zoom.view_recordings",
    "fees.view_own", "fees.download_receipt",
    "notifications.view", "notifications.manage",
    "search.global",
    "feedback.submit", "feedback.view_own",
})

ADMISSIONS_OFFICER_PERMISSIONS: frozenset[str] = frozenset({
    "dashboard.view",
    "admissions.view_students", "admissions.onboard", "admissions.edit_students",
    "admissions.manage_enrollment", "admissions.suspend_reactivate", "admissions.delete_students",
    "admissions.record_payment", "admissions.view_payments", "admissions.view_quota",
    "payment_proof.upload", "payment_proof.view",
    "integrations.view",
    "notifications.view", "notifications.manage",
    "search.global",
    "feedback.submit", "feedback.view_own",
})

SYSTEM_ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    UserRole.admin.value: ADMIN_PERMISSIONS,
    UserRole.course_creator.value: COURSE_CREATOR_PERMISSIONS,
    UserRole.teacher.value: TEACHER_PERMISSIONS,
    UserRole.student.value: STUDENT_PERMISSIONS,
    UserRole.admissions_officer.value: ADMISSIONS_OFFICER_PERMISSIONS,
}

# View type → set of system roles whose gates a custom role should pass
VIEW_TYPE_TO_ROLES: dict[str, set[str]] = {
    "admin_view": {"admin", "course_creator", "teacher", "student", "admissions_officer"},
    "staff_view": {"course_creator", "teacher"},
    "student_view": {"student"},
}
