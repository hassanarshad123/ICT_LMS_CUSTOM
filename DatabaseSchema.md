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
| 1 | **Soft delete everywhere** | Every table has `deleted_at timestamptz` (NULL = not deleted). Never use hard DELETE in application code. RLS policies never grant `FOR DELETE` — all "deletes" are UPDATEs that set `deleted_at`. |
| 2 | **Timestamps on everything** | Every table has `created_at` + `updated_at` (auto-set via triggers). Some tables use semantic aliases (e.g. `assigned_at`, `logged_in_at`) as their creation timestamp. |
| 3 | **Batch status is auto-calculated** | Computed from `start_date` / `end_date` vs `now()`. NOT stored as a column. Use the `batches_with_status` view. |
| 4 | **Course status IS stored** | Stored as an enum column (`upcoming`, `active`, `completed`). Unlike batch status, course status is manually set by Course Creators. |
| 5 | **All Course Creators share ownership** | Any CC can manage any course, lecture, job, or batch. `created_by` is for audit only, NOT access control. |
| 6 | **Students belong to one batch at a time** | `users.batch_id` FK. Can be NULL (unassigned). Can be moved — history tracked in `student_batch_history`. |
| 7 | **Full batch history** | `student_batch_history` records every batch assignment/removal with timestamps and who made the change. |
| 8 | **New batch = new courses only** | When a student moves batches, they only see courses from their current batch, NOT previous batches. |
| 9 | **Lectures belong to one course** | No sharing across courses. One lecture, one `course_id`. |
| 10 | **Job applications use resubmit model** | One active application per student per job. Resubmitting soft-deletes the old and creates a new one (partial unique index on `student_id` + `job_id` where `deleted_at IS NULL`). |
| 11 | **Track application status changes** | `status_changed_at` + `status_changed_by` on `job_applications`. |
| 12 | **Configurable device limit** | Default 2 concurrent sessions. Admin changes via `system_settings` table. Enforced by Edge Function. |
| 13 | **Activity log** | Append-only audit trail in `activity_log`. No updates, no deletes. Admins can read. |
| 14 | **Zoom recordings stored separately** | Pipeline: Zoom cloud recording -> Bunny.net -> `class_recordings` table. Separate from lectures. |
| 15 | **Store file_size for lectures** | `bigint` in bytes for storage tracking. |
| 16 | **Lecture ordering** | Upload order is default. CCs can reorder via `sequence_order`. Unique within a course (partial unique index). |
| 17 | **Curriculum modules can be reordered** | Via `sequence_order` column. Unique within a course (partial unique index). |
| 18 | **Batches can exist without a teacher** | `teacher_id` is nullable. |
| 19 | **Deleted batch -> students become unassigned** | `users.batch_id` set to NULL via `ON DELETE SET NULL`. |
| 20 | **Deleted job -> keep applications** | Soft delete on job; applications preserved. `job_applications.job_id` uses `ON DELETE RESTRICT` to prevent accidental hard deletion of jobs that have applications. |
| 21 | **Topics stored as text[]** | On `curriculum_modules`, not a separate table. Simpler, sufficient for now. |
| 22 | **Specialization on users table** | No separate `teacher_profiles` table. `specialization` column is nullable, enforced NULL for non-teachers via CHECK constraint. |
| 23 | **Column-level security via triggers** | PostgreSQL RLS cannot restrict which columns a user updates. Critical column restrictions (e.g. preventing students from changing their own role) are enforced via BEFORE UPDATE triggers. |
| 24 | **Views use security_invoker** | All views use `WITH (security_invoker = true)` so they respect the caller's RLS policies, not the view owner's. |
| 25 | **Server timezone** | Database views use explicit timezone conversion (`AT TIME ZONE 'Asia/Karachi'`) for date comparisons to avoid dependence on server timezone settings. |

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
| `batch_id` | `uuid` | FK -> `batches.id` ON DELETE SET NULL | Only for students. CHECK enforces NULL for non-students. |
| `status` | `user_status` | NOT NULL, default `'active'` | Enum: `active`, `inactive` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Auto-updated by trigger |
| `deleted_at` | `timestamptz` | | NULL = not deleted |

