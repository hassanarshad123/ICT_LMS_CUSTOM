# Testing Plan: Hard Device Limit with Admin/CC Approval

## Feature Under Test

A second enforcement mode for the device limit system: when an institute
admin picks `require_approval`, non-exempt users who hit their device cap
are **blocked** from logging in until an admin (or CC for students/teachers)
approves their request.

The existing `evict_oldest` mode remains the default so nothing changes
for tenants who don't opt in.

## Mode matrix

| mode | student | teacher | course_creator | admin | super_admin |
|---|---|---|---|---|---|
| `evict_oldest` (default) | evict | evict | evict | evict | evict |
| `require_approval` | **request** | **request** | **request** | evict (exempt) | evict (exempt) |

Admins and super-admins always use `evict_oldest` even in `require_approval`
institutes — this prevents a lockout deadlock where the only admin of a
tenant cannot log in to approve their own fleet.

## Changed surfaces

### Backend
- New model: `DeviceLimitRequest` (`backend/app/models/device_request.py`)
- New enum: `DeviceLimitRequestStatus` in `backend/app/models/enums.py`
- New enum: `DeviceLimitMode` in `backend/app/models/enums.py`
- New service: `backend/app/services/device_request_service.py`
- New schemas: `backend/app/schemas/device_request.py`
- Refactored `auth_service._enforce_device_limit` — now raises `DeviceLimitRequiresApproval`
- New auth endpoints:
  - `POST /api/v1/auth/device-request` — unauthenticated, rate-limited `10/hour`
  - `GET /api/v1/auth/device-request/{id}/status` — unauthenticated, rate-limited `30/minute`
- New admin endpoints:
  - `GET /api/v1/admin/device-requests`
  - `POST /api/v1/admin/device-requests/{id}/approve`
  - `POST /api/v1/admin/device-requests/{id}/reject`
- Alembic migration: `030_add_device_limit_requests.py`

### Frontend
- New API client: `frontend/lib/api/device-request.ts`
- Extended API client: `frontend/lib/api/admin.ts` (request list/approve/reject + `PendingDeviceRequest` type)
- `apiClient` now throws `ApiError` with `.status`, `.detail`, and `.data` fields (backward compatible with `Error.message`)
- `frontend/app/login/page.tsx` — detects structured 403, shows request prompt, polls status, auto-logs in on approval
- `frontend/components/pages/admin/devices.tsx` — tab bar with "Active devices" + "Pending requests", review modal with session picker
- `frontend/components/pages/admin/settings.tsx` — new "When a user exceeds the limit" dropdown in Session Settings

## Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Lockout deadlock (admin at limit cannot log in to approve) | **High** | Admins + SAs are hard-coded exempt in `_HARD_MODE_EXEMPT_ROLES` |
| Attacker spams admins with fake requests | **High** | Rate limits: `10/hour` on create endpoint, `3/hour per user` in service, `30/minute` on poll endpoint. Credentials re-validated on request creation. |
| Polling token leaks → attacker steals tokens on approval | **High** | Raw token only returned once; sha256 stored in DB; tokens minted lazily on first poll and marked `consumed` atomically |
| CC approves an admin's request | **Medium** | Service-layer check: CC can only review requests where user role is student or teacher |
| Terminating wrong user's session | **High** | Approval endpoint verifies `terminated_session_id` belongs to the requesting user and is active |
| Pending requests pile up forever | **Low** | User chose "no auto-expiration"; admin can sweep manually. Accepted limitation. |
| Soft mode regression (existing tenants) | **High** | Default is `evict_oldest`; no institute is auto-migrated; full regression test in suite |
| Token re-use via replay | **High** | `consumed_at` set atomically on first successful poll; second poll returns `consumed` with no tokens |
| Inactive/deactivated user gets approved | **Medium** | Poll re-reads user state; returns `rejected` if user is no longer active |

## Pre-deployment checks

