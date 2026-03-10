# ICT LMS - Complete Architecture

> 22 Tables | 4 User Roles | FastAPI + Next.js | PostgreSQL (AWS RDS)

---

## User Roles

| Role | What They Do |
|------|-------------|
| **Admin** | Manages users, batches, system settings, full access to everything |
| **Course Creator** | Creates courses, lectures, curriculum modules, approves certificates |
| **Teacher** | Assigned to batches, conducts Zoom classes, uploads materials |
| **Student** | Enrolled in batches, watches lectures, earns certificates, applies to jobs |

---

## How Everything Connects

```
                    ┌──────────┐
                    │   USER   │  (admin / course_creator / teacher / student)
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────────┐
          │              │                  │
     creates/manages   teaches          enrolls in
          │              │                  │
          ▼              ▼                  ▼
    ┌──────────┐   ┌──────────┐     ┌──────────────┐
    │  COURSE  │   │  BATCH   │◄────│ StudentBatch │ (enrollment join table)
    └────┬─────┘   └────┬─────┘     └──────────────┘
         │              │
         └──────┬───────┘
                │
          ┌─────┴──────┐
          │ BatchCourse │  (assigns courses to batches — many-to-many)
          └────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌─────────────┐
│Lecture │ │Material│ │  ZoomClass  │
│(video) │ │(files) │ │  (live)     │
└───┬────┘ └────────┘ └──────┬──────┘
    │                        │
    ▼                        ▼
┌──────────────┐     ┌──────────────┐
│LectureProgress│    │ZoomAttendance│
│(watch %)     │     │(join/leave)  │
└──────┬───────┘     └──────────────┘
       │
       ▼
┌─────────────┐
│ CERTIFICATE │  (when completion % >= threshold)
└─────────────┘
```

---

## Entity Details

### Batch Management (Cohorts)

**Batch** (`batches`)
- A cohort/class of students studying together
- Has a `teacher_id` (assigned teacher) and `created_by` (admin who created it)
- Has `start_date` and `end_date`

**StudentBatch** (`student_batches`)
- Join table: links Students to Batches (enrollment)
- Tracks `enrolled_by`, `enrolled_at`, `removed_at` (soft-remove)
- Unique constraint: one active enrollment per student per batch

**BatchCourse** (`batch_courses`)
- Join table: links Courses to Batches (many-to-many)
- A batch can have multiple courses, a course can be in multiple batches
- Tracks `assigned_by`

**StudentBatchHistory** (`student_batch_history`)
- Audit trail for enrollment changes
- Records `action` (assigned/removed) and `changed_by`

---

### Course & Content

**Course** (`courses`)
- Created by Course Creator
- Has `title`, `description`, `status` (upcoming/active/completed)
- Can be cloned from another course (`cloned_from_id` self-reference)

**Lecture** (`lectures`)
- Video content within a batch-course
- `video_type`: upload (Bunny.net) or external (YouTube/Vimeo URL)
- `bunny_video_id` + `video_status` (pending → processing → ready/failed)
- Ordered by `sequence_order`

**CurriculumModule** (`curriculum_modules`)
- Course structure/syllabus units
- `course_id`, `title`, `sequence_order`, `topics[]` (string array)

**BatchMaterial** (`batch_materials`)
- Downloadable files: PDFs, docs, spreadsheets, presentations
- Stored in S3 (`file_path`)
- `file_type`: pdf/excel/word/pptx/image/archive/other

---

### Zoom / Live Classes

**ZoomAccount** (`zoom_accounts`)
- Stores Zoom API credentials (client_id, client_secret encrypted with Fernet)
- Supports multiple Zoom accounts, one marked `is_default`

**ZoomClass** (`zoom_classes`)
- Live class sessions linked to a Batch + Teacher
- `scheduled_date`, `scheduled_time`, `duration`
- Backend creates Zoom meeting via API → stores `zoom_meeting_id`, `zoom_meeting_url`
- `status`: upcoming → live → completed

**ClassRecording** (`class_recordings`)
- Zoom recording uploaded to Bunny.net after class ends
- `zoom_class_id`, `bunny_video_id`, `status` (processing/ready/failed)

**ZoomAttendance** (`zoom_attendance`)
- Tracks student presence in Zoom classes
- `attended` (bool), `join_time`, `leave_time`, `duration_minutes`

---

### Learning Progress

**LectureProgress** (`lecture_progress`)
- One entry per student per lecture
- `watch_percentage` (0-100%), `resume_position_seconds`
- `status`: unwatched → in_progress → completed
- This is the core data used to calculate certificate eligibility

---

### Certificates

**Certificate** (`certificates`)
- Unique per (student, batch, course) combination
- `certificate_name`: student's chosen name for the PDF
- `certificate_id`: human-readable ID like `ICT-2026-00001`
- `verification_code`: 12-char alphanumeric for public verification
- `status`: eligible (requested) → approved (issued) → revoked
- `completion_percentage`, `requested_at`
- Approval tracking: `approved_by`, `approved_at`, `issued_at`
- Revocation tracking: `revoked_by`, `revoked_at`, `revocation_reason`
- `pdf_path`: S3 location of the generated PDF