**CHECK constraints**:
- `CHECK ((role = 'student') OR (batch_id IS NULL))` — only students have a batch
- `CHECK ((role = 'teacher') OR (specialization IS NULL))` — only teachers have a specialization

**Column-protection trigger** (`protect_user_columns`): When a user updates their own row, the trigger prevents changes to `role`, `status`, `batch_id`, `email`, and `specialization`. These can only be changed by admins/CCs updating other users, or by `service_role` (Edge Functions).

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

### 2.3 `student_batch_history`

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

### 2.4 `courses`

Course content containers. Status is stored (not computed).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `title` | `text` | NOT NULL | |
| `description` | `text` | | |
| `status` | `course_status` | NOT NULL, default `'upcoming'` | Enum: `upcoming`, `active`, `completed` |
| `created_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Audit only — all CCs can manage all courses |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

---

### 2.5 `batch_courses`

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

### 2.6 `lectures`

Video lessons within a course. Supports both direct uploads (Bunny.net) and external links.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `course_id` | `uuid` | NOT NULL, FK -> `courses.id` ON DELETE CASCADE | One lecture belongs to one course |
| `title` | `text` | NOT NULL | |
| `description` | `text` | | |
| `duration` | `integer` | | Duration in seconds |
| `file_size` | `bigint` | | File size in bytes (for storage tracking) |
| `video_type` | `video_type` | NOT NULL | Enum: `upload`, `external` |
| `video_url` | `text` | | For external links (YouTube, Vimeo, Google Drive) |
| `bunny_video_id` | `text` | | Bunny.net video GUID (for uploads) |
| `bunny_library_id` | `text` | | Bunny.net library ID (for uploads) |
| `thumbnail_url` | `text` | | Auto-generated or custom thumbnail |
| `sequence_order` | `integer` | NOT NULL | Ordering within the course. CCs can reorder. |
| `created_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Audit |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**CHECK constraint**: `CHECK ((video_type = 'upload' AND bunny_video_id IS NOT NULL) OR (video_type = 'external' AND video_url IS NOT NULL))` — ensures every lecture has valid video data matching its type.

**Unique constraint**: `(course_id, sequence_order) WHERE deleted_at IS NULL` — no duplicate ordering within a course.

---

### 2.7 `curriculum_modules`

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

### 2.8 `zoom_classes`

Scheduled Zoom meetings. Status is stored (updated by Zoom webhooks).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `batch_id` | `uuid` | NOT NULL, FK -> `batches.id` ON DELETE CASCADE | One class per batch |
| `teacher_id` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Teacher who scheduled it |
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

### 2.9 `class_recordings`

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

### 2.10 `jobs`

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

### 2.11 `job_applications`

