# ICT Institute LMS — Complete Feature Requirements

This document describes every feature the LMS should support, written in plain English. No technical implementation details — just what the system does and how it behaves. This is the master checklist for backend development.

---

## 1. Authentication & Accounts

### Login
- Users log in with email and password.
- After login, the user is taken to their role-specific dashboard.
- There is no self-registration. All accounts are created by the Admin.
- There is no "forgot password" or email verification flow for now.

### Roles
The system has 4 roles. Each role sees a different sidebar, different pages, and has different permissions:
- **Admin** — Manages the entire institute (users, batches, teachers, course creators).
- **Course Creator** — Creates courses, uploads lectures, builds curriculum, posts jobs, manages batches.
- **Teacher** — Views assigned courses, manages their batches, schedules and conducts Zoom classes.
- **Student** — Watches lectures, attends Zoom classes, browses jobs, applies to jobs.

### Account Creation
- Only the Admin can create accounts for Teachers, Course Creators, and Students.
- When creating an account, the Admin provides: name, email, phone, and (for teachers) a specialization.
- The Admin can activate or deactivate any Course Creator account.
- The Admin can delete Course Creator accounts.

### Sessions
- A logged-in user stays logged in until they click "Logout".
- Clicking Logout returns the user to the login page.

### Device Limit
- Each user can be logged in on a maximum of **2 devices at the same time** (this is the default).
- If a user tries to log in on a 3rd device, the oldest session is automatically terminated (the user gets logged out on their first device).
- The Admin can change this limit globally from the **Admin Settings** page — they can increase it (e.g., allow 3 or 5 devices) or decrease it (e.g., restrict to 1 device only).
- When the Admin lowers the limit, any users who exceed the new limit will have their oldest sessions terminated on their next request.

---

## 2. Admin Features

### Admin Dashboard
- Shows 4 summary stats: Total Batches, Total Students, Total Teachers, Active Batches.
- Each stat card is clickable and links to its detail page.
- Shows a "Recent Batches" list (last 4 batches with name, teacher, student count, status).
- Shows a "Recent Students" list (last 5 students with name, batch, status).

### Manage Batches
- Admin can see a table of all batches in the system.
- Each row shows: batch name, assigned teacher, student count, date range, and status.
- Admin can create a new batch by providing: batch name, assigned teacher (dropdown of all teachers), start date, end date.
- Batch status is one of: **active**, **upcoming**, or **completed**.

### Manage Students
- Admin can see a table of all students in the system.
- Each row shows: name (with avatar), email, phone, batch name, status.
- Admin can search students by name or email — the table filters in real time.
- Admin can add a new student by providing: full name, email, phone, and assigned batch (dropdown).
- Student status is one of: **active** or **inactive**.

### Manage Teachers
- Admin can see all teachers displayed as cards.
- Each card shows: name, specialization, email, phone, assigned batches, status.
- Admin can add a new teacher by providing: full name, email, phone, specialization.
- Teacher status is one of: **active** or **inactive**.

### Settings
- Admin can access a Settings page from the sidebar.
- **Session Settings:**
  - Shows the current maximum device limit (default: 2).
  - Admin can increase or decrease this number using a stepper control (+/- buttons).
  - Minimum allowed value: 1. No maximum cap.
  - Changes take effect immediately after saving.

### Manage Course Creators
- Admin can see all course creators displayed as cards.
- Each card shows: name, email, phone, status.
- Admin can add a new course creator by providing: full name, email, phone.
- Admin can delete a course creator.
- Admin can activate or deactivate a course creator (toggle button).

---

## 3. Course Creator Features

### Course Creator Dashboard
- Shows 3 summary stats: Total Courses, Total Batches, Total Lectures.
- Shows a "Your Courses" list — each course links to its detail page.

### Manage Courses
- Course Creator can see all courses they've created displayed as cards.
- Each card shows: status badge, title, description, lecture count, batch count.
- Course Creator can create a new course by providing: title and description.
- Clicking a course card opens the Course Detail page.

### Course Detail Page
The course detail page has a dark header banner showing: course title, description, status, lecture count, batch count, total duration. Below that, there are two tabs:

