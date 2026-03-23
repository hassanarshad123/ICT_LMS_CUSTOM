# ICT Institute LMS — Handover Package

**Date:** March 2026
**Prepared by:** Zensbot
**Support:** WhatsApp +923362219755

---

## 1. Platform Access

| Item | Details |
|------|---------|
| **Frontend URL** | https://zensbot.online |
| **Login Page** | https://zensbot.online (opens directly to login) |
| **API (backend)** | https://apiict.zensbot.site |

---

## 2. User Accounts

These are the initial accounts created for your team to explore and test the system. **Change the passwords after your first login.**

| Role | Name | Email | Password |
|------|------|-------|----------|
| **Admin** | ICT Admin | admin@ict.net.pk | ICTAdmin@2026 |
| **Course Creator** | ICT Course Creator | creator@ict.net.pk | ICTCreator@2026 |
| **Teacher** | ICT Teacher | teacher@ict.net.pk | ICTTeacher@2026 |
| **Student** | ICT Student | student@ict.net.pk | ICTStudent@2026 |

> **Important:** Log in with each account and go to **Settings → Change Password** to set a strong password before sharing access with your real users.

---

## 3. Role Overview

### Admin
The highest-privilege role. Can manage all users (create, edit, disable), configure branding (logo, colors, institute name), manage certificates, view system monitoring, and access all data across the platform.

### Course Creator
Manages the academic content layer. Creates and edits courses, builds curriculum (modules + lectures), uploads video content, assigns courses to batches, and manages job postings.

### Teacher
Operates within assigned batches. Can view their schedule, conduct Zoom classes, take attendance, post announcements, view enrolled students, and track lecture progress.

### Student
Can access enrolled batch content, watch lecture videos, view their schedule and attendance, download completion certificates, and browse job listings.

---

## 4. Navigation Guide

### Admin Sidebar

| Menu Item | Description |
|-----------|-------------|
| **Dashboard** | Overview stats — total users, active batches, recent activity |
| **Users** | View, create, edit, and deactivate all users across all roles |
| **Batches** | Create and manage batches; assign teachers and enroll students |
| **Courses** | View all courses in the system |
| **Jobs** | View and manage job postings |
| **Announcements** | View system-wide announcements |
| **Certificates** | View and manage issued certificates; download PDFs |
| **Zoom Accounts** | Add/remove Zoom accounts linked to the platform |
| **Branding** | Set institute name, tagline, logo, favicon, and color themes |
| **Settings** | Configure system-wide settings (device limits, certificate thresholds, etc.) |
| **Monitoring** | View error logs, API health, and system performance metrics |
| **Schedule** | View the global class calendar |

### Course Creator Sidebar

| Menu Item | Description |
|-----------|-------------|
| **Dashboard** | Overview of their courses and content |
| **Courses** | Create and manage courses; build curriculum with modules and lectures |
| **Batches** | View batches and assign/unassign courses to batches |
| **Jobs** | Post and manage job listings |
| **Announcements** | Post announcements to batches |

### Teacher Sidebar

| Menu Item | Description |
|-----------|-------------|
| **Dashboard** | Overview of their assigned batches and upcoming classes |
| **My Batches** | View batches they are assigned to |
| **Schedule** | View upcoming Zoom classes |
| **Classes** | Manage Zoom classes — create, start, view recordings, mark attendance |
| **Students** | View students enrolled in their batches |
| **Announcements** | Post announcements to their batches |

### Student Sidebar

| Menu Item | Description |
|-----------|-------------|
| **Dashboard** | Overview of enrolled batch, upcoming classes, and progress |
| **My Batch** | Access course content, watch lectures, track progress |
| **Schedule** | View upcoming Zoom class schedule |
| **Certificates** | Download completion certificates |
| **Jobs** | Browse job listings posted by the institute |
| **Announcements** | View announcements from teachers and admins |

---

## 5. Getting Started: Admin Setup Workflow

Follow these steps in order the first time you set up the platform for real use.

