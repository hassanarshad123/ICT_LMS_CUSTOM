# ICT Institute LMS — Database Schema

> **Single source of truth** for all database tables, relationships, security rules, and SQL.
> Backend: **Supabase** (PostgreSQL 15+). Read this entire document before writing any migration.

---

## Table of Contents

1. [Design Decisions](#1-design-decisions)
2. [Tables](#2-tables)
3. [Relationships Diagram](#3-relationships-diagram)
4. [Foreign Key References](#4-foreign-key-references)
5. [Row Level Security Policies](#5-row-level-security-policies)
6. [Enums](#6-enums)
7. [Database Views](#7-database-views)
8. [Indexes](#8-indexes)
9. [Supabase Storage Buckets](#9-supabase-storage-buckets)
10. [Edge Functions](#10-edge-functions)
11. [Frontend Integration Notes](#11-frontend-integration-notes)
12. [Full SQL](#12-full-sql)

---

## 1. Design Decisions

Read these before touching any table. Every schema choice traces back to one of these rules.

| # | Decision | Impact |
|---|----------|--------|
| 1 | **Soft delete everywhere** | Every table has `deleted_at timestamptz` (NULL = not deleted). Never use hard DELETE in application code. RLS policies never grant `FOR DELETE` — all "deletes" are UPDATEs that set `deleted_at`. Exceptions: `lecture_progress` and `zoom_attendance` have no `deleted_at` (see #28, #33). |
| 2 | **Timestamps on everything** | Every table has `created_at` + `updated_at` (auto-set via triggers). Some tables use semantic aliases (e.g. `assigned_at`, `logged_in_at`) as their creation timestamp. Exceptions: `zoom_attendance` has no `updated_at` (immutable, see #33). |
| 3 | **Batch status is auto-calculated** | Computed from `start_date` / `end_date` vs `now()`. NOT stored as a column. Use the `batches_with_status` view. |
| 4 | **Course status IS stored** | Stored as an enum column (`upcoming`, `active`, `completed`). Unlike batch status, course status is manually set by Course Creators. |
| 5 | **All Course Creators share ownership** | Any CC can manage any course, lecture, job, or batch. `created_by` is for audit only, NOT access control. |
| 6 | **Students can be enrolled in multiple batches simultaneously** | Via `student_batches` junction table. Each enrollment row has `enrolled_at` / `removed_at`. `removed_at IS NULL` means active. History is implicit in the junction table itself. |
| 7 | **Full batch history** | `student_batch_history` records every batch assignment/removal with timestamps and who made the change. |
| 8 | **Content is separated by batch context** | Student picks a batch context first, then sees that batch's courses, lectures, and materials. Each batch's content is independent. |
| 9 | **Lectures belong to one batch** | No sharing across batches. One lecture, one `batch_id`. Optional `course_id` can be set as a grouping tag for filtering lectures by course. |
| 10 | **Job applications use resubmit model** | One active application per student per job. Resubmitting soft-deletes the old and creates a new one (partial unique index on `student_id` + `job_id` where `deleted_at IS NULL`). |
| 11 | **Track application status changes** | `status_changed_at` + `status_changed_by` on `job_applications`. |
| 12 | **Configurable device limit** | Default 2 concurrent sessions. Admin changes via `system_settings` table. Enforced by Edge Function. |
| 13 | **Activity log** | Append-only audit trail in `activity_log`. No updates, no deletes. Admins can read. |
| 14 | **Zoom recordings stored separately** | Pipeline: Zoom cloud recording -> Bunny.net -> `class_recordings` table. Separate from lectures. |
| 15 | **Store file_size for lectures** | `bigint` in bytes for storage tracking. |
| 16 | **Lecture ordering** | Upload order is default. CCs can reorder via `sequence_order`. Unique within a batch (partial unique index). |
| 17 | **Curriculum modules can be reordered** | Via `sequence_order` column. Unique within a course (partial unique index). |
| 18 | **Batches can exist without a teacher** | `teacher_id` is nullable. |
| 19 | **Deleted batch -> enrollment link removed** | `student_batches` rows are removed via `ON DELETE CASCADE` on `batch_id`. Students remain enrolled in their other batches. |
| 20 | **Deleted job -> keep applications** | Soft delete on job; applications preserved. `job_applications.job_id` uses `ON DELETE RESTRICT` to prevent accidental hard deletion of jobs that have applications. |
| 21 | **Topics stored as text[]** | On `curriculum_modules`, not a separate table. Simpler, sufficient for now. |
| 22 | **Specialization on users table** | No separate `teacher_profiles` table. `specialization` column is nullable, enforced NULL for non-teachers via CHECK constraint. |
| 23 | **Column-level security via triggers** | PostgreSQL RLS cannot restrict which columns a user updates. Critical column restrictions (e.g. preventing students from changing their own role) are enforced via BEFORE UPDATE triggers. |
| 24 | **Views use security_invoker** | All views use `WITH (security_invoker = true)` so they respect the caller's RLS policies, not the view owner's. |
| 25 | **Server timezone** | Database views use explicit timezone conversion (`AT TIME ZONE 'Asia/Karachi'`) for date comparisons to avoid dependence on server timezone settings. |
| 26 | **Materials are batch-level** | Batch materials are a flat list per batch (not linked to individual lectures). Both Course Creators and Teachers can upload materials. CCs can delete any material; Teachers can only upload. Optional `course_id` can be set as a grouping tag for filtering materials by course. |
| 27 | **Announcements: scope-based single table** | Single `announcements` table with `scope` enum (`institute`, `batch`, `course`) + nullable `batch_id`/`course_id`. A CHECK constraint enforces: `institute` scope requires both NULL; `batch` scope requires `batch_id` NOT NULL; `course` scope requires `course_id` NOT NULL. |
| 28 | **Lecture progress: latest-state only** | One row per student per lecture in `lecture_progress` (UPSERT pattern). Stores current watch percentage and resume position — no event sourcing, no history. Has `updated_at` trigger but NO `deleted_at` (progress is never deleted). |
| 29 | **Zoom accounts managed by Admin** | `zoom_accounts` table stores OAuth credentials. `client_secret` should be encrypted at rest using Vault or `pgcrypto`. Teachers SELECT accounts for scheduling dropdown; only Admin has full CRUD. |
| 30 | **Post-batch grace period (per-batch independent)** | Configurable via `system_settings` key `post_batch_grace_period_days` (default `'90'`). After a batch ends, students retain read-only access for this many days. Each batch's grace period is evaluated independently. Enforced in application logic / Edge Functions, not RLS. |
| 31 | **Course cloning via Edge Function** | `clone-course` Edge Function copies a course row + all `curriculum_modules`. Does NOT copy lectures or materials (those are batch-scoped). Clone gets `cloned_from_id` FK pointing to the original. |
| 32 | **CC manages all non-admin users** | Course Creators can create/edit/deactivate Students, Teachers, and other Course Creators. Only Admins can manage Admin accounts. RLS policies on `users` reflect this expanded scope (replaces old students-only CC policies). |
| 33 | **Zoom attendance is immutable** | `zoom_attendance` rows are INSERT-only (by `service_role`). No updates, no deletes. No `updated_at`, no `deleted_at`. Records are written by the `fetch-zoom-attendance` Edge Function after meetings end. |

---

## 2. Tables

### 2.1 `users`

Central identity table for all roles. Extends Supabase Auth — `id` matches `auth.users.id`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Must match `auth.users.id` |
| `email` | `text` | NOT NULL, UNIQUE | Used for login |
| `name` | `text` | NOT NULL | Full name |
| `phone` | `text` | | Optional |
| `role` | `user_role` | NOT NULL | Enum: `admin`, `course_creator`, `teacher`, `student` |
| `specialization` | `text` | | Only for teachers. CHECK enforces NULL for non-teachers. |
| `avatar_url` | `text` | | Profile picture URL (Supabase Storage) |
| `status` | `user_status` | NOT NULL, default `'active'` | Enum: `active`, `inactive` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Auto-updated by trigger |
| `deleted_at` | `timestamptz` | | NULL = not deleted |

**CHECK constraints**:
- `CHECK ((role = 'teacher') OR (specialization IS NULL))` — only teachers have a specialization

**Column-protection trigger** (`protect_user_columns`): When a user updates their own row, the trigger prevents changes to `role`, `status`, `email`, and `specialization`. These can only be changed by admins/CCs updating other users, or by `service_role` (Edge Functions). Additionally, the trigger prevents anyone from escalating a non-admin user to admin role via client API.

**Frontend mapping note**: The frontend uses a `UnifiedUser` TypeScript interface that maps directly to this single `users` table. The `getAllUsers()` helper merges the separate mock data arrays (students, teachers, courseCreators) into a unified list for the Users management pages. In production, this maps to a single query on the `users` table filtered by `role != 'admin'` and `deleted_at IS NULL`.

---

### 2.2 `batches`

Groups of students taught together over a date range. Status is NOT stored — computed from dates.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | e.g. "Batch 4 - Spring 2025" |
| `teacher_id` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Nullable — batch can exist without teacher |
| `start_date` | `date` | NOT NULL | |
| `end_date` | `date` | NOT NULL | Must be > `start_date` (CHECK) |
| `created_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Audit only |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**Computed status logic** (used in `batches_with_status` view):
- `upcoming` — `start_date > today`
- `active` — `start_date <= today AND end_date >= today`
- `completed` — `end_date < today`

Where `today` = `(now() AT TIME ZONE 'Asia/Karachi')::date`

---

### 2.3 `student_batches`

Junction table: many-to-many between students and batches. A student can be actively enrolled in multiple batches simultaneously.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `student_id` | `uuid` | NOT NULL, FK -> `users.id` ON DELETE CASCADE | |
| `batch_id` | `uuid` | NOT NULL, FK -> `batches.id` ON DELETE CASCADE | |
| `enrolled_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Who added them |
| `enrolled_at` | `timestamptz` | NOT NULL, default `now()` | Serves as `created_at` |
| `removed_at` | `timestamptz` | | NULL = active enrollment. Set to soft-remove. |
| `removed_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Who removed them |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Partial unique constraint**: `(student_id, batch_id) WHERE removed_at IS NULL` — a student can only have one active enrollment per batch. Re-enrollment after removal is allowed.

---

### 2.4 `student_batch_history`

Tracks every batch assignment and removal for students. Append-only — never update or delete rows.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `student_id` | `uuid` | NOT NULL, FK -> `users.id` ON DELETE CASCADE | |
| `batch_id` | `uuid` | FK -> `batches.id` ON DELETE SET NULL | The batch assigned to. NULL if batch was later deleted. |
| `action` | `batch_history_action` | NOT NULL | Enum: `assigned`, `removed` |
| `changed_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Admin or CC who made the change |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | When the change happened |

---

### 2.5 `courses`

Course content containers. Status is stored (not computed).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `title` | `text` | NOT NULL | |
| `description` | `text` | | |
| `status` | `course_status` | NOT NULL, default `'upcoming'` | Enum: `upcoming`, `active`, `completed` |
| `cloned_from_id` | `uuid` | FK -> `courses.id` ON DELETE SET NULL | NULL for original courses. Points to source course for clones. |
| `created_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Audit only — all CCs can manage all courses |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

---

### 2.6 `batch_courses`

Junction table: many-to-many between batches and courses.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `batch_id` | `uuid` | NOT NULL, FK -> `batches.id` ON DELETE CASCADE | |
| `course_id` | `uuid` | NOT NULL, FK -> `courses.id` ON DELETE CASCADE | |
| `assigned_at` | `timestamptz` | NOT NULL, default `now()` | When the batch was linked (serves as `created_at`) |
| `assigned_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Who assigned it |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | Soft-delete to unassign |

**Unique constraint**: `(batch_id, course_id) WHERE deleted_at IS NULL` — partial unique index, a batch can only be actively assigned to a course once. Re-assignment after soft-delete is allowed.

---

### 2.7 `lectures`

Video lessons within a batch. Supports both direct uploads (Bunny.net) and external links.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `batch_id` | `uuid` | NOT NULL, FK -> `batches.id` ON DELETE CASCADE | One lecture belongs to one batch |
| `course_id` | `uuid` | FK -> `courses.id` ON DELETE SET NULL | Optional grouping tag for filtering lectures by course |
| `title` | `text` | NOT NULL | |
| `description` | `text` | | |
| `duration` | `integer` | | Duration in seconds |
| `file_size` | `bigint` | | File size in bytes (for storage tracking) |
| `video_type` | `video_type` | NOT NULL | Enum: `upload`, `external` |
| `video_url` | `text` | | For external links (YouTube, Vimeo, Google Drive) |
| `bunny_video_id` | `text` | | Bunny.net video GUID (for uploads) |
| `bunny_library_id` | `text` | | Bunny.net library ID (for uploads) |
| `thumbnail_url` | `text` | | Auto-generated or custom thumbnail |
| `sequence_order` | `integer` | NOT NULL | Ordering within the batch. CCs can reorder. |
| `created_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Audit |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**CHECK constraint**: `CHECK ((video_type = 'upload' AND bunny_video_id IS NOT NULL) OR (video_type = 'external' AND video_url IS NOT NULL))` — ensures every lecture has valid video data matching its type.

**Unique constraint**: `(batch_id, sequence_order) WHERE deleted_at IS NULL` — no duplicate ordering within a batch.

---

### 2.8 `curriculum_modules`

Structured course outline. Each module contains a list of topics (stored as `text[]`).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `course_id` | `uuid` | NOT NULL, FK -> `courses.id` ON DELETE CASCADE | |
| `title` | `text` | NOT NULL | |
| `description` | `text` | | |
| `sequence_order` | `integer` | NOT NULL | Ordering within course. CCs can reorder. |
| `topics` | `text[]` | | Array of topic strings |
| `created_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Audit |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**Unique constraint**: `(course_id, sequence_order) WHERE deleted_at IS NULL` — no duplicate ordering within a course.

---

### 2.9 `batch_materials`

Downloadable documents attached to a batch. Both Course Creators and Teachers can upload.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `batch_id` | `uuid` | NOT NULL, FK -> `batches.id` ON DELETE CASCADE | One material belongs to one batch |
| `course_id` | `uuid` | FK -> `courses.id` ON DELETE SET NULL | Optional grouping tag for filtering materials by course |
| `title` | `text` | NOT NULL | Display title |
| `description` | `text` | | Optional description |
| `file_name` | `text` | NOT NULL | Original filename |
| `file_path` | `text` | NOT NULL | Supabase Storage path |
| `file_type` | `material_file_type` | NOT NULL | Enum: `pdf`, `excel`, `word`, `pptx`, `image`, `archive`, `other` |
| `file_size` | `bigint` | | File size in bytes |
| `mime_type` | `text` | | e.g. `application/pdf` |
| `uploaded_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | CC or Teacher who uploaded |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

---

### 2.10 `zoom_accounts`

Admin-configured Zoom OAuth accounts used for creating meetings.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | Display name, e.g. "ICT Main Account" |
| `account_id` | `text` | NOT NULL | Zoom Account ID |
| `client_id` | `text` | NOT NULL | Zoom OAuth Client ID |
| `client_secret` | `text` | NOT NULL | Zoom OAuth Client Secret. Encrypt at rest via Vault or pgcrypto. |
| `is_default` | `boolean` | NOT NULL, default `false` | One account should be marked as default for teacher convenience |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

> **Security note**: `client_secret` contains sensitive OAuth credentials. Use Supabase Vault (`vault.create_secret()`) or `pgcrypto` encryption. The RLS policies ensure only Admin can read/write this table; Teachers get SELECT for the scheduling dropdown but should only see `id`, `name`, and `is_default` via a frontend query that excludes secret columns.

---

### 2.11 `zoom_classes`

Scheduled Zoom meetings. Status is stored (updated by Zoom webhooks).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `batch_id` | `uuid` | NOT NULL, FK -> `batches.id` ON DELETE CASCADE | One class per batch |
| `teacher_id` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Teacher who scheduled it |
| `zoom_account_id` | `uuid` | FK -> `zoom_accounts.id` ON DELETE SET NULL | Which Zoom account was used to create the meeting |
| `title` | `text` | NOT NULL | |
| `zoom_meeting_id` | `text` | | From Zoom API response |
| `zoom_meeting_url` | `text` | | Join URL for students |
| `zoom_start_url` | `text` | | Host start URL for teacher |
| `scheduled_date` | `date` | NOT NULL | |
| `scheduled_time` | `time` | NOT NULL | Server timezone must match institute timezone (Asia/Karachi) |
| `duration` | `integer` | | Duration in minutes |
| `status` | `zoom_class_status` | NOT NULL, default `'upcoming'` | Enum: `upcoming`, `live`, `completed` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

> **Timezone note**: `scheduled_time` uses `time` without timezone. This is acceptable because the LMS serves a single institute in Pakistan (PKT/Asia/Karachi). If multi-timezone support is ever needed, replace `scheduled_date` + `scheduled_time` with a single `scheduled_at timestamptz` column.

---

### 2.12 `class_recordings`

Zoom recordings processed through Bunny.net. Separate from lectures.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `zoom_class_id` | `uuid` | NOT NULL, FK -> `zoom_classes.id` ON DELETE CASCADE | |
| `title` | `text` | NOT NULL | |
| `bunny_video_id` | `text` | | Bunny.net video GUID |
| `bunny_library_id` | `text` | | Bunny.net library ID |
| `duration` | `integer` | | Duration in seconds |
| `file_size` | `bigint` | | File size in bytes |
| `thumbnail_url` | `text` | | |
| `recording_date` | `date` | | Nullable: populated asynchronously by recording pipeline |
| `status` | `recording_status` | NOT NULL, default `'processing'` | Enum: `processing`, `ready`, `failed` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

---

### 2.13 `announcements`

Scope-based announcements visible to different audiences.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `title` | `text` | NOT NULL | |
| `body` | `text` | NOT NULL | Plain text (no rich text, no images) |
| `scope` | `announcement_scope` | NOT NULL | Enum: `institute`, `batch`, `course` |
| `batch_id` | `uuid` | FK -> `batches.id` ON DELETE CASCADE | Required when scope = `batch`. NULL otherwise. |
| `course_id` | `uuid` | FK -> `courses.id` ON DELETE CASCADE | Required when scope = `course`. NULL otherwise. |
| `expires_at` | `timestamptz` | | Optional. Auto-hide after this timestamp. |
| `posted_by` | `uuid` | NOT NULL, FK -> `users.id` ON DELETE SET NULL | Author |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**CHECK constraint** (scope consistency):
```sql
CHECK (
  (scope = 'institute' AND batch_id IS NULL AND course_id IS NULL) OR
  (scope = 'batch' AND batch_id IS NOT NULL AND course_id IS NULL) OR
  (scope = 'course' AND course_id IS NOT NULL AND batch_id IS NULL)
)
```

> **CASCADE note**: `ON DELETE CASCADE` on `batch_id` and `course_id` would only trigger on hard delete, which is forbidden by Decision #1. In practice, batches/courses are always soft-deleted, so announcements referencing them are preserved.

---

### 2.14 `lecture_progress`

Per-student per-lecture video watch tracking. Latest state only (UPSERT pattern).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `student_id` | `uuid` | NOT NULL, FK -> `users.id` ON DELETE CASCADE | |
| `lecture_id` | `uuid` | NOT NULL, FK -> `lectures.id` ON DELETE CASCADE | |
| `watch_percentage` | `integer` | NOT NULL, default `0` | 0–100. How much of the video has been watched. |
| `resume_position_seconds` | `integer` | NOT NULL, default `0` | Where the student last stopped watching |
| `status` | `lecture_watch_status` | NOT NULL, default `'unwatched'` | Enum: `unwatched`, `in_progress`, `completed` |
| `last_watched_at` | `timestamptz` | NOT NULL, default `now()` | Last time the student watched this lecture |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Auto-updated by trigger |

**UNIQUE constraint**: `(student_id, lecture_id)` — one row per student per lecture. Use UPSERT (`ON CONFLICT ... DO UPDATE`) to update progress.

> **No `deleted_at`**: Progress is never deleted. If a lecture is deleted (CASCADE), the progress rows are automatically removed. Decision #28.

---

### 2.15 `zoom_attendance`

Immutable attendance records populated by Edge Function after Zoom meetings end.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `zoom_class_id` | `uuid` | NOT NULL, FK -> `zoom_classes.id` ON DELETE CASCADE | |
| `student_id` | `uuid` | NOT NULL, FK -> `users.id` ON DELETE CASCADE | |
| `joined` | `boolean` | NOT NULL | Whether the student joined the meeting |
| `join_time` | `timestamptz` | | When the student joined (NULL if not joined) |
| `leave_time` | `timestamptz` | | When the student left (NULL if not joined) |
| `duration_seconds` | `integer` | | Total time spent in meeting |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**UNIQUE constraint**: `(zoom_class_id, student_id)` — one attendance record per student per class.

> **No `updated_at`, no `deleted_at`**: Attendance records are immutable. Inserted once by `service_role` via the `fetch-zoom-attendance` Edge Function. Decision #33.

---

### 2.16 `jobs`

Job postings created by Course Creators. Soft delete preserves applications.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `title` | `text` | NOT NULL | |
| `company` | `text` | NOT NULL | |
| `location` | `text` | | |
| `job_type` | `job_type` | NOT NULL | Enum: `full_time`, `part_time`, `internship`, `remote` |
| `salary` | `text` | | Free-form text (e.g. "PKR 35,000 - 45,000") |
| `description` | `text` | | |
| `requirements` | `text[]` | | Array of requirement strings |
| `deadline` | `date` | | Application deadline |
| `posted_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Audit — all CCs can manage all jobs |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

---

### 2.17 `job_applications`

Student applications to jobs. Resubmit model — one active application per student per job.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `job_id` | `uuid` | NOT NULL, FK -> `jobs.id` ON DELETE RESTRICT | RESTRICT prevents accidental hard-delete of jobs with applications (Decision #20) |
| `student_id` | `uuid` | NOT NULL, FK -> `users.id` ON DELETE CASCADE | |
| `resume_url` | `text` | | Supabase Storage path |
| `cover_text` | `text` | | Optional cover letter text |
| `status` | `application_status` | NOT NULL, default `'applied'` | Enum: `applied`, `shortlisted`, `rejected` |
| `status_changed_at` | `timestamptz` | | When status was last changed |
| `status_changed_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Who changed the status |
| `applied_at` | `timestamptz` | NOT NULL, default `now()` | When the student applied/resubmitted |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**Unique constraint**: `(student_id, job_id)` WHERE `deleted_at IS NULL` — one active application per student per job. Resubmit soft-deletes the old (sets `deleted_at`), then creates new.

**Column-protection trigger** (`protect_application_columns`): When a CC updates an application, the trigger prevents changes to `job_id`, `student_id`, `resume_url`, `cover_text`, `applied_at`, and `deleted_at`. CCs can only change `status`, `status_changed_at`, and `status_changed_by`.

---

### 2.18 `user_sessions`

Active login sessions for device limit enforcement.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | NOT NULL, FK -> `users.id` ON DELETE CASCADE | |
| `session_token` | `text` | NOT NULL | Maps to Supabase Auth session |
| `device_info` | `text` | | User agent or device description |
| `ip_address` | `text` | | |
| `logged_in_at` | `timestamptz` | NOT NULL, default `now()` | Serves as `created_at` for this table |
| `last_active_at` | `timestamptz` | NOT NULL, default `now()` | Updated on each request |
| `is_active` | `boolean` | NOT NULL, default `true` | Set to false when session is terminated. Serves as soft-delete for this table. |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**Column-protection trigger** (`protect_session_columns`): When a user updates their own session, only `is_active` can be changed (to `false`, for logout). All other columns are locked.

---

### 2.19 `system_settings`

Key-value store for system-wide configuration. Used for device limit, grace period, and future settings.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `setting_key` | `text` | NOT NULL, UNIQUE | Setting name, e.g. `'max_device_limit'`. Named `setting_key` to avoid SQL reserved word. |
| `value` | `text` | NOT NULL | Setting value, e.g. `'2'` |
| `description` | `text` | | Human-readable description |
| `updated_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Admin who last changed it |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**Seed data**:
```sql
INSERT INTO system_settings (setting_key, value, description) VALUES
  ('max_device_limit', '2', 'Maximum concurrent login sessions per user'),
  ('post_batch_grace_period_days', '90', 'Days after batch end date that students retain read-only access to content');
```

---

### 2.20 `activity_log`

Append-only audit trail. No updates, no deletes. Only admins can read.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Who performed the action. NULL for system actions. |
| `action` | `text` | NOT NULL | Action identifier (see list below) |
| `entity_type` | `text` | | e.g. `'user'`, `'batch'`, `'course'` |
| `entity_id` | `uuid` | | ID of the affected entity |
| `details` | `jsonb` | | Arbitrary context (old/new values, etc.) |
| `ip_address` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Action types**:

| Category | Actions |
|----------|---------|
| Users | `user.created`, `user.updated`, `user.deactivated`, `user.activated`, `user.deleted`, `user.password_reset`, `user.password_changed`, `user.login`, `user.logout`, `user.force_logout`, `user.bulk_imported` |
| Batches | `batch.created`, `batch.updated`, `batch.deleted`, `batch.student_added`, `batch.student_removed`, `batch.teacher_assigned` |
| Courses | `course.created`, `course.updated`, `course.deleted`, `course.batch_assigned`, `course.batch_removed`, `course.cloned` |
| Lectures | `lecture.created`, `lecture.deleted`, `lecture.reordered` |
| Curriculum | `curriculum.created`, `curriculum.deleted`, `curriculum.reordered` |
| Materials | `material.uploaded`, `material.deleted` |
| Zoom | `zoom.scheduled`, `zoom.started`, `zoom.ended` |
| Zoom Accounts | `zoom_account.created`, `zoom_account.updated`, `zoom_account.deleted` |
| Recordings | `recording.added` |
| Jobs | `job.created`, `job.deleted` |
| Applications | `application.submitted`, `application.resubmitted`, `application.status_changed` |
| Announcements | `announcement.created`, `announcement.deleted` |

---

## 3. Relationships Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          ICT LMS — Entity Relationships                      │
│                             20 tables, 41 FKs                                │
└──────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   users      │
                              │─────────────│
                              │ id (PK)      │
                              │ role         │
                              │ status       │
                              └──────┬───────┘
                                     │
         ┌───────────────────────────┼──────────────────────────────────────┐
         │                           │                                      │
         │ teacher_id               │ created_by / student_id              │
         ▼                           ▼                                      │
  ┌─────────────┐            ┌──────────────────┐                           │
  │   batches    │◄──────────│ student_batches   │◄── users (student)       │
  │─────────────│  batch_id  │──────────────────│  student_id               │
  │ id (PK)      │            │ student_id (FK)  │                           │
  │ teacher_id   │            │ batch_id (FK)    │                           │
  │ start_date   │            │ enrolled_by (FK) │                           │
  │ end_date     │            │ enrolled_at      │                           │
  │             │            │ removed_at       │                           │
  │             │            │ removed_by (FK)  │                           │
  │             │            └──────────────────┘                           │
  │             │                                                           │
  │             │            ┌──────────────┐       ┌─────────────┐         │
  │             │◄───────── │ batch_courses │──────►│   courses    │         │
  │             │  batch_id  │──────────────│course_│─────────────│         │
  │             │            │ id (PK)      │  id   │ id (PK)      │         │
  │             │            │ batch_id(FK) │       │ status       │         │
  │             │            │ course_id(FK)│       │ cloned_from  │─┐ self  │
  │             │            └──────────────┘       │  _id (FK)    │ │ ref   │
  │             │                                   └──────┬───────┘◄┘       │
  │             │                                          │                │
  │             │                                   ┌──────┴───────┐         │
  │             │                                   ▼              │         │
  │             │                     ┌────────────────┐           │         │
  │             │                     │curriculum_     │           │         │
  │             │                     │modules         │           │         │
  │             │                     │────────────────│           │         │
  │             │                     │ course_id      │           │         │
  │             │                     │ topics[]       │           │         │
  │             │                     │ seq_order      │           │         │
  │             │                     └────────────────┘           │         │
  │             │                                                  │         │
  │             │          ┌───────────┐                            │         │
  │             │─────────►│ lectures   │· · · · · · · · · · · · · │         │
  │             │ batch_id │───────────│  course_id (optional)      │         │
  │             │          │ batch_id   │  grouping tag ──►courses   │         │
  │             │          │ course_id? │                            │         │
  │             │          │ video_type │                            │         │
  │             │          │ seq_order  │                            │         │
  │             │          └─────┬─────┘                            │         │
  │             │                │                                  │         │
  │             │                │ lecture_id                        │         │
  │             │                ▼                                  │         │
  │             │          ┌──────────────────┐                     │         │
  │             │          │ lecture_progress   │◄── users (student) │         │
  │             │          │──────────────────│  student_id          │         │
  │             │          │ student_id (FK)  │                     │         │
  │             │          │ lecture_id (FK)  │                     │         │
  │             │          │ watch_percentage │                     │         │
  │             │          │ status           │                     │         │
  │             │          └──────────────────┘                     │         │
  │             │                                                   │         │
  │             │          ┌────────────────┐                        │         │
  │             │─────────►│ batch_materials │· · · · · · · · · · · ·│         │
  │             │ batch_id │────────────────│  course_id (optional)  │         │
  │             │          │ batch_id       │  grouping tag          │         │
  │             │          │ course_id?     │                        │         │
  │             │          │ file_type      │                        │         │
  │             │          └────────────────┘                        │         │
  │             │                                                   │         │
  │             │          ┌────────────────┐                        │         │
  │             │─────────►│ announcements   │· · · · · · · · · · · ·│         │
  │             │ batch_id │────────────────│  course_id (optional)  │         │
  │             │(nullable)│ scope          │  ──►courses             │         │
  │             │          │ batch_id?      │                        │         │
  │             │          │ course_id?     │                        │         │
  │             │          │ posted_by(FK)  │──► users               │         │
  │             │          └────────────────┘                        │         │
  │             │                                                   │         │
  ┌──────────────┐         ┌──────────────────┐                     │         │
  │ zoom_classes  │────────►│ class_recordings  │                     │         │
  │──────────────│zoom_    │──────────────────│                     │         │
  │ batch_id(FK) │class_id │ zoom_class_id(FK)│                     │         │
  │ teacher_id   │         │ bunny_video_id   │                     │         │
  │ zoom_account │         │ status           │                     │         │
  │  _id (FK)    │         └──────────────────┘                     │         │
  │ status       │                                                  │         │
  └──────┬───────┘         ┌──────────────────┐                     │         │
         │                 │ zoom_attendance   │◄── users (student)  │         │
         │ zoom_class_id   │──────────────────│  student_id          │         │
         └────────────────►│ zoom_class_id(FK)│                     │         │
                           │ student_id (FK)  │                     │         │
                           │ joined           │                     │         │
                           │ duration_seconds │                     │         │
                           └──────────────────┘                     │         │
                                                                    │         │
  ┌──────────────┐                                                  │         │
  │ zoom_accounts │◄── zoom_classes.zoom_account_id                 │         │
  │──────────────│                                                  │         │
  │ name         │                                                  │         │
  │ account_id   │                                                  │         │
  │ client_id    │                                                  │         │
  │ client_secret│                                                  │         │
  │ is_default   │                                                  │         │
  └──────────────┘                                                  │         │
                                                                    │         │
  ┌──────────────┐         ┌──────────────────┐                     │         │
  │    jobs       │────────►│ job_applications  │◄── users (student)  │         │
  │──────────────│ job_id  │──────────────────│  student_id          │         │
  │ posted_by    │(RESTRICT)│ job_id (FK)      │                     │         │
  │ job_type     │         │ student_id (FK)  │                     │         │
  │ requirements │         │ status           │                     │         │
  │ deadline     │         │ resume_url       │                     │         │
  └──────────────┘         │ cover_text       │                     │         │
                           └──────────────────┘                     │         │
                                                                    │         │
  ┌──────────────────────┐  ┌─────────────────┐  ┌──────────────────┐         │
  │ student_batch_history │  │  user_sessions   │  │  system_settings  │         │
  │──────────────────────│  │─────────────────│  │──────────────────│         │
  │ student_id (FK)      │  │ user_id (FK)    │  │ setting_key (UQ) │         │
  │ batch_id (FK)        │  │ session_token   │  │ value            │         │
  │ action               │  │ is_active       │  │ updated_by       │         │
  │ changed_by (FK)      │  │ last_active_at  │  └──────────────────┘         │
  └──────────────────────┘  └─────────────────┘                               │
                                                                              │
  ┌──────────────┐                                                            │
  │ activity_log  │ (append-only, references users and any entity)            │
  │──────────────│                                                            │
  │ user_id (FK) │                                                            │
  │ action       │                                                            │
  │ entity_type  │                                                            │
  │ entity_id    │                                                            │
  │ details      │                                                            │
  └──────────────┘                                                            │
```

---

## 4. Foreign Key References

Every FK in the system, with ON DELETE behavior.

| Source Table | Source Column | Target Table | Target Column | ON DELETE |
|-------------|-------------|-------------|--------------|-----------|
| `batches` | `teacher_id` | `users` | `id` | SET NULL |
| `batches` | `created_by` | `users` | `id` | SET NULL |
| `student_batches` | `student_id` | `users` | `id` | CASCADE |
| `student_batches` | `batch_id` | `batches` | `id` | CASCADE |
| `student_batches` | `enrolled_by` | `users` | `id` | SET NULL |
| `student_batches` | `removed_by` | `users` | `id` | SET NULL |
| `student_batch_history` | `student_id` | `users` | `id` | CASCADE |
| `student_batch_history` | `batch_id` | `batches` | `id` | SET NULL |
| `student_batch_history` | `changed_by` | `users` | `id` | SET NULL |
| `courses` | `cloned_from_id` | `courses` | `id` | SET NULL |
| `courses` | `created_by` | `users` | `id` | SET NULL |
| `batch_courses` | `batch_id` | `batches` | `id` | CASCADE |
| `batch_courses` | `course_id` | `courses` | `id` | CASCADE |
| `batch_courses` | `assigned_by` | `users` | `id` | SET NULL |
| `lectures` | `batch_id` | `batches` | `id` | CASCADE |
| `lectures` | `course_id` | `courses` | `id` | SET NULL |
| `lectures` | `created_by` | `users` | `id` | SET NULL |
| `curriculum_modules` | `course_id` | `courses` | `id` | CASCADE |
| `curriculum_modules` | `created_by` | `users` | `id` | SET NULL |
| `batch_materials` | `batch_id` | `batches` | `id` | CASCADE |
| `batch_materials` | `course_id` | `courses` | `id` | SET NULL |
| `batch_materials` | `uploaded_by` | `users` | `id` | SET NULL |
| `zoom_accounts` | *(none)* | *(none)* | *(none)* | *(no FKs)* |
| `zoom_classes` | `batch_id` | `batches` | `id` | CASCADE |
| `zoom_classes` | `teacher_id` | `users` | `id` | SET NULL |
| `zoom_classes` | `zoom_account_id` | `zoom_accounts` | `id` | SET NULL |
| `class_recordings` | `zoom_class_id` | `zoom_classes` | `id` | CASCADE |
| `announcements` | `batch_id` | `batches` | `id` | CASCADE |
| `announcements` | `course_id` | `courses` | `id` | CASCADE |
| `announcements` | `posted_by` | `users` | `id` | SET NULL |
| `lecture_progress` | `student_id` | `users` | `id` | CASCADE |
| `lecture_progress` | `lecture_id` | `lectures` | `id` | CASCADE |
| `zoom_attendance` | `zoom_class_id` | `zoom_classes` | `id` | CASCADE |
| `zoom_attendance` | `student_id` | `users` | `id` | CASCADE |
| `jobs` | `posted_by` | `users` | `id` | SET NULL |
| `job_applications` | `job_id` | `jobs` | `id` | **RESTRICT** |
| `job_applications` | `student_id` | `users` | `id` | CASCADE |
| `job_applications` | `status_changed_by` | `users` | `id` | SET NULL |
| `user_sessions` | `user_id` | `users` | `id` | CASCADE |
| `system_settings` | `updated_by` | `users` | `id` | SET NULL |
| `activity_log` | `user_id` | `users` | `id` | SET NULL |

> **Why RESTRICT on `job_applications.job_id`?** Decision #20 says "Deleted job -> keep applications." RESTRICT prevents accidental hard-deletion of a job that has applications. Jobs should always be soft-deleted (set `deleted_at`), which does not trigger ON DELETE rules.

---

## 5. Row Level Security Policies

All tables have RLS **enabled**. Policies are defined per role. The `service_role` key bypasses RLS (used only in Edge Functions).

**Important**: No `FOR DELETE` policies exist anywhere. All "deletes" are soft-deletes via `UPDATE` (setting `deleted_at`). This is enforced by also not granting `DELETE` permission to the `authenticated` role (see GRANT statements in SQL).

### Helper functions

```sql
-- Returns NULL if user is soft-deleted or inactive, blocking all access
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM public.users
  WHERE id = auth.uid() AND deleted_at IS NULL AND status = 'active'
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Returns array of batch IDs the current student is actively enrolled in.
-- Returns empty array for non-students or students with no active enrollments.
-- Empty array means the student sees zero batches/courses/zoom classes.
CREATE OR REPLACE FUNCTION auth_batch_ids()
RETURNS uuid[] AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT sb.batch_id FROM public.student_batches sb
      WHERE sb.student_id = auth.uid() AND sb.removed_at IS NULL
    ),
    '{}'::uuid[]
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
```

### 5.1 `users`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All users | Create non-admin users (teachers, CCs, students) | Any non-admin user + own profile |
| Course Creator | All users | Create non-admin users (teachers, CCs, students) | Any non-admin user (Decision #32) |
| Teacher | Own profile + students enrolled in own batches (via `student_batches`) | No | Own profile only (name, phone, avatar — enforced by trigger) |
| Student | Own profile only | No | Own profile only (name, phone, avatar — enforced by trigger) |

> **CC expanded permissions (Decision #32):** CC INSERT/UPDATE policies now cover `role IN ('student', 'teacher', 'course_creator')` instead of only `role = 'student'`. The `protect_user_columns` trigger still prevents escalation to admin.

> **Frontend Settings Page:** Each role has a Settings page (`/[role]/settings`) that lets users edit their own name, email, phone, and password. The column-protection trigger on the `users` table ensures only self-edits on safe columns (name, phone, avatar) are allowed. Email changes go through `auth.users` and password changes go through `supabase.auth.updateUser()`. The Admin Settings page also includes system-level session settings (device limit).

### 5.2 `batches`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | Yes | Yes (including soft-delete) |
| Course Creator | All | Yes | Yes (including soft-delete) |
| Teacher | Own batches only (`teacher_id = auth.uid()`) | No | No |
| Student | Own enrolled batches (`id = ANY(auth_batch_ids())`) | No | No |

### 5.3 `student_batches`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | Yes | Yes (including soft-removal via `removed_at`) |
| Course Creator | All | Yes | Yes (including soft-removal via `removed_at`) |
| Teacher | Enrollments for students in own batches | No | No |
| Student | Own enrollments only (`student_id = auth.uid()`) | No | No |

### 5.4 `student_batch_history`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | Yes | No |
| Course Creator | All | Yes | No |
| Teacher | Records for students in own batches | No | No |
| Student | Own records only | No | No |

### 5.5 `courses`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | Yes | Yes (any course, including soft-delete) |
| Teacher | Courses linked to own batches (via `batch_courses`) | No | No |
| Student | Courses linked to enrolled batches (via `batch_courses`) | No | No |

### 5.6 `batch_courses`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | Yes | Yes (soft-delete to unassign) |
| Teacher | Own batch links only | No | No |
| Student | Own enrolled batch links only | No | No |

### 5.7 `lectures`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | Yes | Yes (including soft-delete) |
| Teacher | Lectures in own batches (`batch_id` in batches where `teacher_id = auth.uid()`; RLS allows SELECT but UI does not render lecture/video content for teachers) | No | No |
| Student | Lectures in enrolled batches (`batch_id = ANY(auth_batch_ids())`) | No | No |

### 5.8 `curriculum_modules`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | Yes | Yes (including soft-delete) |
| Teacher | Modules in courses linked to own batches | No | No |
| Student | Modules in courses linked to enrolled batches | No | No |

### 5.9 `batch_materials`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | Yes | Yes (including soft-delete) |
| Teacher | Materials in own batches | Yes (own batches only) | Own uploads only (`uploaded_by = auth.uid()`) |
| Student | Materials in enrolled batches | No | No |

### 5.10 `zoom_accounts`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | Yes | Yes (including soft-delete) |
| Teacher | All (for scheduling dropdown — frontend should exclude secret columns) | No | No |
| Course Creator | No | No | No |
| Student | No | No | No |

### 5.11 `zoom_classes`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | No | No |
| Teacher | Own classes only (`teacher_id = auth.uid()`) | Yes (for own batches only) | Own classes only (must keep same batch) |
| Student | Classes for enrolled batches | No | No |

### 5.12 `class_recordings`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | No | No |
| Teacher | Recordings for own classes (RLS allows SELECT but UI does not surface recordings for teachers) | No | No |
| Student | Only `status = 'ready'` recordings for enrolled batches | No | No |

### 5.13 `announcements`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | Yes (scope must be `institute`) | Own announcements only (soft-delete via `deleted_at`) |
| Course Creator | All (institute + all batch/course scoped) | Yes (scope = `batch` or `course`) | Own announcements only (soft-delete) |
| Teacher | Institute-wide + own batch scoped | Yes (scope = `batch`, only own batches) | Own announcements only (soft-delete) |
| Student | Institute-wide + enrolled batches + enrolled batches' courses | No | No |

> **Admin can also soft-delete any announcement** via a separate UPDATE policy.

### 5.14 `lecture_progress`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | No | No |
| Teacher | No | No | No |
| Student | Own rows only (`student_id = auth.uid()`) | Yes (own rows, `student_id = auth.uid()`) | Own rows only (for UPSERT) |

> **UPSERT note**: Students need both INSERT and UPDATE policies because progress uses `ON CONFLICT (student_id, lecture_id) DO UPDATE`.

### 5.15 `zoom_attendance`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No (service_role only) | No |
| Course Creator | All | No | No |
| Teacher | Attendance for own classes (`zoom_class_id` in own classes) | No | No |
| Student | Own attendance only (`student_id = auth.uid()`) | No | No |

> **INSERT is service_role only**: No INSERT policy for `authenticated`. The `fetch-zoom-attendance` Edge Function uses `service_role` to bypass RLS and insert attendance records.

### 5.16 `jobs`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | Yes | Yes (any job, including soft-delete) |
| Teacher | No | No | No |
| Student | All (where `deleted_at IS NULL`) | No | No |

### 5.17 `job_applications`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | No | Status columns only (`status`, `status_changed_at`, `status_changed_by`) — enforced by trigger |
| Teacher | No | No | No |
| Student | Own applications only | Yes (create own) | Own applications only (soft-delete for resubmit) |

### 5.18 `user_sessions`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | Deactivate any (`is_active = false`) |
| All users | Own sessions only | Via Edge Function | Own sessions only (`is_active` only — enforced by trigger) |

### 5.19 `system_settings`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | Yes | Yes |
| All others | No | No | No |

### 5.20 `activity_log`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No (inserted by service_role) | No |
| All others | No | No | No |

---

## 6. Enums

```sql
CREATE TYPE user_role AS ENUM ('admin', 'course_creator', 'teacher', 'student');

CREATE TYPE user_status AS ENUM ('active', 'inactive');

CREATE TYPE course_status AS ENUM ('upcoming', 'active', 'completed');

CREATE TYPE zoom_class_status AS ENUM ('upcoming', 'live', 'completed');

CREATE TYPE recording_status AS ENUM ('processing', 'ready', 'failed');

CREATE TYPE job_type AS ENUM ('full_time', 'part_time', 'internship', 'remote');

CREATE TYPE application_status AS ENUM ('applied', 'shortlisted', 'rejected');

CREATE TYPE video_type AS ENUM ('upload', 'external');

CREATE TYPE batch_history_action AS ENUM ('assigned', 'removed');

CREATE TYPE material_file_type AS ENUM ('pdf', 'excel', 'word', 'pptx', 'image', 'archive', 'other');

CREATE TYPE announcement_scope AS ENUM ('institute', 'batch', 'course');

CREATE TYPE lecture_watch_status AS ENUM ('unwatched', 'in_progress', 'completed');
```

---

## 7. Database Views

All views use `WITH (security_invoker = true)` (PostgreSQL 15+) so they respect the calling user's RLS policies instead of the view owner's privileges.

### 7.1 `batches_with_status`

Adds computed status to batches. **Use this view instead of querying `batches` directly when you need status.**

```sql
CREATE OR REPLACE VIEW batches_with_status
WITH (security_invoker = true) AS
SELECT
  b.*,
  CASE
    WHEN b.start_date > (now() AT TIME ZONE 'Asia/Karachi')::date THEN 'upcoming'
    WHEN b.end_date < (now() AT TIME ZONE 'Asia/Karachi')::date THEN 'completed'
    ELSE 'active'
  END AS status
FROM batches b
WHERE b.deleted_at IS NULL;
```

### 7.2 `batches_with_counts`

Adds student count and course count to batches.

```sql
CREATE OR REPLACE VIEW batches_with_counts
WITH (security_invoker = true) AS
SELECT
  b.*,
  CASE
    WHEN b.start_date > (now() AT TIME ZONE 'Asia/Karachi')::date THEN 'upcoming'
    WHEN b.end_date < (now() AT TIME ZONE 'Asia/Karachi')::date THEN 'completed'
    ELSE 'active'
  END AS status,
  COALESCE(s.student_count, 0) AS student_count,
  COALESCE(c.course_count, 0) AS course_count
FROM batches b
LEFT JOIN (
  SELECT batch_id, COUNT(*) AS student_count
  FROM student_batches
  WHERE removed_at IS NULL
  GROUP BY batch_id
) s ON s.batch_id = b.id
LEFT JOIN (
  SELECT bc.batch_id, COUNT(*) AS course_count
  FROM batch_courses bc
  JOIN courses co ON co.id = bc.course_id AND co.deleted_at IS NULL
  WHERE bc.deleted_at IS NULL
  GROUP BY bc.batch_id
) c ON c.batch_id = b.id
WHERE b.deleted_at IS NULL;
```

> **Note**: Announcements visibility is handled via RLS policies, not views. No additional views are needed for announcements.

---

## 8. Indexes

All primary keys and unique constraints automatically create indexes. These are the additional indexes needed for performance.

| Table | Index | Columns | Reason |
|-------|-------|---------|--------|
| `users` | `idx_users_role` | `role` | Filter users by role (admin pages) |
| `users` | `idx_users_status` | `status` | Filter active/inactive users |
| `users` | `idx_users_deleted_at` | `deleted_at` | Soft-delete filter |
| `batches` | `idx_batches_teacher_id` | `teacher_id` | Find batches for a teacher |
| `batches` | `idx_batches_dates` | `start_date, end_date` | Status computation |
| `batches` | `idx_batches_deleted_at` | `deleted_at` | Soft-delete filter |
| `student_batches` | `idx_sb_student_id` | `student_id` | Enrollments for a student |
| `student_batches` | `idx_sb_batch_id` | `batch_id` | Students in a batch |
| `student_batches` | `idx_sb_removed_at` | `removed_at` | Filter active enrollments |
| `student_batch_history` | `idx_sbh_student_id` | `student_id` | Student's batch history |
| `student_batch_history` | `idx_sbh_batch_id` | `batch_id` | Batch history |
| `courses` | `idx_courses_status` | `status` | Filter by course status |
| `courses` | `idx_courses_cloned_from` | `cloned_from_id` | Find clones of a course |
| `courses` | `idx_courses_deleted_at` | `deleted_at` | Soft-delete filter |
| `batch_courses` | `idx_bc_batch_id` | `batch_id` | Courses for a batch |
| `batch_courses` | `idx_bc_course_id` | `course_id` | Batches for a course |
| `batch_courses` | `idx_bc_deleted_at` | `deleted_at` | Soft-delete filter |
| `lectures` | `idx_lectures_sequence` | `batch_id, sequence_order` | Ordered lecture list (also covers batch_id-only queries) |
| `lectures` | `idx_lectures_course_id` | `course_id` | Filter lectures by optional course grouping tag |
| `lectures` | `idx_lectures_deleted_at` | `deleted_at` | Soft-delete filter |
| `curriculum_modules` | `idx_cm_sequence` | `course_id, sequence_order` | Ordered module list (also covers course_id-only queries) |
| `curriculum_modules` | `idx_cm_deleted_at` | `deleted_at` | Soft-delete filter |
| `batch_materials` | `idx_materials_batch_id` | `batch_id` | Materials for a batch |
| `batch_materials` | `idx_materials_course_id` | `course_id` | Filter materials by optional course grouping tag |
| `batch_materials` | `idx_materials_uploaded_by` | `uploaded_by` | Materials by uploader |
| `batch_materials` | `idx_materials_file_type` | `file_type` | Filter by file type |
| `batch_materials` | `idx_materials_deleted_at` | `deleted_at` | Soft-delete filter |
| `zoom_accounts` | `idx_za_deleted_at` | `deleted_at` | Soft-delete filter |
| `zoom_classes` | `idx_zc_batch_id` | `batch_id` | Classes for a batch |
| `zoom_classes` | `idx_zc_teacher_id` | `teacher_id` | Classes for a teacher |
| `zoom_classes` | `idx_zc_zoom_account_id` | `zoom_account_id` | Classes per Zoom account |
| `zoom_classes` | `idx_zc_status` | `status` | Filter by class status |
| `zoom_classes` | `idx_zc_scheduled` | `scheduled_date, scheduled_time` | Upcoming classes sort |
| `zoom_classes` | `idx_zc_deleted_at` | `deleted_at` | Soft-delete filter |
| `class_recordings` | `idx_cr_zoom_class_id` | `zoom_class_id` | Recordings for a class |
| `class_recordings` | `idx_cr_status` | `status` | Filter ready recordings |
| `class_recordings` | `idx_cr_deleted_at` | `deleted_at` | Soft-delete filter |
| `announcements` | `idx_ann_scope` | `scope` | Filter by scope type |
| `announcements` | `idx_ann_batch_id` | `batch_id` | Announcements for a batch |
| `announcements` | `idx_ann_course_id` | `course_id` | Announcements for a course |
| `announcements` | `idx_ann_posted_by` | `posted_by` | Announcements by author |
| `announcements` | `idx_ann_expires_at` | `expires_at` | Filter expired announcements |
| `announcements` | `idx_ann_deleted_at` | `deleted_at` | Soft-delete filter |
| `lecture_progress` | `idx_lp_student_id` | `student_id` | Progress for a student |
| `lecture_progress` | `idx_lp_lecture_id` | `lecture_id` | Progress for a lecture |
| `lecture_progress` | `idx_lp_status` | `status` | Filter by watch status |
| `zoom_attendance` | `idx_zatt_zoom_class_id` | `zoom_class_id` | Attendance for a class |
| `zoom_attendance` | `idx_zatt_student_id` | `student_id` | Attendance for a student |
| `jobs` | `idx_jobs_job_type` | `job_type` | Filter by job type |
| `jobs` | `idx_jobs_deadline` | `deadline` | Sort/filter by deadline |
| `jobs` | `idx_jobs_deleted_at` | `deleted_at` | Soft-delete filter |
| `job_applications` | `idx_ja_job_id` | `job_id` | Applications for a job |
| `job_applications` | `idx_ja_student_id` | `student_id` | Student's applications |
| `job_applications` | `idx_ja_status` | `status` | Filter by app status |
| `job_applications` | `idx_ja_deleted_at` | `deleted_at` | Soft-delete filter |
| `user_sessions` | `idx_us_user_id` | `user_id` | Sessions for a user |
| `user_sessions` | `idx_us_active` | `user_id, is_active` | Active session count |
| `user_sessions` | `idx_us_last_active` | `last_active_at` | Session cleanup |
| `activity_log` | `idx_al_user_id` | `user_id` | Logs by user |
| `activity_log` | `idx_al_entity` | `entity_type, entity_id` | Logs for an entity |
| `activity_log` | `idx_al_action` | `action` | Filter by action type |
| `activity_log` | `idx_al_created_at` | `created_at` | Recent logs sort |

**Partial unique indexes** (constraint enforcement):
| Table | Index | Columns | Condition | Purpose |
|-------|-------|---------|-----------|---------|
| `student_batches` | `uq_active_enrollment` | `student_id, batch_id` | `WHERE removed_at IS NULL` | One active enrollment per student per batch |
| `batch_courses` | `uq_active_batch_course` | `batch_id, course_id` | `WHERE deleted_at IS NULL` | One active link per batch-course pair |
| `lectures` | `uq_lecture_sequence` | `batch_id, sequence_order` | `WHERE deleted_at IS NULL` | No duplicate ordering |
| `curriculum_modules` | `uq_cm_sequence` | `course_id, sequence_order` | `WHERE deleted_at IS NULL` | No duplicate ordering |
| `job_applications` | `uq_active_application` | `student_id, job_id` | `WHERE deleted_at IS NULL` | One active application per student per job |
| `lecture_progress` | `uq_student_lecture` | `student_id, lecture_id` | *(none — always unique)* | One progress row per student per lecture |
| `zoom_attendance` | `uq_class_student` | `zoom_class_id, student_id` | *(none — always unique)* | One attendance row per student per class |

---

## 9. Supabase Storage Buckets

### 9.1 `avatars` (Public)

- **Purpose**: User profile pictures
- **Access**: Public read. Authenticated users can upload/update/delete their own avatar.
- **Path pattern**: `avatars/{user_id}/{filename}`
- **Max file size**: 2 MB (configured in Supabase Dashboard)
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp` (configured in Supabase Dashboard)

### 9.2 `resumes` (Private)

- **Purpose**: Student resume uploads for job applications
- **Access**: Private. Students can upload their own. Course Creators can read all (for reviewing applications). Admin can read all.
- **Path pattern**: `resumes/{student_id}/{filename}`
- **Max file size**: 5 MB (configured in Supabase Dashboard)
- **Allowed MIME types**: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (configured in Supabase Dashboard)

### 9.3 `course-materials` (Private)

- **Purpose**: Course material documents (PDF, Excel, Word, PPTX, etc.)
- **Access**: Private. Course Creators can upload/read all. Teachers can upload/read for own-batch courses. Students can read for own-batch courses. Admin can read all.
- **Path pattern**: `course-materials/{course_id}/{filename}`
- **Max file size**: 25 MB (configured in Supabase Dashboard)
- **Allowed MIME types**: `application/pdf`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `image/*`, `application/zip`, `application/x-rar-compressed` (configured in Supabase Dashboard)

> **Note**: File size limits and MIME type restrictions are configured via the Supabase Dashboard bucket settings, not via SQL policies. The SQL below only handles access control.

---

## 10. Edge Functions

Serverless functions deployed on Supabase Edge (Deno/TypeScript). All use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.

### 10.1 `generate-signed-video-url`

- **Trigger**: Student opens a lecture page (teachers do not have video access in the UI)
- **Logic**: Verify enrollment (student has active enrollment in a batch linked to the course via `student_batches`) -> call Bunny.net API -> return temporary signed URL (expires in 10 minutes)
- **Env vars**: `BUNNY_API_KEY`, `BUNNY_LIBRARY_ID`

### 10.2 `create-zoom-meeting`

- **Trigger**: Teacher schedules a class via the LMS
- **Logic**: Validate teacher owns the batch -> look up selected `zoom_account` credentials -> call Zoom API to create meeting -> store `zoom_meeting_id`, `zoom_meeting_url`, `zoom_start_url`, `zoom_account_id` in `zoom_classes` table
- **Env vars**: None (credentials stored in `zoom_accounts` table)

### 10.3 `sync-zoom-status`

- **Trigger**: Zoom webhook (meeting started / meeting ended)
- **Logic**: Receive webhook -> validate signature -> update `zoom_classes.status` to `'live'` or `'completed'`
- **Env vars**: `ZOOM_WEBHOOK_SECRET`

### 10.4 `enforce-device-limit`

- **Trigger**: User login (called from auth hook or client)
- **Logic**: Read `max_device_limit` from `system_settings` -> count active sessions for user -> if count >= limit, deactivate oldest session(s) -> create new session record
- **Env vars**: None (uses service_role key)

### 10.5 `process-recording`

- **Trigger**: Zoom webhook (recording available)
- **Logic**: Receive recording URL from Zoom -> download recording -> upload to Bunny.net -> create `class_recordings` row with status `'processing'` -> update to `'ready'` when Bunny.net confirms
- **Env vars**: `ZOOM_WEBHOOK_SECRET`, `BUNNY_API_KEY`, `BUNNY_LIBRARY_ID`

### 10.6 `send-zoom-reminder`

- **Trigger**: Cron job (runs every 15 minutes)
- **Logic**: Query `zoom_classes` for meetings starting within the next hour that haven't had reminders sent -> for each, query students enrolled in that batch via `student_batches` -> send email reminder via email provider -> mark reminder as sent (via `details` in `activity_log` or a flag)
- **Env vars**: `RESEND_API_KEY` (or `SENDGRID_API_KEY`)

### 10.7 `fetch-zoom-attendance`

- **Trigger**: After `sync-zoom-status` sets status to `completed`
- **Logic**: Call Zoom Past Meeting Participants API -> match participants to students by email -> INSERT rows into `zoom_attendance` (joined/not joined, join/leave times, duration) -> students not found in participant list get `joined = false`
- **Env vars**: None (credentials from `zoom_accounts` table)

### 10.8 `bulk-import-users`

- **Trigger**: Admin uploads CSV from Users page
- **Logic**: Parse CSV -> validate rows (required fields, unique emails, valid roles) -> create `auth.users` entries -> create corresponding `users` table rows -> for students, create `student_batches` enrollment rows -> log `user.bulk_imported` action -> return success/failure summary
- **Env vars**: None (uses service_role key)

### 10.9 `export-data`

- **Trigger**: Admin clicks export button on any list page
- **Logic**: Accept params (entity type, filters, format) -> query data with service_role -> generate CSV or PDF -> return download URL (signed storage URL or inline response)
- **Env vars**: None (uses service_role key)

### 10.10 `clone-course`

- **Trigger**: CC clicks "Clone Course" button
- **Logic**: Copy `courses` row with new ID, title appended with "(Copy)", `status = 'upcoming'`, `cloned_from_id = original.id` -> copy all `curriculum_modules` for original course with new IDs and new `course_id` -> does NOT copy lectures or materials (batch-scoped) -> log `course.cloned` action -> return new course
- **Env vars**: None (uses service_role key)

---

## 11. Frontend Integration Notes

The Next.js frontend uses TypeScript types that differ from the PostgreSQL schema in several ways. These must be handled during backend integration.

### 11.1 Enum Value Mapping

The frontend uses **kebab-case**, the database uses **snake_case**. Transform on read/write.

| Frontend (TypeScript) | Database (PostgreSQL) | Affected Column |
|----------------------|----------------------|-----------------|
| `'course-creator'` | `'course_creator'` | `users.role` |
| `'full-time'` | `'full_time'` | `jobs.job_type` |
| `'part-time'` | `'part_time'` | `jobs.job_type` |
| `'in-progress'` | `'in_progress'` | `lecture_progress.status` |

Values that are the same in both: `admin`, `teacher`, `student`, `internship`, `remote`, `active`, `inactive`, `upcoming`, `completed`, `applied`, `shortlisted`, `rejected`, `live`, `upload`, `external`, `institute`, `batch`, `course`, `unwatched`.

**Recommended approach**: Create a mapping utility in the frontend:
```typescript
const roleToDb = { 'course-creator': 'course_creator' } as const;
const roleFromDb = { 'course_creator': 'course-creator' } as const;
```

### 11.2 Lecture Type Differences

| Field | Frontend (`lib/types.ts`) | Database (`lectures` table) | Action |
|-------|--------------------------|----------------------------|--------|
| `duration` | `string` ("45 min") | `integer` (seconds) | Convert: display `formatDuration(seconds)` on read, parse to seconds on write |
| `batchId` | Present | `batch_id uuid` | Direct mapping. Lectures belong to batches. |
| `batchName` | Present | Not present | Derive from join with `batches` table |
| `uploadDate` | `string` | `created_at timestamptz` | Map `created_at` to display format |
| `videoUrl` | Single field | Split: `video_url` or `bunny_video_id` | Check `video_type` to determine which field to use |
| `order` | `number` | `sequence_order integer` | Rename in frontend type |

### 11.3 Admin Account Setup

The first admin account must be created manually:

1. Create a user via the Supabase Auth Dashboard (Authentication > Users > Add User)
2. Insert a corresponding row in the `users` table:
```sql
INSERT INTO users (id, email, name, role, status)
VALUES (
  '<auth-user-uuid-from-step-1>',
  'admin@ictinstitute.com',
  'System Admin',
  'admin',
  'active'
);
```

After this, the admin can create all other accounts through the LMS interface.

### 11.4 Batch Material Type Differences

| Field | Frontend (`lib/types.ts`) | Database (`batch_materials` table) | Action |
|-------|--------------------------|-------------------------------------|--------|
| `fileSize` | `string` ("2.4 MB") | `bigint` (bytes) | Convert: display `formatFileSize(bytes)` on read, parse to bytes on write |
| `uploadDate` | `string` | `created_at timestamptz` | Map `created_at` to display format |
| `uploadedBy` | `string` (name) | `uploaded_by uuid` | Join with `users` table to get name |
| `uploadedByRole` | `'course-creator' \| 'teacher'` | Derived from `users.role` | Map from user's role via join |
| `fileUrl` | `string` | `file_path text` | Generate signed URL from storage path |

### 11.5 Announcements Mapping

| Field | Frontend | Database (`announcements` table) | Action |
|-------|----------|----------------------------------|--------|
| `author` | `string` (name) | `posted_by uuid` | Join with `users` table to get name and role |
| `postedAt` | `string` | `created_at timestamptz` | Format to display string |
| `isExpired` | `boolean` | `expires_at timestamptz` | Compute: `expires_at != null && expires_at < now()` |
| `scope` | `'institute' \| 'batch' \| 'course'` | `announcement_scope` enum | Direct mapping (same values) |

### 11.6 Lecture Progress Mapping

| Field | Frontend | Database (`lecture_progress` table) | Action |
|-------|----------|--------------------------------------|--------|
| `watchPercentage` | `number` (0-100) | `watch_percentage integer` | Direct mapping |
| `resumePosition` | `number` (seconds) | `resume_position_seconds integer` | Direct mapping |
| `status` | `'unwatched' \| 'in-progress' \| 'completed'` | `lecture_watch_status` enum | Map `'in-progress'` ↔ `'in_progress'` |
| `lastWatchedAt` | `string` | `last_watched_at timestamptz` | Format to display string |

**UPSERT pattern** (frontend Supabase client):
```typescript
const { error } = await supabase
  .from('lecture_progress')
  .upsert({
    student_id: userId,
    lecture_id: lectureId,
    watch_percentage: percentage,
    resume_position_seconds: position,
    status: percentage >= 90 ? 'completed' : 'in_progress',
    last_watched_at: new Date().toISOString(),
  }, { onConflict: 'student_id,lecture_id' });
```

### 11.7 Zoom Attendance Mapping

| Field | Frontend | Database (`zoom_attendance` table) | Action |
|-------|----------|-------------------------------------|--------|
| `studentName` | `string` | Not present | Join with `users` table |
| `joined` | `boolean` | `joined boolean` | Direct mapping |
| `duration` | `string` ("45 min") | `duration_seconds integer` | Format to display string |
| `joinTime` / `leaveTime` | `string` | `join_time` / `leave_time timestamptz` | Format to display string |

### 11.8 Zoom Accounts Mapping

| Field | Frontend | Database (`zoom_accounts` table) | Action |
|-------|----------|-----------------------------------|--------|
| `name` | `string` | `name text` | Direct mapping |
| `accountId` | `string` | `account_id text` | Direct mapping |
| `clientId` | `string` | `client_id text` | Direct mapping |
| `clientSecret` | `string` (masked in UI) | `client_secret text` (encrypted at rest) | Show masked in UI; send raw on save |
| `isDefault` | `boolean` | `is_default boolean` | Direct mapping |

---

## 12. Full SQL

Complete SQL to create the entire schema from scratch. Run in order in the Supabase SQL Editor.

```sql
-- ============================================================
-- ICT Institute LMS — Full Database Schema
-- Target: Supabase (PostgreSQL 15+)
-- Run this in the Supabase SQL Editor in order.
-- ============================================================

-- =====================
-- 1. ENUM TYPES
-- =====================

CREATE TYPE user_role AS ENUM ('admin', 'course_creator', 'teacher', 'student');
CREATE TYPE user_status AS ENUM ('active', 'inactive');
CREATE TYPE course_status AS ENUM ('upcoming', 'active', 'completed');
CREATE TYPE zoom_class_status AS ENUM ('upcoming', 'live', 'completed');
CREATE TYPE recording_status AS ENUM ('processing', 'ready', 'failed');
CREATE TYPE job_type AS ENUM ('full_time', 'part_time', 'internship', 'remote');
CREATE TYPE application_status AS ENUM ('applied', 'shortlisted', 'rejected');
CREATE TYPE video_type AS ENUM ('upload', 'external');
CREATE TYPE batch_history_action AS ENUM ('assigned', 'removed');
CREATE TYPE material_file_type AS ENUM ('pdf', 'excel', 'word', 'pptx', 'image', 'archive', 'other');
CREATE TYPE announcement_scope AS ENUM ('institute', 'batch', 'course');
CREATE TYPE lecture_watch_status AS ENUM ('unwatched', 'in_progress', 'completed');


-- =====================
-- 2. TABLES
-- =====================

-- 2.1 users
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  phone         text,
  role          user_role NOT NULL,
  specialization text,
  avatar_url    text,
  status        user_status NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT chk_specialization_teacher_only CHECK ((role = 'teacher') OR (specialization IS NULL))
);

-- 2.2 batches
CREATE TABLE batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  teacher_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT chk_batch_dates CHECK (end_date > start_date)
);

-- 2.3 student_batches
CREATE TABLE student_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id      uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  enrolled_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  removed_at    timestamptz,
  removed_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Partial unique: one active enrollment per student per batch
CREATE UNIQUE INDEX uq_active_enrollment
  ON student_batches (student_id, batch_id)
  WHERE removed_at IS NULL;

-- 2.4 student_batch_history
CREATE TABLE student_batch_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id      uuid REFERENCES batches(id) ON DELETE SET NULL,
  action        batch_history_action NOT NULL,
  changed_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2.5 courses
CREATE TABLE courses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  status          course_status NOT NULL DEFAULT 'upcoming',
  cloned_from_id  uuid REFERENCES courses(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- 2.6 batch_courses
CREATE TABLE batch_courses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  assigned_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- Partial unique: one active link per batch-course pair
CREATE UNIQUE INDEX uq_active_batch_course
  ON batch_courses (batch_id, course_id)
  WHERE deleted_at IS NULL;

-- 2.7 lectures
CREATE TABLE lectures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  course_id       uuid REFERENCES courses(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  duration        integer,
  file_size       bigint,
  video_type      video_type NOT NULL,
  video_url       text,
  bunny_video_id  text,
  bunny_library_id text,
  thumbnail_url   text,
  sequence_order  integer NOT NULL,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT chk_lecture_video_data CHECK (
    (video_type = 'upload' AND bunny_video_id IS NOT NULL) OR
    (video_type = 'external' AND video_url IS NOT NULL)
  )
);

-- Unique sequence order per batch (among non-deleted lectures)
CREATE UNIQUE INDEX uq_lecture_sequence
  ON lectures (batch_id, sequence_order)
  WHERE deleted_at IS NULL;

-- 2.8 curriculum_modules
CREATE TABLE curriculum_modules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  sequence_order  integer NOT NULL,
  topics          text[],
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- Unique sequence order per course (among non-deleted modules)
CREATE UNIQUE INDEX uq_cm_sequence
  ON curriculum_modules (course_id, sequence_order)
  WHERE deleted_at IS NULL;

-- 2.9 batch_materials
CREATE TABLE batch_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  course_id       uuid REFERENCES courses(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  file_name       text NOT NULL,
  file_path       text NOT NULL,
  file_type       material_file_type NOT NULL,
  file_size       bigint,
  mime_type       text,
  uploaded_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- 2.10 zoom_accounts
CREATE TABLE zoom_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  account_id      text NOT NULL,
  client_id       text NOT NULL,
  client_secret   text NOT NULL,
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- 2.11 zoom_classes
CREATE TABLE zoom_classes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  teacher_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  zoom_account_id   uuid REFERENCES zoom_accounts(id) ON DELETE SET NULL,
  title             text NOT NULL,
  zoom_meeting_id   text,
  zoom_meeting_url  text,
  zoom_start_url    text,
  scheduled_date    date NOT NULL,
  scheduled_time    time NOT NULL,
  duration          integer,
  status            zoom_class_status NOT NULL DEFAULT 'upcoming',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

-- 2.12 class_recordings
CREATE TABLE class_recordings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_class_id     uuid NOT NULL REFERENCES zoom_classes(id) ON DELETE CASCADE,
  title             text NOT NULL,
  bunny_video_id    text,
  bunny_library_id  text,
  duration          integer,
  file_size         bigint,
  thumbnail_url     text,
  recording_date    date,
  status            recording_status NOT NULL DEFAULT 'processing',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

-- 2.13 announcements
CREATE TABLE announcements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  body          text NOT NULL,
  scope         announcement_scope NOT NULL,
  batch_id      uuid REFERENCES batches(id) ON DELETE CASCADE,
  course_id     uuid REFERENCES courses(id) ON DELETE CASCADE,
  expires_at    timestamptz,
  posted_by     uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT chk_announcement_scope CHECK (
    (scope = 'institute' AND batch_id IS NULL AND course_id IS NULL) OR
    (scope = 'batch' AND batch_id IS NOT NULL AND course_id IS NULL) OR
    (scope = 'course' AND course_id IS NOT NULL AND batch_id IS NULL)
  )
);

-- 2.14 lecture_progress
CREATE TABLE lecture_progress (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lecture_id              uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  watch_percentage        integer NOT NULL DEFAULT 0,
  resume_position_seconds integer NOT NULL DEFAULT 0,
  status                  lecture_watch_status NOT NULL DEFAULT 'unwatched',
  last_watched_at         timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Unique: one progress row per student per lecture
CREATE UNIQUE INDEX uq_student_lecture
  ON lecture_progress (student_id, lecture_id);

-- 2.15 zoom_attendance
CREATE TABLE zoom_attendance (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_class_id     uuid NOT NULL REFERENCES zoom_classes(id) ON DELETE CASCADE,
  student_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined            boolean NOT NULL,
  join_time         timestamptz,
  leave_time        timestamptz,
  duration_seconds  integer,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Unique: one attendance record per student per class
CREATE UNIQUE INDEX uq_class_student
  ON zoom_attendance (zoom_class_id, student_id);

-- 2.16 jobs
CREATE TABLE jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  company       text NOT NULL,
  location      text,
  job_type      job_type NOT NULL,
  salary        text,
  description   text,
  requirements  text[],
  deadline      date,
  posted_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- 2.17 job_applications
CREATE TABLE job_applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  student_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_url          text,
  cover_text          text,
  status              application_status NOT NULL DEFAULT 'applied',
  status_changed_at   timestamptz,
  status_changed_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  applied_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

-- Unique: one active application per student per job
CREATE UNIQUE INDEX uq_active_application
  ON job_applications (student_id, job_id)
  WHERE deleted_at IS NULL;

-- 2.18 user_sessions
CREATE TABLE user_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token   text NOT NULL,
  device_info     text,
  ip_address      text,
  logged_in_at    timestamptz NOT NULL DEFAULT now(),
  last_active_at  timestamptz NOT NULL DEFAULT now(),
  is_active       boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- 2.19 system_settings
CREATE TABLE system_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key   text NOT NULL UNIQUE,
  value         text NOT NULL,
  description   text,
  updated_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- 2.20 activity_log
CREATE TABLE activity_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  action        text NOT NULL,
  entity_type   text,
  entity_id     uuid,
  details       jsonb,
  ip_address    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- =====================
-- 3. INDEXES
-- =====================

-- users
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- student_batches
CREATE INDEX idx_sb_student_id ON student_batches(student_id);
CREATE INDEX idx_sb_batch_id ON student_batches(batch_id);
CREATE INDEX idx_sb_removed_at ON student_batches(removed_at);

-- batches
CREATE INDEX idx_batches_teacher_id ON batches(teacher_id);
CREATE INDEX idx_batches_dates ON batches(start_date, end_date);
CREATE INDEX idx_batches_deleted_at ON batches(deleted_at);

-- student_batch_history
CREATE INDEX idx_sbh_student_id ON student_batch_history(student_id);
CREATE INDEX idx_sbh_batch_id ON student_batch_history(batch_id);

-- courses
CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_courses_cloned_from ON courses(cloned_from_id);
CREATE INDEX idx_courses_deleted_at ON courses(deleted_at);

-- batch_courses
CREATE INDEX idx_bc_batch_id ON batch_courses(batch_id);
CREATE INDEX idx_bc_course_id ON batch_courses(course_id);
CREATE INDEX idx_bc_deleted_at ON batch_courses(deleted_at);

-- lectures (composite index covers batch_id-only queries too)
CREATE INDEX idx_lectures_sequence ON lectures(batch_id, sequence_order);
CREATE INDEX idx_lectures_course_id ON lectures(course_id);
CREATE INDEX idx_lectures_deleted_at ON lectures(deleted_at);

-- curriculum_modules (composite index covers course_id-only queries too)
CREATE INDEX idx_cm_sequence ON curriculum_modules(course_id, sequence_order);
CREATE INDEX idx_cm_deleted_at ON curriculum_modules(deleted_at);

-- batch_materials
CREATE INDEX idx_materials_batch_id ON batch_materials(batch_id);
CREATE INDEX idx_materials_course_id ON batch_materials(course_id);
CREATE INDEX idx_materials_uploaded_by ON batch_materials(uploaded_by);
CREATE INDEX idx_materials_file_type ON batch_materials(file_type);
CREATE INDEX idx_materials_deleted_at ON batch_materials(deleted_at);

-- zoom_accounts
CREATE INDEX idx_za_deleted_at ON zoom_accounts(deleted_at);

-- zoom_classes
CREATE INDEX idx_zc_batch_id ON zoom_classes(batch_id);
CREATE INDEX idx_zc_teacher_id ON zoom_classes(teacher_id);
CREATE INDEX idx_zc_zoom_account_id ON zoom_classes(zoom_account_id);
CREATE INDEX idx_zc_status ON zoom_classes(status);
CREATE INDEX idx_zc_scheduled ON zoom_classes(scheduled_date, scheduled_time);
CREATE INDEX idx_zc_deleted_at ON zoom_classes(deleted_at);

-- class_recordings
CREATE INDEX idx_cr_zoom_class_id ON class_recordings(zoom_class_id);
CREATE INDEX idx_cr_status ON class_recordings(status);
CREATE INDEX idx_cr_deleted_at ON class_recordings(deleted_at);

-- announcements
CREATE INDEX idx_ann_scope ON announcements(scope);
CREATE INDEX idx_ann_batch_id ON announcements(batch_id);
CREATE INDEX idx_ann_course_id ON announcements(course_id);
CREATE INDEX idx_ann_posted_by ON announcements(posted_by);
CREATE INDEX idx_ann_expires_at ON announcements(expires_at);
CREATE INDEX idx_ann_deleted_at ON announcements(deleted_at);

-- lecture_progress
CREATE INDEX idx_lp_student_id ON lecture_progress(student_id);
CREATE INDEX idx_lp_lecture_id ON lecture_progress(lecture_id);
CREATE INDEX idx_lp_status ON lecture_progress(status);

-- zoom_attendance
CREATE INDEX idx_zatt_zoom_class_id ON zoom_attendance(zoom_class_id);
CREATE INDEX idx_zatt_student_id ON zoom_attendance(student_id);

-- jobs
CREATE INDEX idx_jobs_job_type ON jobs(job_type);
CREATE INDEX idx_jobs_deadline ON jobs(deadline);
CREATE INDEX idx_jobs_deleted_at ON jobs(deleted_at);

-- job_applications
CREATE INDEX idx_ja_job_id ON job_applications(job_id);
CREATE INDEX idx_ja_student_id ON job_applications(student_id);
CREATE INDEX idx_ja_status ON job_applications(status);
CREATE INDEX idx_ja_deleted_at ON job_applications(deleted_at);

-- user_sessions
CREATE INDEX idx_us_user_id ON user_sessions(user_id);
CREATE INDEX idx_us_active ON user_sessions(user_id, is_active);
CREATE INDEX idx_us_last_active ON user_sessions(last_active_at);

-- activity_log
CREATE INDEX idx_al_user_id ON activity_log(user_id);
CREATE INDEX idx_al_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_al_action ON activity_log(action);
CREATE INDEX idx_al_created_at ON activity_log(created_at);


-- =====================
-- 4. TRIGGERS: updated_at
-- =====================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON student_batches
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON batch_courses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON lectures
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON curriculum_modules
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON batch_materials
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON zoom_accounts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON zoom_classes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON class_recordings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON lecture_progress
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- NOTE: zoom_attendance has NO updated_at trigger (immutable, Decision #33)
-- NOTE: student_batch_history has NO updated_at (append-only)
-- NOTE: activity_log has NO updated_at (append-only)

CREATE TRIGGER set_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- =====================
-- 5. TRIGGERS: column protection
-- =====================

-- Prevent users from changing their own critical columns (role, status, email)
-- Admins/CCs updating OTHER users are not affected.
-- service_role bypasses this check.
CREATE OR REPLACE FUNCTION protect_user_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only restrict when a user updates their own row
  IF NEW.id = auth.uid() THEN
    NEW.role := OLD.role;
    NEW.status := OLD.status;
    NEW.email := OLD.email;
    NEW.specialization := OLD.specialization;
  END IF;

  -- Prevent anyone from escalating to admin via client API
  IF NEW.role = 'admin' AND OLD.role != 'admin' THEN
    RAISE EXCEPTION 'Cannot escalate role to admin';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER protect_user_columns BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION protect_user_columns();

-- Prevent CCs from changing non-status columns on job applications
CREATE OR REPLACE FUNCTION protect_application_columns()
RETURNS TRIGGER AS $$
DECLARE
  caller_role user_role;
BEGIN
  SELECT role INTO caller_role
  FROM public.users
  WHERE id = auth.uid() AND deleted_at IS NULL AND status = 'active';

  -- Course Creators can only change status-related columns
  IF caller_role = 'course_creator' THEN
    NEW.job_id := OLD.job_id;
    NEW.student_id := OLD.student_id;
    NEW.resume_url := OLD.resume_url;
    NEW.cover_text := OLD.cover_text;
    NEW.applied_at := OLD.applied_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER protect_application_columns BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION protect_application_columns();

-- Prevent users from changing non-is_active columns on their own sessions
CREATE OR REPLACE FUNCTION protect_session_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user updates their own session, only allow is_active change
  IF NEW.user_id = auth.uid() THEN
    NEW.session_token := OLD.session_token;
    NEW.device_info := OLD.device_info;
    NEW.ip_address := OLD.ip_address;
    NEW.logged_in_at := OLD.logged_in_at;
    NEW.user_id := OLD.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER protect_session_columns BEFORE UPDATE ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION protect_session_columns();


-- =====================
-- 6. VIEWS
-- =====================

-- Batches with computed status (uses security_invoker to respect caller's RLS)
CREATE OR REPLACE VIEW batches_with_status
WITH (security_invoker = true) AS
SELECT
  b.*,
  CASE
    WHEN b.start_date > (now() AT TIME ZONE 'Asia/Karachi')::date THEN 'upcoming'
    WHEN b.end_date < (now() AT TIME ZONE 'Asia/Karachi')::date THEN 'completed'
    ELSE 'active'
  END AS status
FROM batches b
WHERE b.deleted_at IS NULL;

-- Batches with computed status + counts
CREATE OR REPLACE VIEW batches_with_counts
WITH (security_invoker = true) AS
SELECT
  b.*,
  CASE
    WHEN b.start_date > (now() AT TIME ZONE 'Asia/Karachi')::date THEN 'upcoming'
    WHEN b.end_date < (now() AT TIME ZONE 'Asia/Karachi')::date THEN 'completed'
    ELSE 'active'
  END AS status,
  COALESCE(s.student_count, 0) AS student_count,
  COALESCE(c.course_count, 0) AS course_count
FROM batches b
LEFT JOIN (
  SELECT batch_id, COUNT(*) AS student_count
  FROM student_batches
  WHERE removed_at IS NULL
  GROUP BY batch_id
) s ON s.batch_id = b.id
LEFT JOIN (
  SELECT bc.batch_id, COUNT(*) AS course_count
  FROM batch_courses bc
  JOIN courses co ON co.id = bc.course_id AND co.deleted_at IS NULL
  WHERE bc.deleted_at IS NULL
  GROUP BY bc.batch_id
) c ON c.batch_id = b.id
WHERE b.deleted_at IS NULL;


-- =====================
-- 7. HELPER FUNCTIONS
-- =====================

-- Get the current user's role (returns NULL for deleted/inactive users, blocking all access)
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM public.users
  WHERE id = auth.uid() AND deleted_at IS NULL AND status = 'active'
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Get the current student's active batch IDs
-- Returns empty array for non-students or students with no active enrollments
CREATE OR REPLACE FUNCTION auth_batch_ids()
RETURNS uuid[] AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT sb.batch_id FROM public.student_batches sb
      WHERE sb.student_id = auth.uid() AND sb.removed_at IS NULL
    ),
    '{}'::uuid[]
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;


-- =====================
-- 8. GRANTS
-- =====================

-- Grant table access to authenticated role (RLS policies control what they can actually do)
-- No DELETE grant — all deletes are soft-deletes via UPDATE (Decision #1)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure future tables also get grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO authenticated;


-- =====================
-- 9. ROW LEVEL SECURITY
-- =====================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_batch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecture_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 9.1 users
-- -------------------------------------------------------

-- Admin: read all users
CREATE POLICY admin_select_users ON users
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

-- Admin: create non-admin users
CREATE POLICY admin_insert_users ON users
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin' AND role != 'admin');

-- Admin: update non-admin users + own profile
CREATE POLICY admin_update_others ON users
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin' AND (id = auth.uid() OR role != 'admin'))
  WITH CHECK (auth_role() = 'admin');

-- Course Creator: read all users
CREATE POLICY cc_select_users ON users
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

-- Course Creator: create non-admin users (Decision #32)
CREATE POLICY cc_insert_users ON users
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'course_creator' AND role != 'admin');

-- Course Creator: update non-admin users (Decision #32)
CREATE POLICY cc_update_users ON users
  FOR UPDATE TO authenticated
  USING (auth_role() = 'course_creator' AND (id = auth.uid() OR role != 'admin'))
  WITH CHECK (role != 'admin');

-- Teacher: read own profile + students enrolled in own batches
CREATE POLICY teacher_select_users ON users
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'teacher' AND (
      id = auth.uid() OR
      (role = 'student' AND id IN (
        SELECT sb.student_id FROM student_batches sb
        JOIN batches b ON b.id = sb.batch_id
        WHERE b.teacher_id = auth.uid() AND b.deleted_at IS NULL AND sb.removed_at IS NULL
      ))
    )
  );

-- Teacher: update own profile only (column restrictions enforced by trigger)
CREATE POLICY teacher_update_self ON users
  FOR UPDATE TO authenticated
  USING (auth_role() = 'teacher' AND id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Student: read own profile only
CREATE POLICY student_select_self ON users
  FOR SELECT TO authenticated
  USING (auth_role() = 'student' AND id = auth.uid());

-- Student: update own profile only (column restrictions enforced by trigger)
CREATE POLICY student_update_self ON users
  FOR UPDATE TO authenticated
  USING (auth_role() = 'student' AND id = auth.uid())
  WITH CHECK (id = auth.uid());

-- -------------------------------------------------------
-- 9.2 batches
-- -------------------------------------------------------

CREATE POLICY admin_select_batches ON batches
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY admin_insert_batches ON batches
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY admin_update_batches ON batches
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY cc_select_batches ON batches
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

CREATE POLICY cc_insert_batches ON batches
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY cc_update_batches ON batches
  FOR UPDATE TO authenticated
  USING (auth_role() = 'course_creator')
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY teacher_select_own_batches ON batches
  FOR SELECT TO authenticated
  USING (auth_role() = 'teacher' AND teacher_id = auth.uid());

CREATE POLICY student_select_own_batches ON batches
  FOR SELECT TO authenticated
  USING (auth_role() = 'student' AND id = ANY(auth_batch_ids()));

-- -------------------------------------------------------
-- 9.3 student_batches
-- -------------------------------------------------------

-- Admin: full access
CREATE POLICY admin_select_sb ON student_batches
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY admin_insert_sb ON student_batches
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY admin_update_sb ON student_batches
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- CC: full access
CREATE POLICY cc_select_sb ON student_batches
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

CREATE POLICY cc_insert_sb ON student_batches
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY cc_update_sb ON student_batches
  FOR UPDATE TO authenticated
  USING (auth_role() = 'course_creator')
  WITH CHECK (auth_role() = 'course_creator');

-- Teacher: read enrollments for own batches
CREATE POLICY teacher_select_sb ON student_batches
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'teacher' AND
    batch_id IN (
      SELECT id FROM batches WHERE teacher_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- Student: read own enrollments
CREATE POLICY student_select_own_sb ON student_batches
  FOR SELECT TO authenticated
  USING (auth_role() = 'student' AND student_id = auth.uid());

-- -------------------------------------------------------
-- 9.4 student_batch_history
-- -------------------------------------------------------

CREATE POLICY admin_select_sbh ON student_batch_history
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY admin_insert_sbh ON student_batch_history
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY cc_select_sbh ON student_batch_history
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

CREATE POLICY cc_insert_sbh ON student_batch_history
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY teacher_select_sbh ON student_batch_history
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'teacher' AND
    batch_id IN (
      SELECT id FROM batches WHERE teacher_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY student_select_own_sbh ON student_batch_history
  FOR SELECT TO authenticated
  USING (auth_role() = 'student' AND student_id = auth.uid());

-- -------------------------------------------------------
-- 9.5 courses
-- -------------------------------------------------------

CREATE POLICY admin_select_courses ON courses
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY cc_select_courses ON courses
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

CREATE POLICY cc_insert_courses ON courses
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY cc_update_courses ON courses
  FOR UPDATE TO authenticated
  USING (auth_role() = 'course_creator')
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY teacher_select_courses ON courses
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'teacher' AND
    id IN (
      SELECT bc.course_id FROM batch_courses bc
      JOIN batches b ON b.id = bc.batch_id
      WHERE b.teacher_id = auth.uid() AND b.deleted_at IS NULL AND bc.deleted_at IS NULL
    )
  );

CREATE POLICY student_select_courses ON courses
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'student' AND
    id IN (
      SELECT course_id FROM batch_courses
      WHERE batch_id = ANY(auth_batch_ids()) AND deleted_at IS NULL
    )
  );

-- -------------------------------------------------------
-- 9.6 batch_courses
-- -------------------------------------------------------

CREATE POLICY admin_select_bc ON batch_courses
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY cc_select_bc ON batch_courses
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

CREATE POLICY cc_insert_bc ON batch_courses
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY cc_update_bc ON batch_courses
  FOR UPDATE TO authenticated
  USING (auth_role() = 'course_creator')
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY teacher_select_bc ON batch_courses
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'teacher' AND
    batch_id IN (
      SELECT id FROM batches WHERE teacher_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY student_select_bc ON batch_courses
  FOR SELECT TO authenticated
  USING (auth_role() = 'student' AND batch_id = ANY(auth_batch_ids()));

-- -------------------------------------------------------
-- 9.7 lectures
-- -------------------------------------------------------

CREATE POLICY admin_select_lectures ON lectures
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY cc_select_lectures ON lectures
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

CREATE POLICY cc_insert_lectures ON lectures
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY cc_update_lectures ON lectures
  FOR UPDATE TO authenticated
  USING (auth_role() = 'course_creator')
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY teacher_select_lectures ON lectures
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'teacher' AND
    batch_id IN (
      SELECT id FROM batches
      WHERE teacher_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY student_select_lectures ON lectures
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'student' AND
    batch_id = ANY(auth_batch_ids())
  );

-- -------------------------------------------------------
-- 9.8 curriculum_modules
-- -------------------------------------------------------

CREATE POLICY admin_select_cm ON curriculum_modules
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY cc_select_cm ON curriculum_modules
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

CREATE POLICY cc_insert_cm ON curriculum_modules
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY cc_update_cm ON curriculum_modules
  FOR UPDATE TO authenticated
  USING (auth_role() = 'course_creator')
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY teacher_select_cm ON curriculum_modules
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'teacher' AND
    course_id IN (
      SELECT bc.course_id FROM batch_courses bc
      JOIN batches b ON b.id = bc.batch_id
      WHERE b.teacher_id = auth.uid() AND b.deleted_at IS NULL AND bc.deleted_at IS NULL
    )
  );

CREATE POLICY student_select_cm ON curriculum_modules
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'student' AND
    course_id IN (
      SELECT course_id FROM batch_courses
      WHERE batch_id = ANY(auth_batch_ids()) AND deleted_at IS NULL
    )
  );

-- -------------------------------------------------------
-- 9.9 batch_materials
-- -------------------------------------------------------

CREATE POLICY admin_select_materials ON batch_materials
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY cc_select_materials ON batch_materials
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

CREATE POLICY cc_insert_materials ON batch_materials
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY cc_update_materials ON batch_materials
  FOR UPDATE TO authenticated
  USING (auth_role() = 'course_creator')
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY teacher_select_materials ON batch_materials
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'teacher' AND
    batch_id IN (
      SELECT id FROM batches
      WHERE teacher_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY teacher_insert_materials ON batch_materials
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() = 'teacher' AND
    batch_id IN (
      SELECT id FROM batches
      WHERE teacher_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY teacher_update_own_materials ON batch_materials
  FOR UPDATE TO authenticated
  USING (
    auth_role() = 'teacher' AND uploaded_by = auth.uid()
  )
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY student_select_materials ON batch_materials
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'student' AND
    batch_id = ANY(auth_batch_ids())
  );

-- -------------------------------------------------------
-- 9.10 zoom_accounts
-- -------------------------------------------------------

CREATE POLICY admin_select_za ON zoom_accounts
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY admin_insert_za ON zoom_accounts
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY admin_update_za ON zoom_accounts
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- Teachers can SELECT zoom accounts for the scheduling dropdown
-- Frontend should query only id, name, is_default (exclude client_secret)
CREATE POLICY teacher_select_za ON zoom_accounts
  FOR SELECT TO authenticated
  USING (auth_role() = 'teacher' AND deleted_at IS NULL);

-- -------------------------------------------------------
-- 9.11 zoom_classes
-- -------------------------------------------------------

CREATE POLICY admin_select_zc ON zoom_classes
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY cc_select_zc ON zoom_classes
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

CREATE POLICY teacher_select_zc ON zoom_classes
  FOR SELECT TO authenticated
  USING (auth_role() = 'teacher' AND teacher_id = auth.uid());

CREATE POLICY teacher_insert_zc ON zoom_classes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() = 'teacher' AND
    teacher_id = auth.uid() AND
    batch_id IN (
      SELECT id FROM batches WHERE teacher_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY teacher_update_zc ON zoom_classes
  FOR UPDATE TO authenticated
  USING (auth_role() = 'teacher' AND teacher_id = auth.uid())
  WITH CHECK (
    teacher_id = auth.uid() AND
    batch_id IN (
      SELECT id FROM batches WHERE teacher_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY student_select_zc ON zoom_classes
  FOR SELECT TO authenticated
  USING (auth_role() = 'student' AND batch_id = ANY(auth_batch_ids()));

-- -------------------------------------------------------
-- 9.12 class_recordings
-- -------------------------------------------------------

CREATE POLICY admin_select_cr ON class_recordings
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY cc_select_cr ON class_recordings
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

CREATE POLICY teacher_select_cr ON class_recordings
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'teacher' AND
    zoom_class_id IN (
      SELECT id FROM zoom_classes WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY student_select_cr ON class_recordings
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'student' AND
    status = 'ready' AND
    zoom_class_id IN (
      SELECT id FROM zoom_classes WHERE batch_id = ANY(auth_batch_ids())
    )
  );

-- -------------------------------------------------------
-- 9.13 announcements
-- -------------------------------------------------------

-- Admin: read all announcements
CREATE POLICY admin_select_ann ON announcements
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

-- Admin: create institute-wide announcements
CREATE POLICY admin_insert_ann ON announcements
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin' AND scope = 'institute');

-- Admin: soft-delete any announcement
CREATE POLICY admin_update_ann ON announcements
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin');

-- CC: read all announcements
CREATE POLICY cc_select_ann ON announcements
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

-- CC: create batch or course-scoped announcements
CREATE POLICY cc_insert_ann ON announcements
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'course_creator' AND scope IN ('batch', 'course'));

-- CC: soft-delete own announcements
CREATE POLICY cc_update_ann ON announcements
  FOR UPDATE TO authenticated
  USING (auth_role() = 'course_creator' AND posted_by = auth.uid());

-- Teacher: read institute-wide + own batch-scoped announcements
CREATE POLICY teacher_select_ann ON announcements
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'teacher' AND (
      scope = 'institute' OR
      (scope = 'batch' AND batch_id IN (
        SELECT id FROM batches WHERE teacher_id = auth.uid() AND deleted_at IS NULL
      ))
    )
  );

-- Teacher: create batch-scoped announcements for own batches
CREATE POLICY teacher_insert_ann ON announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() = 'teacher' AND
    scope = 'batch' AND
    batch_id IN (
      SELECT id FROM batches WHERE teacher_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- Teacher: soft-delete own announcements
CREATE POLICY teacher_update_ann ON announcements
  FOR UPDATE TO authenticated
  USING (auth_role() = 'teacher' AND posted_by = auth.uid());

-- Student: read institute-wide + own batch + own batch's course announcements
CREATE POLICY student_select_ann ON announcements
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'student' AND (
      scope = 'institute' OR
      (scope = 'batch' AND batch_id = ANY(auth_batch_ids())) OR
      (scope = 'course' AND course_id IN (
        SELECT course_id FROM batch_courses
        WHERE batch_id = ANY(auth_batch_ids()) AND deleted_at IS NULL
      ))
    )
  );

-- -------------------------------------------------------
-- 9.14 lecture_progress
-- -------------------------------------------------------

-- Admin: read all progress
CREATE POLICY admin_select_lp ON lecture_progress
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

-- CC: read all progress
CREATE POLICY cc_select_lp ON lecture_progress
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

-- Student: read own progress
CREATE POLICY student_select_lp ON lecture_progress
  FOR SELECT TO authenticated
  USING (auth_role() = 'student' AND student_id = auth.uid());

-- Student: insert own progress (for UPSERT)
CREATE POLICY student_insert_lp ON lecture_progress
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'student' AND student_id = auth.uid());

-- Student: update own progress (for UPSERT)
CREATE POLICY student_update_lp ON lecture_progress
  FOR UPDATE TO authenticated
  USING (auth_role() = 'student' AND student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- -------------------------------------------------------
-- 9.15 zoom_attendance
-- -------------------------------------------------------

-- Admin: read all attendance
CREATE POLICY admin_select_zatt ON zoom_attendance
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

-- CC: read all attendance
CREATE POLICY cc_select_zatt ON zoom_attendance
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

-- Teacher: read attendance for own classes
CREATE POLICY teacher_select_zatt ON zoom_attendance
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'teacher' AND
    zoom_class_id IN (
      SELECT id FROM zoom_classes WHERE teacher_id = auth.uid()
    )
  );

-- Student: read own attendance
CREATE POLICY student_select_zatt ON zoom_attendance
  FOR SELECT TO authenticated
  USING (auth_role() = 'student' AND student_id = auth.uid());

-- INSERT is service_role only (no INSERT policy for authenticated)

-- -------------------------------------------------------
-- 9.16 jobs
-- -------------------------------------------------------

CREATE POLICY admin_select_jobs ON jobs
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY cc_select_jobs ON jobs
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

CREATE POLICY cc_insert_jobs ON jobs
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY cc_update_jobs ON jobs
  FOR UPDATE TO authenticated
  USING (auth_role() = 'course_creator')
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY student_select_jobs ON jobs
  FOR SELECT TO authenticated
  USING (auth_role() = 'student' AND deleted_at IS NULL);

-- -------------------------------------------------------
-- 9.17 job_applications
-- -------------------------------------------------------

CREATE POLICY admin_select_ja ON job_applications
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY cc_select_ja ON job_applications
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

-- CC can update status only (column restrictions enforced by protect_application_columns trigger)
CREATE POLICY cc_update_ja_status ON job_applications
  FOR UPDATE TO authenticated
  USING (auth_role() = 'course_creator')
  WITH CHECK (auth_role() = 'course_creator');

CREATE POLICY student_select_own_ja ON job_applications
  FOR SELECT TO authenticated
  USING (auth_role() = 'student' AND student_id = auth.uid());

CREATE POLICY student_insert_ja ON job_applications
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'student' AND student_id = auth.uid());

-- Student can soft-delete own application (for resubmit) by setting deleted_at
CREATE POLICY student_update_own_ja ON job_applications
  FOR UPDATE TO authenticated
  USING (auth_role() = 'student' AND student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- -------------------------------------------------------
-- 9.18 user_sessions
-- -------------------------------------------------------

CREATE POLICY admin_select_sessions ON user_sessions
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY admin_update_sessions ON user_sessions
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY user_select_own_sessions ON user_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- User can update own sessions (is_active only, enforced by protect_session_columns trigger)
CREATE POLICY user_update_own_sessions ON user_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- -------------------------------------------------------
-- 9.19 system_settings
-- -------------------------------------------------------

CREATE POLICY admin_select_settings ON system_settings
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY admin_insert_settings ON system_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY admin_update_settings ON system_settings
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- -------------------------------------------------------
-- 9.20 activity_log
-- -------------------------------------------------------

CREATE POLICY admin_select_log ON activity_log
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

-- Insert is done via service_role in Edge Functions (bypasses RLS)


-- =====================
-- 10. SEED DATA
-- =====================

INSERT INTO system_settings (setting_key, value, description) VALUES
  ('max_device_limit', '2', 'Maximum number of concurrent login sessions allowed per user'),
  ('post_batch_grace_period_days', '90', 'Number of days after batch end date that students retain read-only access to content');
```

---

## Appendix A: Storage Bucket SQL

Run these in Supabase Dashboard > Storage or via SQL:

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('resumes', 'resumes', false),
  ('course-materials', 'course-materials', false);

-- Storage policies: avatars (public read, authenticated upload/update/delete own)
CREATE POLICY "Avatar public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Avatar upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Avatar update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Avatar delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies: resumes (private)
CREATE POLICY "Resume student upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text AND
    auth_role() = 'student'
  );

CREATE POLICY "Resume student read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text AND
    auth_role() = 'student'
  );

CREATE POLICY "Resume cc read all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes' AND
    auth_role() = 'course_creator'
  );

CREATE POLICY "Resume admin read all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes' AND
    auth_role() = 'admin'
  );

-- Storage policies: course-materials (private)
CREATE POLICY "Material cc upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-materials' AND
    auth_role() = 'course_creator'
  );

CREATE POLICY "Material cc read all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-materials' AND
    auth_role() = 'course_creator'
  );

CREATE POLICY "Material teacher upload own batch courses" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-materials' AND
    auth_role() = 'teacher'
  );

CREATE POLICY "Material teacher read own batch courses" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-materials' AND
    auth_role() = 'teacher'
  );

CREATE POLICY "Material student read own batch courses" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-materials' AND
    auth_role() = 'student'
  );

CREATE POLICY "Material admin read all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-materials' AND
    auth_role() = 'admin'
  );
```

---

## Appendix B: Insights Page — Data Source Note

The **Admin Insights** page derives all of its data from existing tables. **No new schema or tables are required.**

| Insight | Data Source |
|---------|-----------|
| KPI cards (students, batches, courses, sessions, teachers, lectures, materials) | Counts / filters on `users`, `batches`, `courses`, `user_sessions`, `lectures`, `batch_materials` |
| Student & Enrollment charts | `users` (role = student, grouped by status), `batches` (student count), date-aggregated `users.created_at` |
| Batch Performance charts | `batches` (grouped by status), `batches` + `users` (teacher -> batch -> student counts) |
| Course & Content charts | `courses` (grouped by status), `lectures` (grouped by course_id), `batch_materials` (grouped by file_type) |
| Device & Security charts | `user_sessions` (active/at-limit/none), date-aggregated `user_sessions.logged_in_at` |
| Lecture Progress charts | `lecture_progress` (completion rates per course, per batch) |
| Zoom Attendance charts | `zoom_attendance` (attendance rates per class, per batch) |

When connected to a real backend, monthly trend data (Enrollment Growth, Monthly Sessions & Issues) will use date-aggregated queries on `user_sessions.logged_in_at` and `users.created_at` instead of the current `monthlyInsightsData` mock array. Lecture progress and zoom attendance data provide new insight dimensions for student engagement analytics.
