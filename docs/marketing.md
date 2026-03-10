# Zensbot LMS — Creative Team Brief

> **Document purpose:** Single source of truth for the creative/marketing team when producing ads, campaigns, landing pages, and sales materials for the Zensbot LMS product.
>
> **Last updated:** March 2026

---

## 1. Product Overview

**What it is:** A fully white-label, multi-tenant Learning Management System built for educational institutions, training academies, and edtech companies. Institutions get their own branded LMS — their logo, their colors, their domain — with zero coding required.

**Who it's for:**
- Coaching institutes & training academies
- Universities & colleges running online programs
- Corporate training departments
- EdTech companies reselling LMS under their brand

**Tagline options for creative use:**
- *"Your brand. Your academy. Fully yours."*
- *"The LMS that becomes yours."*
- *"Launch your branded academy in minutes."*

---

## 2. Platform Availability

| Platform | Status | Details |
|----------|--------|---------|
| **Web App** | Live | Full-featured dashboard at `https://ict.zensbot.site` — works on any modern browser |
| **Android App** | Live | Native app via Expo (React Native) — `com.zensbot.lms` |
| **iOS App** | Live | Universal app (iPhone + iPad) — `com.zensbot.lms` |

**Mobile app highlights for creative assets:**
- Biometric login (fingerprint / Face ID)
- Offline-friendly design
- Push notifications for announcements & class reminders
- Resume video playback from where you left off
- Download course materials on the go
- View & download certificates
- Browse & apply for jobs
- 5 main tabs: Home, Courses, Classes, Notifications, Profile

---

## 3. Core Features by Audience

### For Admins (Institute Owners)
- **Full dashboard** — students, courses, live classes, active sessions at a glance
- **User management** — create, edit, search, filter users by role & status
- **Batch management** — organize students into cohorts with date ranges
- **Branding control** — change logo, colors, institute name, favicon, theme presets — all from a UI
- **Certificate designer** — customize certificate colors, border styles, signatures, body text
- **Certificate approval** — review & batch-approve student certificate requests
- **Announcements** — post announcements scoped to institute, batch, or course
- **Monitoring** — error logs, system health, real-time alerts via Discord
- **Insights** — student progress trends, engagement metrics, completion rates
- **Device management** — view & terminate active sessions per user

### For Course Creators
- **Course builder** — create courses with titles, descriptions, status management
- **Curriculum editor** — organize content into modules and topics
- **Video uploads** — drag-and-drop video upload with automatic encoding (Bunny.net CDN)
- **External video support** — link YouTube or Vimeo videos directly
- **Materials** — upload PDFs, documents, and resources for students
- **Job portal** — post job listings with salary, requirements, deadlines

### For Teachers
- **Zoom class scheduling** — create live classes directly from the dashboard (Zoom API integration)
- **Multiple Zoom accounts** — manage several Zoom credentials per institute
- **Automatic attendance** — Zoom webhooks capture who attended and for how long
- **Recordings** — auto-download and stream past class recordings
- **Class reminders** — automated email reminders sent before every scheduled class

### For Students
- **Enrolled courses** — browse courses grouped by batch with full curriculum
- **Video learning** — stream lectures with resume-from-where-you-left-off
- **Live classes** — join Zoom sessions with one click, view recordings later
- **Certificates** — track progress per course, request certificates when eligible, download PDFs
- **Job board** — browse listings, apply with resume & cover letter, track application status
- **Announcements** — real-time notifications for institute/batch/course updates
- **Mobile app** — full learning experience on Android & iOS

---

## 4. White-Label & Branding

**This is a major selling point.** Every institute gets complete brand ownership:

- **Custom colors** — primary, accent, and background colors applied across the entire UI
- **6 preset themes** — one-click theme selection for quick setup
- **Custom logo** — appears in sidebar, login screen, and certificates
- **Custom favicon** — browser tab icon matches their brand
- **Institute name & tagline** — displayed throughout the platform
- **Custom domain** — each institute gets `[slug].ict.zensbot.site` (or their own domain)
- **Certificate branding** — institute logo, name, website, custom colors, border styles, and signature images on every PDF certificate

**Creative angle:** *"Zero coding. Full branding. It looks and feels like you built it yourself."*

---

## 5. Multi-Tenant SaaS Model

Each institute operates as an isolated tenant on a shared platform:

- **Subdomain isolation** — `acme.ict.zensbot.site`, `techschool.ict.zensbot.site`, etc.
- **Super Admin panel** — Zensbot manages all institutes from a centralized dashboard
- **Plan tiers** — Free, Basic, Pro, Enterprise with configurable limits
- **Quota enforcement** — user limits, storage quotas, video quotas per plan
- **Usage tracking** — real-time dashboard showing consumption vs. allowance
- **Trial management** — automatic suspension on trial expiry, conversion to paid plans
- **Data isolation** — each institute's users, courses, settings, and branding are completely separate

