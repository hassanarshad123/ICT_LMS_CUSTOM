# ICT Institute LMS — API Specification

> Complete REST API documentation for the FastAPI backend.
> Base URL: `https://api.ictlms.com/api/v1`
> Auto-generated interactive docs: `https://api.ictlms.com/docs` (Swagger UI)

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Auth](#2-auth)
3. [Users](#3-users)
4. [Batches](#4-batches)
5. [Courses](#5-courses)
6. [Lectures](#6-lectures)
7. [Curriculum](#7-curriculum)
8. [Materials](#8-materials)
9. [Zoom](#9-zoom)
10. [Announcements](#10-announcements)
11. [Jobs](#11-jobs)
12. [Admin](#12-admin)
13. [WebSocket Endpoints](#13-websocket-endpoints)

---

## 1. Conventions

### Authentication

All endpoints except `/auth/login` and `/zoom/webhook` require:
```
Authorization: Bearer <access_token>
```

### Response Format

**Success:**
```json
{
  "id": "...",
  "name": "...",
  ...
}
```

**Success (list):**
```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "per_page": 20,
  "total_pages": 8
}
```

**Error:**
```json
{
  "detail": "Human-readable error message"
}
```

### Pagination

All list endpoints accept:
| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number (1-indexed) |
| `per_page` | 20 | Items per page (max 100) |
| `sort_by` | `created_at` | Column to sort by |
| `sort_order` | `desc` | `asc` or `desc` |

### Enum Transformation

The API transforms DB snake_case enums to frontend kebab-case:
| API Value | DB Value |
|-----------|----------|
| `course-creator` | `course_creator` |
| `full-time` | `full_time` |
| `part-time` | `part_time` |
| `in-progress` | `in_progress` |

All other enums are the same in both (e.g., `admin`, `student`, `active`, `completed`).

### Dates

All dates/times in ISO 8601 format: `2025-03-05T14:30:00Z`

### Soft Delete

No `DELETE` HTTP method removes data. "Delete" endpoints set `deleted_at` via `PATCH` or a dedicated soft-delete endpoint.

---

## 2. Auth

**Router prefix:** `/api/v1/auth`

### POST `/login`

Login with email and password. Returns access + refresh tokens. Enforces device limit.

| | |
|---|---|
| **Auth** | None |
| **Rate limit** | 10/minute per IP |

**Request:**
```json
{
  "email": "student@email.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-...",
    "name": "Muhammad Imran",
    "email": "student@email.com",
    "phone": "0300-1234567",
    "role": "student",
    "status": "active",
    "batch_ids": ["b3"],
    "batch_names": ["Batch 3 - August 2024"]
  }
}
```

**Errors:** `401` Invalid credentials | `403` Account inactive

---

### POST `/refresh`

Get a new access token using a valid refresh token.

| | |
|---|---|
| **Auth** | None (refresh token in body) |

**Request:**
```json
{
  "refresh_token": "f47ac10b-..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJ..."
}
```

---

### POST `/logout`

Invalidate the current session.

| | |
|---|---|
| **Auth** | Bearer token |

**Request:** No body needed. Optionally include `session_id` to target a specific session.

**Response (200):**
```json
{
  "detail": "Logged out successfully"
}
```

---

### POST `/logout-all`

Invalidate all sessions for the current user.

| | |
|---|---|
| **Auth** | Bearer token |

**Response (200):**
```json
{
  "detail": "All sessions terminated",
  "sessions_terminated": 2
}
```

---

### POST `/change-password`

Change the current user's password.

| | |
|---|---|
| **Auth** | Bearer token |

**Request:**
```json
{
  "current_password": "oldpass123",
  "new_password": "newpass456"
}
```

**Response (200):**
```json
{
  "detail": "Password changed successfully"
}
```

**Errors:** `400` Current password incorrect | `422` New password too short

---

## 3. Users

**Router prefix:** `/api/v1/users`

### GET `/`

List all users (paginated, filterable).

| | |
|---|---|
| **Auth** | Bearer token |
| **Roles** | Admin, Course Creator |

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `role` | string | Filter by role: `student`, `teacher`, `course-creator` |
| `status` | string | Filter: `active`, `inactive` |
| `batch_id` | uuid | Filter students by batch enrollment |
| `search` | string | Search name or email |
| `page`, `per_page` | int | Pagination |

**Response (200):** `PaginatedResponse[UnifiedUserResponse]`

Each user in `data[]`:
```json
{
  "id": "...",
  "name": "Muhammad Imran",
  "email": "imran@email.com",
  "phone": "0300-1234567",
  "role": "student",
  "status": "active",
  "batch_ids": ["b3", "b4"],
  "batch_names": ["Batch 3 - August 2024", "Batch 4 - October 2024"],
  "join_date": "2024-08-01T00:00:00Z",
  "specialization": null,
  "created_at": "2024-08-01T00:00:00Z"
}
```

---

### POST `/`

Create a new user. Admin or CC only. Generates a temporary password.

| | |
|---|---|
| **Auth** | Bearer token |
| **Roles** | Admin, Course Creator |

**Request:**
```json
{
  "name": "New Student",
  "email": "newstudent@email.com",
  "phone": "0300-9999999",
  "role": "student",
  "batch_id": "b3",
  "specialization": null
}
```

- `batch_id` required when `role=student` (auto-enrolls)
- `specialization` only for `role=teacher`
- CC cannot set `role=admin`

**Response (201):**
```json
{
  "id": "...",
  "name": "New Student",
  "email": "newstudent@email.com",
  "role": "student",
  "temporary_password": "xK9m2pL4"
}
```

---

### GET `/{user_id}`

Get user details.

| | |
|---|---|
| **Auth** | Bearer token |
| **Roles** | Admin, CC (any user), Teacher (own batch students), Student (self only) |

**Response (200):** `UnifiedUserResponse`

---

### PATCH `/{user_id}`

Update user profile.

| | |
|---|---|
| **Auth** | Bearer token |
| **Roles** | Admin, CC |

**Request:**
```json
{
  "name": "Updated Name",
  "phone": "0300-1111111",
  "specialization": "Data Science"
}
```

Cannot change: `role`, `email`, `status` (use dedicated endpoints).

---

### PATCH `/{user_id}/status`

Activate or deactivate a user.

| | |
|---|---|
| **Auth** | Bearer token |
| **Roles** | Admin, CC (non-admin targets only) |

**Request:**
```json
{
  "status": "inactive"
}
```

Deactivating a user: terminates all their active sessions immediately.

---

### POST `/{user_id}/reset-password`

Generate a new temporary password for a user.

| | |
|---|---|
| **Auth** | Bearer token |
| **Roles** | Admin only |

**Response (200):**
```json
{
  "temporary_password": "nP7kQ3mX"
}
```

---

### GET `/me`

Get current user's own profile.

| | |
|---|---|
| **Auth** | Bearer token |
| **Roles** | All |

**Response (200):** User profile with role-specific fields.

---

### PATCH `/me`

Update own profile (name, phone only).

| | |
|---|---|
| **Auth** | Bearer token |
| **Roles** | All |

**Request:**
```json
{
  "name": "My New Name",
  "phone": "0300-5555555"
}
```

---

### POST `/bulk-import`

Bulk import users from CSV file.

| | |
|---|---|
| **Auth** | Bearer token |
| **Roles** | Admin only |

**Request:** `multipart/form-data` with CSV file. CSV columns: `name,email,phone,role,batch_id,specialization`

**Response (200):**
```json
{
  "imported": 45,
  "skipped": 3,
  "errors": [
    {"row": 12, "error": "Email already exists: duplicate@email.com"}
  ]
}
```

---

## 4. Batches

**Router prefix:** `/api/v1/batches`

### GET `/`

List batches. Status is computed from dates.

| | |
|---|---|
| **Auth** | Bearer token |
| **Roles** | Admin, CC (all), Teacher (own), Student (enrolled) |

**Query params:** `status`, `teacher_id`, `search`, pagination

Each batch in response:
```json
{
  "id": "b1",
  "name": "Batch 1 - January 2024",
  "start_date": "2024-01-15",
  "end_date": "2024-04-15",
  "teacher_id": "t1",
  "teacher_name": "Ahmed Khan",
  "student_count": 28,
  "course_count": 2,
  "status": "completed"
}
```

---

### POST `/`

Create a new batch.

| | |
|---|---|
| **Roles** | Admin, CC |

**Request:**
```json
{
  "name": "Batch 5 - March 2025",
  "start_date": "2025-03-15",
  "end_date": "2025-06-15",
  "teacher_id": "t1"
}
```

`teacher_id` is optional (batch can exist without a teacher).

---

### GET `/{batch_id}`

Batch detail with computed status, student count, course count.

| | |
|---|---|
| **Roles** | Admin, CC, Teacher (own), Student (enrolled) |

---

### PATCH `/{batch_id}`

Update batch name, dates, teacher.

| | |
|---|---|
| **Roles** | Admin, CC |

---

### DELETE `/{batch_id}`

Soft delete. Cascades: removes student enrollments.

| | |
|---|---|
| **Roles** | Admin, CC |

---

### GET `/{batch_id}/students`

List students enrolled in this batch.

| | |
|---|---|
| **Roles** | Admin, CC, Teacher (own batch) |

---

### POST `/{batch_id}/students`

Enroll a student in this batch.

| | |
|---|---|
| **Roles** | Admin, CC |

**Request:**
```json
{
  "student_id": "s5"
}
```

---

### DELETE `/{batch_id}/students/{student_id}`

Remove student from batch (sets `removed_at`).

| | |
|---|---|
| **Roles** | Admin, CC |

---

### GET `/{batch_id}/courses`

List courses linked to this batch.

| | |
|---|---|
| **Roles** | All (scoped by role) |

---

### POST `/{batch_id}/courses`

Link a course to this batch.

| | |
|---|---|
| **Roles** | CC |

**Request:** `{ "course_id": "cr1" }`

---

### DELETE `/{batch_id}/courses/{course_id}`

Unlink a course from this batch.

| | |
|---|---|
| **Roles** | CC |

---

## 5. Courses

**Router prefix:** `/api/v1/courses`

### GET `/`

List courses. CC sees all, Teacher sees own-batch courses, Student sees enrolled-batch courses.

| | |
|---|---|
| **Roles** | All (scoped) |

**Query params:** `status`, `batch_id`, `search`, pagination

Each course:
```json
{
  "id": "cr1",
  "title": "Web Development Bootcamp",
  "description": "...",
  "status": "active",
  "batch_ids": ["b1", "b3"],
  "created_by": "cc1",
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### POST `/`

Create a course.

| | |
|---|---|
| **Roles** | CC |

**Request:**
```json
{
  "title": "New Course",
  "description": "Course description"
}
```

Status defaults to `upcoming`. Batch assignments done separately.

---

### GET `/{course_id}`

Course detail.

| | |
|---|---|
| **Roles** | All (scoped) |

---

### PATCH `/{course_id}`

Update course title, description, status.

| | |
|---|---|
| **Roles** | CC |

---

### DELETE `/{course_id}`

Soft delete course.

| | |
|---|---|
| **Roles** | CC |

---

### POST `/{course_id}/clone`

Clone a course and its curriculum modules. Does NOT clone lectures or materials (they are batch-scoped).

| | |
|---|---|
| **Roles** | CC |

**Response (201):**
```json
{
  "id": "cr4",
  "title": "Web Development Bootcamp (Copy)",
  "status": "upcoming",
  "cloned_from_id": "cr1"
}
```

---

## 6. Lectures

**Router prefix:** `/api/v1/lectures`

### GET `/`

List lectures. Requires `batch_id` filter.

| | |
|---|---|
| **Roles** | CC, Teacher (own batch), Student (enrolled batch) |

**Query params (required):** `batch_id`
**Query params (optional):** `course_id`, pagination

Each lecture:
```json
{
  "id": "l1",
  "title": "HTML & CSS Fundamentals",
  "description": "...",
  "video_type": "upload",
  "video_url": null,
  "bunny_video_id": "abc123",
  "duration": 2700,
  "duration_display": "45 min",
  "batch_id": "b1",
  "course_id": "cr1",
  "sequence_order": 1,
  "upload_date": "2024-01-16T00:00:00Z"
}
```

---

### POST `/`

Create a lecture (external URL type).

| | |
|---|---|
| **Roles** | CC |

**Request:**
```json
{
  "title": "Introduction to HTML",
  "description": "...",
  "video_type": "external",
  "video_url": "https://youtube.com/watch?v=...",
  "duration": 2700,
  "batch_id": "b1",
  "course_id": "cr1"
}
```

`sequence_order` auto-assigned as max + 1 for this batch+course.

---

### POST `/upload`

Upload a lecture video to Bunny.net.

| | |
|---|---|
| **Roles** | CC |

**Request:** `multipart/form-data` with video file + metadata fields.

**Response (201):**
```json
{
  "id": "l9",
  "title": "...",
  "video_type": "upload",
  "bunny_video_id": "xyz789",
  "bunny_library_id": "...",
  "status": "processing"
}
```

---

### GET `/{lecture_id}`

Lecture detail.

| | |
|---|---|
| **Roles** | CC, Student (enrolled) |

---

### PATCH `/{lecture_id}`

Update lecture title, description, order.

| | |
|---|---|
| **Roles** | CC |

---

### DELETE `/{lecture_id}`

Soft delete lecture.

| | |
|---|---|
| **Roles** | CC |

---

### POST `/{lecture_id}/reorder`

Update `sequence_order`.

| | |
|---|---|
| **Roles** | CC |

**Request:** `{ "sequence_order": 3 }`

---

### POST `/{lecture_id}/signed-url`

Generate a Bunny.net signed URL for video playback. Verifies student enrollment and batch grace period.

| | |
|---|---|
| **Roles** | Student (enrolled in lecture's batch) |

**Response (200):**
```json
{
  "url": "https://vz-xxx.b-cdn.net/abc123/playlist.m3u8?token=...&expires=...",
  "expires_at": "2025-03-05T14:40:00Z"
}
```

---

### POST `/{lecture_id}/progress`

UPSERT lecture progress (watch percentage and resume position).

| | |
|---|---|
| **Roles** | Student |

**Request:**
```json
{
  "watch_percentage": 75,
  "resume_position_seconds": 1350
}
```

Status auto-set: `>= 90%` → `completed`, `> 0%` → `in_progress`, `0%` → `unwatched`

---

### GET `/{lecture_id}/progress`

Get student's own progress for this lecture.

| | |
|---|---|
| **Roles** | Student |

---

## 7. Curriculum

**Router prefix:** `/api/v1/curriculum`

### GET `/`

List curriculum modules for a course.

| | |
|---|---|
| **Roles** | All (scoped) |

**Query params (required):** `course_id`

Each module:
```json
{
  "id": "c1",
  "course_id": "cr1",
  "title": "Introduction to Web Development",
  "description": "...",
  "topics": ["What is web development", "HTML basics", "CSS basics"],
  "sequence_order": 1
}
```

---

### POST `/`

Create a curriculum module.

| | |
|---|---|
| **Roles** | CC |

**Request:**
```json
{
  "course_id": "cr1",
  "title": "Module Title",
  "description": "Module description",
  "topics": ["Topic 1", "Topic 2", "Topic 3"]
}
```

---

### PATCH `/{module_id}`

Update module title, description, topics.

| | |
|---|---|
| **Roles** | CC |

---

### DELETE `/{module_id}`

Soft delete module.

| | |
|---|---|
| **Roles** | CC |

---

### POST `/{module_id}/reorder`

Update `sequence_order`.

| | |
|---|---|
| **Roles** | CC |

---

## 8. Materials

**Router prefix:** `/api/v1/materials`

### GET `/`

List batch materials. Requires `batch_id`.

| | |
|---|---|
| **Roles** | CC, Teacher (own batch), Student (enrolled batch) |

**Query params (required):** `batch_id`
**Query params (optional):** `course_id`

Each material:
```json
{
  "id": "m1",
  "batch_id": "b1",
  "course_id": "cr1",
  "title": "HTML Cheat Sheet",
  "description": "Quick reference for HTML tags",
  "file_name": "html-cheatsheet.pdf",
  "file_type": "pdf",
  "file_size": "2.4 MB",
  "file_size_bytes": 2516582,
  "upload_date": "2024-01-20T00:00:00Z",
  "uploaded_by": "Asad Mehmood",
  "uploaded_by_role": "course-creator"
}
```

---

### POST `/upload-url`

Get an S3 pre-signed URL for file upload.

| | |
|---|---|
| **Roles** | CC, Teacher (own batch) |

**Request:**
```json
{
  "file_name": "notes.pdf",
  "content_type": "application/pdf",
  "batch_id": "b1",
  "course_id": "cr1"
}
```

**Response (200):**
```json
{
  "upload_url": "https://ict-lms-materials.s3.ap-south-1.amazonaws.com/...",
  "object_key": "materials/b1/550e8400_notes.pdf"
}
```

---

### POST `/`

Register a material after S3 upload.

| | |
|---|---|
| **Roles** | CC, Teacher (own batch) |

**Request:**
```json
{
  "object_key": "materials/b1/550e8400_notes.pdf",
  "title": "Class Notes",
  "description": "Notes from week 1",
  "file_name": "notes.pdf",
  "file_type": "pdf",
  "file_size_bytes": 1048576,
  "batch_id": "b1",
  "course_id": "cr1"
}
```

---

### GET `/{material_id}/download-url`

Get an S3 pre-signed download URL.

| | |
|---|---|
| **Roles** | CC, Teacher, Student (enrolled batch) |

**Response (200):**
```json
{
  "download_url": "https://ict-lms-materials.s3.ap-south-1.amazonaws.com/...",
  "file_name": "notes.pdf"
}
```

---

### DELETE `/{material_id}`

Soft delete material. CC can delete any. Teacher can delete only own uploads.

| | |
|---|---|
| **Roles** | CC (any), Teacher (own uploads) |

---

## 9. Zoom

**Router prefix:** `/api/v1/zoom`

### Zoom Accounts

#### GET `/accounts`

List Zoom accounts.

| | |
|---|---|
| **Roles** | Admin (all fields), Teacher (name + id only — no secrets) |

Admin response includes all fields. Teacher response excludes `client_id`, `client_secret`, `account_id`.

---

#### POST `/accounts`

Create a Zoom account. `client_secret` is encrypted before storage.

| | |
|---|---|
| **Roles** | Admin |

**Request:**
```json
{
  "account_name": "ICT Main Account",
  "account_id": "abc123",
  "client_id": "xyz789",
  "client_secret": "secret_value",
  "is_default": true
}
```

---

#### PATCH `/accounts/{account_id}`

Update Zoom account.

| | |
|---|---|
| **Roles** | Admin |

---

#### DELETE `/accounts/{account_id}`

Soft delete Zoom account.

| | |
|---|---|
| **Roles** | Admin |

---

#### PATCH `/accounts/{account_id}/set-default`

Set as the default Zoom account.

| | |
|---|---|
| **Roles** | Admin |

---

### Zoom Classes

#### GET `/classes`

List Zoom classes (scoped by role).

| | |
|---|---|
| **Roles** | All (scoped) |

**Query params:** `batch_id`, `status`, `teacher_id`, pagination

Each class:
```json
{
  "id": "z1",
  "title": "HTML Basics - Live Session",
  "batch_id": "b3",
  "batch_name": "Batch 3 - August 2024",
  "teacher_id": "t1",
  "teacher_name": "Ahmed Khan",
  "zoom_meeting_url": "https://zoom.us/j/123456",
  "scheduled_date": "2025-03-10",
  "scheduled_time": "10:00",
  "duration": 90,
  "duration_display": "1.5 hours",
  "status": "upcoming",
  "zoom_account_id": "za1"
}
```

---

#### POST `/classes`

Schedule a Zoom class. Calls Zoom API to create the meeting.

| | |
|---|---|
| **Roles** | Teacher (own batches only) |

**Request:**
```json
{
  "title": "CSS Layout - Live Session",
  "batch_id": "b3",
  "zoom_account_id": "za1",
  "scheduled_date": "2025-03-15",
  "scheduled_time": "10:00",
  "duration": 90
}
```

**Response (201):** Includes `zoom_meeting_url` and `zoom_start_url` from Zoom API.

---

#### PATCH `/classes/{class_id}`

Update a scheduled class (before it goes live).

| | |
|---|---|
| **Roles** | Teacher (own), Admin |

---

#### DELETE `/classes/{class_id}`

Soft delete a class (cancels Zoom meeting if upcoming).

| | |
|---|---|
| **Roles** | Teacher (own), Admin |

---

#### GET `/classes/{class_id}/attendance`

Get attendance records for a completed class.

| | |
|---|---|
| **Roles** | Admin, CC, Teacher (own class) |

---

#### GET `/classes/{class_id}/recordings`

Get recordings for a completed class.

| | |
|---|---|
| **Roles** | All (Student: enrolled batch + status='ready' only) |

---

### Webhook

#### POST `/webhook`

Receives Zoom webhook events. No Bearer auth — validated via HMAC signature.

| | |
|---|---|
| **Auth** | HMAC-SHA256 signature verification |

Handles events: `meeting.started`, `meeting.ended`, `recording.completed`

---

## 10. Announcements

**Router prefix:** `/api/v1/announcements`

### GET `/`

List announcements visible to the current user.

| | |
|---|---|
| **Roles** | All (scoped by role and batch/course enrollment) |

**Query params:** `scope` (`institute`, `batch`, `course`), `batch_id`, `course_id`, pagination

Each announcement:
```json
{
  "id": "a1",
  "title": "Welcome to the new semester",
  "content": "...",
  "scope": "institute",
  "batch_id": null,
  "course_id": null,
  "posted_by": "cc1",
  "posted_by_name": "Asad Mehmood",
  "expires_at": "2025-04-01T00:00:00Z",
  "created_at": "2025-03-01T00:00:00Z"
}
```

---

### POST `/`

Create an announcement.

| | |
|---|---|
| **Roles** | Admin (institute), CC (batch/course), Teacher (own batch) |

**Request:**
```json
{
  "title": "Assignment Due",
  "content": "Submit by Friday",
  "scope": "batch",
  "batch_id": "b3",
  "expires_at": "2025-03-15T23:59:59Z"
}
```

Validation: `institute` scope requires `batch_id` and `course_id` to be null. `batch` scope requires `batch_id`. `course` scope requires `course_id`.

---

### PATCH `/{announcement_id}`

Update or soft-delete an announcement.

| | |
|---|---|
| **Roles** | Author (own), Admin (any) |

---

## 11. Jobs

**Router prefix:** `/api/v1/jobs`

### GET `/`

List job postings.

| | |
|---|---|
| **Roles** | CC, Student |

**Query params:** `type` (`full-time`, `part-time`, `internship`, `remote`), `search`, pagination

Each job:
```json
{
  "id": "j1",
  "title": "Junior Web Developer",
  "company": "TechCorp Pakistan",
  "location": "Lahore",
  "type": "full-time",
  "salary": "PKR 35,000 - 45,000",
  "description": "...",
  "requirements": ["HTML/CSS proficiency", "JavaScript basics"],
  "posted_date": "2024-09-01T00:00:00Z",
  "deadline": "2024-10-15T00:00:00Z",
  "posted_by": "cc1"
}
```

---

### POST `/`

Post a new job.

| | |
|---|---|
| **Roles** | CC |

---

### GET `/{job_id}`

Job detail.

| | |
|---|---|
| **Roles** | CC, Student |

---

### PATCH `/{job_id}`

Update job posting.

| | |
|---|---|
| **Roles** | CC |

---

### DELETE `/{job_id}`

Soft delete job.

| | |
|---|---|
| **Roles** | CC |

---

### POST `/{job_id}/apply`

Student applies to a job. Resubmit model: soft-deletes previous application if exists.

| | |
|---|---|
| **Roles** | Student |

**Request:**
```json
{
  "resume_key": "resumes/s1/resume.pdf",
  "cover_letter": "I am interested in this position..."
}
```

---

### GET `/{job_id}/applications`

List applications for a job.

| | |
|---|---|
| **Roles** | CC |

---

### PATCH `/{job_id}/applications/{app_id}/status`

Update application status.

| | |
|---|---|
| **Roles** | CC |

**Request:**
```json
{
  "status": "shortlisted"
}
```

Valid values: `applied`, `shortlisted`, `rejected`

---

### GET `/my-applications`

Get current student's own applications.

| | |
|---|---|
| **Roles** | Student |

---

## 12. Admin

**Router prefix:** `/api/v1/admin`

All endpoints require `Admin` role.

### GET `/dashboard`

Dashboard statistics for the admin home page.

**Response (200):**
```json
{
  "total_batches": 4,
  "active_batches": 2,
  "total_students": 10,
  "active_students": 8,
  "total_teachers": 3,
  "total_course_creators": 2,
  "total_courses": 3,
  "recent_batches": [...],
  "recent_students": [...]
}
```

---

### GET `/insights`

Analytics data for all Insights page charts.

**Response (200):**
```json
{
  "monthly": [
    {"month": "Jan 2024", "new_enrollments": 28, "active_sessions": 18, "device_issues": 0}
  ],
  "students_by_status": {"active": 8, "inactive": 2},
  "batches_by_status": {"active": 2, "completed": 1, "upcoming": 1},
  "enrollment_per_batch": [
    {"batch_id": "b1", "name": "Batch 1", "student_count": 28}
  ],
  "teacher_workload": [
    {"teacher_id": "t1", "name": "Ahmed Khan", "batch_count": 2, "student_count": 53}
  ],
  "materials_by_type": {"pdf": 4, "excel": 2, "word": 2},
  "lectures_per_course": [
    {"course_id": "cr1", "title": "Web Dev", "lecture_count": 5}
  ],
  "device_overview": {"at_limit": 3, "active": 7, "no_sessions": 5}
}
```

---

### GET `/devices`

All users with their active sessions (for Device Management page).

**Query params:** `role`, `search`, pagination

**Response (200):** `PaginatedResponse[UserDeviceSummaryResponse]`

Each summary:
```json
{
  "user_id": "s1",
  "user_name": "Muhammad Imran",
  "user_email": "imran@email.com",
  "user_role": "student",
  "active_sessions": [
    {
      "id": "ds1",
      "device_info": "Chrome on Windows 11",
      "ip_address": "192.168.1.100",
      "logged_in_at": "2024-09-20T08:30:00Z",
      "last_active_at": "2024-09-20T14:22:00Z"
    }
  ]
}
```

---

### DELETE `/devices/{session_id}`

Terminate a specific session.

---

### DELETE `/devices/user/{user_id}`

Terminate all sessions for a user.

---

### GET `/settings`

Get system settings.

**Response (200):**
```json
{
  "max_device_limit": "2",
  "post_batch_grace_period_days": "90"
}
```

---

### PATCH `/settings`

Update system settings.

**Request:**
```json
{
  "max_device_limit": "3"
}
```

---

### GET `/activity-log`

Paginated activity log.

**Query params:** `action`, `entity_type`, `user_id`, `date_from`, `date_to`, pagination

---

### GET `/export/{entity_type}`

Export data as CSV or PDF.

**Path params:** `entity_type` = `users` | `batches` | `students` | `courses`
**Query params:** `format` = `csv` | `pdf`, filters

**Response (200):**
```json
{
  "download_url": "https://ict-lms-exports.s3.../export_users_20250305.csv",
  "expires_at": "2025-03-05T15:30:00Z"
}
```

---

## 13. WebSocket Endpoints

WebSockets use a separate path (not under `/api/v1/`).

### Authentication

All WebSocket connections require JWT token as query parameter:
```
wss://api.ictlms.com/ws/class-status/b3?token=eyJ...
```

Token is validated on connect. Invalid/expired token closes the connection with code `4001`.

### WS `/ws/class-status/{batch_id}`

Pushes Zoom class status changes for a batch.

**Messages received by client:**
```json
{
  "type": "class_status_changed",
  "class_id": "z1",
  "status": "live",
  "zoom_meeting_url": "https://zoom.us/j/123456"
}
```

---

### WS `/ws/announcements/{user_id}`

Pushes new announcements relevant to the user.

**Messages received by client:**
```json
{
  "type": "new_announcement",
  "announcement": {
    "id": "a5",
    "title": "Class Cancelled",
    "scope": "batch",
    "created_at": "2025-03-05T10:00:00Z"
  }
}
```

---

### WS `/ws/session/{session_id}`

Pushes session termination notifications (when admin kills a session or device limit exceeded).

**Messages received by client:**
```json
{
  "type": "session_terminated",
  "reason": "admin_action"
}
```

On receiving this message, the frontend should clear tokens and redirect to login.