#### Batches Tab
- Shows all batches assigned to this course.
- Course Creator can assign an existing batch to the course (dropdown of unassigned batches).
- Course Creator can remove a batch from the course.
- Each batch is expandable. When expanded, it shows:
  - Batch metadata: name, status, student count, date range.
  - A list of all students in that batch (name, email, status).
  - An inline form to add a new student to that batch (name, email, phone).

#### Content Tab
- **Lectures section:**
  - Shows all lectures belonging to this course, ordered by sequence.
  - Course Creator can add a lecture by providing: title, duration, description, and video.
  - For video, Course Creator can either upload a video file directly OR paste an external link (YouTube, Vimeo, Google Drive).
  - Course Creator can delete a lecture.

- **Curriculum section:**
  - Shows all curriculum modules belonging to this course, ordered by sequence.
  - Each module has: title, description, and a list of topics.
  - Course Creator can add a module by providing: title, description, and a comma-separated list of topics.
  - Course Creator can delete a module.
  - Topics are displayed as a numbered or bulleted list inside each module.

### Manage Batches (Course Creator)
- Course Creator can see all batches displayed as expandable cards.
- Each card shows: batch name, status, teacher name, student count, date range.
- Course Creator can create a new batch by providing: batch name, assigned teacher (dropdown), start date, end date.
- Course Creator can delete a batch.
- When a batch is expanded, it shows:
  - Student list (name, email, phone, status) with a remove button per student.
  - An inline form to add a new student (name, email, phone).

### Manage Lectures (Standalone Page)
- Course Creator can see all lectures as a list with drag handles (for future reordering).
- Each item shows: lecture number, title, description, duration, batch name.
- Course Creator can add a new lecture by providing: title, description, video URL, duration, and batch (dropdown).

### Manage Curriculum (Standalone Page)
- Course Creator can see all curriculum modules as expandable cards.
- Each card shows: module icon, title, description, topic count.
- When expanded, shows numbered list of topics.
- Course Creator can add a new module by providing: title, description, and topics (one per line).

### Post & Manage Jobs
- Course Creator can see all posted jobs as expandable cards.
- Each card shows: job title, company, type badge, location, salary, deadline.
- When expanded, shows: full description, requirements list, posted date.
- Course Creator can post a new job by providing: title, company, location, job type (full-time / part-time / internship / remote), salary, deadline, description, and requirements (comma-separated).
- Course Creator can delete a job posting.

---

## 4. Teacher Features

### Teacher Dashboard
- Shows 3 summary stats: My Batches, Total Students (across all batches), Upcoming Classes.
- Shows 2 action cards: "My Batches" and "Schedule Class" — each links to its page.
- Shows an "Upcoming Classes" list (next scheduled Zoom classes with title, batch, date, time).

### View My Courses
- Teacher can see all courses assigned to their batches as cards.
- Each card shows: status, title, description, lecture count, duration, batch name, student count.
- Clicking a card opens the Course Detail page.

### Course Detail Page (Teacher View)
- Dark header with: course title, description, status, lecture count, total duration.
- **Video Player area** — placeholder that will stream the selected lecture.
- **Lecture Playlist sidebar** — numbered list of all lectures. Teacher can click any lecture to select it.
- **Lecture Info card** below the video — shows: title, description, duration, upload date of the currently selected lecture.
- **Curriculum section** — expandable modules showing topics inside each module.

### View My Batches
- Teacher can see all batches assigned to them as expandable cards.
- Each card shows: batch name, date range, student count, status.
- When expanded, shows: list of students with name, email, phone, and status.

### Schedule Zoom Classes
- Teacher can see upcoming classes and past classes in separate sections.
- Teacher can schedule a new class by providing: class title, batch (dropdown of their batches), Zoom link, date, time, and duration.
- **Zoom API Integration:**
  - When scheduling a class, the system auto-creates a Zoom meeting via the Zoom API.
  - The system syncs the meeting status (upcoming → live → ended).
  - The "Join Class" button only appears when the class is live.
  - Past classes show as completed and grayed out.
- Upcoming class cards show: title, batch, date, time, duration, and a Join button (opens Zoom).
- Past class cards show: title, batch, date, time (grayed out).

---

## 5. Student Features

### Student Dashboard
- Shows 2 action cards: "Courses" (with enrolled count) and "Job Opportunities" (with available count).
- Shows a "Recent Lectures" section — the 4 most recent lectures with title, description snippet, and duration. Clicking any lecture opens the course detail page.

