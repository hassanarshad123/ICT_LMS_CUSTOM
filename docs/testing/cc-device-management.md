# Testing Plan: Course Creator Device Management Access

## Feature Under Test

Course Creators (CCs) can now view and terminate device sessions of **students and teachers** in their institute. CCs **must not** see or affect sessions of admins or other course creators. Admin behavior is unchanged.

## Changed Surfaces

### Backend
- `GET /api/v1/admin/devices` — now accepts `admin` **or** `course_creator`; CC results are hard-filtered to student + teacher roles; response now embeds `device_limit`.
- `DELETE /api/v1/admin/devices/{session_id}` — CCs cannot terminate sessions belonging to admin/CC users (returns 404).
- `DELETE /api/v1/admin/devices/user/{user_id}` — CCs cannot bulk-terminate admin/CC users (returns 404).
- Response schema: `DevicesListResponse` extends paginated envelope with `device_limit: int`.

### Frontend
- `/devices` page RoleGuard: `admin` + `course-creator`.
- Sidebar: Devices nav item added to CC sidebar, positioned after "Upload Videos".
- Role filter chip: CC view does not list "Course Creator" option.
- Device limit badge: sourced from embedded `deviceLimit` in list response (no separate settings call).

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| CC sees an admin's active sessions | **High** | Service-layer hard filter `User.role IN (student, teacher)` |
| CC terminates an admin session by guessing session UUID | **High** | `terminate_session` joins user and returns 404 for out-of-scope roles |
| CC terminates an admin user's sessions by guessing user UUID | **High** | `terminate_all_user_sessions` fetches target user first, returns 404 for out-of-scope |
| Leaks across institutes | Medium | Existing institute scoping unchanged — all queries still gated by `institute_id` |
| `/admin/settings` accidentally opened to CC | Medium | Not touched — endpoint remains admin-only |
| UI shows stale device_limit | Low | Read from list response, refetches on every paginated query |

## Pre-Deployment Checks

| Check | Command | Expected |
|---|---|---|
| Backend compiles | `python -m compileall -q app/` (in `backend/`) | exit 0 |
| Frontend types | `npm run typecheck` (in `frontend/`) | 0 errors |
| Frontend lint | `npm run lint` (in `frontend/`) | 0 errors |
| Device integration tests | `pytest backend/tests/test_device_management_cc.py -v` | all pass |

## Test Coverage

### Automated (pytest integration — `backend/tests/test_device_management_cc.py`)

These tests hit a **running backend** using pre-seeded accounts (admin/cc/teacher/student per `conftest.py`).

1. **Admin list parity** — Admin `GET /admin/devices` returns users of all roles and includes a `device_limit` field.
2. **CC list scope** — CC `GET /admin/devices` returns *only* users with role `student` or `teacher`; the response includes `device_limit`.
3. **CC role filter sanitization** — CC `GET /admin/devices?role=admin` returns no admin users (filter silently dropped).
4. **CC role filter sanitization** — CC `GET /admin/devices?role=course-creator` returns no CC users.
5. **CC role filter passthrough** — CC `GET /admin/devices?role=student` returns only students.
6. **CC cannot terminate admin session** — CC `DELETE /admin/devices/{admin_session_id}` returns 404.
7. **CC cannot bulk-terminate admin user** — CC `DELETE /admin/devices/user/{admin_user_id}` returns 404.
8. **CC can list own-scope devices** — CC sees the seeded student + teacher in the devices list.
9. **Admin unchanged** — Admin can still see admin + CC users (regression check).

### Manual QA (post-deploy smoke test)

Run on production (`https://apiict.zensbot.site`, `https://zensbot.online`) after deploy:

1. **Admin regression**
   - Login as admin
   - Navigate to Devices
   - Verify the role filter shows all 4 options (All / Student / Teacher / Course Creator)
   - Verify the list shows users of all roles
   - Verify the `device_limit` badge shows the correct value
   - Terminate one session → succeeds, disappears from list
   - Terminate all sessions for a user → succeeds

2. **CC happy path**
   - Login as a course creator
   - Verify "Devices" appears in the sidebar immediately after "Upload Videos"
   - Click Devices
   - Verify the page loads without 403
   - Verify the role filter shows only 3 options (All / Student / Teacher)
   - Verify the list contains only students and teachers
   - Terminate a student session → succeeds
   - Terminate all sessions for a teacher → succeeds

3. **CC security probe** (use browser devtools or Postman)
   - Get the CC access token
   - `GET /api/v1/admin/devices?role=admin` → response `data` array contains **no** admin users
   - `GET /api/v1/admin/devices?role=course-creator` → response `data` array contains **no** CC users
   - Pick an admin session UUID from the admin's devices response — then `DELETE /api/v1/admin/devices/{that_id}` with the CC token → **404**
   - Pick an admin user UUID — `DELETE /api/v1/admin/devices/user/{that_id}` with the CC token → **404**
   - `GET /api/v1/admin/settings` with CC token → **403** (unchanged)

## Rollback Plan

If any of the post-deploy checks fail:

1. Revert the commit: `git revert <commit_sha> && git push origin main`
2. CI/CD will redeploy previous image via blue-green on EC2
3. Vercel will auto-revert the frontend on next push

No data migration was performed — the rollback is pure code revert, zero data risk.

## Known Limitations

- `/admin/devices` still lives under the `/admin/` URL prefix even though CCs now use it. Not renamed to avoid a wider blast radius; documented here for any future URL audit.
- The UI component file is still at `frontend/components/pages/admin/devices.tsx` — kept for minimal churn, not moved to a shared location.
