# ICT Institute LMS — Database Schema

> **Single source of truth** for all database tables, relationships, and SQL.
> Target: **AWS RDS PostgreSQL** (ap-south-1, db.t4g.micro). ORM: **SQLModel** with **Alembic** migrations.
> Access control: enforced in **FastAPI application layer** (not RLS). See `docs/Security.md`.

---

## Table of Contents

1. [Design Decisions](#1-design-decisions)
2. [Tables](#2-tables)
3. [Relationships Diagram](#3-relationships-diagram)
4. [Foreign Key References](#4-foreign-key-references)
5. [Enums](#5-enums)
6. [Database Views](#6-database-views)
7. [Indexes](#7-indexes)
8. [File Storage (S3)](#8-file-storage-s3)
9. [FastAPI Service Endpoints](#9-fastapi-service-endpoints)
10. [AWS RDS Connection Notes](#10-aws-rds-connection-notes)
11. [Alembic Migration Strategy](#11-alembic-migration-strategy)
12. [SQLModel Stubs](#12-sqlmodel-stubs)
13. [Full SQL](#13-full-sql)

---

## 1. Design Decisions

| # | Decision | Impact |
|---|----------|--------|
| 1 | **Soft delete everywhere** | Every table has `deleted_at timestamptz` (NULL = not deleted). Never hard DELETE. Exceptions: `lecture_progress` and `zoom_attendance` have no `deleted_at`. |
| 2 | **Timestamps on everything** | Every table has `created_at` + `updated_at` (auto-set via trigger). Exceptions: `zoom_attendance` (immutable, no `updated_at`), `student_batch_history` and `activity_log` (append-only, no `updated_at`). |
| 3 | **Batch status is computed** | From `start_date` / `end_date` vs `now()`. NOT stored. Use the `batches_with_status` view. |
| 4 | **Course status IS stored** | Manually set by Course Creators. Enum: `upcoming`, `active`, `completed`. |
| 5 | **All CCs share ownership** | Any CC can manage any course, lecture, job, or batch. `created_by` is audit only. |
| 6 | **Students in multiple batches** | Via `student_batches` junction table. `removed_at IS NULL` = active. |
| 7 | **Lectures belong to one batch** | No sharing across batches. Optional `course_id` for grouping/filtering. |
| 8 | **Application resubmit model** | One active application per student per job (partial unique index on `student_id + job_id WHERE deleted_at IS NULL`). |
| 9 | **Configurable device limit** | Default 2. Admin changes via `system_settings`. Enforced by FastAPI login endpoint. |
| 10 | **Activity log is append-only** | No updates, no deletes. Admin read-only. |
| 11 | **Zoom recordings stored separately** | Pipeline: Zoom cloud → Bunny.net → `class_recordings` table. |
| 12 | **Password stored in users table** | `hashed_password` column — bcrypt hash. Not in original Supabase schema (was handled by Supabase Auth). |
| 13 | **No RLS — app-layer security** | All access control enforced in FastAPI middleware/services. See `Security.md` for the RBAC matrix. |
| 14 | **Timezone: Asia/Karachi** | All date comparisons use `AT TIME ZONE 'Asia/Karachi'` in views. |
| 15 | **Zoom credentials encrypted** | `zoom_accounts.client_secret` stored as Fernet-encrypted ciphertext. Decrypted only in FastAPI service. |

---

## 2. Tables

### 2.1 `users`

Central identity table for all roles.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `email` | `text` | NOT NULL, UNIQUE | Used for login |
| `name` | `text` | NOT NULL | Full name |
| `phone` | `text` | | Optional |
| `hashed_password` | `text` | NOT NULL | bcrypt hash (NEW — not in original schema) |
| `role` | `user_role` | NOT NULL | Enum: `admin`, `course_creator`, `teacher`, `student` |
| `specialization` | `text` | | Only for teachers. CHECK enforces NULL for non-teachers. |
| `avatar_url` | `text` | | S3 object key for profile picture |
| `status` | `user_status` | NOT NULL, default `'active'` | Enum: `active`, `inactive` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Auto-updated by trigger |
| `deleted_at` | `timestamptz` | | NULL = not deleted |

**CHECK**: `((role = 'teacher') OR (specialization IS NULL))`

---

### 2.2 `batches`

Student groups over a date range. Status is computed (not stored).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | e.g. "Batch 4 - Spring 2025" |
| `teacher_id` | `uuid` | FK → `users.id` ON DELETE SET NULL | Nullable |
| `start_date` | `date` | NOT NULL | |
| `end_date` | `date` | NOT NULL | CHECK: `end_date > start_date` |
| `created_by` | `uuid` | FK → `users.id` ON DELETE SET NULL | Audit only |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**Computed status** (via `batches_with_status` view):
- `upcoming` — `start_date > today`
- `active` — `start_date <= today AND end_date >= today`
- `completed` — `end_date < today`

Where `today = (now() AT TIME ZONE 'Asia/Karachi')::date`

---

### 2.3 `student_batches`

Many-to-many: students enrolled in batches.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `student_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | |
| `batch_id` | `uuid` | NOT NULL, FK → `batches.id` ON DELETE CASCADE | |
| `enrolled_by` | `uuid` | FK → `users.id` ON DELETE SET NULL | |
| `enrolled_at` | `timestamptz` | NOT NULL, default `now()` | |
| `removed_at` | `timestamptz` | | NULL = active enrollment |
| `removed_by` | `uuid` | FK → `users.id` ON DELETE SET NULL | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Partial unique**: `(student_id, batch_id) WHERE removed_at IS NULL`

---

### 2.4 `student_batch_history`

Append-only audit trail of batch assignments/removals.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `student_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | |
| `batch_id` | `uuid` | FK → `batches.id` ON DELETE SET NULL | |
| `action` | `batch_history_action` | NOT NULL | `assigned` or `removed` |
| `changed_by` | `uuid` | FK → `users.id` ON DELETE SET NULL | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

---

### 2.5 `courses`

Course content containers. Status is stored (manually set).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `title` | `text` | NOT NULL | |
| `description` | `text` | | |
| `status` | `course_status` | NOT NULL, default `'upcoming'` | `upcoming`, `active`, `completed` |
| `cloned_from_id` | `uuid` | FK → `courses.id` ON DELETE SET NULL | For cloned courses |
| `created_by` | `uuid` | FK → `users.id` ON DELETE SET NULL | Audit only |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

---

### 2.6 `batch_courses`

Many-to-many: batches linked to courses.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `batch_id` | `uuid` | NOT NULL, FK → `batches.id` ON DELETE CASCADE | |
| `course_id` | `uuid` | NOT NULL, FK → `courses.id` ON DELETE CASCADE | |
| `assigned_at` | `timestamptz` | NOT NULL, default `now()` | |
| `assigned_by` | `uuid` | FK → `users.id` ON DELETE SET NULL | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**Partial unique**: `(batch_id, course_id) WHERE deleted_at IS NULL`

---

### 2.7 `lectures`

Video lessons within a batch. Supports uploads (Bunny.net) and external links.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `batch_id` | `uuid` | NOT NULL, FK → `batches.id` ON DELETE CASCADE | |
| `course_id` | `uuid` | FK → `courses.id` ON DELETE SET NULL | Optional grouping |
| `title` | `text` | NOT NULL | |
| `description` | `text` | | |
| `duration` | `integer` | | Seconds |
| `file_size` | `bigint` | | Bytes |
| `video_type` | `video_type` | NOT NULL | `upload` or `external` |
| `video_url` | `text` | | For external links |
| `bunny_video_id` | `text` | | For Bunny.net uploads |
| `bunny_library_id` | `text` | | For Bunny.net uploads |
| `thumbnail_url` | `text` | | |
| `sequence_order` | `integer` | NOT NULL | |
| `created_by` | `uuid` | FK → `users.id` ON DELETE SET NULL | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**CHECK**: `((video_type = 'upload' AND bunny_video_id IS NOT NULL) OR (video_type = 'external' AND video_url IS NOT NULL))`
**Partial unique**: `(batch_id, sequence_order) WHERE deleted_at IS NULL`

---

### 2.8 `curriculum_modules`

Course outline. Topics stored as `text[]`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `course_id` | `uuid` | NOT NULL, FK → `courses.id` ON DELETE CASCADE | |
| `title` | `text` | NOT NULL | |
| `description` | `text` | | |
| `sequence_order` | `integer` | NOT NULL | |
| `topics` | `text[]` | | Array of topic strings |
| `created_by` | `uuid` | FK → `users.id` ON DELETE SET NULL | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**Partial unique**: `(course_id, sequence_order) WHERE deleted_at IS NULL`

---

### 2.9 `batch_materials`

Downloadable documents attached to a batch. Files stored in AWS S3.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `batch_id` | `uuid` | NOT NULL, FK → `batches.id` ON DELETE CASCADE | |
| `course_id` | `uuid` | FK → `courses.id` ON DELETE SET NULL | Optional grouping |
| `title` | `text` | NOT NULL | |
| `description` | `text` | | |
| `file_name` | `text` | NOT NULL | Original filename |
| `file_path` | `text` | NOT NULL | S3 object key |
| `file_type` | `material_file_type` | NOT NULL | `pdf`, `excel`, `word`, `pptx`, `image`, `archive`, `other` |
| `file_size` | `bigint` | | Bytes |
| `mime_type` | `text` | | |
| `uploaded_by` | `uuid` | FK → `users.id` ON DELETE SET NULL | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

---

### 2.10 `zoom_accounts`

Admin-configured Zoom OAuth credentials. `client_secret` is Fernet-encrypted.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `account_name` | `text` | NOT NULL | Display name |
| `account_id` | `text` | NOT NULL | Zoom Account ID |
| `client_id` | `text` | NOT NULL | OAuth Client ID |
| `client_secret` | `text` | NOT NULL | **Fernet-encrypted** ciphertext |
| `is_default` | `boolean` | NOT NULL, default `false` | Only one should be true |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

---

### 2.11 `zoom_classes`

Scheduled Zoom meetings.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `batch_id` | `uuid` | NOT NULL, FK → `batches.id` ON DELETE CASCADE | |
| `teacher_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE SET NULL | |
| `zoom_account_id` | `uuid` | NOT NULL, FK → `zoom_accounts.id` ON DELETE SET NULL | |
| `title` | `text` | NOT NULL | |
| `scheduled_date` | `date` | NOT NULL | |
| `scheduled_time` | `time` | NOT NULL | No timezone — single timezone institute |
| `duration` | `integer` | NOT NULL | Minutes |
| `zoom_meeting_id` | `text` | | From Zoom API response |
| `zoom_meeting_url` | `text` | | Join URL |
| `zoom_start_url` | `text` | | Host URL |
| `status` | `zoom_class_status` | NOT NULL, default `'upcoming'` | `upcoming`, `live`, `completed` |
| `reminder_sent` | `boolean` | NOT NULL, default `false` | For APScheduler reminder job |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

---

### 2.12 `class_recordings`

Zoom recordings processed through Bunny.net.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `zoom_class_id` | `uuid` | NOT NULL, FK → `zoom_classes.id` ON DELETE CASCADE | |
| `bunny_video_id` | `text` | | After Bunny.net upload |
| `bunny_library_id` | `text` | | |
| `original_download_url` | `text` | | From Zoom (temporary) |
| `duration` | `integer` | | Seconds |
| `file_size` | `bigint` | | Bytes |
| `status` | `recording_status` | NOT NULL, default `'processing'` | `processing`, `ready`, `failed` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

---

### 2.13 `announcements`

Scope-based: `institute`, `batch`, or `course`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `title` | `text` | NOT NULL | |
| `content` | `text` | NOT NULL | |
| `scope` | `announcement_scope` | NOT NULL | `institute`, `batch`, `course` |
| `batch_id` | `uuid` | FK → `batches.id` ON DELETE CASCADE | Required when scope = `batch` |
| `course_id` | `uuid` | FK → `courses.id` ON DELETE CASCADE | Required when scope = `course` |
| `posted_by` | `uuid` | FK → `users.id` ON DELETE SET NULL | |
| `expires_at` | `timestamptz` | | Optional expiry |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**CHECK**: Enforces scope consistency:
- `institute` → both `batch_id` and `course_id` must be NULL
- `batch` → `batch_id` NOT NULL, `course_id` NULL
- `course` → `course_id` NOT NULL, `batch_id` NULL

---

### 2.14 `lecture_progress`

Per-student per-lecture watch tracking. UPSERT pattern. No `deleted_at`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `student_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | |
| `lecture_id` | `uuid` | NOT NULL, FK → `lectures.id` ON DELETE CASCADE | |
| `watch_percentage` | `integer` | NOT NULL, default `0` | 0-100 |
| `resume_position_seconds` | `integer` | NOT NULL, default `0` | |
| `status` | `lecture_watch_status` | NOT NULL, default `'unwatched'` | `unwatched`, `in_progress`, `completed` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Unique**: `(student_id, lecture_id)` — one row per student per lecture (UPSERT)

---

### 2.15 `zoom_attendance`

Immutable attendance records. INSERT-only.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `zoom_class_id` | `uuid` | NOT NULL, FK → `zoom_classes.id` ON DELETE CASCADE | |
| `student_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | |
| `attended` | `boolean` | NOT NULL | `true` = joined, `false` = did not join |
| `join_time` | `timestamptz` | | From Zoom API |
| `leave_time` | `timestamptz` | | From Zoom API |
| `duration_minutes` | `integer` | | Time in meeting |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Unique**: `(zoom_class_id, student_id)` — one attendance record per student per class

---

### 2.16 `jobs`

Job postings by Course Creators.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `title` | `text` | NOT NULL | |
| `company` | `text` | NOT NULL | |
| `location` | `text` | | |
| `job_type` | `job_type` | NOT NULL | `full_time`, `part_time`, `internship`, `remote` |
| `salary` | `text` | | Display string e.g. "PKR 35,000-45,000" |
| `description` | `text` | | |
| `requirements` | `text[]` | | Array of requirement strings |
| `deadline` | `date` | | Application deadline |
| `posted_by` | `uuid` | FK → `users.id` ON DELETE SET NULL | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

---

### 2.17 `job_applications`

Student applications. Resubmit model (soft-delete old, create new).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `job_id` | `uuid` | NOT NULL, FK → `jobs.id` ON DELETE RESTRICT | Prevent hard-delete of jobs with applications |
| `student_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | |
| `resume_url` | `text` | | S3 object key |
| `cover_letter` | `text` | | |
| `status` | `application_status` | NOT NULL, default `'applied'` | `applied`, `shortlisted`, `rejected` |
| `status_changed_at` | `timestamptz` | | |
| `status_changed_by` | `uuid` | FK → `users.id` ON DELETE SET NULL | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |
| `deleted_at` | `timestamptz` | | |

**Partial unique**: `(student_id, job_id) WHERE deleted_at IS NULL`

---

### 2.18 `user_sessions`

Active login sessions for device tracking.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | |
| `session_token` | `text` | NOT NULL | bcrypt hash of refresh token |
| `device_info` | `text` | | Parsed User-Agent |
| `ip_address` | `text` | | |
| `is_active` | `boolean` | NOT NULL, default `true` | `false` = logged out |
| `logged_in_at` | `timestamptz` | NOT NULL, default `now()` | |
| `last_active_at` | `timestamptz` | NOT NULL, default `now()` | Updated on each refresh |
| `expires_at` | `timestamptz` | | Refresh token expiry (7 days from login) |

---

### 2.19 `system_settings`

Key-value configuration store.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `setting_key` | `text` | NOT NULL, UNIQUE | |
| `value` | `text` | NOT NULL | |
| `description` | `text` | | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Seed data:**
```sql
INSERT INTO system_settings (setting_key, value, description) VALUES
  ('max_device_limit', '2', 'Maximum concurrent login sessions per user'),
  ('post_batch_grace_period_days', '90', 'Days after batch end that students retain read-only access');
```

---

### 2.20 `activity_log`

Append-only audit trail. No updates, no deletes.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | FK → `users.id` ON DELETE SET NULL | Who performed the action |
| `action` | `text` | NOT NULL | e.g. `user.created`, `batch.updated` |
| `entity_type` | `text` | NOT NULL | e.g. `user`, `batch`, `course` |
| `entity_id` | `uuid` | | Which record was affected |
| `details` | `jsonb` | | Extra context |
| `ip_address` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

---

## 3. Relationships Diagram

```
                              users
                           (all 4 roles)
                    ┌──────────┼──────────┐
                    │          │          │
            student_batches  batches   zoom_accounts
                    │     ┌────┴────┐        │
                    │     │         │        │
                    │  batch_courses  zoom_classes ─── class_recordings
                    │     │              │
                    │   courses      zoom_attendance
                    │     │
                    │  ┌──┴──────┐
                    │  │         │
                    │ lectures  curriculum_modules
                    │  │
                    │ lecture_progress
                    │
           ┌────────┴────────┐
           │                 │
    batch_materials   announcements

           jobs ──── job_applications

    user_sessions    system_settings    activity_log
```

---

## 4. Foreign Key References

| Table | Column | References | ON DELETE |
|-------|--------|------------|-----------|
| batches | teacher_id | users.id | SET NULL |
| batches | created_by | users.id | SET NULL |
| student_batches | student_id | users.id | CASCADE |
| student_batches | batch_id | batches.id | CASCADE |
| student_batches | enrolled_by | users.id | SET NULL |
| student_batches | removed_by | users.id | SET NULL |
| student_batch_history | student_id | users.id | CASCADE |
| student_batch_history | batch_id | batches.id | SET NULL |
| student_batch_history | changed_by | users.id | SET NULL |
| batch_courses | batch_id | batches.id | CASCADE |
| batch_courses | course_id | courses.id | CASCADE |
| batch_courses | assigned_by | users.id | SET NULL |
| courses | cloned_from_id | courses.id | SET NULL |
| courses | created_by | users.id | SET NULL |
| lectures | batch_id | batches.id | CASCADE |
| lectures | course_id | courses.id | SET NULL |
| lectures | created_by | users.id | SET NULL |
| curriculum_modules | course_id | courses.id | CASCADE |
| curriculum_modules | created_by | users.id | SET NULL |
| batch_materials | batch_id | batches.id | CASCADE |
| batch_materials | course_id | courses.id | SET NULL |
| batch_materials | uploaded_by | users.id | SET NULL |
| zoom_classes | batch_id | batches.id | CASCADE |
| zoom_classes | teacher_id | users.id | SET NULL |
| zoom_classes | zoom_account_id | zoom_accounts.id | SET NULL |
| class_recordings | zoom_class_id | zoom_classes.id | CASCADE |
| announcements | batch_id | batches.id | CASCADE |
| announcements | course_id | courses.id | CASCADE |
| announcements | posted_by | users.id | SET NULL |
| lecture_progress | student_id | users.id | CASCADE |
| lecture_progress | lecture_id | lectures.id | CASCADE |
| zoom_attendance | zoom_class_id | zoom_classes.id | CASCADE |
| zoom_attendance | student_id | users.id | CASCADE |
| jobs | posted_by | users.id | SET NULL |
| job_applications | job_id | jobs.id | **RESTRICT** |
| job_applications | student_id | users.id | CASCADE |
| job_applications | status_changed_by | users.id | SET NULL |
| user_sessions | user_id | users.id | CASCADE |
| activity_log | user_id | users.id | SET NULL |

**Total: 37 foreign keys**

---

## 5. Enums

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

## 6. Database Views

### `batches_with_status`

Adds computed status to batches.

```sql
CREATE VIEW batches_with_status AS
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

### `batches_with_counts`

Extends `batches_with_status` with student and course counts.

```sql
CREATE VIEW batches_with_counts AS
SELECT
    bws.*,
    COALESCE(sc.student_count, 0) AS student_count,
    COALESCE(cc.course_count, 0) AS course_count
FROM batches_with_status bws
LEFT JOIN (
    SELECT batch_id, COUNT(*) AS student_count
    FROM student_batches
    WHERE removed_at IS NULL
    GROUP BY batch_id
) sc ON sc.batch_id = bws.id
LEFT JOIN (
    SELECT batch_id, COUNT(*) AS course_count
    FROM batch_courses
    WHERE deleted_at IS NULL
    GROUP BY batch_id
) cc ON cc.batch_id = bws.id;
```

---

## 7. Indexes

Beyond auto-created PK and UNIQUE indexes:

```sql
-- users
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- batches
CREATE INDEX idx_batches_teacher_id ON batches(teacher_id);
CREATE INDEX idx_batches_dates ON batches(start_date, end_date);
CREATE INDEX idx_batches_deleted_at ON batches(deleted_at);

-- student_batches
CREATE INDEX idx_student_batches_student ON student_batches(student_id);
CREATE INDEX idx_student_batches_batch ON student_batches(batch_id);
CREATE INDEX idx_student_batches_removed ON student_batches(removed_at);

-- lectures
CREATE INDEX idx_lectures_batch_order ON lectures(batch_id, sequence_order);
CREATE INDEX idx_lectures_course ON lectures(course_id);
CREATE INDEX idx_lectures_deleted ON lectures(deleted_at);

-- zoom_classes
CREATE INDEX idx_zoom_classes_batch ON zoom_classes(batch_id);
CREATE INDEX idx_zoom_classes_teacher ON zoom_classes(teacher_id);
CREATE INDEX idx_zoom_classes_status ON zoom_classes(status);
CREATE INDEX idx_zoom_classes_schedule ON zoom_classes(scheduled_date, scheduled_time);
CREATE INDEX idx_zoom_classes_deleted ON zoom_classes(deleted_at);

-- announcements
CREATE INDEX idx_announcements_scope ON announcements(scope);
CREATE INDEX idx_announcements_batch ON announcements(batch_id);
CREATE INDEX idx_announcements_course ON announcements(course_id);
CREATE INDEX idx_announcements_expires ON announcements(expires_at);

-- user_sessions
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_user_active ON user_sessions(user_id, is_active);
CREATE INDEX idx_sessions_last_active ON user_sessions(last_active_at);

-- activity_log
CREATE INDEX idx_activity_user ON activity_log(user_id);
CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_action ON activity_log(action);
CREATE INDEX idx_activity_created ON activity_log(created_at);
```

---

## 8. File Storage (S3)

Videos are on Bunny.net. Non-video files are on AWS S3.

| Bucket | Contents | Path pattern | Max size |
|--------|----------|-------------|----------|
| `ict-lms-resumes` | Student resumes | `resumes/{student_id}/{uuid}_{filename}` | 10 MB |
| `ict-lms-avatars` | Profile pictures | `avatars/{user_id}/{uuid}_{filename}` | 2 MB |
| `ict-lms-materials` | Course materials | `materials/{batch_id}/{uuid}_{filename}` | 100 MB |
| `ict-lms-exports` | Admin CSV/PDF exports | `exports/{date}_{entity}_{uuid}.{ext}` | Auto-deleted after 24h |

All buckets: Block ALL public access. Files served via S3 pre-signed URLs only.

---

## 9. FastAPI Service Endpoints

These replace the 10 Supabase Edge Functions:

| # | Original Edge Function | FastAPI Equivalent |
|---|----------------------|-------------------|
| 1 | `generate-signed-video-url` | `POST /api/v1/lectures/{id}/signed-url` |
| 2 | `create-zoom-meeting` | Inside `POST /api/v1/zoom/classes` handler |
| 3 | `sync-zoom-status` | `POST /api/v1/zoom/webhook` handler |
| 4 | `enforce-device-limit` | Inside `POST /api/v1/auth/login` handler |
| 5 | `process-recording` | Inside webhook handler + `zoom_service.process_recording()` |
| 6 | `send-zoom-reminder` | APScheduler cron job in `scheduler/jobs.py` |
| 7 | `fetch-zoom-attendance` | Inside webhook handler + `zoom_service.fetch_attendance()` |
| 8 | `bulk-import-users` | `POST /api/v1/users/bulk-import` |
| 9 | `export-data` | `GET /api/v1/admin/export/{entity_type}` |
| 10 | `clone-course` | `POST /api/v1/courses/{id}/clone` |

---

## 10. AWS RDS Connection Notes

**RDS Instance:**

| Property | Value |
|----------|-------|
| Instance ID | `ict-lms-db` |
| Instance Class | `db.t4g.micro` |
| Storage | 20 GB (gp3) |
| Region | `ap-south-1` (Mumbai) |
| Endpoint | `ict-lms-db.c5i8iasqgtzx.ap-south-1.rds.amazonaws.com` |
| Port | `5432` |

**Connection string format:**

```
postgresql+asyncpg://<user>:<password>@ict-lms-db.c5i8iasqgtzx.ap-south-1.rds.amazonaws.com:5432/<dbname>
```

- FastAPI (`DATABASE_URL`): uses the connection string above with asyncpg driver
- Alembic (`DATABASE_URL_DIRECT`): can use the same endpoint (no pooler distinction needed unlike Neon)

**Staging / dev environments:**

RDS does not have Neon-style database branching. Use one of these approaches instead:
- **Separate RDS instance** for staging (e.g., `ict-lms-db-staging`)
- **RDS snapshots** to clone production data for testing (`aws rds restore-db-instance-from-db-snapshot`)
- **pg_dump / pg_restore** for lightweight dev copies

---

## 11. Alembic Migration Strategy

- Alembic config: `backend/alembic.ini`
- Env file: `backend/migrations/env.py` (uses async engine)
- Target metadata: `SQLModel.metadata` (auto-discovers all models)
- Initial migration: `backend/migrations/versions/001_initial_schema.py` (all 20 tables, 12 enums, indexes, views)

**Rules:**
1. Never modify a migration after it has been applied to production
2. Always create new migrations for schema changes
3. Use `alembic revision --autogenerate -m "description"` to generate
4. Review auto-generated migrations before applying — Alembic may miss some changes
5. Test migrations on a staging RDS instance or snapshot before applying to production

---

## 12. SQLModel Stubs

Reference stubs for the most important models. Full implementations go in `backend/app/models/`.

```python
# models/user.py
import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from app.models.enums import UserRole, UserStatus

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    phone: Optional[str] = None
    hashed_password: str
    role: UserRole
    specialization: Optional[str] = None
    avatar_url: Optional[str] = None
    status: UserStatus = Field(default=UserStatus.active)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


# models/batch.py
class Batch(SQLModel, table=True):
    __tablename__ = "batches"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    teacher_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    start_date: date
    end_date: date
    created_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


# models/course.py
class Lecture(SQLModel, table=True):
    __tablename__ = "lectures"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    batch_id: uuid.UUID = Field(foreign_key="batches.id")
    course_id: Optional[uuid.UUID] = Field(default=None, foreign_key="courses.id")
    title: str
    description: Optional[str] = None
    duration: Optional[int] = None          # seconds
    file_size: Optional[int] = None         # bytes
    video_type: VideoType
    video_url: Optional[str] = None
    bunny_video_id: Optional[str] = None
    bunny_library_id: Optional[str] = None
    sequence_order: int
    created_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None
```

---

## 13. Full SQL

### Create Types

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

### Auto-update Trigger Function

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Create Tables

```sql
-- 2.1 users
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    name text NOT NULL,
    phone text,
    hashed_password text NOT NULL,
    role user_role NOT NULL,
    specialization text,
    avatar_url text,
    status user_status NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK ((role = 'teacher') OR (specialization IS NULL))
);
CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.2 batches
CREATE TABLE batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK (end_date > start_date)
);
CREATE TRIGGER set_batches_updated_at BEFORE UPDATE ON batches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.3 student_batches
CREATE TABLE student_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    enrolled_by uuid REFERENCES users(id) ON DELETE SET NULL,
    enrolled_at timestamptz NOT NULL DEFAULT now(),
    removed_at timestamptz,
    removed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_student_batches_active ON student_batches(student_id, batch_id) WHERE removed_at IS NULL;
CREATE TRIGGER set_student_batches_updated_at BEFORE UPDATE ON student_batches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.4 student_batch_history
CREATE TABLE student_batch_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
    action batch_history_action NOT NULL,
    changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.5 courses
CREATE TABLE courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    status course_status NOT NULL DEFAULT 'upcoming',
    cloned_from_id uuid REFERENCES courses(id) ON DELETE SET NULL,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE TRIGGER set_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.6 batch_courses
CREATE TABLE batch_courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE UNIQUE INDEX idx_batch_courses_active ON batch_courses(batch_id, course_id) WHERE deleted_at IS NULL;
CREATE TRIGGER set_batch_courses_updated_at BEFORE UPDATE ON batch_courses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.7 lectures
CREATE TABLE lectures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    duration integer,
    file_size bigint,
    video_type video_type NOT NULL,
    video_url text,
    bunny_video_id text,
    bunny_library_id text,
    thumbnail_url text,
    sequence_order integer NOT NULL,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK ((video_type = 'upload' AND bunny_video_id IS NOT NULL) OR (video_type = 'external' AND video_url IS NOT NULL))
);
CREATE UNIQUE INDEX idx_lectures_batch_order ON lectures(batch_id, sequence_order) WHERE deleted_at IS NULL;
CREATE TRIGGER set_lectures_updated_at BEFORE UPDATE ON lectures
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.8 curriculum_modules
CREATE TABLE curriculum_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    sequence_order integer NOT NULL,
    topics text[],
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE UNIQUE INDEX idx_curriculum_course_order ON curriculum_modules(course_id, sequence_order) WHERE deleted_at IS NULL;
CREATE TRIGGER set_curriculum_updated_at BEFORE UPDATE ON curriculum_modules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.9 batch_materials
CREATE TABLE batch_materials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_type material_file_type NOT NULL,
    file_size bigint,
    mime_type text,
    uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE TRIGGER set_materials_updated_at BEFORE UPDATE ON batch_materials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.10 zoom_accounts
CREATE TABLE zoom_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name text NOT NULL,
    account_id text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE TRIGGER set_zoom_accounts_updated_at BEFORE UPDATE ON zoom_accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.11 zoom_classes
CREATE TABLE zoom_classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    zoom_account_id uuid NOT NULL REFERENCES zoom_accounts(id) ON DELETE SET NULL,
    title text NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_time time NOT NULL,
    duration integer NOT NULL,
    zoom_meeting_id text,
    zoom_meeting_url text,
    zoom_start_url text,
    status zoom_class_status NOT NULL DEFAULT 'upcoming',
    reminder_sent boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE TRIGGER set_zoom_classes_updated_at BEFORE UPDATE ON zoom_classes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.12 class_recordings
CREATE TABLE class_recordings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    zoom_class_id uuid NOT NULL REFERENCES zoom_classes(id) ON DELETE CASCADE,
    bunny_video_id text,
    bunny_library_id text,
    original_download_url text,
    duration integer,
    file_size bigint,
    status recording_status NOT NULL DEFAULT 'processing',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_recordings_updated_at BEFORE UPDATE ON class_recordings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.13 announcements
CREATE TABLE announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    content text NOT NULL,
    scope announcement_scope NOT NULL,
    batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
    course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
    posted_by uuid REFERENCES users(id) ON DELETE SET NULL,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK (
        (scope = 'institute' AND batch_id IS NULL AND course_id IS NULL) OR
        (scope = 'batch' AND batch_id IS NOT NULL AND course_id IS NULL) OR
        (scope = 'course' AND course_id IS NOT NULL AND batch_id IS NULL)
    )
);
CREATE TRIGGER set_announcements_updated_at BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.14 lecture_progress
CREATE TABLE lecture_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    watch_percentage integer NOT NULL DEFAULT 0,
    resume_position_seconds integer NOT NULL DEFAULT 0,
    status lecture_watch_status NOT NULL DEFAULT 'unwatched',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(student_id, lecture_id)
);
CREATE TRIGGER set_progress_updated_at BEFORE UPDATE ON lecture_progress
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.15 zoom_attendance
CREATE TABLE zoom_attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    zoom_class_id uuid NOT NULL REFERENCES zoom_classes(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attended boolean NOT NULL,
    join_time timestamptz,
    leave_time timestamptz,
    duration_minutes integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(zoom_class_id, student_id)
);

-- 2.16 jobs
CREATE TABLE jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    company text NOT NULL,
    location text,
    job_type job_type NOT NULL,
    salary text,
    description text,
    requirements text[],
    deadline date,
    posted_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE TRIGGER set_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.17 job_applications
CREATE TABLE job_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_url text,
    cover_letter text,
    status application_status NOT NULL DEFAULT 'applied',
    status_changed_at timestamptz,
    status_changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE UNIQUE INDEX idx_applications_active ON job_applications(student_id, job_id) WHERE deleted_at IS NULL;
CREATE TRIGGER set_applications_updated_at BEFORE UPDATE ON job_applications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.18 user_sessions
CREATE TABLE user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token text NOT NULL,
    device_info text,
    ip_address text,
    is_active boolean NOT NULL DEFAULT true,
    logged_in_at timestamptz NOT NULL DEFAULT now(),
    last_active_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz
);

-- 2.19 system_settings
CREATE TABLE system_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key text NOT NULL UNIQUE,
    value text NOT NULL,
    description text,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.20 activity_log
CREATE TABLE activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    details jsonb,
    ip_address text,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

### Seed Data

```sql
INSERT INTO system_settings (setting_key, value, description) VALUES
    ('max_device_limit', '2', 'Maximum concurrent login sessions per user'),
    ('post_batch_grace_period_days', '90', 'Days after batch end that students retain read-only access');
```