### View My Courses
- Student can see all courses their batch is enrolled in as cards.
- Each card shows: status, title, description, lecture count, duration.
- Clicking a card opens the Course Detail page.

### Course Detail Page (Student View)
- Dark header with: course title, description, status, lecture count, recording count, total duration.
- **Video Player area** — placeholder that will stream the selected lecture or recording.
- **Playlist sidebar with two tabs:**
  - **Lectures tab** — numbered list of all lectures for this course. Student can click to select.
  - **Class Recordings tab** — numbered list of recorded Zoom classes. Student can click to select.
  - The currently playing item is highlighted.
- **Info card** below the video — shows title, description/subtitle, duration, and date of the selected item.
- **Curriculum section** — expandable modules showing topics inside each module.

### Attend Zoom Classes
- Student can see upcoming classes and past classes in separate sections.
- Upcoming class cards show: title, teacher name, date, time, duration, and a "Join Class" button.
- The "Join Class" button only appears when the class is live (Zoom API integration).
- Past class cards show: title, teacher, date, time (grayed out).
- If there are no upcoming classes, a friendly empty state message is shown.

### Browse & Apply to Jobs
- Student can see all available job postings as expandable cards.
- Student can filter jobs by type: All, Full-time, Part-time, Internship, Remote.
- Each card shows: job title, company, location, salary, type badge, deadline.
- When expanded, shows: full description, requirements list, posted date.
- **In-App Job Applications:**
  - Student can click "Apply Now" to apply to a job within the LMS.
  - The application process should let the student submit their application (and optionally upload a resume).
  - After applying, the student can see their application status (e.g., Applied, Shortlisted, Rejected).
  - Course Creators can view all applications for their job postings and update application status.
- If no jobs match the current filter, a friendly empty state is shown.

---

## 6. Video Lectures

### Uploading Lectures
- Course Creators can add lectures to a course in two ways:
  1. **Direct upload** — Upload a video file (e.g., .mp4) directly to the LMS. The system stores and streams the video.
  2. **External link** — Paste a URL from YouTube, Vimeo, Google Drive, or any video hosting platform. The system embeds or links to the video.
- When adding a lecture, the Course Creator provides: title, description, duration, and either a file or a URL.

### Watching Lectures
- Students and Teachers see a video player on the course detail page.
- They select a lecture from the playlist sidebar — the player loads that lecture.
- The currently playing lecture is highlighted in the playlist.

### Class Recordings
- Recorded Zoom classes appear as a separate tab in the student's playlist.
- Students can switch between "Lectures" and "Class Recordings" tabs.
- Recordings are listed by date and teacher name.

---

## 7. Zoom Class Integration

### Scheduling
- Teachers schedule Zoom classes by providing: title, batch, date, time, and duration.
- The system uses the Zoom API to automatically create a Zoom meeting.
- The generated Zoom link is stored and displayed to both the teacher and students.

### Live Class Flow
- Before the scheduled time: the class shows as "upcoming".
- When the teacher starts the meeting: the class status changes to "live" and the "Join Class" button becomes visible to students.
- When the meeting ends: the class status changes to "completed" and appears in the "Past Classes" section.

### Recordings
- If the Zoom meeting is recorded, the recording becomes available in the student's "Class Recordings" tab on the course detail page.

---

## 8. Batches

### What is a Batch
- A batch is a group of students being taught together over a specific time period.
- Each batch has: a name, a start date, an end date, an assigned teacher, and a status.

### Batch Status
- **Upcoming** — Batch hasn't started yet (before start date).
- **Active** — Batch is currently running (between start and end dates).
- **Completed** — Batch has finished (after end date).

### Batch-Course Relationship
- A course can be assigned to multiple batches (many-to-many).
- A batch can have multiple courses.
- Course Creators assign batches to courses from the course detail page.

### Batch-Student Relationship
- Each student belongs to exactly one batch.
- Students are added to batches by Admin or Course Creator.
- A student can be removed from a batch.

### Batch-Teacher Relationship
- Each batch has exactly one assigned teacher.
- A teacher can be assigned to multiple batches.

---

## 9. Courses

### What is a Course
- A course is a collection of lectures and curriculum modules.
- Each course has: a title, a description, a status, associated batches, lectures, and curriculum modules.

