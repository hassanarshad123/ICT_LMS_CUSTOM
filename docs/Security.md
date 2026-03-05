# ICT Institute LMS — Security Architecture

> Complete security documentation: authentication, authorization, encryption, and every protection layer.
> This replaces the Supabase RLS approach with FastAPI application-layer security.

---

## Table of Contents

1. [JWT Authentication Flow](#1-jwt-authentication-flow)
2. [Password Hashing](#2-password-hashing)
3. [Role-Based Access Control (RBAC)](#3-role-based-access-control-rbac)
4. [Permission Matrix](#4-permission-matrix)
5. [Device Limit Enforcement](#5-device-limit-enforcement)
6. [Video URL Signing](#6-video-url-signing)
7. [S3 Pre-Signed URLs](#7-s3-pre-signed-urls)
8. [Zoom Credential Encryption](#8-zoom-credential-encryption)
9. [CORS Configuration](#9-cors-configuration)
10. [Rate Limiting](#10-rate-limiting)
11. [Activity Logging](#11-activity-logging)
12. [Webhook Validation](#12-webhook-validation)
13. [Security Checklist](#13-security-checklist)

---

## 1. JWT Authentication Flow

### Token Architecture

| Token | Type | Lifetime | Storage | Revocable |
|-------|------|----------|---------|-----------|
| Access Token | JWT (signed HS256) | 15 minutes | Frontend `localStorage` | No (stateless) |
| Refresh Token | Random UUID | 7 days | DB `user_sessions.session_token` (bcrypt hash) | Yes (delete DB row) |

**Why this split:**
- Access token is fast — no DB lookup on every request (stateless verification)
- Refresh token is revocable — stored in DB, can be deleted by admin or logout
- If an access token is compromised, it expires in 15 minutes
- If a refresh token is compromised, admin can terminate the session

### Access Token Payload

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "role": "student",
  "exp": 1709654400,
  "iat": 1709653500
}
```

Only `sub` (user ID) and `role` are in the token. All other user data is fetched from DB when needed.

### Login Flow

```
1. POST /api/v1/auth/login
   Body: { "email": "student@email.com", "password": "..." }

2. Server: Find user by email WHERE deleted_at IS NULL AND status = 'active'
   → If not found: 401 "Invalid credentials"

3. Server: passlib.verify(password, user.hashed_password)
   → If mismatch: 401 "Invalid credentials"

4. Server: enforce_device_limit(user_id)
   → Count active sessions. If >= max_device_limit, deactivate oldest.
   → Push WebSocket "session_terminated" to oldest session.

5. Server: Create user_sessions row
   → session_token = bcrypt.hash(refresh_token)
   → device_info = parse User-Agent header
   → ip_address = request.client.host

6. Server: Generate access token
   → jwt.encode({"sub": user_id, "role": role, "exp": now + 15min})

7. Response: 200
   {
     "access_token": "eyJ...",
     "refresh_token": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
     "token_type": "bearer",
     "user": { "id": "...", "name": "...", "email": "...", "role": "student", ... }
   }
```

### Per-Request Authentication

```
1. Extract "Authorization: Bearer <token>" header
2. jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
   → If expired: 401 "Token expired"
   → If invalid: 401 "Invalid token"
3. Extract user_id from payload["sub"]
4. Query DB: get user WHERE id = user_id AND deleted_at IS NULL AND status = 'active'
   → If not found/inactive: 401 "User not found or inactive"
5. Inject user object into request via Depends(get_current_user)
```

### Refresh Flow

```
1. POST /api/v1/auth/refresh
   Body: { "refresh_token": "f47ac10b-..." }

2. Server: Query user_sessions WHERE is_active = true
   → For each session: bcrypt.verify(refresh_token, session.session_token)
   → If no match: 401 "Invalid refresh token"

3. Server: Check session.user is still active and not deleted
   → If not: 401 "User deactivated"

4. Server: Generate new access token (refresh token stays the same)

5. Response: 200
   { "access_token": "eyJ..." }
```

### Logout Flow

```
1. POST /api/v1/auth/logout
   Header: Authorization: Bearer <access_token>

2. Server: Identify current session (from the refresh token, or from a session_id header)
3. Server: Set user_sessions.is_active = false for that session
4. Response: 200 { "detail": "Logged out" }
```

---

## 2. Password Hashing

| Setting | Value |
|---------|-------|
| Algorithm | bcrypt |
| Library | `passlib[bcrypt]` |
| Rounds | 12 (default) |
| Hash time | ~250ms per password |

### Implementation

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

### Password Rules

- No self-registration — Admin or Course Creator creates all accounts
- No "forgot password" email flow — Admin resets passwords manually
- Password reset: Admin calls `POST /api/v1/users/{id}/reset-password` → generates random 12-char temp password → returns plaintext to admin → admin communicates it out-of-band
- Minimum password length: 8 characters (enforced by Pydantic schema validation)

---

## 3. Role-Based Access Control (RBAC)

### Two Levels of Authorization

**Level 1 — Role Check (middleware):** Does this user's role allow access to this endpoint?

```python
@router.post("/")
async def create_batch(
    data: BatchCreate,
    current_user: User = Depends(require_roles("admin", "course_creator")),
):
```

**Level 2 — Resource Check (service):** Does this user have access to this specific resource?

```python
# In batch_service.py
async def get_batch(db, batch_id, current_user):
    batch = await db.get(Batch, batch_id)
    if not batch or batch.deleted_at:
        raise NotFoundError("Batch", batch_id)

    # Teacher can only see batches assigned to them
    if current_user.role == "teacher" and batch.teacher_id != current_user.id:
        raise PermissionDeniedError()

    # Student can only see batches they are enrolled in
    if current_user.role == "student":
        enrollment = await db.exec(
            select(StudentBatch)
            .where(StudentBatch.student_id == current_user.id)
            .where(StudentBatch.batch_id == batch_id)
            .where(StudentBatch.removed_at.is_(None))
        )
        if not enrollment.first():
            raise PermissionDeniedError()

    return batch
```

### Fine-Grained Rules

| Rule | Enforcement |
|------|-------------|
| Teacher can only CRUD Zoom classes for their own batches | Service checks `batch.teacher_id == current_user.id` |
| Teacher can only upload materials to their own batches | Service checks batch ownership |
| Student can only watch lectures for enrolled batches | Service checks `student_batches` active enrollment |
| Student can only see active (non-expired) batch content | Service checks batch `end_date + grace_period >= today` |
| CC can manage non-admin users only | Service checks `target_user.role != 'admin'` |
| CC cannot create admin accounts | Schema validation rejects `role: 'admin'` + service double-check |
| Users can only update their own profile (name, phone) | Service checks `current_user.id == target_user_id` |
| Users cannot change their own role, email, or status | Service ignores these fields from self-update payloads |

---

## 4. Permission Matrix

This matrix mirrors the original Supabase RLS policies, now enforced in the FastAPI service layer.

### Read Permissions

| Resource | Admin | Course Creator | Teacher | Student |
|----------|-------|----------------|---------|---------|
| Users (all) | All | All non-admin | Own batch students | Self only |
| Batches | All | All | Own batches only | Enrolled batches only |
| Courses | All | All | Own-batch courses | Enrolled-batch courses |
| Lectures | All | All | Own-batch lectures | Enrolled-batch lectures |
| Curriculum | All | All | Own-batch courses | Enrolled-batch courses |
| Materials | All | All | Own-batch materials | Enrolled-batch materials |
| Zoom Classes | All | All | Own classes | Enrolled-batch classes |
| Zoom Accounts | All fields | None | Name + ID only (no secret) | None |
| Class Recordings | All | All | Own-batch recordings | Enrolled + status='ready' only |
| Announcements | All | All | Own-batch + institute | Own-batch + own-course + institute |
| Lecture Progress | All | All | None | Own progress only |
| Zoom Attendance | All | All | Own-class attendance | None |
| Jobs | All | All | None | All active jobs |
| Job Applications | All | All (for their jobs) | None | Own applications only |
| User Sessions | All | None | None | Own sessions only |
| System Settings | All | None | None | None |
| Activity Log | All | None | None | None |

### Write Permissions

| Operation | Admin | Course Creator | Teacher | Student |
|-----------|-------|----------------|---------|---------|
| Create user | Yes (all roles) | Yes (non-admin) | No | No |
| Update user | Yes (all) | Yes (non-admin) | No | Self (name, phone) |
| Deactivate user | Yes | Yes (non-admin) | No | No |
| Create batch | Yes | Yes | No | No |
| Update batch | Yes | Yes | No | No |
| Enroll student | Yes | Yes | No | No |
| Create course | No | Yes | No | No |
| Update course | No | Yes | No | No |
| Clone course | No | Yes | No | No |
| Create lecture | No | Yes | No | No |
| Delete lecture | No | Yes | No | No |
| Create material | No | Yes | Yes (own batch) | No |
| Delete material | No | Yes (any) | Own uploads only | No |
| Create curriculum module | No | Yes | No | No |
| Schedule Zoom class | No | No | Yes (own batch) | No |
| Create announcement | Yes (institute) | Yes (batch/course) | Yes (own batch) | No |
| Post job | No | Yes | No | No |
| Apply to job | No | No | No | Yes |
| Update application status | No | Yes | No | No |
| Update lecture progress | No | No | No | Yes (own) |
| Terminate session | Yes (any) | No | No | No |
| Update system settings | Yes | No | No | No |

---

## 5. Device Limit Enforcement

### Configuration

Stored in `system_settings` table:
```sql
INSERT INTO system_settings (setting_key, value, description)
VALUES ('max_device_limit', '2', 'Maximum concurrent login sessions per user');
```

Admin can update via `PATCH /api/v1/admin/settings`.

### Enforcement Flow (Inside Login)

```python
async def enforce_device_limit(db: AsyncSession, user_id: UUID):
    # 1. Get max limit from system_settings
    max_limit = await get_setting(db, "max_device_limit")  # default: 2

    # 2. Count active sessions for this user
    stmt = (
        select(UserSession)
        .where(UserSession.user_id == user_id)
        .where(UserSession.is_active == True)
        .order_by(UserSession.logged_in_at.asc())  # oldest first
    )
    sessions = (await db.exec(stmt)).all()

    # 3. If at or over limit, deactivate oldest sessions
    while len(sessions) >= int(max_limit):
        oldest = sessions.pop(0)
        oldest.is_active = False
        db.add(oldest)

        # 4. Push WebSocket notification to the terminated session
        await ws_manager.send_to_session(
            str(oldest.id),
            {"type": "session_terminated", "reason": "device_limit_exceeded"}
        )

    await db.commit()
```

### Admin Actions

- **View all sessions:** `GET /api/v1/admin/devices` → returns `UserDeviceSummary[]`
- **Terminate one session:** `DELETE /api/v1/admin/devices/{session_id}`
- **Terminate all for user:** `DELETE /api/v1/admin/devices/user/{user_id}`
- **Change limit:** `PATCH /api/v1/admin/settings` with `{"max_device_limit": "3"}`

---

## 6. Video URL Signing

### Flow

```
1. Student: POST /api/v1/lectures/{lecture_id}/signed-url
   Header: Authorization: Bearer <token>

2. Server: Verify current_user.role == 'student'
3. Server: Get lecture from DB → get batch_id
4. Server: Check student_batches — active enrollment in this batch
5. Server: Check batch grace period — end_date + grace_days >= today (Asia/Karachi)
6. Server: Generate Bunny.net signed URL
7. Response: { "url": "https://...", "expires_at": "2025-03-05T14:40:00Z" }
```

### Bunny.net Signed URL Generation

```python
import hmac
import hashlib
import base64
import time

def generate_bunny_signed_url(
    video_id: str,
    cdn_hostname: str,
    signing_key: str,
    student_name: str,
    student_id: str,
    expiry_seconds: int = 600,  # 10 minutes
) -> str:
    expiry = int(time.time()) + expiry_seconds

    # Build the string to sign
    hashable_path = f"/{video_id}/{expiry}"
    signature = base64.urlsafe_b64encode(
        hmac.new(
            signing_key.encode(),
            hashable_path.encode(),
            hashlib.sha256
        ).digest()
    ).decode().rstrip("=")

    # Build URL with watermark parameters
    watermark = f"{student_name} ({student_id})"
    url = (
        f"https://{cdn_hostname}/{video_id}/playlist.m3u8"
        f"?token={signature}"
        f"&expires={expiry}"
        f"&watermark={watermark}"
    )
    return url
```

### Security Layers

| Layer | Protection |
|-------|-----------|
| Signed URL | Expires in 10 minutes — sharing is useless |
| Watermark | Student name + ID overlaid on video — deters screen recording |
| DRM | Bunny.net built-in — prevents playback on unauthorized devices |
| Enrollment check | Student must be actively enrolled in the lecture's batch |
| Grace period | After batch ends, access continues for configurable days (default 90) |

---

## 7. S3 Pre-Signed URLs

### Upload Flow (Materials, Resumes, Avatars)

```
1. Client: POST /api/v1/materials/upload-url
   Body: { "file_name": "notes.pdf", "content_type": "application/pdf", "batch_id": "..." }

2. Server: Validate role + batch access
3. Server: Generate object key: "materials/{batch_id}/{uuid}_{file_name}"
4. Server: boto3.generate_presigned_url('put_object', Params={
       'Bucket': S3_BUCKET_MATERIALS,
       'Key': object_key,
       'ContentType': content_type,
   }, ExpiresIn=900)  # 15 minutes

5. Response: { "upload_url": "https://s3.ap-south-1.amazonaws.com/...", "object_key": "materials/..." }

6. Client: PUT file directly to S3 upload_url (bypasses EC2)

7. Client: POST /api/v1/materials/
   Body: { "object_key": "materials/...", "title": "...", "batch_id": "...", ... }

8. Server: Create batch_materials row in DB
```

### Download Flow

```
1. Client: GET /api/v1/materials/{material_id}/download-url

2. Server: Validate role + enrollment (student must be in batch)
3. Server: boto3.generate_presigned_url('get_object', Params={
       'Bucket': S3_BUCKET_MATERIALS,
       'Key': material.file_path,
       'ResponseContentDisposition': f'attachment; filename="{material.file_name}"',
   }, ExpiresIn=900)

4. Response: { "download_url": "https://..." }
```

### Why Pre-Signed URLs

- **Upload:** File goes directly from browser to S3 — doesn't pass through EC2 (no bandwidth bottleneck, no memory pressure)
- **Download:** Same — browser downloads directly from S3
- **Security:** URLs expire in 15 minutes; bucket is fully private; no public access

---

## 8. Zoom Credential Encryption

### Why Encrypt

The `zoom_accounts` table stores OAuth `client_secret` values. These must not be stored in plaintext in the database — if the database is compromised, the Zoom credentials should still be protected.

### Implementation

```python
from cryptography.fernet import Fernet
from app.config import settings

# ENCRYPTION_KEY is a Fernet key stored as env var
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

fernet = Fernet(settings.ENCRYPTION_KEY.encode())

def encrypt_secret(plaintext: str) -> str:
    """Encrypt a Zoom client_secret for DB storage."""
    return fernet.encrypt(plaintext.encode()).decode()

def decrypt_secret(ciphertext: str) -> str:
    """Decrypt a Zoom client_secret from DB storage."""
    return fernet.decrypt(ciphertext.encode()).decode()
```

### Usage

```python
# When creating a Zoom account (admin):
account.client_secret = encrypt_secret(request.client_secret)
db.add(account)

# When creating a Zoom meeting (internal service):
decrypted_secret = decrypt_secret(account.client_secret)
zoom_token = get_zoom_access_token(account.client_id, decrypted_secret, account.account_id)
```

### Rules

- `ENCRYPTION_KEY` lives ONLY in EC2 `.env` — never in code, never in DB
- If `ENCRYPTION_KEY` is lost, all Zoom credentials must be re-entered by admin
- `client_secret` is NEVER returned in any API response — response schema excludes it
- Teachers see Zoom account `name` and `id` only (for scheduling dropdown)

---

## 9. CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    # Production: ["https://ict-lms.vercel.app"]
    # Development: ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
```

**Rules:**
- `allow_origins` must be an explicit list (not `"*"`) because `allow_credentials=True`
- Development origin (`localhost:3000`) included only in dev environment
- Flutter mobile app does not need CORS (not a browser)

---

## 10. Rate Limiting

Using `slowapi` (FastAPI-compatible, built on limits library).

### Configuration

| Endpoint | Limit | Reason |
|----------|-------|--------|
| `POST /auth/login` | 10/minute per IP | Prevent brute force |
| `POST /auth/refresh` | 30/minute per IP | Prevent token abuse |
| `POST /lectures/*/signed-url` | 30/minute per user | Prevent video URL farming |
| All other endpoints | 200/minute per user | General protection |

### Implementation

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, ...):
    ...
```

---

## 11. Activity Logging

### What's Logged

All mutating operations are recorded in the `activity_log` table. This is an append-only audit trail — no updates, no deletes.

### Actions Logged

| Category | Actions |
|----------|---------|
| Users | `user.created`, `user.updated`, `user.deactivated`, `user.reactivated`, `user.password_reset`, `user.bulk_imported` |
| Batches | `batch.created`, `batch.updated`, `batch.deleted` |
| Enrollment | `student.enrolled`, `student.removed_from_batch` |
| Courses | `course.created`, `course.updated`, `course.deleted`, `course.cloned` |
| Lectures | `lecture.created`, `lecture.updated`, `lecture.deleted` |
| Curriculum | `module.created`, `module.updated`, `module.deleted` |
| Materials | `material.uploaded`, `material.deleted` |
| Zoom | `zoom_account.created`, `zoom_account.updated`, `zoom_account.deleted` |
| Zoom Classes | `zoom_class.scheduled`, `zoom_class.started`, `zoom_class.completed` |
| Recordings | `recording.processing`, `recording.ready`, `recording.failed` |
| Jobs | `job.posted`, `job.updated`, `job.deleted` |
| Applications | `application.submitted`, `application.status_changed` |
| Announcements | `announcement.created`, `announcement.updated`, `announcement.deleted` |
| Sessions | `session.created`, `session.terminated`, `session.expired` |
| Settings | `setting.updated` |

### Implementation

```python
async def log_activity(
    db: AsyncSession,
    user_id: Optional[UUID],     # Who did it (None for system actions)
    action: str,                  # e.g., "user.created"
    entity_type: str,             # e.g., "user"
    entity_id: Optional[UUID],    # Which record was affected
    details: Optional[dict],      # Extra context (JSON)
    ip_address: Optional[str],    # Request IP
):
    log = ActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(log)
    # Do NOT commit — let the caller's transaction commit it
```

### Access

Only Admin can view the activity log via `GET /api/v1/admin/activity-log` (paginated, filterable by action, entity_type, user_id, date range).

---

## 12. Webhook Validation

### Zoom Webhook Signature Verification

```python
import hmac
import hashlib

async def validate_zoom_webhook(request: Request) -> dict:
    """Validate Zoom webhook signature and return parsed body."""
    body = await request.body()
    timestamp = request.headers.get("x-zm-request-timestamp", "")
    signature = request.headers.get("x-zm-signature", "")

    # Reconstruct the message
    message = f"v0:{timestamp}:{body.decode()}"

    # Compute expected signature
    expected = "v0=" + hmac.new(
        settings.ZOOM_WEBHOOK_SECRET.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    return json.loads(body)
```

### Webhook Endpoint

```python
@router.post("/webhook")
async def zoom_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    # No auth header — Zoom webhooks don't use Bearer tokens
    # Instead, validate HMAC signature
    payload = await validate_zoom_webhook(request)

    event = payload.get("event")
    if event == "meeting.started":
        await zoom_service.handle_meeting_started(db, payload)
    elif event == "meeting.ended":
        await zoom_service.handle_meeting_ended(db, payload)
    elif event == "recording.completed":
        await zoom_service.handle_recording_completed(db, payload)

    return {"status": "ok"}
```

---

## 13. Security Checklist

Before going to production, verify all items:

### Authentication
- [ ] JWT SECRET_KEY is a random 64+ character hex string
- [ ] Access tokens expire in 15 minutes
- [ ] Refresh tokens are stored hashed (bcrypt) in DB
- [ ] Login endpoint enforces device limit
- [ ] Logout invalidates the session in DB
- [ ] Password minimum length is enforced (8 chars)

### Authorization
- [ ] Every endpoint has a `require_roles()` dependency
- [ ] Service layer checks resource ownership (teacher→own batch, student→enrolled batch)
- [ ] Admin-only endpoints are protected
- [ ] CC cannot create/manage admin accounts
- [ ] Users cannot change their own role/status/email via self-update

### Data Protection
- [ ] Zoom `client_secret` is encrypted at rest (Fernet)
- [ ] `hashed_password` is never in any API response schema
- [ ] Soft delete is used everywhere (no hard DELETE)
- [ ] S3 buckets block all public access
- [ ] Bunny.net videos require signed URLs

### Network
- [ ] HTTPS only (HTTP redirects to HTTPS)
- [ ] CORS allows only specific origins
- [ ] EC2 security group restricts SSH to known IPs
- [ ] Rate limiting is active on login endpoint
- [ ] Zoom webhook signature is validated

### Secrets
- [ ] All secrets are in EC2 `.env` file (not in code)
- [ ] `.env` is in `.gitignore`
- [ ] `ENCRYPTION_KEY` is backed up securely
- [ ] No secrets in frontend code (only `NEXT_PUBLIC_API_URL`)
