# ICT Institute LMS — Tech Stack

This document describes every technology used in the LMS, what it does, why it was chosen, and how they all connect together.

---

## 1. Next.js (Web Frontend)

### What It Is
- A React-based web framework that runs in the browser on desktop and mobile.
- This is the website where Admin, Course Creators, Teachers, and Students access the LMS from their computers.

### What It Does In This Project
- Renders all 23+ pages of the LMS — dashboards, course pages, video players, forms, tables.
- Handles client-side routing between pages (no full page reloads).
- Communicates with Supabase for all data (read/write students, courses, batches, etc.).
- Communicates with Bunny.net for video playback (loads secure video URLs).
- Fully responsive — works on phones (360px) through large desktops (1440px+).

### Key Details
- **Version:** Next.js 13 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **State Management:** React useState (local state per page, no global store needed)
- **Deployed on:** Vercel

---

## 2. Flutter (Mobile App)

### What It Is
- A cross-platform mobile framework by Google.
- One codebase produces both an Android app (Google Play Store) and an iOS app (Apple App Store).

### What It Does In This Project
- Provides native mobile apps for Students and Teachers (primary mobile users).
- Connects to the exact same Supabase backend as the website — same data, same login, same everything.
- Students can watch lectures, attend Zoom classes, browse jobs, and apply to jobs from their phones.
- Teachers can view batches, schedule Zoom classes, and join Zoom classes from their phones. Teachers do not have access to lecture videos.

### Why Flutter Over React Native
- Easier to build polished, consistent UI with less effort.
- Better performance on low-end Android devices (common in Pakistan).
- Single codebase for both platforms with near-identical look and feel.

### Key Details
- **Language:** Dart
- **Supabase SDK:** `supabase_flutter` package
- **Video Player:** Uses Bunny.net embed URLs or a native video player widget
- **Screen Recording Protection:** Flutter allows detecting and blocking screen recording on mobile (video security)

---

## 3. Supabase (Backend — Database, Auth, API, Security)

### What It Is
- An open-source backend-as-a-service built on top of PostgreSQL.
- **This is the entire backend.** No custom Express/Django/Rails server needed.

### What It Does In This Project

#### Database (PostgreSQL)
- Stores ALL LMS data: users, students, teachers, course creators, batches, courses, lectures, curriculum modules, jobs, job applications, zoom classes, and their relationships.
- Relational database — properly enforces relationships (e.g., a student belongs to a batch, a batch belongs to a teacher, a course has many lectures).
- All queries are standard SQL under the hood.

#### Authentication
- Handles login and logout with email and password.
- Supports all 4 roles: Admin, Course Creator, Teacher, Student.
- No self-registration — Admin creates all accounts through the admin panel.
- Manages user sessions (JWT tokens) automatically.
- Supports auto-logout after inactivity period.
- Supports force-logout and account deactivation by Admin.

#### Auto-Generated API
- The moment you create a table in Supabase, both the Next.js website and the Flutter app can read and write data from it immediately.
- No REST endpoints to code manually — Supabase generates them automatically.
- Supports filtering, sorting, pagination, and joins out of the box.
- Provides copy-paste code examples for both JavaScript (Next.js) and Dart (Flutter).

#### Row Level Security (RLS)
- Controls who can see and modify what data, enforced at the database level.
- **Students** can only see their own batch data, their own courses, their own job applications.
- **Teachers** can only see batches assigned to them and students in those batches.
- **Course Creators** can only see and manage courses, lectures, and jobs they created.
- **Admins** can see and manage everything.
- Because security is enforced at the database level, it cannot be bypassed even if someone tries to call the API directly — the database itself rejects unauthorized requests.

#### Session Management
- Auto-logout after a configurable period of inactivity.
- Configurable device limit — by default, users can be logged in on up to 2 devices simultaneously. If they exceed the limit, the oldest session is terminated. The Admin can change this limit from the Settings page.
- Admin can force-logout any user.
- Admin can deactivate an account — the user is immediately logged out and cannot log back in.

#### File Storage (Supabase Storage)
- Stores small files: student resumes (for job applications), profile pictures, and attachments.
- **Not used for videos** — videos go to Bunny.net for proper streaming and CDN delivery.
- Files are organized into buckets with their own access rules.