### Course Status
- **Upcoming** — Course hasn't started.
- **Active** — Course is currently being taught.
- **Completed** — Course is finished.

### Course Content
- **Lectures** — Ordered list of video lessons (uploaded files or external links).
- **Curriculum Modules** — Ordered list of modules, each containing a title, description, and topics.

---

## 10. Curriculum

### What is Curriculum
- The curriculum defines the structured outline of a course.
- It is organized into modules, and each module contains topics.

### Modules
- Each module has: a title, a description, an order number, and a list of topics.
- Modules are displayed in order and can be expanded/collapsed.
- Topics are simple text strings listed inside each module.

### Who Can Manage Curriculum
- Course Creators can add and delete modules.
- Teachers and Students can only view the curriculum.

---

## 11. Job Opportunities

### Posting Jobs
- Course Creators can post job opportunities for students.
- Each job has: title, company, location, type (full-time / part-time / internship / remote), salary, description, requirements, posted date, and deadline.

### Browsing Jobs
- Students can browse all available jobs.
- Students can filter by job type.
- Each job can be expanded to see full description and requirements.

### Applying to Jobs (In-App)
- Students can apply to a job directly within the LMS.
- When applying, the student can optionally upload a resume.
- After applying, the student sees their application status: **Applied**, **Shortlisted**, or **Rejected**.
- Course Creators can view all applications for each of their job postings.
- Course Creators can update a student's application status (shortlist or reject).

---

## 12. User Management Summary

| Action | Who Can Do It |
|--------|--------------|
| Create Admin account | System (pre-seeded) |
| Create Teacher account | Admin |
| Create Course Creator account | Admin |
| Create Student account | Admin, Course Creator |
| Activate/Deactivate Course Creator | Admin |
| Delete Course Creator | Admin |
| Add Student to Batch | Admin, Course Creator |
| Remove Student from Batch | Course Creator |
| Delete Batch | Course Creator |
| Assign Teacher to Batch | Admin, Course Creator |
| Change max device limit | Admin (from Settings page) |

---

## 13. Navigation Structure

### Admin Sidebar
- Dashboard
- Batches
- Students
- Teachers
- Course Creators
- Settings

### Course Creator Sidebar
- Dashboard
- Courses (with nested course detail pages)
- Batches
- Jobs

### Teacher Sidebar
- Dashboard
- My Courses (with nested course detail pages)
- My Batches
- Schedule Class

### Student Sidebar
- Dashboard
- Courses (with nested course detail pages)
- Zoom Classes
- Job Opportunities

---

## 14. Data Relationships Summary

```
Admin
  └── manages → Teachers, Course Creators, Students, Batches

Course Creator
  ├── creates → Courses, Lectures, Curriculum Modules, Jobs
  ├── manages → Batches, Students (within batches)
  └── reviews → Job Applications

Teacher
  ├── assigned to → Batches
  ├── views → Courses (through their batches)
  └── schedules → Zoom Classes

Student
  ├── belongs to → one Batch
  ├── enrolled in → Courses (through their batch)
  ├── watches → Lectures, Class Recordings
  ├── attends → Zoom Classes
  └── applies to → Jobs

Batch
  ├── has one → Teacher
  ├── has many → Students
  └── linked to many → Courses

Course
  ├── linked to many → Batches
  ├── has many → Lectures
  └── has many → Curriculum Modules

Zoom Class
  ├── belongs to → one Batch
  └── taught by → one Teacher

Job
  ├── posted by → Course Creator
  └── has many → Applications (from Students)
```

---

## 15. Status Definitions

| Entity | Statuses |
|--------|----------|
| Batch | upcoming, active, completed |
| Course | upcoming, active, completed |
| Student | active, inactive |
| Teacher | active, inactive |
| Course Creator | active, inactive |
| Zoom Class | upcoming, live, completed |
| Job Application | applied, shortlisted, rejected |

---

## 16. Features NOT Included (For Now)

- No notifications system (bell icon is placeholder)
- No forgot password or email verification
- No self-registration (all accounts created by admin)
- No real-time chat or messaging
- No grading or assessments
- No attendance tracking
- No certificates or completion tracking
- No analytics or reporting dashboards
- No drag-and-drop lecture reordering (visual handle exists but not functional)
- No course progress tracking for students
