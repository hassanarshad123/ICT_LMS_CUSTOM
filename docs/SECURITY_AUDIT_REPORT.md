# Security Audit Report — ICT LMS

| Field | Value |
|-------|-------|
| **Document** | ICT LMS Security Audit Report |
| **Classification** | CONFIDENTIAL — Internal Use Only |
| **Version** | 1.0 |
| **Date** | 2026-03-09 |
| **Auditor** | Zensbot Security Review |
| **Target System** | ICT Institute Learning Management System |
| **Environment** | Production (`apiict.zensbot.site` / `ict.zensbot.site`) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Audit Scope](#2-audit-scope)
3. [Findings Summary Table](#3-findings-summary-table)
4. [Critical Findings](#4-critical-findings)
5. [High Findings](#5-high-findings)
6. [Medium Findings](#6-medium-findings)
7. [Low Findings](#7-low-findings)
8. [Positive Security Controls](#8-positive-security-controls)
9. [Remediation Roadmap](#9-remediation-roadmap)
10. [OWASP Top 10 Mapping](#10-owasp-top-10-mapping)

---

## 1. Executive Summary

### Overall Risk Assessment: HIGH

A comprehensive security audit of the ICT LMS platform identified **30 security findings** across the full-stack application. The system demonstrates several strong security practices — including bcrypt password hashing, JWT access/refresh token separation, device limit enforcement, and Zoom webhook HMAC validation — but critical gaps exist in webhook authentication, secret management, and authorization controls that could lead to data exposure or system compromise.

### Finding Distribution

| Severity | Count | Percentage |
|----------|-------|------------|
| Critical | 3 | 10% |
| High | 7 | 23% |
| Medium | 9 | 30% |
| Low | 11 | 37% |
| **Total** | **30** | **100%** |

### Top Risks

1. **Unauthenticated webhook endpoint** allows external attackers to forge video processing status changes (SA-001)
2. **Production secrets in git history** — JWT keys, database credentials, and API keys are compromised (SA-002)
3. **WebSocket channels lack authorization** — any authenticated user can subscribe to any channel (SA-003)
4. **Missing authorization checks** on certificate downloads, user profiles, material downloads, and recording URLs (SA-006, SA-007, SA-016, SA-019)
5. **Client-side-only route protection** with no Next.js middleware (SA-005)

---

## 2. Audit Scope

### Systems Audited

| Component | Technology | Files Reviewed |
|-----------|-----------|----------------|
| Backend API | FastAPI + SQLModel + PostgreSQL | 11 routers, 11 services, middleware, utilities, config |
| Frontend | Next.js 13 (App Router) + TypeScript | Auth context, API client, 33+ pages, shared components |
| Authentication | JWT (HS256) + bcrypt | `security.py`, `auth_service.py`, `auth.py` (router), `auth-context.tsx` |
| WebSockets | FastAPI WebSocket | `manager.py`, `routes.py` |
| Video CDN | Bunny.net Stream | `bunny.py`, `lectures.py` |
| Zoom Integration | Zoom Server-to-Server OAuth | `zoom_api.py`, `zoom.py` (router), `encryption.py` |
| File Storage | AWS S3 | `s3.py`, `materials.py` (router) |
| Certificates | PDF generation + S3 | `certificates.py` (router), `certificate_service.py` |
| CI/CD | GitHub Actions | `deploy-backend.yml` |
| Infrastructure | EC2 + nginx + systemd | Server configuration (documented, not SSH-audited) |

### Methodology

- Static code analysis of all backend routers, services, middleware, and utilities
- Review of all frontend authentication and API client code
- Analysis of CI/CD pipeline and deployment scripts
- Review of environment variable handling and secret management
- Cross-reference against OWASP Top 10 (2021)

### Exclusions

- Dynamic/runtime penetration testing was not performed
- EC2 server hardening (SSH audit, OS patches, firewall rules) was not reviewed via SSH
- Third-party dependency vulnerability scanning (e.g., `pip audit`, `npm audit`) was not run
- Load testing and DDoS resilience were not evaluated

---

## 3. Findings Summary Table

| ID | Severity | Title | OWASP Category | Location |
|----|----------|-------|----------------|----------|
| SA-001 | CRITICAL | Bunny Webhook — No Signature Validation | A07: Security Misconfiguration | `backend/app/routers/lectures.py:143-181` |
| SA-002 | CRITICAL | Production Secrets Committed to Git History | A02: Cryptographic Failures | `envs/backend.env` |
| SA-003 | CRITICAL | WebSocket Channels — No Authorization Checks | A01: Broken Access Control | `backend/app/websockets/manager.py:15-29`, `routes.py` |
| SA-004 | HIGH | JWT Tokens in localStorage (XSS Vector) | A07: Security Misconfiguration | `frontend/lib/auth-context.tsx:35-37` |
| SA-005 | HIGH | No Next.js Middleware — Client-Side Route Protection Only | A01: Broken Access Control | No `frontend/middleware.ts` exists |
| SA-006 | HIGH | Certificate Download — Missing Authorization | A01: Broken Access Control | `backend/app/routers/certificates.py:240-250` |
| SA-007 | HIGH | User Profile IDOR — Any User Can View Any Profile | A01: Broken Access Control | `backend/app/routers/users.py:207-217` |
| SA-008 | HIGH | No CSRF Protection | A01: Broken Access Control | System-wide |
| SA-009 | HIGH | Course Creator Can View All User Profiles | A01: Broken Access Control | `backend/app/routers/users.py:207-217` |
| SA-010 | HIGH | Temporary Passwords Returned in API Response | A04: Insecure Design | `backend/app/routers/users.py:198-204, 270-275` |
| SA-011 | MEDIUM | CORS `allow_headers=["*"]` | A07: Security Misconfiguration | `backend/main.py:65` |
| SA-012 | MEDIUM | No HTTP Security Headers | A05: Security Misconfiguration | `backend/main.py` |
| SA-013 | MEDIUM | Certificate Verification — No Rate Limiting | A07: Security Misconfiguration | `backend/app/routers/certificates.py:187-196` |
| SA-014 | MEDIUM | Weak Password Policy (8 chars, no complexity) | A07: Security Misconfiguration | `backend/app/routers/auth.py:125-126` |
| SA-015 | MEDIUM | S3 Presigned URL File Name Injection | A03: Injection | `backend/app/utils/s3.py:35, 56` |
| SA-016 | MEDIUM | Material Download — No Enrollment Check | A01: Broken Access Control | `backend/app/routers/materials.py:89-107` |
| SA-017 | MEDIUM | Batch/Course Information — Broad Read Access | A01: Broken Access Control | `backend/app/routers/batches.py:22-40, 58-67, 97-103` |
| SA-018 | MEDIUM | Deployment Uses `git reset --hard` | A08: Software and Data Integrity | `.github/workflows/deploy-backend.yml:94` |
| SA-019 | MEDIUM | Recording Signed URL — No Enrollment Check | A01: Broken Access Control | `backend/app/routers/zoom.py:389-399` |
| SA-020 | LOW | JWT HS256 Symmetric Algorithm | A02: Cryptographic Failures | `backend/app/config.py:12` |
| SA-021 | LOW | Lecture GET — No Enrollment Check for Metadata | A01: Broken Access Control | `backend/app/routers/lectures.py:184-193` |
| SA-022 | LOW | Health Check Exposes Version Info | A05: Security Misconfiguration | `backend/main.py:87-100` |
| SA-023 | LOW | OpenAPI/Docs Publicly Exposed in Production | A05: Security Misconfiguration | `backend/main.py:43-47` |
| SA-024 | LOW | WebSocket Token in Query Params | A04: Insecure Design | `backend/app/websockets/manager.py:17` |
| SA-025 | LOW | Zoom Secret Partially Exposed to Admin | A01: Broken Access Control | `backend/app/routers/zoom.py:49` |
| SA-026 | LOW | No Request Body Size Limits | A05: Security Misconfiguration | `backend/main.py` |
| SA-027 | LOW | Verbose Error Messages Reveal Internals | A05: Security Misconfiguration | Multiple routers |
| SA-028 | LOW | No Account Lockout After Failed Logins | A07: Security Misconfiguration | `backend/app/services/auth_service.py:32-37` |
| SA-029 | LOW | Session Cleanup Granularity (hourly) | A04: Insecure Design | `backend/main.py:28` |
| SA-030 | LOW | User ID Exposed in Frontend URL Paths | A04: Insecure Design | Frontend route structure |

---

## 4. Critical Findings

### SA-001 — Bunny Webhook: No Signature Validation

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **OWASP** | A07: Security Misconfiguration |
| **Affected File(s)** | `backend/app/routers/lectures.py:143-181` |
| **CVSS Estimate** | 8.6 |

**Description:**

The `/api/v1/lectures/bunny-webhook` endpoint accepts any incoming POST request without verifying a webhook signature. The `BUNNY_WEBHOOK_SECRET` configuration variable exists in `backend/app/config.py:31` but is never referenced in the webhook handler. The endpoint directly processes the JSON body, trusting the `VideoGuid` and `Status` fields.

This stands in contrast to the Zoom webhook handler (`backend/app/routers/zoom.py:404-431`), which correctly validates requests using HMAC-SHA256 with constant-time comparison via `hmac.compare_digest()`.

**Affected Code (`lectures.py:143-150`):**
```python
@router.post("/bunny-webhook")
async def bunny_webhook(request: Request):
    """Handle Bunny Stream encoding webhooks."""
    body = await request.json()
    video_guid = body.get("VideoGuid")
    if not video_guid:
        return {"status": "ignored"}
```

**Impact:**

An attacker who discovers the webhook URL can:
- Mark any lecture's video status as "ready" before encoding completes, causing students to see broken video players
- Mark videos as "failed" to disrupt course content delivery
- Set videos to "processing" indefinitely, locking out legitimate status updates

**Exploitation Scenario:**

```
POST /api/v1/lectures/bunny-webhook
Content-Type: application/json

{"VideoGuid": "<known-or-guessed-video-id>", "Status": 5}
```

This would set the target lecture's video_status to "failed" with no authentication required.

**Remediation:**

Add HMAC signature validation matching the Bunny.net webhook signing mechanism. Verify the `X-Bunny-Webhook-Signature` header against the `BUNNY_WEBHOOK_SECRET` before processing. Return 401 on signature mismatch. Use constant-time comparison (`hmac.compare_digest`).

---

### SA-002 — Production Secrets Committed to Git History

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **OWASP** | A02: Cryptographic Failures |
| **Affected File(s)** | `envs/backend.env` (and `envs/frontend.env`) |
| **CVSS Estimate** | 9.1 |

**Description:**

The file `envs/backend.env` was committed to the repository before `.gitignore` rules were added (the file is currently modified and gitignored). The git history retains the full contents, which included:

- `JWT_SECRET_KEY` — used to sign all access and refresh tokens
- `DATABASE_URL` — full PostgreSQL connection string with credentials to the AWS RDS database
- `ZOOM_CREDENTIAL_ENCRYPTION_KEY` — symmetric key used to encrypt/decrypt Zoom OAuth secrets
- `BUNNY_API_KEY`, `BUNNY_TOKEN_KEY` — Bunny.net CDN credentials
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — S3 credentials (if populated)
- `RESEND_API_KEY` — email service credentials

The current git status shows `envs/backend.env` as modified (unstaged), confirming the file was previously tracked.

**Impact:**

Anyone with repository read access (or a leaked clone) can extract all production secrets from git history. With the JWT secret, an attacker can forge valid access tokens for any user (including admin). With database credentials, they can directly access or modify all data.

**Remediation:**

1. **Immediately rotate ALL secrets** listed above — JWT key, database password, Zoom encryption key, Bunny keys, AWS keys, Resend key
2. Rewrite git history to remove the committed env files (using `git filter-repo` or BFG Repo Cleaner), OR accept that the old values are compromised and ensure rotation is complete
3. Verify `.gitignore` covers all env files before any future commits
4. Audit GitHub access logs for unauthorized clones

---

### SA-003 — WebSocket Channels: No Authorization Checks

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **OWASP** | A01: Broken Access Control |
| **Affected File(s)** | `backend/app/websockets/manager.py:15-29`, `backend/app/websockets/routes.py:1-51` |
| **CVSS Estimate** | 7.5 |

**Description:**

The WebSocket connection manager (`manager.py:15-29`) validates the JWT token from query parameters to confirm the user is authenticated, but never checks whether the authenticated user has permission to subscribe to the requested channel:

```python
async def connect(self, websocket: WebSocket, channel: str) -> bool:
    token = websocket.query_params.get("token")
    # ... validates token is a valid JWT ...
    await websocket.accept()
    self._connections[channel].append(websocket)
    return True
```

The three WebSocket routes in `routes.py` pass URL path parameters directly as channel identifiers:

- `/ws/class-status/{batch_id}` — Any authenticated user can monitor class status for any batch
- `/ws/announcements/{user_id}` — Any authenticated user can receive announcements intended for any other user
- `/ws/session/{session_id}` — Any authenticated user can monitor any session's activity

**Impact:**

- **Privacy breach**: A student in Batch A can monitor class activity in Batch B (unauthorized batch)
- **Information disclosure**: Any user can subscribe to another user's announcement channel and receive their targeted notifications
- **Session surveillance**: An attacker can monitor when specific user sessions become active or inactive

**Remediation:**

After JWT validation in `manager.connect()`, extract the user ID and role from the token payload and verify:
- For `class-status:{batch_id}`: User must be enrolled in (student) or assigned to (teacher/CC) the batch
- For `announcements:{user_id}`: The `user_id` in the URL must match the authenticated user's ID
- For `session:{session_id}`: The session must belong to the authenticated user

---

## 5. High Findings

### SA-004 — JWT Tokens in localStorage (XSS Vector)

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **OWASP** | A07: Security Misconfiguration |
| **Affected File(s)** | `frontend/lib/auth-context.tsx:35-37` |

**Description:**

The frontend stores JWT access and refresh tokens in `localStorage`:

```typescript
localStorage.setItem('access_token', res.accessToken);
localStorage.setItem('refresh_token', res.refreshToken);
localStorage.setItem('user', JSON.stringify(res.user));
```

`localStorage` is accessible to any JavaScript running on the same origin. If an XSS vulnerability exists anywhere in the application (or in a third-party script), an attacker can steal both the access token and the long-lived refresh token (7-day validity).

**Impact:**

A single XSS vulnerability would allow complete account takeover. The 7-day refresh token means the attacker maintains access even after the 15-minute access token expires.

**Remediation:**

Migrate to `httpOnly` cookies for token storage. Set the refresh token as an `httpOnly`, `Secure`, `SameSite=Strict` cookie that is automatically sent on API requests. The access token can remain in memory (JavaScript variable) for the current session. This eliminates the ability for XSS to exfiltrate persistent credentials.

---

### SA-005 — No Next.js Middleware: Client-Side Route Protection Only

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **OWASP** | A01: Broken Access Control |
| **Affected File(s)** | No `frontend/middleware.ts` or `frontend/middleware.tsx` exists |

**Description:**

The frontend has no Next.js middleware file. All route protection is implemented client-side within individual page components using the `useAuth()` hook. This means:

- Protected page HTML/JS is served to unauthenticated users before the client-side check runs
- The browser downloads, parses, and briefly renders protected pages before redirecting
- Route protection depends entirely on JavaScript execution

**Impact:**

- Page source code and component logic for admin/course-creator pages are exposed to unauthenticated users
- Search engines may index protected pages
- Users with JavaScript disabled (or browser extensions that interfere) may see protected content
- Note: The backend API still enforces authentication, so no actual data is exposed — but UI logic, page structure, and admin workflows are visible

**Remediation:**

Create a `frontend/middleware.ts` that checks for the presence of a valid token (or auth cookie) and redirects unauthenticated users to `/login` before the page renders. Implement role-based path matching (e.g., `/admin/*` requires admin role, `/course-creator/*` requires course_creator role).

---

### SA-006 — Certificate Download: Missing Authorization

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **OWASP** | A01: Broken Access Control |
| **Affected File(s)** | `backend/app/routers/certificates.py:240-250` |

**Description:**

The `GET /{cert_uuid}/download` endpoint uses `AllRoles` (any authenticated user) with no ownership or role check:

```python
@router.get("/{cert_uuid}/download")
async def download_certificate(
    cert_uuid: uuid.UUID,
    current_user: AllRoles,
    ...
):
    url = await certificate_service.get_download_url(session, cert_uuid)
    ...
    return {"download_url": url}
```

In contrast, the adjacent `GET /{cert_uuid}` endpoint (line 222-237) correctly checks that students can only view their own certificates:

```python
if current_user.role.value == "student" and data["student_id"] != current_user.id:
    raise HTTPException(status_code=403, detail="Not authorized")
```

This authorization check is missing from the download endpoint.

**Impact:**

Any authenticated user (including students) can download any other student's certificate PDF by guessing or enumerating certificate UUIDs. Certificate PDFs contain the student's full name, course details, and verification codes.

**Remediation:**

Add the same ownership check from the `GET /{cert_uuid}` endpoint to the download endpoint. Students should only be able to download their own certificates; course creators and admins can download any.

---

### SA-007 — User Profile IDOR: Any User Can View Any Profile

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **OWASP** | A01: Broken Access Control |
| **Affected File(s)** | `backend/app/routers/users.py:207-217` |

**Description:**

The `GET /users/{user_id}` endpoint allows any authenticated user (`AllRoles`) to retrieve the full profile of any other user:

```python
@router.get("/{user_id}", response_model=UserOut)
async def get_user_endpoint(
    user_id: uuid.UUID,
    current_user: AllRoles,
    ...
):
    user = await get_user(session, user_id)
    ...
    data = await _enrich_user(session, user)
    return UserOut(**data)
```

The `UserOut` schema includes: email, phone, role, specialization, status, avatar_url, batch_ids, batch_names. No scoping is applied based on the requesting user's role.

**Impact:**

A student can retrieve the personal information (email, phone number) of any other student, teacher, course creator, or admin. This is an Insecure Direct Object Reference (IDOR) vulnerability exposing PII.

**Remediation:**

Implement role-based scoping:
- Students: Can only view their own profile via `/users/me`; block access to other user IDs
- Teachers: Can view students in their assigned batches only
- Course creators: Can view users in their batches
- Admins: Full access

---

### SA-008 — No CSRF Protection

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **OWASP** | A01: Broken Access Control |
| **Affected File(s)** | System-wide (backend + frontend) |

**Description:**

The application uses Bearer token authentication via the `Authorization` header. While Bearer tokens are not automatically sent by browsers (unlike cookies), the tokens are stored in `localStorage` (SA-004). If the application is ever migrated to cookie-based authentication (as recommended in SA-004), CSRF protection becomes mandatory.

Additionally, the current architecture has no CSRF token mechanism, making it vulnerable if any part of the system relies on cookie-based session identification (e.g., if a reverse proxy or CDN adds session cookies).

**Impact:**

Currently mitigated by Bearer token usage. However, if cookie-based auth is adopted without simultaneous CSRF implementation, all state-changing endpoints become vulnerable to cross-site request forgery.

**Remediation:**

Implement CSRF protection proactively:
- Use `SameSite=Strict` or `SameSite=Lax` on any authentication cookies
- Add a CSRF token mechanism (double-submit cookie or synchronizer token pattern)
- Validate the `Origin` or `Referer` header on state-changing requests

---

### SA-009 — Course Creator Can View All User Profiles

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **OWASP** | A01: Broken Access Control |
| **Affected File(s)** | `backend/app/routers/users.py:207-217` |

**Description:**

Related to SA-007, the `GET /users/{user_id}` endpoint is available to all roles including course creators. While course creators legitimately need to view students in their batches, the endpoint provides unscoped access to ALL user profiles — including other course creators, teachers, and admin accounts.

The `GET /users` list endpoint (line 104) is correctly restricted to `AdminOrCC`, but it returns all users without scoping to the course creator's own batches either.

**Impact:**

A course creator can enumerate and view profiles of users outside their organizational scope, including admin email addresses and other course creators' contact information. In a multi-tenant or multi-department setup, this violates the principle of least privilege.

**Remediation:**

Scope the user list and user detail endpoints for course creators to only return users in batches they created. Admin retains full access.

---

### SA-010 — Temporary Passwords Returned in API Response

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **OWASP** | A04: Insecure Design |
| **Affected File(s)** | `backend/app/routers/users.py:198-204, 270-275` |

**Description:**

When creating a user or resetting a password, the plaintext temporary password is returned in the API response body:

User creation (line 198-204):
```python
return {
    "id": user.id,
    "name": user.name,
    "email": user.email,
    "role": user.role.value,
    "temporary_password": password,
}
```

Password reset (line 270-275):
```python
temp_password = secrets.token_urlsafe(8)
user.hashed_password = hash_password(temp_password)
...
return {"temporary_password": temp_password}
```

**Impact:**

- Temporary passwords appear in browser network logs, API client history, and any HTTP logging/monitoring tools
- If API responses are logged (which is common), plaintext passwords are stored in log files
- The `RequestLoggingMiddleware` (referenced in `main.py:54`) may log response bodies containing these passwords
- Passwords transmitted over HTTPS are safe in transit but vulnerable at rest in logs and browser history

**Remediation:**

Instead of returning passwords in API responses:
1. Send temporary passwords via email using the Resend integration
2. Or implement a password-set flow where the admin generates a one-time link (JWT-based) that the user clicks to set their own password
3. If the current flow must be preserved short-term, ensure the logging middleware explicitly excludes response bodies from password-related endpoints

---

## 6. Medium Findings

### SA-011 — CORS `allow_headers=["*"]`

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **OWASP** | A07: Security Misconfiguration |
| **Affected File(s)** | `backend/main.py:65` |

**Description:**

The CORS configuration allows all request headers:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,         # Restricted to specific origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],           # <-- All headers allowed
)
```

While `allow_origins` is correctly restricted, `allow_headers=["*"]` combined with `allow_credentials=True` can be problematic. Some browsers and security scanners flag this combination. It also means any custom header sent by a malicious page (within the allowed origins) will be accepted.

**Impact:**

Expands the attack surface for credential-bearing cross-origin requests. In combination with a misconfigured origin (e.g., if a wildcard is accidentally added to `ALLOWED_ORIGINS`), this could enable unauthorized cross-origin access.

**Remediation:**

Replace `allow_headers=["*"]` with an explicit list: `["Authorization", "Content-Type", "Accept", "X-Requested-With"]`.

---

### SA-012 — No HTTP Security Headers

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **OWASP** | A05: Security Misconfiguration |
| **Affected File(s)** | `backend/main.py` |

**Description:**

The backend does not set any HTTP security response headers. The following headers are missing:

- `Strict-Transport-Security` (HSTS) — not enforcing HTTPS
- `X-Content-Type-Options: nosniff` — allows MIME sniffing
- `X-Frame-Options: DENY` — allows clickjacking
- `Content-Security-Policy` — no CSP policy
- `X-XSS-Protection` — no legacy XSS filter
- `Referrer-Policy` — no referrer control
- `Permissions-Policy` — no feature policy

While nginx may add some of these, the application itself should set them to ensure protection regardless of reverse proxy configuration.

**Impact:**

Without HSTS, users connecting over HTTP are vulnerable to downgrade attacks and man-in-the-middle. Without X-Frame-Options, the application can be framed in an iframe for clickjacking attacks. Without CSP, XSS attacks have no secondary mitigation.

**Remediation:**

Add a middleware that sets security headers on all responses:
```python
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response
```

---

### SA-013 — Certificate Verification: No Rate Limiting

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **OWASP** | A07: Security Misconfiguration |
| **Affected File(s)** | `backend/app/routers/certificates.py:187-196` |

**Description:**

The `GET /verify/{code}` endpoint is a public endpoint (no authentication required) with no rate limiting:

```python
@router.get("/verify/{code}", response_model=CertificateVerifyOut)
async def verify_certificate(
    code: str,
    session: AsyncSession = Depends(get_session),
):
```

This endpoint returns certificate details (student name, course, batch, dates) when given a valid verification code.

**Impact:**

An attacker can brute-force verification codes to enumerate all issued certificates and extract student names, course names, and completion dates. Depending on the code format, this may be feasible with automated tools. Additionally, without rate limiting, this endpoint can be used for denial-of-service against the database.

**Remediation:**

Apply rate limiting (e.g., `@limiter.limit("10/minute")`) and consider adding a CAPTCHA or proof-of-work challenge for public verification. Ensure verification codes are long enough (16+ characters) to resist brute-force enumeration.

---

### SA-014 — Weak Password Policy (8 chars, no complexity)

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **OWASP** | A07: Security Misconfiguration |
| **Affected File(s)** | `backend/app/routers/auth.py:125-126` |

**Description:**

The password change endpoint enforces only a minimum length of 8 characters:

```python
if len(body.new_password) < 8:
    raise HTTPException(status_code=422, detail="New password must be at least 8 characters")
```

No complexity requirements exist — no uppercase, lowercase, digit, or special character requirements. Auto-generated temporary passwords (`secrets.token_urlsafe(8)`) are strong, but user-chosen passwords can be trivially weak (e.g., "password", "12345678").

**Impact:**

Users can set weak passwords that are vulnerable to dictionary attacks and credential stuffing. While rate limiting (5/min on login) provides some protection, an attacker with a small wordlist of common 8-character passwords could compromise accounts over time.

**Remediation:**

Enforce password complexity: minimum 12 characters, require at least one uppercase letter, one lowercase letter, one digit, and one special character. Consider checking against a list of known breached passwords (e.g., HaveIBeenPwned API or a local top-10000 list).

---

### SA-015 — S3 Presigned URL File Name Injection

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **OWASP** | A03: Injection |
| **Affected File(s)** | `backend/app/utils/s3.py:35, 56` |

**Description:**

User-supplied file names are used directly in S3 object keys and download headers without sanitization:

Upload (line 35):
```python
object_key = f"materials/{batch_id}/{uuid.uuid4()}_{file_name}"
```

Download (line 56):
```python
"ResponseContentDisposition": f'attachment; filename="{file_name}"'
```

The `file_name` comes from user input. While the UUID prefix prevents key collisions, the file name is still embedded in the S3 key and in the `Content-Disposition` header.

**Impact:**

- **Path traversal in S3 key**: A file name like `../../../admin/evil.exe` would create an S3 key outside the intended prefix (though UUID prefix partially mitigates this)
- **Header injection**: A file name containing `"` or newline characters could break the `Content-Disposition` header, potentially enabling HTTP response splitting
- **File name spoofing**: A file name like `grades.pdf\x00.exe` could confuse download handlers

**Remediation:**

Sanitize `file_name` before use:
1. Strip or replace path separators (`/`, `\`, `..`)
2. Remove or escape special characters (`"`, `\n`, `\r`, `\x00`)
3. Use `urllib.parse.quote()` for the Content-Disposition filename
4. Consider using only the UUID as the S3 key and storing the original filename separately in the database

---

### SA-016 — Material Download: No Enrollment Check

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **OWASP** | A01: Broken Access Control |
| **Affected File(s)** | `backend/app/routers/materials.py:89-107` |

**Description:**

The `GET /{material_id}/download-url` endpoint uses `AllRoles` (any authenticated user) with no check that the user is enrolled in or associated with the material's batch:

```python
@router.get("/{material_id}/download-url", response_model=MaterialDownloadUrlResponse)
async def get_download_url(
    material_id: uuid.UUID,
    current_user: AllRoles,
    ...
):
    material = await material_service.get_material(session, material_id)
    ...
    url = generate_download_url(material.file_path, material.file_name)
    return MaterialDownloadUrlResponse(download_url=url, file_name=material.file_name)
```

Compare with the lecture signed URL endpoint (`lectures.py:271-293`), which correctly verifies enrollment.

**Impact:**

Any authenticated user can download course materials from any batch by providing the material UUID. Students from one batch can access materials from another batch. Proprietary course content is not properly access-controlled.

**Remediation:**

Add enrollment/ownership verification:
- Students: Must be enrolled in the material's batch
- Teachers: Must be assigned to the batch
- Course creators: Must own the batch
- Admins: Full access

---

### SA-017 — Batch/Course Information: Broad Read Access

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **OWASP** | A01: Broken Access Control |
| **Affected File(s)** | `backend/app/routers/batches.py:22-40, 58-67, 97-103` |

**Description:**

Several batch endpoints use `AllRoles` (any authenticated user):

- `GET /batches` (line 22-40) — list all batches
- `GET /batches/{batch_id}` (line 58-67) — view any batch details
- `GET /batches/{batch_id}/students` (line 97-103) — list students in any batch

While the list endpoint passes `current_user` to the service layer (which may apply scoping), the detail and students list endpoints have no role-based filtering.

**Impact:**

A student can view the full student roster of any batch (names, IDs), even batches they're not enrolled in. This leaks PII and organizational structure to unauthorized users.

**Remediation:**

Restrict batch detail and student list access:
- Students: Only their enrolled batches
- Teachers: Only their assigned batches
- Course creators: Only their created batches
- Admins: Full access

---

### SA-018 — Deployment Uses `git reset --hard`

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **OWASP** | A08: Software and Data Integrity |
| **Affected File(s)** | `.github/workflows/deploy-backend.yml:94` |

**Description:**

The deployment script uses destructive git operations:

```bash
git fetch origin main
git reset --hard origin/main
git clean -fd backend/migrations/versions/
```

`git reset --hard` discards any uncommitted changes on the server, and `git clean -fd` deletes untracked files in the migrations directory.

**Impact:**

- Any manual hotfixes or debugging changes made directly on the server are silently destroyed
- If a migration file was created on the server (e.g., during emergency maintenance), it is permanently deleted
- No backup or confirmation step exists before destroying local state
- An attacker who compromises the GitHub Actions pipeline could deploy arbitrary code

**Remediation:**

1. Add a pre-deployment backup step that stashes or archives local changes before reset
2. Consider using a proper deployment tool (e.g., AWS CodeDeploy, Ansible) that supports rollback
3. Add a deployment approval gate in GitHub Actions for production deployments
4. Log the git diff before reset to capture what's being overwritten

---

### SA-019 — Recording Signed URL: No Enrollment Check

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **OWASP** | A01: Broken Access Control |
| **Affected File(s)** | `backend/app/routers/zoom.py:389-399` |

**Description:**

The `POST /recordings/{recording_id}/signed-url` endpoint uses `AllRoles` with no enrollment check:

```python
@router.post("/recordings/{recording_id}/signed-url", response_model=RecordingSignedUrlOut)
async def get_recording_signed_url(
    recording_id: uuid.UUID,
    current_user: AllRoles,
    ...
):
    result = await zoom_service.get_recording_signed_url(session, recording_id)
    return RecordingSignedUrlOut(**result)
```

Any authenticated user can request a signed URL for any class recording, regardless of whether they are enrolled in the associated batch.

**Impact:**

Students can access class recordings from batches they are not enrolled in. Paid course content may be accessible to unauthorized users. This bypasses the enrollment-based access model applied to lecture videos.

**Remediation:**

Add an enrollment check similar to `lectures.py:284-293`. Look up the recording's associated `ZoomClass`, then verify the user is enrolled in (or assigned to) the class's batch.

---

## 7. Low Findings

### SA-020 — JWT HS256 Symmetric Algorithm

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **OWASP** | A02: Cryptographic Failures |
| **Affected File(s)** | `backend/app/config.py:12` |

**Description:**

The application uses HS256 (HMAC-SHA256) for JWT signing:

```python
JWT_ALGORITHM: str = "HS256"
```

HS256 uses a shared symmetric secret. If the secret is leaked (see SA-002), any party can sign valid tokens. Asymmetric algorithms (RS256, ES256) use a private/public key pair — the public key can verify tokens but cannot create them.

**Impact:**

In a single-server architecture, HS256 is acceptable. However, if the system scales to multiple services or introduces a separate auth server, the shared secret becomes a liability. Combined with SA-002 (secrets in git history), this amplifies the risk.

**Remediation:**

Consider migrating to RS256 or ES256 for JWT signing. This is lower priority for a single-service architecture but becomes important if the system scales. At minimum, ensure the HS256 secret is 256+ bits of cryptographic randomness.

---

### SA-021 — Lecture GET: No Enrollment Check for Metadata

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **OWASP** | A01: Broken Access Control |
| **Affected File(s)** | `backend/app/routers/lectures.py:184-193` |

**Description:**

The `GET /lectures/{lecture_id}` endpoint returns lecture metadata (title, description, duration, video type, sequence order) to any authenticated user without enrollment verification:

```python
@router.get("/{lecture_id}", response_model=LectureOut)
async def get_lecture(
    lecture_id: uuid.UUID,
    current_user: AllRoles,
    ...
):
```

Note: The list endpoint (`GET /lectures`, line 48-76) correctly checks enrollment for students. The signed URL endpoint (`POST /{lecture_id}/signed-url`, line 271-293) also checks enrollment. Only the individual GET is unprotected.

**Impact:**

Low severity because lecture metadata (title, description) is not highly sensitive, and actual video content requires enrollment verification. However, it does allow enumeration of course structure by unauthorized users.

**Remediation:**

Add enrollment verification consistent with the list endpoint. Students should only access metadata for lectures in their enrolled batches.

---

### SA-022 — Health Check Exposes Version Info

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **OWASP** | A05: Security Misconfiguration |
| **Affected File(s)** | `backend/main.py:87-100` |

**Description:**

The public health check endpoint returns the application version and database status:

```python
@app.get("/api/health")
async def health_check():
    ...
    return {"status": "ok", "version": "1.0.0", "database": "connected"}
```

On failure:
```python
return JSONResponse(
    status_code=503,
    content={"status": "degraded", "version": "1.0.0", "database": "unreachable"},
)
```

**Impact:**

Low risk. The version string could help an attacker identify specific vulnerable versions. The database status indicator reveals infrastructure details. An attacker can also determine whether the database is reachable, which could aid in timing attacks or targeted DoS.

**Remediation:**

Remove `version` and `database` fields from the public health check. Return only `{"status": "ok"}` or a 503 with `{"status": "degraded"}`. If detailed health information is needed, create a separate authenticated health endpoint for admin use.

---

### SA-023 — OpenAPI/Docs Publicly Exposed in Production

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **OWASP** | A05: Security Misconfiguration |
| **Affected File(s)** | `backend/main.py:43-47` |

**Description:**

The FastAPI application is created without disabling the automatic documentation endpoints:

```python
app = FastAPI(
    title="ICT Institute LMS API",
    version="1.0.0",
    lifespan=lifespan,
)
```

By default, FastAPI exposes:
- `/docs` — Swagger UI (interactive API explorer)
- `/redoc` — ReDoc documentation
- `/openapi.json` — Full OpenAPI schema

These are accessible without authentication at `https://apiict.zensbot.site/docs`.

**Impact:**

Attackers can browse the complete API surface (all 95+ endpoints, schemas, parameters, response types) without any authentication. This significantly accelerates reconnaissance. Schema details may reveal internal implementation patterns, enum values, and data relationships.

**Remediation:**

Disable documentation in production:
```python
app = FastAPI(
    ...
    docs_url=None if settings.APP_ENV == "production" else "/docs",
    redoc_url=None if settings.APP_ENV == "production" else "/redoc",
    openapi_url=None if settings.APP_ENV == "production" else "/openapi.json",
)
```

---

### SA-024 — WebSocket Token in Query Params

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **OWASP** | A04: Insecure Design |
| **Affected File(s)** | `backend/app/websockets/manager.py:17` |

**Description:**

WebSocket authentication passes the JWT token as a query parameter:

```python
token = websocket.query_params.get("token")
```

The WebSocket protocol does not support custom headers during the upgrade handshake, so query parameters are the standard approach. However, query parameters appear in server access logs, proxy logs, browser history, and Referrer headers.

**Impact:**

JWT access tokens may be logged in nginx access logs, load balancer logs, and CDN edge logs. If logs are compromised, the tokens (15-minute validity) could be reused. The short expiry and the fact that these are access tokens (not refresh tokens) limit the window.

**Remediation:**

This is a known limitation of WebSocket authentication. Mitigations:
1. Use a short-lived, single-use WebSocket ticket instead of the JWT directly — the client requests a ticket via the REST API, then uses it for the WebSocket connection
2. Ensure server/proxy logs exclude query parameters from WebSocket upgrade requests
3. Consider using the first message after connection as the auth mechanism (though this is less standard)

---

### SA-025 — Zoom Secret Partially Exposed to Admin

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **OWASP** | A01: Broken Access Control |
| **Affected File(s)** | `backend/app/routers/zoom.py:49` |

**Description:**

When listing Zoom accounts for admin users, the first 8 characters of the client secret are exposed:

```python
client_secret_masked=a.client_secret[:8] + "..." if a.client_secret else None,
```

Note: `a.client_secret` is stored encrypted (via `encryption.py`), so this is actually exposing the first 8 characters of the encrypted (ciphertext) string, not the plaintext secret. This reduces the severity.

**Impact:**

Low. The exposed characters are from the encrypted form, not the plaintext. However, exposing any portion of ciphertext provides information to an attacker attempting cryptanalysis, particularly if they can correlate it with known-plaintext attacks against the encryption algorithm.

**Remediation:**

Remove the `client_secret_masked` field entirely. Admins don't need to see any portion of the secret. If UI requires a visual indicator, return a boolean `has_secret: True/False` instead.

---

### SA-026 — No Request Body Size Limits

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **OWASP** | A05: Security Misconfiguration |
| **Affected File(s)** | `backend/main.py` |

**Description:**

The FastAPI application does not configure explicit request body size limits. Uvicorn's default limit is 1MB for most content types, but this can be exceeded for file uploads and multipart requests. The CSV bulk import endpoint (`users.py:302-350`) reads the entire file into memory:

```python
content = await file.read()
text = content.decode("utf-8-sig")
```

**Impact:**

An attacker could send oversized request bodies to consume server memory. The bulk import endpoint is limited to 500 rows but not file size — a malicious CSV with extremely long fields could exhaust memory. The t3.small instance (2GB RAM, 2 workers) is particularly vulnerable.

**Remediation:**

1. Configure Uvicorn's `--limit-max-body-size` parameter
2. Add `max_length` validation to Pydantic fields
3. For file uploads, check `file.size` before reading the full content
4. Consider streaming CSV parsing instead of reading the entire file into memory

---

### SA-027 — Verbose Error Messages Reveal Internals

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **OWASP** | A05: Security Misconfiguration |
| **Affected File(s)** | Multiple routers |

**Description:**

Several endpoints pass internal error messages directly to the HTTP response:

```python
# users.py:192-193
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))

# auth.py:68-69
except ValueError as e:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
```

The role guard in `middleware/auth.py:63` also reveals the required roles:
```python
detail=f"Role '{current_user.role.value}' not authorized. Required: {', '.join(roles)}"
```

**Impact:**

Error messages may reveal internal details:
- Role names and authorization requirements help attackers understand the access model
- Service-layer error messages may contain database column names, constraint names, or internal identifiers
- These details accelerate targeted attacks

**Remediation:**

In production, return generic error messages to clients (e.g., "Request failed" or "Unauthorized"). Log the detailed error server-side for debugging. Keep detailed messages in development/staging only. Replace the role guard message with a generic "Not authorized".

---

### SA-028 — No Account Lockout After Failed Logins

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **OWASP** | A07: Security Misconfiguration |
| **Affected File(s)** | `backend/app/services/auth_service.py:32-37` |

**Description:**

The authentication flow checks credentials but does not track failed login attempts:

```python
user = result.scalar_one_or_none()
if not user or not verify_password(password, user.hashed_password):
    raise ValueError("Invalid email or password")
```

Rate limiting (5/min per IP via slowapi) provides some protection, but there is no per-account lockout.

**Impact:**

An attacker can distribute login attempts across multiple IP addresses (using proxies or botnets) to bypass the IP-based rate limit. Without per-account tracking, the only defense is the 5/min/IP rate limit, which allows 300 attempts per hour from a single IP, and unlimited attempts from distributed sources.

**Remediation:**

Implement progressive account lockout:
1. Track failed login attempts per account (add `failed_login_count` and `locked_until` fields to the User model)
2. After 5 consecutive failures, lock the account for 15 minutes
3. After 10 failures, lock for 1 hour and notify the user via email
4. Provide an admin unlock mechanism
5. Reset the counter on successful login

---

### SA-029 — Session Cleanup Granularity (hourly)

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **OWASP** | A04: Insecure Design |
| **Affected File(s)** | `backend/main.py:28` |

**Description:**

Expired sessions are cleaned up by a scheduled job running every hour:

```python
scheduler.add_job(cleanup_expired_sessions, "interval", hours=1, id="cleanup_sessions")
```

This means an expired session can remain "active" in the database for up to 60 minutes after its expiration time.

**Impact:**

Low impact because session validation also checks the JWT expiry (which is enforced independently). However, the database retains stale session records, which could:
- Inflate the "active sessions" count shown to admins
- Consume unnecessary storage over time
- Delay the effect of admin-triggered "force logout" if the implementation relies solely on session records

**Remediation:**

Reduce the cleanup interval to 15 minutes (matching the access token lifetime). Also ensure that session validity checks compare `expires_at` against the current time, not just the `is_active` flag.

---

### SA-030 — User ID Exposed in Frontend URL Paths

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **OWASP** | A04: Insecure Design |
| **Affected File(s)** | Frontend route structure |

**Description:**

The WebSocket route structure uses user IDs directly in URLs:

```
/ws/announcements/{user_id}
```

Additionally, frontend routes may include user IDs, batch IDs, and other UUIDs in the URL path. While UUIDs are not sequential (preventing simple enumeration), they are still guessable if leaked through browser history, referrer headers, or shared links.

**Impact:**

Low. UUIDs provide 128 bits of randomness, making brute-force enumeration infeasible. However, if a user shares a URL containing their user ID, it becomes a permanent identifier that cannot be rotated. Combined with SA-007 (IDOR), a leaked UUID enables profile access.

**Remediation:**

For WebSocket routes, derive the user ID from the JWT token instead of requiring it in the URL. This ensures the channel subscription matches the authenticated user and eliminates SA-003 for the announcements channel. For frontend routes, UUIDs in paths are generally acceptable given their entropy.

---

## 8. Positive Security Controls

The following security measures are correctly implemented and should be maintained:

### 1. JWT Access/Refresh Token Separation
**File:** `backend/app/utils/security.py:20-42`

Access tokens expire in 15 minutes; refresh tokens in 7 days. This limits the window of opportunity for stolen access tokens while providing a good user experience.

### 2. bcrypt 12-Round Password Hashing
**File:** `backend/app/utils/security.py:12-13`

```python
return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")
```

12 rounds of bcrypt provides strong protection against offline brute-force attacks.

### 3. Device Limit Enforcement with Auto-Eviction
**File:** `backend/app/services/auth_service.py:141-170`

The system tracks active sessions and enforces a configurable device limit. When the limit is reached, the oldest session is automatically revoked. This prevents credential sharing and limits the blast radius of stolen credentials.

### 4. Rate Limiting on Auth Endpoints
**File:** `backend/app/utils/rate_limit.py`, `backend/app/routers/auth.py:54, 81`

Login is limited to 5 attempts per minute per IP. Token refresh is limited to 10 per minute. These limits are enforced via `slowapi` and provide defense against online brute-force attacks.

### 5. Zoom Webhook HMAC-SHA256 Validation
**File:** `backend/app/routers/zoom.py:404-431`

The Zoom webhook endpoint correctly validates the `x-zm-signature` header using HMAC-SHA256 with constant-time comparison (`hmac.compare_digest`). This prevents webhook forgery.

### 6. Refresh Token Stored as SHA-256 Hash
**File:** `backend/app/services/auth_service.py:17-19`

```python
def _hash_token(token_id: str) -> str:
    return sha256(token_id.encode()).hexdigest()
```

Refresh token identifiers are hashed before database storage. If the database is compromised, the attacker cannot reconstruct valid refresh tokens.

### 7. Soft-Delete Pattern on All Tables
**File:** All 20 model definitions

Every model uses `deleted_at` timestamps for soft-delete instead of hard-delete. This preserves audit trails, prevents accidental data loss, and supports data recovery.

### 8. TUS Direct Upload (No Server Memory Pressure)
**File:** `backend/app/utils/bunny.py`

Video uploads use the TUS protocol for direct browser-to-Bunny uploads. The server only creates the upload credentials — the actual file data never passes through the backend. This prevents memory exhaustion from large video files on the t3.small instance.

### 9. Password Change Triggers Logout-All
**File:** `backend/app/routers/auth.py:131-132`

```python
count = await logout_all(session, current_user.id)
```

When a user changes their password, all active sessions are terminated. This ensures that if an attacker has a stolen session, it is immediately revoked when the user changes their password.

### 10. Enrollment Checks on Video Signed URLs
**File:** `backend/app/routers/lectures.py:271-293`

The signed URL endpoint correctly verifies that the requesting student is enrolled in the lecture's batch via the `StudentBatch` table before issuing a playback URL. This protects paid video content.

---

## 9. Remediation Roadmap

### Immediate (0-48 hours) — Critical & Quick Wins

| Priority | Finding | Action | Effort |
|----------|---------|--------|--------|
| 1 | SA-002 | Rotate ALL production secrets (JWT, DB, Bunny, Zoom, AWS, Resend) | 2-4 hours |
| 2 | SA-001 | Add HMAC signature validation to Bunny webhook endpoint | 1-2 hours |
| 3 | SA-003 | Add channel-level authorization checks to WebSocket manager | 2-3 hours |
| 4 | SA-023 | Disable `/docs`, `/redoc`, `/openapi.json` in production | 15 minutes |

### Short-Term (1-2 weeks) — High & Medium Authorization Fixes

| Priority | Finding | Action | Effort |
|----------|---------|--------|--------|
| 5 | SA-006 | Add ownership check to certificate download endpoint | 30 minutes |
| 6 | SA-007/SA-009 | Scope user profile access by role | 2-3 hours |
| 7 | SA-016 | Add enrollment check to material download endpoint | 1-2 hours |
| 8 | SA-019 | Add enrollment check to recording signed URL endpoint | 1-2 hours |
| 9 | SA-012 | Add security headers middleware | 1 hour |
| 10 | SA-013 | Add rate limiting to certificate verification endpoint | 15 minutes |

### Medium-Term (2-4 weeks) — Architecture Improvements

| Priority | Finding | Action | Effort |
|----------|---------|--------|--------|
| 11 | SA-004 | Migrate token storage from localStorage to httpOnly cookies | 1-2 days |
| 12 | SA-005 | Implement Next.js middleware for server-side route protection | 1 day |
| 13 | SA-010 | Replace password-in-response with email-based delivery | 1 day |
| 14 | SA-014 | Strengthen password policy with complexity requirements | 2-3 hours |
| 15 | SA-015 | Sanitize file names in S3 utility | 1-2 hours |
| 16 | SA-011 | Restrict CORS `allow_headers` to explicit list | 15 minutes |
| 17 | SA-017 | Scope batch/course read access by role | 3-4 hours |

### Long-Term (1-3 months) — Defense in Depth

| Priority | Finding | Action | Effort |
|----------|---------|--------|--------|
| 18 | SA-020 | Evaluate migration from HS256 to RS256/ES256 | 1-2 days |
| 19 | SA-024 | Implement WebSocket ticket system (short-lived, single-use) | 1 day |
| 20 | SA-028 | Add per-account login lockout mechanism | 1 day |
| 21 | SA-018 | Improve deployment pipeline with rollback support | 2-3 days |
| 22 | SA-025 | Remove client secret masking, use boolean indicator | 15 minutes |
| 23 | SA-027 | Implement generic error responses for production | 2-3 hours |
| 24 | SA-008 | Implement CSRF protection (coordinate with SA-004 cookie migration) | 1 day |
| 25 | SA-026 | Configure request body size limits | 1-2 hours |
| 26 | SA-021 | Add enrollment check to lecture metadata endpoint | 30 minutes |
| 27 | SA-022 | Remove version/database info from public health check | 15 minutes |
| 28 | SA-029 | Reduce session cleanup interval to 15 minutes | 5 minutes |
| 29 | SA-030 | Derive user ID from JWT in WebSocket routes | 1-2 hours |

---

## 10. OWASP Top 10 Mapping

| OWASP Category | Findings | Count |
|----------------|----------|-------|
| **A01: Broken Access Control** | SA-003, SA-005, SA-006, SA-007, SA-008, SA-009, SA-016, SA-017, SA-019, SA-021, SA-025 | 11 |
| **A02: Cryptographic Failures** | SA-002, SA-020 | 2 |
| **A03: Injection** | SA-015 | 1 |
| **A04: Insecure Design** | SA-010, SA-024, SA-029, SA-030 | 4 |
| **A05: Security Misconfiguration** | SA-012, SA-022, SA-023, SA-026, SA-027 | 5 |
| **A06: Vulnerable Components** | (Not assessed — requires dependency scan) | 0 |
| **A07: Security Misconfiguration** | SA-001, SA-004, SA-011, SA-013, SA-014, SA-028 | 6 |
| **A08: Software and Data Integrity** | SA-018 | 1 |
| **A09: Security Logging & Monitoring** | (Logging middleware exists; detailed review not in scope) | 0 |
| **A10: Server-Side Request Forgery** | (No SSRF vectors identified) | 0 |

### Key Observation

**Broken Access Control (A01)** dominates with 11 findings (37% of all findings). This is the primary area requiring remediation. The system has strong authentication but inconsistent authorization — many endpoints verify "is the user logged in?" but not "should this user access this specific resource?"

---

## Footer

| Field | Value |
|-------|-------|
| **Report Version** | 1.0 |
| **Date** | 2026-03-09 |
| **Next Review** | After immediate remediation items are complete |
| **Distribution** | Project maintainers only |
| **Classification** | CONFIDENTIAL — Internal Use Only |

**Disclaimer:** This report is based on static code analysis only. No dynamic penetration testing was performed. Findings reflect the state of the codebase at the time of review. New vulnerabilities may be introduced by subsequent code changes. A follow-up audit should be conducted after remediation is complete.