**CertificateCounter** (`certificate_counter`)
- Single-row table for atomic sequential ID generation
- `current_year` + `last_sequence` → `ICT-{year}-{seq:05d}`

---

### Jobs & Placements

**Job** (`jobs`)
- Job postings with `title`, `company`, `location`, `salary`, `deadline`
- `job_type`: full_time/part_time/internship/remote
- `requirements[]` (string array)
- `posted_by` → User (admin/teacher)

**JobApplication** (`job_applications`)
- Students apply to jobs
- `resume_url` (S3), `cover_letter`
- `status`: applied → shortlisted/rejected
- Unique per (student, job)

---

### Communications

**Announcement** (`announcements`)
- `scope`: institute (all users), batch (specific batch), course (specific course)
- Optional `batch_id` and `course_id` for scoped announcements
- `posted_by`, `expires_at`

---

### System & Security

**User** (`users`)
- `email` (unique), `name`, `phone`, `password_hash`, `avatar_url`
- `role`: admin/course_creator/teacher/student
- `status`: active/inactive
- `specialization` (for teachers)

**UserSession** (`user_sessions`)
- Multi-device session tracking
- `session_token`, `device_info`, `ip_address`, `is_active`
- `logged_in_at`, `last_active_at`, `expires_at`
- Used for device limit enforcement

**SystemSetting** (`system_settings`)
- Key-value config: `setting_key` (unique) + `value`
- Examples: `max_devices_per_user`, `certificate_completion_threshold`, `session_timeout`

**ActivityLog** (`activity_log`)
- Audit trail: `user_id`, `action`, `entity_type`, `entity_id`
- `details` (JSONB), `ip_address`

---

## Key Relationships Summary

| Relationship | Type | Via |
|-------------|------|-----|
| Student ↔ Batch | Many-to-Many | `StudentBatch` |
| Batch ↔ Course | Many-to-Many | `BatchCourse` |
| Student ↔ Lecture | Many-to-Many | `LectureProgress` |
| Student ↔ Job | Many-to-Many | `JobApplication` |
| Student ↔ ZoomClass | Many-to-Many | `ZoomAttendance` |
| Teacher → Batch | One-to-Many | `teacher_id` FK |
| Course Creator → Course | One-to-Many | `created_by` FK |
| Certificate → (Student, Batch, Course) | Unique | composite unique constraint |
| ZoomClass → ClassRecording | One-to-Many | `zoom_class_id` FK |
| Course → CurriculumModule | One-to-Many | `course_id` FK |

---

## Core Data Flows

### 1. Course Creation & Enrollment

```
Course Creator creates Course
    → adds Lectures (video via Bunny.net) + CurriculumModules
        → Admin creates Batch, assigns Teacher
            → Admin links Course to Batch (BatchCourse)
                → Admin enrolls Students (StudentBatch)
                    → Students can access Lectures in their Batch's Courses
```

### 2. Video Upload & Playback (Bunny.net)

```
CC calls POST /lectures/upload-init
    → Backend creates Bunny entry, returns TUS upload URL
        → Frontend uploads directly to Bunny (TUS protocol, 50MB chunks)
            → Bunny encodes: video_status = pending → processing → ready
                → Student calls POST /lectures/{id}/signed-url
                    → Watches in iframe with student email watermark
```

### 3. Certificate Flow

```
Student watches Lectures → LectureProgress tracked (watch_percentage)
    → Completion % calculated across all batch-course lectures
        → Reaches threshold (default 70%) → status: "eligible" on dashboard
            → Student clicks "Request Certificate", enters custom name
                → Certificate record created (status=eligible, requested_at set)
                    → CC sees request in Approval Queue
                        → CC approves → cert_id + PDF generated → status: "approved"
                            → Student downloads PDF / public verify via QR code
```

### 4. Zoom Class & Recording

```
Teacher creates ZoomClass (date, time, batch)
    → Backend creates Zoom meeting via API → gets meeting URL
        → Students join → ZoomAttendance tracked (join_time, leave_time)
            → Class ends → Zoom recording webhook fires
                → Backend downloads recording → uploads to Bunny → ClassRecording
                    → Students watch recording with signed URL
```

---

## External Services

| Service | Purpose | Used For |
|---------|---------|----------|
| **AWS RDS PostgreSQL** | Database (Mumbai, ap-south-1) | 22 tables, async via asyncpg + SQLAlchemy 2.0 |
| **Bunny.net** | Video CDN + Streaming | Lecture uploads (TUS), Zoom recordings, signed stream URLs |
| **AWS S3** | File storage | Certificate PDFs, course materials, student resumes |
| **Zoom API** | Live classes | Meeting creation, recording webhooks, attendance |
| **Resend** | Email | Notifications (credentials built, needs setup) |

---

## Soft-Delete Pattern

All major entities use `deleted_at` (TIMESTAMPTZ, nullable) for soft-delete:
- Users, Batches, Courses, BatchCourses, Lectures, CurriculumModules, BatchMaterials
- ZoomAccounts, ZoomClasses, Announcements, Jobs, JobApplications, Certificates

**Exception:** `StudentBatch` uses `removed_at` instead (enrollment-specific).

All queries filter with `.deleted_at.is_(None)` to exclude soft-deleted records.