#### Edge Functions
- Small serverless functions hosted on Supabase's edge network.
- Used for tasks that require server-side logic:
  - **Generating signed video URLs** — When a student opens a lecture, an Edge Function checks enrollment, then calls Bunny.net API to generate a temporary, expiring video URL.
  - **Zoom API calls** — When a teacher schedules a class, an Edge Function calls the Zoom API to create the meeting and returns the Zoom link.
  - **Device limit enforcement** — An Edge Function checks active sessions against the configurable device limit (default: 2) and terminates the oldest sessions when the limit is exceeded.
- Written in TypeScript (Deno runtime).
- Keeps API secrets (Bunny.net API key, Zoom API credentials) server-side where they cannot be exposed to the browser or app.

### How Apps Connect to Supabase
- Both the Next.js website and the Flutter app connect using just two values:
  - **Project URL** — The Supabase project endpoint
  - **Anon Key** — A public API key (safe to include in client code because RLS protects the data)
- The secret service key is only used in Edge Functions (never in client code).

---

## 4. Bunny.net Stream (Video Hosting & Streaming)

### What It Is
- A video hosting and CDN (Content Delivery Network) service optimized for streaming.
- This is where all lecture videos and Zoom class recordings are stored and served from.

### What It Does In This Project

#### Video Storage
- All lecture videos uploaded by Course Creators are stored on Bunny.net.
- Zoom class recordings (when available) are also stored here.
- This is where the hundreds or thousands of videos live — not on Supabase.

#### Auto Transcoding
- When a Course Creator uploads a single video, Bunny.net automatically creates multiple quality versions: 240p, 360p, 480p, 720p, 1080p.
- The video player automatically selects the best quality based on the student's internet speed.
- Students on slow mobile data get a low-quality stream (no buffering). Students on fast wifi get HD.

#### CDN Delivery
- Videos are served from the nearest Bunny.net server to the student.
- Bunny.net has edge servers across the globe including Asia/Pakistan — this means minimal buffering and fast load times for local students.

#### Video Security (Signed URLs)
- Videos are not publicly accessible. Every video URL is temporary and expires after a few minutes.
- **The flow:**
  1. Student opens a lecture page.
  2. The frontend calls a Supabase Edge Function.
  3. The Edge Function checks: Is this student enrolled in this course? Is their account active?
  4. If yes, the Edge Function generates a signed URL from Bunny.net that expires in a few minutes.
  5. The signed URL is returned to the frontend, and the video player loads it.
  6. If the student copies the URL and shares it, it will have already expired by the time someone else tries to use it.
- This prevents video piracy, link sharing, and unauthorized access.

#### Download Protection
- The video player disables the download button and right-click save.
- In the Flutter mobile app, screen recording detection can block recording attempts.
- These are deterrents — no system can 100% prevent screen recording, but these measures stop casual sharing.

### Upload Flow
- Course Creators upload videos through the LMS interface (website or app).
- Behind the scenes, the file is sent to Bunny.net via their API.
- The Course Creator never interacts with Bunny.net directly — they just see an upload button in the LMS.
- External links (YouTube, Vimeo, Google Drive) are also supported as an alternative to direct upload.

---

## 5. Zoom API (Live Classes)

### What It Is
- The official Zoom API that allows programmatic creation and management of Zoom meetings.
- ICT Institute has a paid Zoom plan with API access enabled.

### What It Does In This Project

#### Meeting Creation
- When a Teacher schedules a class in the LMS, the system automatically creates a Zoom meeting via the API.
- The teacher does not need to open Zoom separately or copy-paste meeting links manually.
- The generated Zoom join link and host link are stored in Supabase.

#### Status Syncing
- The Zoom API provides webhooks (real-time notifications) that tell us when:
  - A meeting starts → class status changes from "upcoming" to "live"
  - A meeting ends → class status changes from "live" to "completed"
- This status is reflected in real-time in the LMS for both the teacher and students.

#### Join Button Logic
- **Before the meeting starts:** Students see the class as "upcoming" — no join button.
- **When the meeting is live:** The "Join Class" button appears and is clickable.
- **After the meeting ends:** The class moves to "Past Classes" — grayed out, no join button.