| Check | Command | Expected |
|---|---|---|
| Backend compiles | `python -m compileall -q app/` | exit 0 |
| Alembic migration runs | `alembic upgrade head` | no errors |
| Frontend types | `npm run typecheck` | 0 errors |
| Frontend lint | `npm run lint` | 0 errors |
| Integration suite | `pytest tests/test_device_limit_requests.py -v -m integration` | all pass |
| Previous feature regression | `pytest tests/test_device_management_cc.py -v -m integration` | all pass |

## Manual QA (production smoke)

Run after deploy on `https://apiict.zensbot.site` + `https://zensbot.online`.

### 1. Admin regression — evict_oldest still works
1. Log in as admin with `device_limit_mode = evict_oldest` and `max_device_limit = 2`
2. Log in from 2 more browsers (same user)
3. Third login succeeds silently; oldest session is kicked out
4. ✅ No "device limit reached" prompt appears

### 2. Admin configures hard mode
1. Log in as admin
2. Settings → Session Settings
3. Confirm the new dropdown is visible under the device limit stepper
4. Change to "Require admin approval for new devices"
5. Click Save → toast "Session settings saved"
6. Refresh the page → the dropdown shows `require_approval`

### 3. Student happy path
1. Log in as student from device A → success
2. Log in as student from device B → success
3. Try device C → see "Device limit reached" prompt (not a generic error)
4. Click "Request access" → "Waiting for approval" screen with a spinner and elapsed timer
5. In another window, log in as admin (or CC)
6. Navigate to Devices → **Pending requests** tab (check badge count)
7. Click **Review** on the student's request
8. Modal opens showing A and B as radio options
9. Pick A → click **Approve**
10. Within 5 seconds, device C's waiting screen transitions to the student dashboard automatically
11. Device A's next API call returns 401 and logs out

### 4. Rejection
1. Repeat step 1-4 with a new device
2. Admin clicks **Reject** → types reason "Unknown device" → confirms
3. Student's waiting screen shows "Request denied: Unknown device" with a "Back to login" button

### 5. Role exemption
1. Admin settings still in `require_approval`
2. Admin logs in from 3 devices
3. Third login silently evicts oldest (NO prompt, NO request flow)
4. No admin request appears in the pending tab

### 6. CC scope
1. Log in as CC
2. Navigate to Devices → Pending requests
3. Confirm CC can see student/teacher requests
4. Create an admin device request via direct API hit:
   ```
   curl -X POST /api/v1/auth/device-request \
     -H "X-Institute-Slug: ict" \
     -d '{"email": "admin@ict.net.pk", "password": "admin123"}'
   ```
   (this should fail with `approval_not_required` since admins are exempt)
5. CC tries to approve a fake request ID → 404

### 7. Rate limit
1. As a student at hard limit, send 3 requests in under an hour
2. 4th attempt → "Too many requests. Please try again later." error on the request prompt

### 8. Replay protection
1. Get a valid polling token from an approved request (via DB query if needed)
2. Poll once → tokens returned
3. Poll again with the same token → `{status: "consumed"}` with no tokens

### 9. Mode rollback
1. Admin switches mode back to "Evict oldest"
2. New student logins silently evict again
3. Existing pending requests stay visible in the admin tab
4. Admin manually rejects any stale requests

## Rollback

- **Code**: `git revert <sha> && git push origin main` → CI + blue-green + Vercel handle the rest
- **Schema**: `alembic downgrade -1` drops `device_limit_requests` table. The existing `UserSession` table is never touched, so there's zero data risk.
- **Mode per-institute**: Any admin can flip the dropdown back to `evict_oldest` — takes effect on the next login, no deploy needed.

## Known limitations

1. No email notifications; admins must check the in-app notification bell or the Devices tab.
2. No auto-expiration of pending requests — stale requests pile up if admin doesn't reject them.
3. No fingerprinting; two browsers on the same machine count as two devices.
4. `POST /auth/device-request` is unauthenticated — rate limited but still a surface an attacker could probe. Max damage: spam admin notifications within the 10/hour cap.
5. No bulk approve/reject on the admin page. For MVP queue sizes this is fine.
6. The waiting page caps at 5 minutes of polling. If the admin approves later, the user must log in again (but the approval did happen — the old session is already terminated, so the next login works without a new request).