**Creative angle:** *"One platform. Unlimited academies. Each one uniquely branded."*

---

## 6. Live Learning (Zoom Integration)

- **Schedule classes** directly from the dashboard — no switching to Zoom
- **Students join with one click** from the Classes tab (web or mobile)
- **Automatic attendance tracking** — Zoom webhooks record who joined and when
- **Automated reminders** — email notifications sent 10 minutes before class
- **Recording auto-capture** — Zoom recordings are automatically imported and made available to students
- **Multiple Zoom accounts** — institutes can manage several Zoom credentials
- **Encrypted credentials** — Zoom API keys stored with Fernet encryption

**Real-time features (WebSockets):**
- Live class status updates (who's in class right now)
- Instant announcement delivery
- Active session tracking

**Creative angle:** *"Live classes, automatic attendance, instant recordings — teaching just got easier."*

---

## 7. Video Hosting & Security

Built on **Bunny.net CDN** for enterprise-grade video delivery:

- **Drag-and-drop upload** — TUS protocol with 50MB chunked uploads and 5 parallel streams
- **Automatic encoding** — Bunny handles transcoding; status tracked (pending → processing → ready)
- **Signed URLs** — time-limited, secure embed links for every video
- **Anti-piracy watermark** — student's email displayed as an overlay during playback
- **Resume playback** — students pick up exactly where they left off
- **External video support** — YouTube and Vimeo embeds alongside hosted content
- **Global CDN** — fast streaming worldwide via Bunny.net edge network

**Creative angle:** *"Your content, protected. Watermarked, signed, and securely delivered worldwide."*

---

## 8. Certificates

A fully customizable, verifiable certificate system:

- **Custom design** — colors, border styles (Classic / Modern / Ornate), signatures, body text
- **Institute branding** — logo, name, and website printed on every certificate
- **Unique certificate IDs** — formatted as `ICT-2026-00001` (auto-incrementing per year)
- **QR code verification** — every certificate has an embedded QR code linking to a public verification page
- **Public verification** — anyone can verify a certificate at `/certificates/verify/{code}` (no login needed)
- **Approval workflow** — students request → admin reviews → certificate generated as PDF
- **Progress tracking** — students see completion percentage per course and eligibility status
- **PDF download** — professional landscape A4 certificates generated with ReportLab

**Creative angle:** *"Beautiful, verifiable certificates your students will be proud to share."*

---

## 9. Job Portal

Built-in career placement — not a bolt-on:

- **Post job listings** — title, company, location, salary range, requirements, deadline
- **Student applications** — apply with resume and cover letter directly in the platform
- **Application tracking** — students track status of their submissions
- **Admin oversight** — manage all job listings and applications from the dashboard

**Creative angle:** *"From learning to earning — career placement built right in."*

---

## 10. Analytics & Monitoring

### Admin Insights
- Total students, active courses, live classes, active sessions — all at a glance
- Student progress trends and engagement metrics
- Course completion rates
- Date-range filtering for custom analysis

### System Monitoring
- **Error log aggregation** — filterable by level, source, resolved status
- **Request tracking** — every API call tagged with a unique `X-Request-ID`
- **Sentry integration** — automatic error capture and reporting
- **Discord alerts** — instant webhook notifications on 5xx server errors
- **Activity audit trail** — user actions logged for compliance

**Creative angle:** *"Know exactly how your academy is performing — in real time."*

---

## 11. Security & Compliance

- **JWT authentication** — access tokens (15 min) + refresh tokens (7 days) with automatic rotation
- **Bcrypt password hashing** — industry-standard with salt
- **Device limit enforcement** — max concurrent sessions per user, per-device logout
- **Rate limiting** — 5 attempts/min on login, 10/min on token refresh
- **Encrypted credentials** — Zoom API keys protected with Fernet encryption
- **Soft deletes** — nothing is permanently deleted; full audit trail preserved
- **Role-based access control** — 5 roles (super_admin, admin, course_creator, teacher, student) with granular permissions
- **CORS protection** — configurable allowed origins
- **Institute suspension checks** — middleware blocks access to suspended/expired tenants
- **Biometric auth** — fingerprint and Face ID on mobile

**Creative angle:** *"Enterprise-grade security, built in from day one."*

---

## 12. Infrastructure & Reliability

| Component | Technology | Details |
|-----------|-----------|---------|
| **Backend** | FastAPI (Python 3.11) | Async, high-performance API with 17 route modules |
| **Frontend** | Next.js 13 + TypeScript | Server-side rendering, Tailwind CSS, Shadcn UI |
| **Mobile** | React Native (Expo) | Cross-platform iOS & Android from single codebase |
| **Database** | PostgreSQL (AWS RDS) | Managed, auto-backed-up, same-region as compute |
| **Compute** | AWS EC2 (Mumbai) | Ubuntu 24.04, Nginx reverse proxy, Systemd managed |
| **Video CDN** | Bunny.net | Global edge delivery, TUS uploads, auto-encoding |
| **File Storage** | AWS S3 | Presigned URLs for secure material downloads |
| **Frontend Hosting** | Vercel | Automatic deployments, edge network, wildcard domains |
| **CI/CD** | GitHub Actions | Auto-deploy on push to main — compile check + SSH deploy |
| **Error Tracking** | Sentry + Discord | Real-time error capture with instant notifications |
| **Real-Time** | WebSockets | 3 channels for live class status, announcements, sessions |

**Creative angle:** *"Built on AWS. Deployed on Vercel. Powered by the modern stack."*

---

## 13. Zensbot.com Value-Add

**Standard LMS** gives institutions everything above. **Zensbot custom engagement** unlocks deeper capabilities:

### What Zensbot.com Offers Beyond the Platform
- **Custom roles** — need a "Department Head" or "Teaching Assistant" role? We build it
- **Custom workflows** — approval chains, notification rules, escalation paths tailored to your process
- **Deeper integrations** — connect to your existing ERP, payment gateway, HR system, or student portal
- **Custom reporting** — bespoke analytics dashboards for your specific KPIs
- **White-glove onboarding** — dedicated setup, data migration, and training for your team
- **Priority support** — direct line to the engineering team for urgent issues
- **Custom feature development** — any feature your institution needs, built and maintained by Zensbot
- **Dedicated infrastructure** — isolated servers and databases for high-security requirements
- **SLA guarantees** — uptime commitments and response time agreements

**Creative angle:** *"The LMS adapts to you — not the other way around. Zensbot.com makes it happen."*

**Positioning:** The standard platform is powerful out of the box. Zensbot.com is for institutions that want it to be *exactly* theirs — custom roles, custom logic, custom everything.

---

## 14. Key Selling Points — Quick Reference for Ad Copy

### One-Liners
- "Launch your branded academy in minutes — not months"
- "Your logo. Your colors. Your domain. Zero coding."
- "Live classes with automatic attendance — teaching just got smarter"
- "Beautiful certificates with QR verification your students will share"
- "From learning to earning — career placement built right in"
- "Enterprise security meets simple setup"
- "Web + iOS + Android — your students learn everywhere"
- "One platform, unlimited branded academies"

### Feature Bullets (for landing pages / ads)
- White-label branding (logo, colors, themes, domain)
- Web, iOS & Android apps
- Zoom live classes with auto-attendance
- Bunny.net video CDN with anti-piracy watermarks
- Customizable PDF certificates with QR verification
- Built-in job portal & career placement
- Multi-tenant SaaS with plan tiers & quotas
- Real-time announcements & push notifications
- Admin analytics & monitoring dashboard
- JWT auth, device limits, encrypted credentials
- AWS infrastructure with CI/CD auto-deploy
- Custom roles & features via Zensbot.com

### Audience-Specific Hooks

**For institute owners:**
> "Stop paying for an LMS that looks like everyone else's. Get your own branded academy — your logo, your colors, your domain — live in minutes."

**For teachers:**
> "Schedule Zoom classes, track attendance automatically, and share recordings — all from one dashboard."

**For students:**
> "Learn on any device. Resume videos where you left off. Earn verified certificates. Find jobs — all in one place."

**For edtech entrepreneurs:**
> "Launch a multi-tenant LMS SaaS. Give each client their own branded academy with isolated data, custom domains, and plan-tier billing."

---

## Appendix: Visual Asset Suggestions

| Asset Type | Suggested Content |
|------------|------------------|
| **Hero screenshot** | Admin dashboard with branding panel open showing color customization |
| **Mobile mockup** | iPhone/Android showing course list and video player |
| **Certificate showcase** | Sample certificate with QR code, custom branding, ornate border |
| **Split screen** | Two institutes with different branding on the same platform |
| **Zoom integration** | Class scheduling view → live class → attendance report flow |
| **Video player** | Lecture playing with student email watermark visible |
| **Job portal** | Student browsing job listings and submitting application |
| **Before/after** | Generic LMS vs. white-labeled version with custom branding |