#### Recording Retrieval
- If the Zoom meeting is recorded (cloud recording), the Zoom API can provide the recording URL after the meeting ends.
- The recording is then made available in the student's "Class Recordings" tab on the course detail page.
- Optionally, the recording can be transferred to Bunny.net for consistent streaming quality and security.

#### API Call Flow
- All Zoom API calls go through Supabase Edge Functions.
- The Zoom API credentials (Client ID, Client Secret, Account ID) are stored as environment variables in Supabase — never exposed to the browser or app.
- **Scheduling flow:**
  1. Teacher fills out the schedule form in the LMS (title, batch, date, time, duration).
  2. Frontend sends the data to a Supabase Edge Function.
  3. The Edge Function calls the Zoom API to create the meeting.
  4. The Zoom API returns the meeting ID, join URL, and host URL.
  5. The Edge Function stores everything in the Supabase database.
  6. The frontend displays the class with the Zoom link.

#### Zoom Webhooks
- Zoom sends webhook events to a Supabase Edge Function endpoint when meetings start, end, or are recorded.
- The Edge Function updates the class status in the database accordingly.
- This means the LMS stays in sync with Zoom without any polling or manual updates.

---

## 6. Vercel (Web Hosting)

### What It Is
- A hosting platform built specifically for Next.js applications.

### What It Does In This Project
- Hosts the Next.js website and serves it to users worldwide.
- **Zero DevOps** — push code to the Git repository and it deploys automatically within seconds.
- **Preview deployments** — every pull request gets its own preview URL for testing before going live.
- **Edge network** — the website is served from the nearest Vercel edge server to the user, ensuring fast load times globally.
- **Custom domain** — the LMS runs on ICT Institute's own domain (e.g., lms.ictinstitute.com).

---

## How Everything Connects

```
┌─────────────────────┐         ┌─────────────────────┐
│    Next.js Website   │         │    Flutter App       │
│    (Hosted on        │         │    (iOS + Android)   │
│     Vercel)          │         │                      │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │   Uses Supabase JS SDK        │   Uses Supabase Dart SDK
           │                               │
           └───────────────┬───────────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │      Supabase       │
                │                     │
                │  ┌───────────────┐  │
                │  │  PostgreSQL   │  │  ← All LMS data lives here
                │  │  Database     │  │
                │  └───────────────┘  │
                │                     │
                │  ┌───────────────┐  │
                │  │  Auth         │  │  ← Login, logout, sessions, roles
                │  └───────────────┘  │
                │                     │
                │  ┌───────────────┐  │
                │  │  Auto API     │  │  ← Read/write data from any table
                │  └───────────────┘  │
                │                     │
                │  ┌───────────────┐  │
                │  │  Row Level    │  │  ← Who can see/edit what
                │  │  Security     │  │
                │  └───────────────┘  │
                │                     │
                │  ┌───────────────┐  │
                │  │  Edge         │  │  ← Server-side logic
                │  │  Functions    │  │     (Zoom API, video URLs,
                │  └───────────────┘  │      session enforcement)
                │                     │
                │  ┌───────────────┐  │
                │  │  Storage      │  │  ← Resumes, profile pics
                │  └───────────────┘  │
                │                     │
                └──────────┬──────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
     ┌──────────────┐ ┌────────┐ ┌──────────────┐
     │  Bunny.net   │ │  Zoom  │ │  Supabase    │
     │  Stream      │ │  API   │ │  Storage     │
     │              │ │        │ │              │
     │  Stores and  │ │ Create │ │  Resumes,    │
     │  streams all │ │ meetings│ │  avatars,    │
     │  lecture     │ │ Sync   │ │  small files │
     │  videos &    │ │ status │ │              │
     │  recordings  │ │ Get    │ │              │
     │              │ │ recordings│              │
     └──────────────┘ └────────┘ └──────────────┘
```

### Data Flow Examples

**Student watches a lecture:**
1. Student opens course page → Next.js/Flutter loads course data from Supabase
2. Student clicks a lecture → Frontend calls Supabase Edge Function
3. Edge Function checks enrollment via database → Generates signed URL from Bunny.net API
4. Signed URL returned to frontend → Video player loads and streams the lecture
5. URL expires after a few minutes — cannot be reused or shared

