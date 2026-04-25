export const P = {
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_VIEW_INSIGHTS: 'dashboard.view_insights',

  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  USERS_RESET_PASSWORD: 'users.reset_password',
  USERS_FORCE_LOGOUT: 'users.force_logout',
  USERS_BULK_IMPORT: 'users.bulk_import',

  COURSES_VIEW: 'courses.view',
  COURSES_CREATE: 'courses.create',
  COURSES_EDIT: 'courses.edit',
  COURSES_DELETE: 'courses.delete',
  COURSES_CLONE: 'courses.clone',

  BATCHES_VIEW: 'batches.view',
  BATCHES_CREATE: 'batches.create',
  BATCHES_EDIT: 'batches.edit',
  BATCHES_DELETE: 'batches.delete',
  BATCHES_MANAGE_STUDENTS: 'batches.manage_students',
  BATCHES_MANAGE_COURSES: 'batches.manage_courses',
  BATCHES_MANAGE_ACCESS: 'batches.manage_access',
  BATCHES_VIEW_EXPIRY: 'batches.view_expiry',

  LECTURES_VIEW: 'lectures.view',
  LECTURES_CREATE: 'lectures.create',
  LECTURES_EDIT: 'lectures.edit',
  LECTURES_DELETE: 'lectures.delete',
  LECTURES_TRACK_PROGRESS: 'lectures.track_progress',

  MATERIALS_VIEW: 'materials.view',
  MATERIALS_CREATE: 'materials.create',
  MATERIALS_EDIT: 'materials.edit',
  MATERIALS_DELETE: 'materials.delete',

  CURRICULUM_VIEW: 'curriculum.view',
  CURRICULUM_MANAGE: 'curriculum.manage',

  QUIZZES_VIEW: 'quizzes.view',
  QUIZZES_CREATE: 'quizzes.create',
  QUIZZES_EDIT: 'quizzes.edit',
  QUIZZES_DELETE: 'quizzes.delete',
  QUIZZES_GRADE: 'quizzes.grade',
  QUIZZES_ATTEMPT: 'quizzes.attempt',

  ZOOM_VIEW_ACCOUNTS: 'zoom.view_accounts',
  ZOOM_MANAGE_ACCOUNTS: 'zoom.manage_accounts',
  ZOOM_VIEW_CLASSES: 'zoom.view_classes',
  ZOOM_CREATE_CLASSES: 'zoom.create_classes',
  ZOOM_EDIT_CLASSES: 'zoom.edit_classes',
  ZOOM_DELETE_CLASSES: 'zoom.delete_classes',
  ZOOM_VIEW_RECORDINGS: 'zoom.view_recordings',
  ZOOM_MANAGE_RECORDINGS: 'zoom.manage_recordings',
  ZOOM_VIEW_ATTENDANCE: 'zoom.view_attendance',

  ANNOUNCEMENTS_VIEW: 'announcements.view',
  ANNOUNCEMENTS_CREATE: 'announcements.create',
  ANNOUNCEMENTS_EDIT: 'announcements.edit',
  ANNOUNCEMENTS_DELETE: 'announcements.delete',

  NOTIFICATIONS_VIEW: 'notifications.view',
  NOTIFICATIONS_MANAGE: 'notifications.manage',

  CERTIFICATES_VIEW: 'certificates.view',
  CERTIFICATES_MANAGE: 'certificates.manage',
  CERTIFICATES_REQUEST: 'certificates.request',
  CERTIFICATES_DOWNLOAD: 'certificates.download',

  JOBS_VIEW: 'jobs.view',
  JOBS_CREATE: 'jobs.create',
  JOBS_EDIT: 'jobs.edit',
  JOBS_DELETE: 'jobs.delete',
  JOBS_MANAGE_APPLICATIONS: 'jobs.manage_applications',
  JOBS_APPLY: 'jobs.apply',

  ADMISSIONS_VIEW_STUDENTS: 'admissions.view_students',
  ADMISSIONS_ONBOARD: 'admissions.onboard',
  ADMISSIONS_EDIT_STUDENTS: 'admissions.edit_students',
  ADMISSIONS_MANAGE_ENROLLMENT: 'admissions.manage_enrollment',
  ADMISSIONS_SUSPEND_REACTIVATE: 'admissions.suspend_reactivate',
  ADMISSIONS_DELETE_STUDENTS: 'admissions.delete_students',
  ADMISSIONS_RECORD_PAYMENT: 'admissions.record_payment',
  ADMISSIONS_VIEW_PAYMENTS: 'admissions.view_payments',
  ADMISSIONS_VIEW_STATS: 'admissions.view_stats',
  ADMISSIONS_VIEW_QUOTA: 'admissions.view_quota',

  FEES_VIEW_OWN: 'fees.view_own',
  FEES_DOWNLOAD_RECEIPT: 'fees.download_receipt',

  PAYMENT_PROOF_UPLOAD: 'payment_proof.upload',
  PAYMENT_PROOF_VIEW: 'payment_proof.view',

  DEVICES_VIEW: 'devices.view',
  DEVICES_TERMINATE: 'devices.terminate',
  DEVICES_MANAGE_REQUESTS: 'devices.manage_requests',

  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',

  BRANDING_EDIT: 'branding.edit',
  BRANDING_EDIT_CERTIFICATE: 'branding.edit_certificate',

  EMAIL_TEMPLATES_VIEW: 'email_templates.view',
  EMAIL_TEMPLATES_EDIT: 'email_templates.edit',

  MONITORING_VIEW_ERRORS: 'monitoring.view_errors',
  MONITORING_RESOLVE_ERRORS: 'monitoring.resolve_errors',
  MONITORING_REPORT_ERRORS: 'monitoring.report_errors',

  API_KEYS_VIEW: 'api_keys.view',
  API_KEYS_CREATE: 'api_keys.create',
  API_KEYS_DELETE: 'api_keys.delete',

  WEBHOOKS_VIEW: 'webhooks.view',
  WEBHOOKS_CREATE: 'webhooks.create',
  WEBHOOKS_EDIT: 'webhooks.edit',
  WEBHOOKS_DELETE: 'webhooks.delete',
  WEBHOOKS_TEST: 'webhooks.test',

  INTEGRATIONS_VIEW: 'integrations.view',
  INTEGRATIONS_MANAGE: 'integrations.manage',
  INTEGRATIONS_SYNC: 'integrations.sync',

  BILLING_VIEW: 'billing.view',
  BILLING_MANAGE_ADDONS: 'billing.manage_addons',

  SEARCH_GLOBAL: 'search.global',

  FEEDBACK_SUBMIT: 'feedback.submit',
  FEEDBACK_VIEW_OWN: 'feedback.view_own',

  ACTIVITY_LOG_VIEW: 'activity_log.view',

  EXPORT_DATA: 'export.data',

  ROLES_VIEW: 'roles.view',
  ROLES_CREATE: 'roles.create',
  ROLES_EDIT: 'roles.edit',
  ROLES_DELETE: 'roles.delete',
  ROLES_ASSIGN: 'roles.assign',

  UPGRADE_REQUEST: 'upgrade.request',
} as const;

export type PermissionCode = (typeof P)[keyof typeof P];
