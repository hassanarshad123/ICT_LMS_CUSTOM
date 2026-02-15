# ICT Institute LMS — Complete Feature Requirements

This document describes every feature the LMS supports, written in plain English. It serves as the **master specification for backend development** — a dev team should be able to build the Supabase backend, Bunny.net video integration, Zoom API integration, and Flutter mobile app from this document alone.

Each section describes: what it does, who can do it, what data is involved, and edge cases.

---

## Table of Contents

1. [Introduction & Overview](#1-introduction--overview)
2. [Authentication & Sessions](#2-authentication--sessions)
3. [User Roles & Permissions Summary](#3-user-roles--permissions-summary)
4. [Admin Features](#4-admin-features)
5. [Course Creator Features](#5-course-creator-features)
6. [Teacher Features](#6-teacher-features)
7. [Student Features](#7-student-features)
8. [Video Lectures & DRM](#8-video-lectures--drm)
9. [Zoom Integration](#9-zoom-integration)
10. [Announcements System](#10-announcements-system)
11. [Batches](#11-batches)
12. [Courses](#12-courses)
13. [Curriculum](#13-curriculum)
14. [Job Opportunities & In-App Applications](#14-job-opportunities--in-app-applications)
15. [Data Relationships Summary](#15-data-relationships-summary)
16. [Status Definitions](#16-status-definitions)
17. [Navigation Structure](#17-navigation-structure)
18. [File Upload Limits](#18-file-upload-limits)
19. [Post-Batch Content Access Rules](#19-post-batch-content-access-rules)
20. [Mobile App (Flutter) Scope](#20-mobile-app-flutter-scope)
21. [Features NOT Included](#21-features-not-included)

---

## 1. Introduction & Overview

The ICT Institute LMS is a Learning Management System for a Pakistan-based ICT training institute. It supports 4 user roles (Admin, Course Creator, Teacher, Student) and covers the full lifecycle of batch-based training: creating courses, uploading video lectures, scheduling live Zoom classes, posting job opportunities, and tracking student progress.

**Technology stack:**
- **Web frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Radix UI / shadcn components
- **Backend:** Supabase (PostgreSQL, Auth, Row-Level Security, Edge Functions, Storage)
- **Video hosting:** Bunny.net Stream (with DRM and watermarking)
- **Live classes:** Zoom API (OAuth, meeting creation, recordings, attendance)
- **Mobile app:** Flutter (Students + Teachers only)
- **Deployment:** Vercel (web)

**Key architectural principles:**
- Single institute, single timezone (Asia/Karachi)
- English-only interface
- Light theme only
- No payments or subscriptions
- All accounts created by Admin or Course Creator (no self-registration)
- Soft delete everywhere (records are deactivated, never permanently removed from UI)

---

## 2. Authentication & Sessions

### Login
- Users log in with email and password.
- After login, the user is redirected to their role-specific dashboard (`/admin`, `/course-creator`, `/teacher`, `/student`).
- There is **no self-registration**. All accounts are created by Admin or Course Creator.
- There is **no "forgot password"** flow. If a user forgets their password, they contact the Admin who resets it from the user detail page.

### Logout
- Clicking "Logout" in the sidebar ends the current session and returns the user to the login page.

### Device Limit
- Each user can be logged in on a maximum number of devices simultaneously.
- The **default limit is 2 devices**.
- If a user tries to log in on an additional device beyond the limit, the **oldest session is automatically terminated** (logged out on the earliest device).
- The Admin can change this limit globally from **Admin Settings > Session Settings**.
- When the Admin lowers the limit, any users who exceed the new limit will have their oldest sessions terminated on their next request.

### Session Tracking
- Each active session is recorded with: device info, IP address, login timestamp, and last-active timestamp.
- The Admin can view all active sessions on the **Devices** page and manually terminate any session.

---

## 3. User Roles & Permissions Summary

| Action | Admin | Course Creator | Teacher | Student |
|--------|:-----:|:--------------:|:-------:|:-------:|
| Create/edit/deactivate Students | Yes | Yes | No | No |
| Create/edit/deactivate Teachers | Yes | Yes | No | No |
| Create/edit/deactivate Course Creators | Yes | Yes | No | No |
| Create/edit/deactivate Admins | Yes | No | No | No |
| Reset user passwords | Yes | No | No | No |
| Create/edit batches | Yes | Yes | No | No |
| Create/edit/clone courses | No | Yes | No | No |
| Manage curriculum modules | No | Yes | No | No |
| Upload/delete lectures (batch-scoped) | No | Yes | No | No |
| Upload/delete materials (batch-scoped) | No | Yes | Yes (own batches) | No |
| Schedule Zoom classes | No | No | Yes | No |
| Join Zoom classes | No | No | Yes (as host) | Yes |
| Post/manage jobs | No | Yes | No | No |
| Review job applications | No | Yes | No | No |
| Apply to jobs | No | No | No | Yes |
| Watch video lectures | No | No | No | Yes |
| View insights/analytics | Yes | No | No | No |
| Manage device sessions | Yes | No | No | No |
| Configure system settings | Yes | No | No | No |
| Manage Zoom accounts | Yes | No | No | No |
| Bulk CSV import users | Yes | No | No | No |
| Export data (CSV/PDF) | Yes | No | No | No |
| View activity/audit log | Yes | No | No | No |
| Post announcements (institute-wide) | Yes | No | No | No |
| Post announcements (batch/course scope) | No | Yes | Yes (own batches) | No |
| View announcements | Yes | Yes | Yes | Yes |
| Add/remove students from batches | Yes | Yes | No | No |

**Key permission rule:** Course Creators can manage any user type **except** Admins. Only Admins can manage Admin accounts and Course Creator accounts (create, edit, deactivate, delete).

---

## 4. Admin Features

### 4.1 Admin Dashboard

**Route:** `/admin`

Displays 4 summary stat cards (each clickable, linking to the respective page):
- **Total Batches** — count of all batches
- **Total Students** — count of all students
- **Total Teachers** — count of all teachers
- **Active Batches** — count of batches with status "active"

Below the stats:
- **Recent Batches** — last 4 batches showing name, teacher, student count, and status badge
- **Recent Students** — last 5 students showing avatar (initials), name, batch name, and status badge

### 4.2 Manage Batches

**Route:** `/admin/batches`

- Table of all batches showing: batch name, assigned teacher, student count, date range (start–end), status badge.
- **Add Batch** form: fields for Batch Name, Teacher (dropdown), Start Date, End Date. New batch starts with 0 students and "upcoming" status.
- Status is computed from dates (see [Status Definitions](#16-status-definitions)).

### 4.3 Manage Students

**Route:** `/admin/students`

- Searchable table of all students showing: avatar (initials), name, email, phone, batch, status badge.
- **Add Student** form: Full Name, Email, Phone, Batch assignment (dropdown).
- Search filters by name or email in real-time.

### 4.4 Manage Teachers

**Route:** `/admin/teachers`

- Card grid layout showing each teacher with: avatar (initials), name, specialization, email, phone, assigned batches (as tags), status badge.
- **Add Teacher** form: Full Name, Email, Phone, Specialization.

### 4.5 Manage Course Creators

**Route:** `/admin/course-creators`

- Card grid layout showing each course creator with: avatar, name, email, phone, status badge.
- Actions per card: **Deactivate/Activate** toggle, **Delete** (removes from list).
- **Add Course Creator** form: Full Name, Email, Phone.
- Empty state with icon and call-to-action when no creators exist.

### 4.6 Unified User Management

**Route:** `/admin/users`

A unified view of all non-admin users (students, teachers, course creators) in a single paginated table (15 items per page).

**Filters:**
- Search by name or email
- Role filter pills: All, Student, Teacher, Course Creator
- Status dropdown: All, Active, Inactive
- Batch dropdown (visible when filtering by Student or All)

**Add User** — multi-step form:
1. Step 1: Select role (Student, Teacher, or Course Creator) — each shown as a card with icon and description
2. Step 2: Role-specific form fields:
   - All roles: Full Name, Email, Phone
   - Student: + Batch assignment dropdown
   - Teacher: + Specialization field

**Table columns:** Name (with avatar), Email, Role (badge), Status (badge), Actions (deactivate button).

**Row click** navigates to User Detail page.

**Deactivate** — soft delete via confirmation dialog; sets status to "inactive".

### 4.7 User Detail

**Route:** `/admin/users/[id]`

Shows complete profile for any user. Includes:
- Profile header: avatar, name, email, phone, role badge, status badge
- **Edit** button to update name, email, phone
- **Reset Password** button (Admin-only action)
- **Activate/Deactivate** toggle
- Role-specific info:
  - Student: enrolled batches (list), enrollment timeline (all enrollments/removals with dates), job applications
  - Teacher: specialization, assigned batches list
  - Course Creator: no additional role-specific fields

### 4.8 Devices Management

**Route:** `/admin/devices`

Shows all users who have active sessions, with expandable rows.

**Filters:** Search by name or email, Role filter pills (All, Student, Teacher, Course Creator).

**Table columns:** Name (avatar), Email, Role (badge), Active Devices (count / limit), Actions.

**Expandable rows:** Click chevron to see each session's device info, IP address, login timestamp, last-active timestamp, and a **Remove** button per session.

**Bulk action:** "Remove All Devices" per user with confirmation dialog.

Users at the device limit are highlighted in red.

### 4.9 Insights & Analytics

**Route:** `/admin/insights`

**Only Admin has access** to this page. No other role has analytics.

**Primary KPI Cards (top row):** Total Students, Active Batches, Total Courses, Active Sessions.

**Secondary KPI Cards:** Total Lectures, Materials Uploaded, Users at Device Limit, Total Teachers.

**Section A — Student & Enrollment:**
- Student Status donut chart (Active vs. Inactive)
- Enrollment per Batch bar chart
- Enrollment Growth area chart (cumulative by month)

**Section B — Batch Performance:**
- Batch Status donut chart (Completed, Active, Upcoming)
- Students per Batch bar chart
- Teacher Workload grouped bar chart (batches and students per teacher)

**Section C — Course & Content:**
- Course Status donut chart (Active vs. Upcoming)
- Lectures per Course horizontal bar chart
- Materials by Type pie chart (PDF, Excel, Word, PPTX)

**Section D — Device & Security:**
- Device Sessions Overview donut chart (Active, At Limit, No Sessions)
- Monthly Sessions & Issues dual area chart

### 4.10 Settings

**Route:** `/admin/settings`

Three settings sections:

**Account Settings:**
- Edit own profile: Full Name, Email, Phone
- Save button with success feedback

**Session Settings:**
- **Maximum Devices Per User** — increment/decrement control with current value display
- Minimum: 1 device
- Save button
- Help text explaining the behavior when limit is exceeded

**Zoom Integration:**
- List of configured Zoom OAuth accounts
- Each account shows: account name, "Default" badge (if applicable), masked client secret with show/hide toggle
- Actions per account: **Set as Default** (star icon), **Edit**, **Delete**
- **Add Zoom Account** form: Account Name, Account ID, Client ID, Client Secret (password field with visibility toggle)
- Edit mode appears inline with same fields
- Empty state prompting to add the first account

### 4.11 Activity / Audit Log

**Route:** `/admin/activity-log` (new page)

A searchable, filterable page showing all system actions. Each log entry records:
- **Who** performed the action (user name + role)
- **What** action was taken (e.g., "Created user", "Deleted lecture", "Changed batch assignment")
- **Which entity** was affected (entity type + entity ID)
- **When** it happened (timestamp)
- **Details** — JSON/text with before/after values where relevant

**Filters:** Search by action or user name, filter by entity type, filter by date range.

The log is **append-only** — entries cannot be edited or deleted.

### 4.12 Bulk CSV Import

Admin can bulk-upload users via CSV file from the Users page.

**Supported user types:** Students, Teachers, Course Creators (different CSV templates for each role).

**Workflow:**
1. Admin selects role type to import
2. Downloads a CSV template with the required columns
3. Fills in the CSV with user data
4. For students: also selects which batch to assign them to
5. Uploads the CSV
6. System validates all rows and shows a preview with any errors
7. Admin confirms the import
8. Users are created in bulk

**Required CSV columns by role:**
- Student: name, email, phone
- Teacher: name, email, phone, specialization
- Course Creator: name, email, phone

**Batch selection:** When importing students, Admin picks a batch from a dropdown. All imported students are assigned to that batch.

**Error handling:** Invalid rows (missing fields, duplicate emails) are flagged and skipped. Valid rows are imported. A summary shows how many succeeded and how many failed.

### 4.13 Data Export

All major data is exportable as CSV or PDF from the relevant pages.

**Exportable data:**
- Student lists (all students, or filtered by batch)
- Batch reports (batch details, student roster, course assignments)
- Course reports (course details, linked batches, lecture count)
- Attendance reports (Zoom class attendance per batch)
- Job application reports (all applications, or filtered by job)
- Insights data (charts and KPIs)

**Where export buttons appear:** On each respective list page (Students, Batches, Courses, Jobs, Insights) as a download button in the page header or toolbar.

### 4.14 Announcements (Admin Scope)

Admin can post **institute-wide announcements** visible to all users across all roles.

See [Announcements System](#10-announcements-system) for full details.

---

## 5. Course Creator Features

### 5.1 Course Creator Dashboard

**Route:** `/course-creator`

Displays summary stat cards:
- **Total Courses** — count of all courses
- **Total Batches** — count of all batches
- **Total Students** — count of all students
- **Active Batches** — count of active batches

Below the stats:
- **Recent Courses** — last few courses with title, status, batch count
- **Quick actions** — links to create course, create batch, etc.

### 5.2 Manage Courses

**Route:** `/course-creator/courses`

- Grid or list of all courses showing: title, description (truncated), linked batch count, status badge.
- **Create Course** form: Title, Description. New course starts with "upcoming" status and no linked batches.
- **Clone Course** button per course — duplicates the course including all curriculum modules. Does **not** copy batch-scoped lectures or materials (those belong to specific batches). The clone gets a new name (e.g., "ICT Fundamentals (Copy)") and "upcoming" status.
- Clicking a course navigates to Course Detail.

### 5.3 Course Detail

**Route:** `/course-creator/courses/[id]`

**Header:** Course title, description, status badge.

**Tabs/Sections:**

**Linked Batches:** List of batches this course is assigned to. Each shows batch name, teacher, student count, status. CC can add/remove batch assignments.

**Curriculum:** Ordered list of curriculum modules. Each module has: title, description, ordered list of topics. CC can add, edit, reorder, and delete modules and topics.

### 5.4 Batch Content Page

**Route:** `/course-creator/batches/[batchId]`

This is the **primary content management page** — where CC manages lectures and materials per batch, grouped by course.

**Header banner (dark):** Batch name, status badge, student count, teacher name, list of linked courses.

**For each linked course, the page shows:**

**Lectures section:**
- Ordered list of lectures showing: order number, title, description, duration, delete button.
- **Add Lecture** form: Title, Description, Video URL, Duration.
- Lectures are scoped to this batch + course combination.

**Materials section:**
- List of materials showing: file type icon/badge, title, file name, file size, upload date, delete button.
- **Upload Material** form: Title, Description (optional), File Type dropdown (PDF, Excel, Word, PPTX, Image, Archive, Other), file upload area, file name.
- Materials are scoped to this batch + course combination.

**Zoom Recordings section (batch-wide):**
- List of completed Zoom classes for this batch showing: title, teacher name, date, time, duration.
- These are auto-fetched from Zoom after meetings end (see [Zoom Integration](#9-zoom-integration)).

### 5.5 Manage Batches

**Route:** `/course-creator/batches`

- List or grid of all batches showing: name, teacher, student count, date range, status badge, course tags.
- **Create Batch** form: Batch Name, Teacher (dropdown), Start Date, End Date.
- Clicking a batch navigates to the Batch Content Page.
- Expandable student list per batch (shows students assigned to that batch).

### 5.6 Unified User Management

**Route:** `/course-creator/users`

Identical interface to Admin's Users page (shared component). CC can:
- View all non-admin users
- Add students, teachers, and course creators
- Deactivate/activate users
- View user detail pages

**Key restriction:** CC **cannot** see, edit, or manage Admin accounts. CC can manage all other roles.

### 5.7 User Detail

**Route:** `/course-creator/users/[id]`

Same interface as Admin's User Detail page (shared component). CC can edit profile details and activate/deactivate users.

**CC cannot reset passwords** — only Admin can do that.

### 5.8 Jobs

**Route:** `/course-creator/jobs`

CC manages job opportunities for students.

**Job list:** Shows all jobs with title, company, location, type badge, salary, posting date, deadline.

**Create Job** form: Title, Company, Location, Type (full-time, part-time, internship, remote), Salary, Description, Requirements (list), Deadline.

**Job detail / applications view:** Click a job to see its full details and a table of student applications. Each application shows: student name, applied date, status badge (applied, shortlisted, rejected). CC can change application status.

See [Job Opportunities](#14-job-opportunities--in-app-applications) for full details.

### 5.9 Announcements (CC Scope)

CC can post announcements scoped to specific **batches** or **courses** they manage.

See [Announcements System](#10-announcements-system) for full details.

### 5.10 Settings

**Route:** `/course-creator/settings`

**Account Settings:** Edit own profile (Full Name, Email, Phone) with save button.

---

## 6. Teacher Features

### 6.1 Teacher Dashboard

**Route:** `/teacher`

Displays summary stat cards:
- **My Batches** — count of batches assigned to this teacher
- **My Courses** — count of courses linked to teacher's batches
- **Total Students** — count of students across teacher's batches
- **Upcoming Classes** — count of scheduled Zoom classes

Below the stats:
- **Upcoming Zoom Classes** — next few scheduled classes with title, batch, date/time
- **My Batches** — list of assigned batches with name, student count, status

### 6.2 View Courses

**Route:** `/teacher/courses`

List of all courses linked to any of the teacher's assigned batches. Shows: title, description (truncated), linked batch count, status badge.

Clicking a course navigates to Course Detail.

### 6.3 Course Detail

**Route:** `/teacher/courses/[id]`

**Header:** Course title, description, status badge.

**Sections:**

**Curriculum:** Read-only view of curriculum modules and topics.

**Materials:** Teacher can **upload** materials to their assigned batches for this course. Teacher can also view and download existing materials. Teacher **cannot** delete materials uploaded by Course Creators.

### 6.4 View Batches

**Route:** `/teacher/batches`

List of batches assigned to this teacher showing: batch name, student count, date range, status badge.

Expandable student list per batch showing student names, emails, and status.

### 6.5 Schedule Zoom Classes

**Route:** `/teacher/schedule`

**Upcoming Classes list:** Shows all scheduled/completed Zoom classes for the teacher, with title, batch, date, time, duration, status badge, and Zoom link.

**Schedule New Class** form:
- Title
- Batch (dropdown — only teacher's assigned batches)
- Zoom Account (dropdown — picks from admin-configured Zoom accounts; pre-selects the default account)
- Date
- Start Time
- Duration

On submit, the system **auto-creates a Zoom meeting** via the selected account's API credentials and generates the meeting link. The teacher does **not** paste a Zoom link manually.

**If no Zoom accounts are configured:** The form is disabled with a message telling the teacher to contact the Admin.

### 6.6 Announcements (Teacher Scope)

Teacher can post announcements scoped to their **assigned batches**.

See [Announcements System](#10-announcements-system) for full details.

### 6.7 Settings

**Route:** `/teacher/settings`

**Account Settings:** Edit own profile (Full Name, Email, Phone) with save button.

---

## 7. Student Features

### 7.1 Student Dashboard

**Route:** `/student`

Displays summary stat cards:
- **My Courses** — count of courses across all enrolled batches
- **Lectures Watched** — count of completed lectures
- **Upcoming Classes** — count of upcoming Zoom classes across all enrolled batches
- **Course Progress** — overall completion percentage across all courses

Below the stats:
- **Continue Watching** — the last lecture the student was watching, with a resume button
- **Upcoming Zoom Classes** — next few scheduled classes with title, teacher, date/time, join button
- **Announcements** — recent announcements relevant to the student's batch

### 7.2 View Courses

**Route:** `/student/courses`

List of courses available to the student (courses grouped by batch; student selects batch context first). Shows: title, description (truncated), status badge, progress bar (completion percentage).

Clicking a course navigates to Course Detail.

### 7.3 Course Detail (Video Player)

**Route:** `/student/courses/[id]`

This is the primary learning interface for students.

**Tabs:**

**Lectures tab:**
- Video player at the top showing the currently selected lecture
- Playlist/sidebar listing all lectures in order, with:
  - Watch status indicator (unwatched, in-progress, completed)
  - Lecture title, duration
  - Click to switch lecture
- Progress tracking: video watch percentage shown per lecture
- Resume capability: student picks up where they left off

**Recordings tab:**
- List of completed Zoom class recordings for this batch
- Each shows: title, teacher, date, duration
- Click to watch the recording

**Curriculum tab:**
- Read-only view of curriculum modules and topics for this course
- Ordered list of modules, each with its topics

**Materials tab:**
- List of downloadable materials for this batch + course
- Each shows: file type icon, title, file name, file size, upload date, uploader
- Download button per material

### 7.4 Lecture Progress & Video Tracking

The system tracks detailed video watching progress per student per lecture:
- **Watch percentage** — how much of the video has been watched (0–100%)
- **Resume position** — exact timestamp where the student last stopped watching
- **Completion status** — a lecture is "completed" when the student has watched a sufficient percentage (e.g., 90%+)
- **Per-course completion** — percentage of lectures completed in each course

This data is shown:
- On the course list page as a progress bar per course
- In the lecture playlist as status indicators per lecture
- On the student dashboard as an overall completion percentage

### 7.5 Zoom Classes

**Route:** `/student/zoom`

**Upcoming Classes:** List of future Zoom classes across all enrolled batches. Shows: title, teacher, batch, date, time, duration, **Join** button (links to Zoom meeting URL).

**Past Classes:** List of completed Zoom classes with: title, teacher, date, time, duration, attendance status (joined / not joined).

### 7.6 Jobs

**Route:** `/student/jobs`

**Job Listings:** Browsable list of all active job postings. Each shows: title, company, location, type badge, salary, description (truncated), requirements, posted date, deadline.

**Filters:** Search by title or company, filter by job type (full-time, part-time, internship, remote).

**Apply flow:**
1. Student clicks "Apply" on a job
2. Application form opens: optional cover text + **resume upload** (file upload)
3. Student submits the application
4. Application status starts as "applied"
5. Student can track their applications with status updates (applied → shortlisted → rejected)

**My Applications:** Student can view their submitted applications with current status.

See [Job Opportunities](#14-job-opportunities--in-app-applications) for full details.

### 7.7 Batch History & Post-Batch Access

On the student's profile (visible from User Detail page), an **enrollment timeline** shows:
- All current batch enrollments with enrollment dates
- All past enrollments with date ranges and who added/removed them
- Each enrollment and removal is an independent event (no "transfer" concept)

**Post-batch access rules:** After a batch ends, students retain **read-only, time-limited access** to that batch's content (grace period evaluated independently per batch). See [Post-Batch Content Access Rules](#19-post-batch-content-access-rules) for full details.

### 7.8 Announcements (View)

Students see announcements on their dashboard. They see:
- Institute-wide announcements (posted by Admin)
- Announcements scoped to any of their enrolled batches
- Announcements scoped to courses in any of their enrolled batches

See [Announcements System](#10-announcements-system) for full details.

### 7.9 Settings

**Route:** `/student/settings`

**Account Settings:** Edit own profile (Full Name, Email, Phone) with save button.

---

## 8. Video Lectures & DRM

### Video Hosting

Lecture videos are hosted on **Bunny.net Stream**. Two upload methods are supported:

1. **Direct upload:** Course Creator uploads a video file through the LMS. The backend uploads it to Bunny.net Stream and stores the resulting streaming URL and Bunny video ID.
2. **External URL:** Course Creator pastes an external video URL (YouTube, Vimeo, etc.). The URL is stored directly. The video player embeds or links to the external source.

The video type (upload vs. external) is stored per lecture so the player knows how to render it.

### DRM Protection

Videos uploaded to Bunny.net are protected with DRM:
- **Bunny.net DRM** — prevents unauthorized downloading and playback on non-authorized devices.
- **Visible watermark** — the student's name and ID are overlaid on the video during playback. This discourages screen recording.
- Signed URLs are generated per-session via a Supabase Edge Function, ensuring only authenticated students can access the stream.

### Progress Tracking

See [Lecture Progress & Video Tracking](#74-lecture-progress--video-tracking) in Student Features.

---

## 9. Zoom Integration

### 9.1 Zoom Account Management

**Admin configures Zoom OAuth accounts** in Admin Settings > Zoom Integration.

Each Zoom account has:
- Account Name (e.g., "ICT Main Account")
- Account ID (Zoom Account ID)
- Client ID (Zoom OAuth Client ID)
- Client Secret (Zoom OAuth Client Secret)
- Default flag (one account is marked as default)

Multiple Zoom accounts can be configured. Teachers **manually select** which account to use when scheduling a class (no automatic load balancing).

### 9.2 Scheduling a Class

1. Teacher opens Schedule page and fills in: title, batch, Zoom account, date, start time, duration.
2. On submit, the backend uses the selected Zoom account's OAuth credentials to call the **Zoom Create Meeting API**.
3. The API returns a meeting ID, join URL, and host URL.
4. These are stored in the `zoom_classes` table.
5. The meeting appears on the teacher's schedule and in the student's Zoom Classes page.

### 9.3 Live Class Flow

- Before the class: status is "upcoming". Students see a "Join" button that opens the Zoom meeting URL.
- During the class: status changes to "live" (either via Zoom webhook or periodic polling).
- After the class: status changes to "completed".

### 9.4 Zoom Recording Auto-Fetch

After a Zoom meeting ends, the backend **automatically pulls the recording** from Zoom:
1. Zoom sends a webhook (or the backend polls) when a recording is available.
2. The backend downloads the recording and uploads it to Bunny.net Stream.
3. A `class_recordings` entry is created with the Bunny video ID.
4. The recording becomes available to students on the Recordings tab of the course detail page and on the Batch Content page.

Recording status: `processing` → `ready` (or `failed` if something goes wrong).

### 9.5 Zoom Attendance Tracking

After a meeting ends, the backend **auto-tracks attendance** using Zoom API participant data:
- Calls the Zoom API to get the list of participants who joined the meeting.
- Matches participants to student records (by email or name).
- Records attendance per student per class (joined / not joined, join time, leave time, duration attended).
- Teachers and Admin can view attendance reports per class.

### 9.6 Email Reminders

Students receive an **email reminder** before a scheduled Zoom class (e.g., 1 hour before). This is sent via Supabase Edge Function + email provider (e.g., Resend, SendGrid).

---

## 10. Announcements System

### Who Can Post

| Role | Scope |
|------|-------|
| Admin | Institute-wide (visible to all users) |
| Course Creator | Scoped to specific batches or courses they manage |
| Teacher | Scoped to their assigned batches |
| Student | Cannot post (view only) |

### Announcement Fields

- **Title** — required
- **Body** — plain text (no rich text, no images, no formatting)
- **Scope** — institute-wide, batch, or course
- **Expiry date** — optional. If set, the announcement auto-hides after this date.
- **Posted by** — author name and role
- **Posted at** — timestamp

### Visibility

- Students see announcements on their dashboard: institute-wide + their batch + their courses.
- Teachers see: institute-wide + their assigned batches.
- Course Creators see: institute-wide + all batches/courses.
- Admin sees: all announcements.

### Management

- Authors can **delete** their own announcements.
- Admin can delete any announcement.
- Expired announcements are auto-hidden but remain in the database.

---

## 11. Batches

### Definition

A **batch** is a group of students enrolled together for a specific time period. Each batch:
- Has a name (e.g., "Batch 3 — August 2024")
- Has a start date and end date
- Is assigned to exactly one teacher
- Can be linked to one or more courses
- Has zero or more students

### Status (Computed from Dates)

Batch status is **not stored** in the database — it is computed at query time based on the current date in **Asia/Karachi** timezone:

| Status | Condition |
|--------|-----------|
| Upcoming | `start_date > today` |
| Active | `start_date <= today AND end_date >= today` |
| Completed | `end_date < today` |

### Relationships

- A batch **has one** teacher (the teacher assigned to lead/manage the batch)
- A batch **has many** students (a student can be enrolled in multiple batches simultaneously via `student_batches`)
- A batch **has many** courses (via `batch_courses` junction table)
- Lectures and materials are **batch-scoped** (they belong to a specific batch + course combination)

### Batch Enrollment Management

Admin or Course Creator can **add or remove students from batches** independently:
- To enroll a student, a row is created in `student_batches` with student ID, batch ID, enrolled_by, and timestamp
- To remove a student, the `removed_at` timestamp is set on the enrollment row (soft removal)
- A student can be enrolled in multiple batches simultaneously — enrollments are independent
- The student's profile shows the full enrollment timeline (all additions and removals)

---

## 12. Courses

### Definition

A **course** is a container for educational content. Each course has:
- Title
- Description
- Status (stored as enum: upcoming, active, completed)
- Linked batches (many-to-many via `batch_courses`)
- Curriculum modules (course-level)
- Lectures (batch-scoped — different for each batch)
- Materials (batch-scoped)

### Course Status

Unlike batch status, course status is **stored** (not computed):
- **Upcoming** — course is created but not yet active
- **Active** — course is currently being taught
- **Completed** — course is finished

Course Creator sets and updates the status manually.

### Content Hierarchy

```
Course
├── Curriculum Modules (course-level, shared across batches)
│   └── Topics (ordered list within each module)
├── Batch 1
│   ├── Lectures (ordered, batch-scoped)
│   └── Materials (batch-scoped)
├── Batch 2
│   ├── Lectures (different set)
│   └── Materials (different set)
└── ...
```

### Course Cloning

Course Creator can **clone a course**, which:
- Creates a new course with copied title (appended with "(Copy)") and description
- Copies all **curriculum modules** and their topics
- Does **not** copy lectures or materials (those are batch-scoped and belong to specific batches)
- The cloned course starts with "upcoming" status and no linked batches

---

## 13. Curriculum

### Definition

A **curriculum** is an ordered list of modules attached to a course. It represents the course outline/syllabus.

Each **curriculum module** has:
- Title (e.g., "Module 1: Introduction to Computers")
- Description
- Order number (for sequencing)
- Topics — an ordered list of strings (e.g., "What is a computer?", "Types of hardware")

### Scope

Curriculum is **course-level** — the same curriculum applies to all batches linked to the course.

### Who Can Manage

Only **Course Creators** can add, edit, reorder, and delete curriculum modules and topics.

Teachers and Students see the curriculum in **read-only** mode.

---

## 14. Job Opportunities & In-App Applications

### Job Postings

Course Creators post job opportunities for students. Each job has:
- Title (e.g., "Data Entry Operator")
- Company name
- Location
- Type: full-time, part-time, internship, or remote
- Salary range (text, e.g., "PKR 35,000 — 45,000")
- Description
- Requirements (list of strings)
- Posted date
- Application deadline

### Student Application Flow

1. Student browses job listings on `/student/jobs`
2. Student filters by type, searches by title/company
3. Student clicks "Apply" on a job
4. Application form: optional cover text + **resume upload** (PDF file)
5. Application is created with status "applied"
6. Student can view their applications under "My Applications"

### Application Review (by Course Creator)

1. CC opens a job on `/course-creator/jobs`
2. CC sees all applications for that job in a table
3. Each application shows: student name, applied date, status, resume download link
4. CC can change status to: **shortlisted** or **rejected**
5. Status changes are recorded with the reviewer's ID and timestamp

### Re-application

If a student applies again to the same job:
- The old application is soft-deleted
- A new application is created

---

## 15. Data Relationships Summary

```
Admin
 └── manages → Users (all roles), Batches, Settings, Devices, Insights, Audit Log

Course Creator
 ├── creates → Courses, Curriculum Modules, Jobs
 ├── manages → Batches (create, assign courses)
 ├── manages → Lectures (per batch+course)
 ├── manages → Materials (per batch+course)
 ├── manages → Users (except Admins)
 └── reviews → Job Applications

Teacher
 ├── assigned to → Batches (one or more)
 ├── schedules → Zoom Classes (per batch)
 ├── uploads → Materials (to own batches)
 └── views → Courses, Curriculum, Students (in own batches)

Student
 ├── enrolled in → many Batches (via student_batches)
 ├── watches → Lectures (in batch's courses)
 ├── attends → Zoom Classes (in batch)
 ├── applies to → Jobs
 └── downloads → Materials (in batch's courses)

Batch
 ├── has one → Teacher
 ├── has many → Students
 ├── has many → Courses (via batch_courses)
 ├── has many → Lectures (per course)
 ├── has many → Materials (per course)
 └── has many → Zoom Classes

Course
 ├── has many → Batches (via batch_courses)
 ├── has many → Curriculum Modules
 ├── has many → Lectures (batch-scoped)
 └── has many → Materials (batch-scoped)

Zoom Class
 ├── belongs to → Batch
 ├── belongs to → Teacher
 ├── has one → Zoom Account (used to create)
 └── has many → Recordings
```

---

## 16. Status Definitions

### Batch Status (computed)

| Status | Badge Color | Meaning |
|--------|------------|---------|
| Upcoming | Yellow | `start_date > today` |
| Active | Green | `start_date <= today AND end_date >= today` |
| Completed | Gray | `end_date < today` |

### Course Status (stored)

| Status | Badge Color | Meaning |
|--------|------------|---------|
| Upcoming | Yellow | Course is created but not yet active |
| Active | Green | Course is currently being taught |
| Completed | Gray | Course is finished |

### User Status

| Status | Badge Color | Meaning |
|--------|------------|---------|
| Active | Green | User can log in and use the system |
| Inactive | Gray | User is deactivated (soft deleted) and cannot log in |

### Zoom Class Status

| Status | Badge Color | Meaning |
|--------|------------|---------|
| Upcoming | Yellow | Class is scheduled but hasn't started |
| Live | Green/pulsing | Class is currently in progress |
| Completed | Gray | Class has ended |

### Job Application Status

| Status | Badge Color | Meaning |
|--------|------------|---------|
| Applied | Blue | Student has submitted the application |
| Shortlisted | Green | CC has shortlisted the student |
| Rejected | Red | CC has rejected the application |

### Recording Status

| Status | Meaning |
|--------|---------|
| Processing | Recording is being fetched/converted |
| Ready | Recording is available for playback |
| Failed | Recording fetch/conversion failed |

---

## 17. Navigation Structure

### Admin Sidebar (9 items)

| Label | Route | Icon |
|-------|-------|------|
| Dashboard | `/admin` | LayoutDashboard |
| Users | `/admin/users` | Users |
| Batches | `/admin/batches` | Layers |
| Students | `/admin/students` | GraduationCap |
| Teachers | `/admin/teachers` | BookOpen |
| Course Creators | `/admin/course-creators` | PenTool |
| Devices | `/admin/devices` | Monitor |
| Insights | `/admin/insights` | TrendingUp |
| Settings | `/admin/settings` | Settings |

### Course Creator Sidebar (6 items)

| Label | Route | Icon |
|-------|-------|------|
| Dashboard | `/course-creator` | LayoutDashboard |
| Users | `/course-creator/users` | Users |
| Courses | `/course-creator/courses` | BookOpen |
| Batches | `/course-creator/batches` | Layers |
| Jobs | `/course-creator/jobs` | Briefcase |
| Settings | `/course-creator/settings` | Settings |

### Teacher Sidebar (5 items)

| Label | Route | Icon |
|-------|-------|------|
| Dashboard | `/teacher` | LayoutDashboard |
| My Courses | `/teacher/courses` | BookOpen |
| My Batches | `/teacher/batches` | Layers |
| Schedule Class | `/teacher/schedule` | Video |
| Settings | `/teacher/settings` | Settings |

### Student Sidebar (5 items)

| Label | Route | Icon |
|-------|-------|------|
| Dashboard | `/student` | LayoutDashboard |
| Courses | `/student/courses` | BookOpen |
| Zoom Classes | `/student/zoom` | Video |
| Job Opportunities | `/student/jobs` | Briefcase |
| Settings | `/student/settings` | Settings |

### Shared Layout

All pages are wrapped in `DashboardLayout` which provides:
- Sidebar (role-specific, collapsible on mobile with hamburger menu)
- Header with user name, role badge, search icon (decorative — no global search), notification bell (placeholder — no notifications)
- Main content area

---

## 18. File Upload Limits

Fixed reasonable limits (not configurable by Admin):

| Upload Type | Max File Size | Notes |
|-------------|--------------|-------|
| Lecture video | 100 MB | Per file upload to Bunny.net |
| Course material | 100 MB | Per file (PDF, Excel, Word, etc.) |
| Resume (job application) | 10 MB | PDF only |
| Total materials per batch | 5 GB | Aggregate limit across all materials in a batch |

These limits are enforced at the API level. The frontend shows appropriate error messages when a limit is exceeded.

---

## 19. Post-Batch Content Access Rules

When a batch's end date passes and its status becomes "completed":

### Grace Period

Students retain **read-only access** to each batch's content for a configurable duration after that batch's end date. Each batch's grace period is evaluated independently.

- **Duration is set by Admin** in Admin Settings (default: 3 months).
- During the grace period, students can:
  - Watch lecture videos
  - Download materials
  - View recordings
  - See curriculum
- Students **cannot** submit new job applications or join Zoom classes for a completed batch (there are none).

### After Grace Period Expires

Once the grace period expires:
- **Content is locked** — students can no longer watch videos or download materials.
- **History remains visible** — students can still see their course list, progress percentages, and lecture completion status, but with a "locked" indicator.
- A message informs the student that access has expired.

### Admin Control

- Admin can adjust the grace period duration from Settings at any time.
- Changing the duration applies to all batches (retroactively computed: `batch.end_date + grace_period`).

---

## 20. Mobile App (Flutter) Scope

The Flutter mobile app supports **Students** and **Teachers** only. Admin and Course Creator use the web app exclusively.

### Student Mobile Features

| Feature | Included | Notes |
|---------|:--------:|-------|
| Login/Logout | Yes | Same auth as web |
| Dashboard | Yes | Stats + continue watching + upcoming classes |
| View Courses | Yes | Course list with progress bars |
| Watch Lectures | Yes | Video player with progress tracking |
| View Recordings | Yes | Zoom class recordings |
| View Curriculum | Yes | Read-only |
| Download Materials | Yes | File downloads |
| Zoom Classes | Yes | View schedule + join via Zoom app deep link |
| Browse Jobs | Yes | Job listings with filters |
| Apply to Jobs | Yes | In-app application + resume upload |
| View Announcements | Yes | On dashboard |
| Settings | Yes | Edit profile |

### Teacher Mobile Features

| Feature | Included | Notes |
|---------|:--------:|-------|
| Login/Logout | Yes | Same auth as web |
| Dashboard | Yes | Stats + upcoming classes + batches |
| View Courses | Yes | Course list, curriculum, materials |
| View Batches | Yes | Student lists |
| Schedule Zoom Class | Yes | Create class (select account, set date/time) |
| Start/Join Zoom Class | Yes | Launch via Zoom app deep link |
| Upload Materials | Yes | To own batches |
| Post Announcements | Yes | To own batches |
| Settings | Yes | Edit profile |

### Not on Mobile

- Admin dashboard and all admin features
- Course Creator dashboard and all CC features
- Insights/analytics
- Device management
- Bulk CSV import
- Data export
- Activity/audit log
- System settings

---

## 21. Features NOT Included

The following features are **explicitly out of scope** and should not be built:

| Feature | Reason |
|---------|--------|
| Notifications (bell icon) | Bell icon is a visual placeholder. No notification system. |
| Payments / subscriptions | This is a free internal training institute. No fees. |
| Assessments / quizzes / grading | Content delivery platform only. No testing. |
| Certificates | No certificate generation or issuance. |
| Dark mode | Light theme only. |
| Multi-language (Urdu) | English-only interface. |
| Global search | Search icon is decorative. Pages have their own local search/filters. |
| Self-registration | All accounts created by Admin or CC. |
| Real-time chat | No messaging between users. |
| Forgot password (self-service) | Admin resets passwords. No email reset flow. |
| Calendar view | Schedule is list-based, not calendar-based. |
| Drag-and-drop reordering | Curriculum/lecture ordering is number-based, not drag-and-drop. |
| Video comments/discussions | No discussion threads on lectures or courses. |
| Social features | No user profiles, follows, or activity feeds. |
| Multi-tenant | Single institute only. |