### Step 1 — Configure Branding
1. Log in as **Admin** at https://zensbot.online
2. Go to **Branding** in the sidebar
3. Set your **Institute Name**, **Tagline**, and upload your **Logo** and **Favicon**
4. Choose a **color theme** or set custom primary/secondary colors
5. Click **Save** — changes apply immediately across the entire platform

### Step 2 — Configure Settings
1. Go to **Settings** in the sidebar
2. Set the **device limit** (e.g., 1 device per student to prevent sharing)
3. Set the **minimum attendance percentage** required for certificate eligibility
4. Set the **minimum lecture progress** required for certificate eligibility
5. Save settings

### Step 3 — Add Real Users
1. Go to **Users** in the sidebar
2. Click **Add User**
3. Create accounts for your Course Creator, Teachers, and Students
4. Set roles, names, emails, and initial passwords
5. Share credentials with each person

> **Tip:** Create the Course Creator account first — they'll need to create courses before you can set up batches.

### Step 4 — Create Courses (Course Creator)
1. Log in as **Course Creator**
2. Go to **Courses** → **Create Course**
3. Fill in course name, description, and thumbnail
4. Inside the course, go to **Curriculum** → add **Modules** and **Lectures**
5. For each lecture, either upload a video (hosted on Bunny.net CDN) or paste an external URL (YouTube/Vimeo)
6. Publish the course when ready

### Step 5 — Create Batches (Admin)
1. Log in as **Admin** → go to **Batches** → **Create Batch**
2. Set batch name, start/end dates, and batch type (full-time/part-time)
3. Assign a **Teacher** to the batch
4. Enroll **Students** into the batch
5. Go to **Courses** tab within the batch and assign courses to it

### Step 6 — Schedule Zoom Classes (Teacher)
1. Log in as **Teacher** → go to **Classes**
2. Click **Schedule Class**
3. Set the topic, date, time, and duration
4. The class will appear in students' schedules automatically
5. Start the class when it's time — recordings are saved automatically

### Step 7 — Post Announcements
- Teachers and Admins can post announcements from the **Announcements** section
- Students receive real-time notifications in their sidebar

---

## 6. Key Features Quick Reference

### Video Hosting
- Videos are hosted on **Bunny.net CDN** — fast global delivery
- Course Creators upload videos directly from the Lectures page
- Students watch via a secure, watermarked player (their email is shown as a watermark to prevent sharing)
- Supported: direct upload OR external URL (YouTube, Vimeo)

### Zoom Integration
- Teachers schedule classes from the platform — Zoom links are auto-generated
- Students see the join link in their Schedule
- Attendance is automatically tracked when students join
- Recordings are saved and linked to the class

### Certificates
- Auto-generated PDF certificates for students who meet attendance + lecture thresholds
- Admin can customize the certificate design (colors, institute name, signatures, border style) from **Branding**
- Students download from their **Certificates** page

### Job Board
- Course Creators post job listings with requirements and application deadline
- Students browse and apply from the **Jobs** section
- Admin and Course Creator can view all applicants

### Announcements & Notifications
- Announcements are visible in-app to all students in the batch
- Real-time notifications appear in the top bar
- Teachers can target specific batches

---

## 7. Important Notes

1. **Change passwords immediately** after first login for all accounts
2. **Device limit:** By default, students are limited to 1 active device. If a student is locked out, Admin can clear their sessions from the Users page
3. **Zoom accounts:** You need to add at least one Zoom account under **Admin → Zoom Accounts** before teachers can schedule classes. Each Zoom account can host one simultaneous class
4. **Video uploads:** Large videos may take a few minutes to process after upload. The status shows "Processing" until ready
5. **Branding:** Changes to branding (colors, logo) take effect immediately — no page reload needed for other users
6. **Certificate design:** The certificate design is separate from site branding. Configure it under **Admin → Branding → Certificate Design**
7. **Backup:** Your data is stored on AWS RDS (Mumbai region) with automated daily backups

---

## 8. Support Contact

For technical issues, feature requests, or questions:

**Zensbot**
WhatsApp: **+923362219755**

Please include a screenshot or screen recording of the issue when contacting support — it helps resolve issues faster.