**Teacher schedules a Zoom class:**
1. Teacher fills schedule form → Frontend sends data to Supabase Edge Function
2. Edge Function calls Zoom API → Meeting created, links returned
3. Edge Function stores meeting data in Supabase database
4. Students see the upcoming class on their dashboard
5. When teacher starts the meeting → Zoom webhook fires → Edge Function updates status to "live"
6. Students see "Join Class" button appear
7. When meeting ends → Zoom webhook fires → Status changes to "completed"

**Student applies to a job:**
1. Student clicks "Apply Now" → Frontend sends application to Supabase (with optional resume to Storage)
2. Application status set to "Applied" in database
3. Course Creator opens their job posting → Sees list of applicants from Supabase
4. Course Creator updates status to "Shortlisted" or "Rejected" → Database updated
5. Student sees their updated application status

---

## Estimated Monthly Costs

| Service | Plan | Cost | What You Get |
|---------|------|------|-------------|
| Supabase | Pro | $25/month | Database, Auth, API, Storage, Edge Functions for the entire LMS. 8GB database, 250GB bandwidth, 100GB file storage. |
| Vercel | Pro | $20/month | Website hosting with custom domain, automatic deployments, edge network, analytics. |
| Bunny.net Stream | Pay-as-you-go | $5–60/month | Video storage ($0.005/GB/month) + streaming bandwidth ($0.01/GB). Scales with how many students watch how many videos. |
| Zoom | Existing Plan | $0 (already paid) | API access for meeting creation, webhooks, and recordings. Uses ICT's existing Zoom subscription. |
| **Total** | | **$50–105/month** | **Complete LMS infrastructure for web + mobile** |

Costs scale primarily with video streaming bandwidth (number of students × hours watched), not with number of features, pages, or database tables.

---

## Security Summary

| Security Concern | How It's Handled | Service |
|-----------------|-----------------|---------|
| Who can access what data | Row Level Security policies on every table | Supabase RLS |
| Login and logout | Email + password authentication with JWT tokens | Supabase Auth |
| Auto-logout after inactivity | Configurable session timeout | Supabase Auth |
| Device limit (default 2 devices) | Edge Function checks active sessions, terminates oldest when limit exceeded. Admin can change the limit. | Supabase Edge Functions |
| Force logout / deactivate user | Admin triggers via Auth admin API | Supabase Auth |
| Video link protection | Signed URLs that expire in minutes | Bunny.net + Edge Functions |
| Video download prevention | Player disables download; mobile blocks screen recording | Bunny.net player + Flutter |
| API secrets kept safe | Zoom credentials, Bunny.net API key stored in Edge Function env vars only | Supabase Edge Functions |
| Public API key safety | Anon key is safe in client code because RLS protects all data | Supabase RLS |
| SQL injection prevention | Supabase SDK uses parameterized queries — no raw SQL in client code | Supabase SDK |

---

## Development Workflow

### Web (Next.js)
1. Developer writes code locally.
2. Pushes to GitHub.
3. Vercel automatically builds and deploys.
4. Preview URL generated for every pull request.
5. Merge to main → live site updates within seconds.

### Mobile (Flutter)
1. Developer writes code locally.
2. Builds APK (Android) or IPA (iOS) locally or via CI/CD.
3. Uploads to Google Play Store / Apple App Store.
4. Users update the app to get new features.

### Backend (Supabase)
1. Database schema changes made via Supabase Dashboard or SQL migrations.
2. RLS policies written as SQL and applied to tables.
3. Edge Functions deployed via Supabase CLI (`supabase functions deploy`).
4. No server to manage — Supabase handles scaling, backups, and uptime.

---

## SDK & Connection Details

### Next.js (Website)
```
Package: @supabase/supabase-js
Connects with: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Flutter (Mobile App)
```
Package: supabase_flutter
Connects with: SUPABASE_URL + SUPABASE_ANON_KEY
```

### Edge Functions (Server-Side)
```
Runtime: Deno (TypeScript)
Has access to: SUPABASE_SERVICE_ROLE_KEY (full database access, bypasses RLS)
Has access to: BUNNY_API_KEY, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID
```

Both the website and the mobile app use the same Supabase project, the same database, and the same Edge Functions. One backend powers everything.
