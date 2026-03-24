# Routers

FastAPI endpoint handlers. All routes are at `/api/v1/{prefix}`.

Each router uses role-based access via `require_roles()` dependency.
Roles: super_admin, admin, course_creator, teacher, student.

Public endpoints (no auth): branding, signup, public_api.
Admin-only: monitoring, api_keys, webhooks, super_admin.

Request flow: Router → Service → Database (AsyncSession).