Student applications to jobs. Resubmit model — one active application per student per job.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `job_id` | `uuid` | NOT NULL, FK -> `jobs.id` ON DELETE RESTRICT | RESTRICT prevents accidental hard-delete of jobs with applications (Decision #20) |
| `student_id` | `uuid` | NOT NULL, FK -> `users.id` ON DELETE CASCADE | |
| `resume_url` | `text` | | Supabase Storage path |
| `status` | `application_status` | NOT NULL, default `'applied'` | Enum: `applied`, `shortlisted`, `rejected` |
| `status_changed_at` | `timestamptz` | | When status was last changed |
| `status_changed_by` | `uuid` | FK -> `users.id` ON DELETE SET NULL | Who changed the status |
| `applied_at` | `timestamptz` | NOT NULL, default `now()` | When the student applied/resubmitted |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**Unique constraint**: `(student_id, job_id)` WHERE `deleted_at IS NULL` — one active application per student per job. Resubmit soft-deletes the old (sets `deleted_at`), then creates new.

**Column-protection trigger** (`protect_application_columns`): When a CC updates an application, the trigger prevents changes to `job_id`, `student_id`, `resume_url`, `applied_at`, and `deleted_at`. CCs can only change `status`, `status_changed_at`, and `status_changed_by`.

---

### 2.12 `user_sessions`

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

### 2.13 `system_settings`

Key-value store for system-wide configuration. Used for device limit and future settings.

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

**Seed data**: `INSERT INTO system_settings (setting_key, value, description) VALUES ('max_device_limit', '2', 'Maximum concurrent login sessions per user');`

---

### 2.14 `activity_log`

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
| Users | `user.created`, `user.updated`, `user.deactivated`, `user.activated`, `user.deleted`, `user.password_reset`, `user.password_changed`, `user.login`, `user.logout`, `user.force_logout` |
| Batches | `batch.created`, `batch.updated`, `batch.deleted`, `batch.student_added`, `batch.student_removed`, `batch.teacher_assigned` |
| Courses | `course.created`, `course.updated`, `course.deleted`, `course.batch_assigned`, `course.batch_removed` |
| Lectures | `lecture.created`, `lecture.deleted`, `lecture.reordered` |
| Curriculum | `curriculum.created`, `curriculum.deleted`, `curriculum.reordered` |
| Zoom | `zoom.scheduled`, `zoom.started`, `zoom.ended` |
| Recordings | `recording.added` |
| Jobs | `job.created`, `job.deleted` |
| Applications | `application.submitted`, `application.resubmitted`, `application.status_changed` |

---

## 3. Relationships Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          ICT LMS — Entity Relationships                      │
└──────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   users      │
                              │─────────────│
                              │ id (PK)      │
                              │ role         │
                              │ batch_id(FK) │──────────────┐
                              │ status       │              │
                              └──────┬───────┘              │
                                     │                      │
         ┌───────────────────────────┼──────────────────────┼────────────────┐
         │                           │                      │                │
         │ teacher_id               │ created_by           │ student        │
         ▼                           ▼                      ▼                │
  ┌─────────────┐            ┌──────────────┐       ┌─────────────┐         │
  │   batches    │◄───────── │ batch_courses │──────►│   courses    │         │
  │─────────────│  batch_id  │──────────────│course_│─────────────│         │
  │ id (PK)      │            │ id (PK)      │  id   │ id (PK)      │         │
  │ teacher_id   │            │ batch_id(FK) │       │ status       │         │
  │ start_date   │            │ course_id(FK)│       │ created_by   │         │
  │ end_date     │            └──────────────┘       └──────┬───────┘         │
  └──────┬───────┘                                          │                │
         │                                    ┌─────────────┼──────────┐     │
         │                                    │             │          │     │
         │                                    ▼             ▼          │     │
         │                             ┌───────────┐ ┌────────────────┐│     │
         │                             │ lectures   │ │curriculum_     ││     │
         │                             │───────────│ │modules         ││     │
         │                             │ course_id  │ │────────────────││     │
         │                             │ video_type │ │ course_id      ││     │
         │                             │ seq_order  │ │ topics[]       ││     │
         │                             └───────────┘ │ seq_order      ││     │
         │                                           └────────────────┘│     │
         │                                                             │     │
         ▼                                                             │     │
  ┌──────────────┐         ┌──────────────────┐                        │     │
  │ zoom_classes  │────────►│ class_recordings  │                        │     │
  │──────────────│zoom_    │──────────────────│                        │     │
  │ batch_id(FK) │class_id │ zoom_class_id(FK)│                        │     │
  │ teacher_id   │         │ bunny_video_id   │                        │     │
  │ zoom_meeting │         │ status           │                        │     │
  │ status       │         └──────────────────┘                        │     │
  └──────────────┘                                                     │     │
                                                                       │     │
  ┌──────────────┐         ┌──────────────────┐                        │     │
  │    jobs       │────────►│ job_applications  │◄───── users (student) │     │
  │──────────────│ job_id  │──────────────────│  student_id            │     │
  │ posted_by    │(RESTRICT)│ job_id (FK)      │                        │     │
  │ job_type     │         │ student_id (FK)  │                        │     │
  │ requirements │         │ status           │                        │     │
  │ deadline     │         │ resume_url       │                        │     │
  └──────────────┘         └──────────────────┘                        │     │
                                                                       │     │
  ┌──────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │     │
  │ student_batch_history │  │  user_sessions   │  │  system_settings  │  │     │
  │──────────────────────│  │─────────────────│  │──────────────────│  │     │
  │ student_id (FK)      │  │ user_id (FK)    │  │ setting_key (UQ) │  │     │
  │ batch_id (FK)        │  │ session_token   │  │ value            │  │     │
  │ action               │  │ is_active       │  │ updated_by       │  │     │
  │ changed_by (FK)      │  │ last_active_at  │  └──────────────────┘  │     │
  └──────────────────────┘  └─────────────────┘                        │     │
                                                                       │     │
  ┌──────────────┐                                                     │     │
  │ activity_log  │ (append-only, references users and any entity)     │     │
  │──────────────│                                                     │     │
  │ user_id (FK) │                                                     │     │
  │ action       │                                                     │     │
  │ entity_type  │                                                     │     │
  │ entity_id    │                                                     │     │
  │ details      │                                                     │     │
  └──────────────┘                                                     │     │
```

---

## 4. Foreign Key References

Every FK in the system, with ON DELETE behavior.

| Source Table | Source Column | Target Table | Target Column | ON DELETE |
|-------------|-------------|-------------|--------------|-----------|
| `users` | `batch_id` | `batches` | `id` | SET NULL |
| `batches` | `teacher_id` | `users` | `id` | SET NULL |
| `batches` | `created_by` | `users` | `id` | SET NULL |
| `student_batch_history` | `student_id` | `users` | `id` | CASCADE |
| `student_batch_history` | `batch_id` | `batches` | `id` | SET NULL |
| `student_batch_history` | `changed_by` | `users` | `id` | SET NULL |
| `courses` | `created_by` | `users` | `id` | SET NULL |
| `batch_courses` | `batch_id` | `batches` | `id` | CASCADE |
| `batch_courses` | `course_id` | `courses` | `id` | CASCADE |
| `batch_courses` | `assigned_by` | `users` | `id` | SET NULL |
| `lectures` | `course_id` | `courses` | `id` | CASCADE |
| `lectures` | `created_by` | `users` | `id` | SET NULL |
| `curriculum_modules` | `course_id` | `courses` | `id` | CASCADE |
| `curriculum_modules` | `created_by` | `users` | `id` | SET NULL |
| `zoom_classes` | `batch_id` | `batches` | `id` | CASCADE |
| `zoom_classes` | `teacher_id` | `users` | `id` | SET NULL |
| `class_recordings` | `zoom_class_id` | `zoom_classes` | `id` | CASCADE |
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

-- Returns NULL for non-students or unassigned students
-- NOTE: NULL batch_id means the student sees zero batches/courses/zoom classes.
-- This is intentional — unassigned students have no course access.
CREATE OR REPLACE FUNCTION auth_batch_id()
RETURNS uuid AS $$
  SELECT batch_id FROM public.users
  WHERE id = auth.uid() AND deleted_at IS NULL AND status = 'active'
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
```

### 5.1 `users`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All users | Create teachers, CCs, students (not admins) | Any non-admin user + own profile |
| Course Creator | All users | Create students only | Update students only |
| Teacher | Own profile + students in own batches | No | Own profile only (name, phone, avatar — enforced by trigger) |
| Student | Own profile only | No | Own profile only (name, phone, avatar — enforced by trigger) |

### 5.2 `batches`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | Yes | Yes (including soft-delete) |
| Course Creator | All | Yes | Yes (including soft-delete) |
| Teacher | Own batches only (`teacher_id = auth.uid()`) | No | No |
| Student | Own batch only (`id = user.batch_id`) | No | No |

### 5.3 `student_batch_history`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | Yes | No |
| Course Creator | All | Yes | No |
| Teacher | Records for students in own batches | No | No |
| Student | Own records only | No | No |

### 5.4 `courses`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | Yes | Yes (any course, including soft-delete) |
| Teacher | Courses linked to own batches (via `batch_courses`) | No | No |
| Student | Courses linked to own batch (via `batch_courses`) | No | No |

### 5.5 `batch_courses`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | Yes | Yes (soft-delete to unassign) |
| Teacher | Own batch links only | No | No |
| Student | Own batch links only | No | No |

### 5.6 `lectures`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | Yes | Yes (including soft-delete) |
| Teacher | Lectures in courses linked to own batches | No | No |
| Student | Lectures in courses linked to own batch | No | No |

### 5.7 `curriculum_modules`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | Yes | Yes (including soft-delete) |
| Teacher | Modules in courses linked to own batches | No | No |
| Student | Modules in courses linked to own batch | No | No |

### 5.8 `zoom_classes`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | No | No |
| Teacher | Own classes only (`teacher_id = auth.uid()`) | Yes (for own batches only) | Own classes only (must keep same batch) |
| Student | Classes for own batch | No | No |

### 5.9 `class_recordings`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | No | No |
| Teacher | Recordings for own classes | No | No |
| Student | Only `status = 'ready'` recordings for own batch | No | No |

### 5.10 `jobs`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | Yes | Yes (any job, including soft-delete) |
| Teacher | No | No | No |
| Student | All (where `deleted_at IS NULL`) | No | No |

### 5.11 `job_applications`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | No |
| Course Creator | All | No | Status columns only (`status`, `status_changed_at`, `status_changed_by`) — enforced by trigger |
| Teacher | No | No | No |
| Student | Own applications only | Yes (create own) | Own applications only (soft-delete for resubmit) |

### 5.12 `user_sessions`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | No | Deactivate any (`is_active = false`) |
| All users | Own sessions only | Via Edge Function | Own sessions only (`is_active` only — enforced by trigger) |

### 5.13 `system_settings`

| Role | SELECT | INSERT | UPDATE |
|------|--------|--------|--------|
| Admin | All | Yes | Yes |
| All others | No | No | No |

### 5.14 `activity_log`

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
  FROM users
  WHERE role = 'student' AND deleted_at IS NULL
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

---

## 8. Indexes

All primary keys and unique constraints automatically create indexes. These are the additional indexes needed for performance.

| Table | Index | Columns | Reason |
|-------|-------|---------|--------|
| `users` | `idx_users_role` | `role` | Filter users by role (admin pages) |
| `users` | `idx_users_batch_id` | `batch_id` | List students in a batch |
| `users` | `idx_users_status` | `status` | Filter active/inactive users |
| `users` | `idx_users_deleted_at` | `deleted_at` | Soft-delete filter |
| `batches` | `idx_batches_teacher_id` | `teacher_id` | Find batches for a teacher |
| `batches` | `idx_batches_dates` | `start_date, end_date` | Status computation |
| `batches` | `idx_batches_deleted_at` | `deleted_at` | Soft-delete filter |
| `student_batch_history` | `idx_sbh_student_id` | `student_id` | Student's batch history |
| `student_batch_history` | `idx_sbh_batch_id` | `batch_id` | Batch history |
| `batch_courses` | `idx_bc_batch_id` | `batch_id` | Courses for a batch |
| `batch_courses` | `idx_bc_course_id` | `course_id` | Batches for a course |
| `batch_courses` | `idx_bc_deleted_at` | `deleted_at` | Soft-delete filter |
| `courses` | `idx_courses_status` | `status` | Filter by course status |
| `courses` | `idx_courses_deleted_at` | `deleted_at` | Soft-delete filter |
| `lectures` | `idx_lectures_sequence` | `course_id, sequence_order` | Ordered lecture list (also covers course_id-only queries) |
| `lectures` | `idx_lectures_deleted_at` | `deleted_at` | Soft-delete filter |
| `curriculum_modules` | `idx_cm_sequence` | `course_id, sequence_order` | Ordered module list (also covers course_id-only queries) |
| `curriculum_modules` | `idx_cm_deleted_at` | `deleted_at` | Soft-delete filter |
| `zoom_classes` | `idx_zc_batch_id` | `batch_id` | Classes for a batch |
| `zoom_classes` | `idx_zc_teacher_id` | `teacher_id` | Classes for a teacher |
| `zoom_classes` | `idx_zc_status` | `status` | Filter by class status |
| `zoom_classes` | `idx_zc_scheduled` | `scheduled_date, scheduled_time` | Upcoming classes sort |
| `zoom_classes` | `idx_zc_deleted_at` | `deleted_at` | Soft-delete filter |
| `class_recordings` | `idx_cr_zoom_class_id` | `zoom_class_id` | Recordings for a class |
| `class_recordings` | `idx_cr_status` | `status` | Filter ready recordings |
| `class_recordings` | `idx_cr_deleted_at` | `deleted_at` | Soft-delete filter |
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
| `batch_courses` | `uq_active_batch_course` | `batch_id, course_id` | `WHERE deleted_at IS NULL` | One active link per batch-course pair |
| `lectures` | `uq_lecture_sequence` | `course_id, sequence_order` | `WHERE deleted_at IS NULL` | No duplicate ordering |
| `curriculum_modules` | `uq_cm_sequence` | `course_id, sequence_order` | `WHERE deleted_at IS NULL` | No duplicate ordering |
| `job_applications` | `uq_active_application` | `student_id, job_id` | `WHERE deleted_at IS NULL` | One active application per student per job |

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

> **Note**: File size limits and MIME type restrictions are configured via the Supabase Dashboard bucket settings, not via SQL policies. The SQL below only handles access control.

---

## 10. Edge Functions

Serverless functions deployed on Supabase Edge (Deno/TypeScript). All use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.

### 10.1 `generate-signed-video-url`

- **Trigger**: Student or teacher opens a lecture page
- **Logic**: Verify enrollment (student's batch linked to course) -> call Bunny.net API -> return temporary signed URL (expires in 10 minutes)
- **Env vars**: `BUNNY_API_KEY`, `BUNNY_LIBRARY_ID`

### 10.2 `create-zoom-meeting`

- **Trigger**: Teacher schedules a class via the LMS
- **Logic**: Validate teacher owns the batch -> call Zoom API to create meeting -> store `zoom_meeting_id`, `zoom_meeting_url`, `zoom_start_url` in `zoom_classes` table
- **Env vars**: `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_ACCOUNT_ID`

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

Values that are the same in both: `admin`, `teacher`, `student`, `internship`, `remote`, `active`, `inactive`, `upcoming`, `completed`, `applied`, `shortlisted`, `rejected`, `live`, `upload`, `external`.

**Recommended approach**: Create a mapping utility in the frontend:
```typescript
const roleToDb = { 'course-creator': 'course_creator' } as const;
const roleFromDb = { 'course_creator': 'course-creator' } as const;
```

### 11.2 Lecture Type Differences

| Field | Frontend (`lib/types.ts`) | Database (`lectures` table) | Action |
|-------|--------------------------|----------------------------|--------|
| `duration` | `string` ("45 min") | `integer` (seconds) | Convert: display `formatDuration(seconds)` on read, parse to seconds on write |
| `batchId` | Present | Not present | Remove from type. Lectures belong to courses, not batches. Batch info comes via `batch_courses` join. |
| `batchName` | Present | Not present | Same as above — derive from joins |
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
  batch_id      uuid,
  status        user_status NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT chk_batch_id_student_only CHECK ((role = 'student') OR (batch_id IS NULL)),
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

-- Add FK from users.batch_id -> batches.id (deferred because batches didn't exist yet)
ALTER TABLE users
  ADD CONSTRAINT fk_users_batch
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL;

-- 2.3 student_batch_history
CREATE TABLE student_batch_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id      uuid REFERENCES batches(id) ON DELETE SET NULL,
  action        batch_history_action NOT NULL,
  changed_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2.4 courses
CREATE TABLE courses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  status        course_status NOT NULL DEFAULT 'upcoming',
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- 2.5 batch_courses
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

-- 2.6 lectures
CREATE TABLE lectures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
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

-- Unique sequence order per course (among non-deleted lectures)
CREATE UNIQUE INDEX uq_lecture_sequence
  ON lectures (course_id, sequence_order)
  WHERE deleted_at IS NULL;

-- 2.7 curriculum_modules
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

-- 2.8 zoom_classes
CREATE TABLE zoom_classes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  teacher_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  title             text NOT NULL,
  zoom_meeting_id   text,
  zoom_meeting_url  text,
  zoom_start_url    text,
  scheduled_date    date NOT NULL,
  scheduled_time    time NOT NULL,  -- Server timezone must be Asia/Karachi
  duration          integer,
  status            zoom_class_status NOT NULL DEFAULT 'upcoming',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

-- 2.9 class_recordings
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

-- 2.10 jobs
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

-- 2.11 job_applications
CREATE TABLE job_applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  student_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_url          text,
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

-- 2.12 user_sessions
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

-- 2.13 system_settings
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

-- 2.14 activity_log
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
CREATE INDEX idx_users_batch_id ON users(batch_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- batches
CREATE INDEX idx_batches_teacher_id ON batches(teacher_id);
CREATE INDEX idx_batches_dates ON batches(start_date, end_date);
CREATE INDEX idx_batches_deleted_at ON batches(deleted_at);

-- student_batch_history
CREATE INDEX idx_sbh_student_id ON student_batch_history(student_id);
CREATE INDEX idx_sbh_batch_id ON student_batch_history(batch_id);

-- batch_courses
CREATE INDEX idx_bc_batch_id ON batch_courses(batch_id);
CREATE INDEX idx_bc_course_id ON batch_courses(course_id);
CREATE INDEX idx_bc_deleted_at ON batch_courses(deleted_at);

-- courses
CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_courses_deleted_at ON courses(deleted_at);

-- lectures (composite index covers course_id-only queries too)
CREATE INDEX idx_lectures_sequence ON lectures(course_id, sequence_order);
CREATE INDEX idx_lectures_deleted_at ON lectures(deleted_at);

-- curriculum_modules (composite index covers course_id-only queries too)
CREATE INDEX idx_cm_sequence ON curriculum_modules(course_id, sequence_order);
CREATE INDEX idx_cm_deleted_at ON curriculum_modules(deleted_at);

-- zoom_classes
CREATE INDEX idx_zc_batch_id ON zoom_classes(batch_id);
CREATE INDEX idx_zc_teacher_id ON zoom_classes(teacher_id);
CREATE INDEX idx_zc_status ON zoom_classes(status);
CREATE INDEX idx_zc_scheduled ON zoom_classes(scheduled_date, scheduled_time);
CREATE INDEX idx_zc_deleted_at ON zoom_classes(deleted_at);

-- class_recordings
CREATE INDEX idx_cr_zoom_class_id ON class_recordings(zoom_class_id);
CREATE INDEX idx_cr_status ON class_recordings(status);
CREATE INDEX idx_cr_deleted_at ON class_recordings(deleted_at);

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

CREATE TRIGGER set_updated_at BEFORE UPDATE ON batch_courses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON lectures
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON curriculum_modules
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON zoom_classes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON class_recordings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

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

-- Prevent users from changing their own critical columns (role, status, batch_id, email)
-- Admins/CCs updating OTHER users are not affected.
-- service_role bypasses this check.
CREATE OR REPLACE FUNCTION protect_user_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only restrict when a user updates their own row
  IF NEW.id = auth.uid() THEN
    NEW.role := OLD.role;
    NEW.status := OLD.status;
    NEW.batch_id := OLD.batch_id;
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
  FROM users
  WHERE role = 'student' AND deleted_at IS NULL
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

-- Get the current user's batch_id (for students)
-- Returns NULL for non-students or unassigned students — they see zero batches/courses/classes
CREATE OR REPLACE FUNCTION auth_batch_id()
RETURNS uuid AS $$
  SELECT batch_id FROM public.users
  WHERE id = auth.uid() AND deleted_at IS NULL AND status = 'active'
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
ALTER TABLE student_batch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_recordings ENABLE ROW LEVEL SECURITY;
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

-- Admin: update non-admin users
CREATE POLICY admin_update_others ON users
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin' AND (id = auth.uid() OR role != 'admin'))
  WITH CHECK (auth_role() = 'admin');

-- Course Creator: read all users
CREATE POLICY cc_select_users ON users
  FOR SELECT TO authenticated
  USING (auth_role() = 'course_creator');

-- Course Creator: create students only
CREATE POLICY cc_insert_students ON users
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'course_creator' AND role = 'student');

-- Course Creator: update students only
CREATE POLICY cc_update_students ON users
  FOR UPDATE TO authenticated
  USING (auth_role() = 'course_creator' AND role = 'student')
  WITH CHECK (role = 'student');

-- Teacher: read own profile + students in own batches
CREATE POLICY teacher_select_users ON users
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'teacher' AND (
      id = auth.uid() OR
      (role = 'student' AND batch_id IN (
        SELECT id FROM batches WHERE teacher_id = auth.uid() AND deleted_at IS NULL
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

CREATE POLICY student_select_own_batch ON batches
  FOR SELECT TO authenticated
  USING (auth_role() = 'student' AND id = auth_batch_id());

-- -------------------------------------------------------
-- 9.3 student_batch_history
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
-- 9.4 courses
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
      WHERE batch_id = auth_batch_id() AND deleted_at IS NULL
    )
  );

-- -------------------------------------------------------
-- 9.5 batch_courses
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
  USING (auth_role() = 'student' AND batch_id = auth_batch_id());

-- -------------------------------------------------------
-- 9.6 lectures
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
    course_id IN (
      SELECT bc.course_id FROM batch_courses bc
      JOIN batches b ON b.id = bc.batch_id
      WHERE b.teacher_id = auth.uid() AND b.deleted_at IS NULL AND bc.deleted_at IS NULL
    )
  );

CREATE POLICY student_select_lectures ON lectures
  FOR SELECT TO authenticated
  USING (
    auth_role() = 'student' AND
    course_id IN (
      SELECT course_id FROM batch_courses
      WHERE batch_id = auth_batch_id() AND deleted_at IS NULL
    )
  );

-- -------------------------------------------------------
-- 9.7 curriculum_modules
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
      WHERE batch_id = auth_batch_id() AND deleted_at IS NULL
    )
  );

-- -------------------------------------------------------
-- 9.8 zoom_classes
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
  USING (auth_role() = 'student' AND batch_id = auth_batch_id());

-- -------------------------------------------------------
-- 9.9 class_recordings
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
      SELECT id FROM zoom_classes WHERE batch_id = auth_batch_id()
    )
  );

-- -------------------------------------------------------
-- 9.10 jobs
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
-- 9.11 job_applications
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
-- 9.12 user_sessions
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
-- 9.13 system_settings
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
-- 9.14 activity_log
-- -------------------------------------------------------

CREATE POLICY admin_select_log ON activity_log
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

-- Insert is done via service_role in Edge Functions (bypasses RLS)


-- =====================
-- 10. SEED DATA
-- =====================

INSERT INTO system_settings (setting_key, value, description)
VALUES ('max_device_limit', '2', 'Maximum number of concurrent login sessions allowed per user');
```

---

## Appendix: Storage Bucket SQL

Run these in Supabase Dashboard > Storage or via SQL:

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('resumes', 'resumes', false);

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
```
