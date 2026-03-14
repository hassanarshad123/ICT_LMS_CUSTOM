"""
Seed the 'ICT' institute with admin, course_creator, teacher, and student accounts,
plus demo batches, courses, curriculum, lectures, announcements, jobs, and notifications.

Creates the institute if it doesn't exist.

Accounts created:
  admin@ict.net.pk   / admin123   (admin)
  cc@ict.net.pk      / cc123456   (course_creator)
  teacher@ict.net.pk / teacher123 (teacher)
  student@ict.net.pk / student123 (student)

Usage:
    cd backend
    python scripts/seed_ict_data.py
"""
import asyncio
import os
import sys
import uuid
from datetime import date, datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main():
    from app.database import async_session
    from app.models.user import User
    from app.models.institute import Institute, InstituteUsage
    from app.models.batch import Batch, StudentBatch
    from app.models.course import Course, BatchCourse, Lecture, CurriculumModule
    from app.models.announcement import Announcement
    from app.models.job import Job
    from app.models.notification import Notification
    from app.models.enums import (
        UserRole, CourseStatus, VideoType, AnnouncementScope,
        JobType,
    )
    from app.models.institute import InstituteStatus, PlanTier
    from app.utils.security import hash_password
    from sqlmodel import select

    # ── Credentials ─────────────────────────────────────────────
    SLUG = "ict"
    INSTITUTE_NAME = "ICT"
    CONTACT_EMAIL = "admin@ict.net.pk"

    ADMIN_EMAIL = "admin@ict.net.pk"
    ADMIN_PASSWORD = "admin123"
    ADMIN_NAME = "ICT Admin"

    CC_EMAIL = "cc@ict.net.pk"
    CC_PASSWORD = "cc123456"
    CC_NAME = "ICT Course Creator"

    TEACHER_EMAIL = "teacher@ict.net.pk"
    TEACHER_PASSWORD = "teacher123"
    TEACHER_NAME = "ICT Teacher"

    STUDENT_EMAIL = "student@ict.net.pk"
    STUDENT_PASSWORD = "student123"
    STUDENT_NAME = "ICT Student"

    async with async_session() as session:
        # ── 1. Create or find the ICT institute ─────────────────
        result = await session.execute(
            select(Institute).where(
                Institute.slug == SLUG,
                Institute.deleted_at.is_(None),
            )
        )
        institute = result.scalar_one_or_none()
        if not institute:
            institute = Institute(
                name=INSTITUTE_NAME,
                slug=SLUG,
                contact_email=CONTACT_EMAIL,
                status=InstituteStatus.active,
                plan_tier=PlanTier.pro,
                max_users=999999,
                max_storage_gb=999999.0,
                max_video_gb=999999.0,
                expires_at=None,
            )
            session.add(institute)
            await session.flush()

            # Create usage tracker
            usage = InstituteUsage(institute_id=institute.id)
            session.add(usage)
            await session.flush()
            print(f"Created institute: {INSTITUTE_NAME} (slug={SLUG})")
        else:
            print(f"Found existing institute: {institute.name} (slug={SLUG})")

        inst_id = institute.id

        # ── 2. Create admin ─────────────────────────────────────
        result = await session.execute(
            select(User).where(
                User.email == ADMIN_EMAIL,
                User.institute_id == inst_id,
                User.deleted_at.is_(None),
            )
        )
        admin = result.scalar_one_or_none()
        if not admin:
            admin = User(
                email=ADMIN_EMAIL,
                name=ADMIN_NAME,
                hashed_password=hash_password(ADMIN_PASSWORD),
                role=UserRole.admin,
                institute_id=inst_id,
            )
            session.add(admin)
            await session.flush()
            print(f"Created admin: {ADMIN_EMAIL}")
        else:
            print(f"Found existing admin: {ADMIN_EMAIL}")
        admin_id = admin.id

        # ── 3. Create course creator ────────────────────────────
        result = await session.execute(
            select(User).where(
                User.email == CC_EMAIL,
                User.institute_id == inst_id,
                User.deleted_at.is_(None),
            )
        )
        cc = result.scalar_one_or_none()
        if not cc:
            cc = User(
                email=CC_EMAIL,
                name=CC_NAME,
                hashed_password=hash_password(CC_PASSWORD),
                role=UserRole.course_creator,
                institute_id=inst_id,
            )
            session.add(cc)
            await session.flush()
            print(f"Created course creator: {CC_EMAIL}")
        else:
            print(f"Found existing course creator: {CC_EMAIL}")
        cc_id = cc.id

        # ── 4. Create teacher ───────────────────────────────────
        result = await session.execute(
            select(User).where(
                User.email == TEACHER_EMAIL,
                User.institute_id == inst_id,
                User.deleted_at.is_(None),
            )
        )
        teacher = result.scalar_one_or_none()
        if not teacher:
            teacher = User(
                email=TEACHER_EMAIL,
                name=TEACHER_NAME,
                hashed_password=hash_password(TEACHER_PASSWORD),
                phone="+923001112233",
                specialization="Computer Science",
                role=UserRole.teacher,
                institute_id=inst_id,
            )
            session.add(teacher)
            await session.flush()
            print(f"Created teacher: {TEACHER_EMAIL}")
        else:
            print(f"Found existing teacher: {TEACHER_EMAIL}")
        teacher_id = teacher.id

        # ── 5. Create student ───────────────────────────────────
        result = await session.execute(
            select(User).where(
                User.email == STUDENT_EMAIL,
                User.institute_id == inst_id,
                User.deleted_at.is_(None),
            )
        )
        student = result.scalar_one_or_none()
        if not student:
            student = User(
                email=STUDENT_EMAIL,
                name=STUDENT_NAME,
                hashed_password=hash_password(STUDENT_PASSWORD),
                phone="+923009998877",
                role=UserRole.student,
                institute_id=inst_id,
            )
            session.add(student)
            await session.flush()
            print(f"Created student: {STUDENT_EMAIL}")
        else:
            print(f"Found existing student: {STUDENT_EMAIL}")
        student_id = student.id

        # ── 6. Create batches ───────────────────────────────────
        batches_data = [
            {
                "name": "ICT Web Development 2026",
                "teacher_id": teacher_id,
                "start_date": date(2026, 3, 1),
                "end_date": date(2026, 8, 31),
            },
            {
                "name": "ICT Python Programming 2026",
                "teacher_id": teacher_id,
                "start_date": date(2026, 4, 1),
                "end_date": date(2026, 9, 30),
            },
        ]

        batch_ids = []
        for bdata in batches_data:
            result = await session.execute(
                select(Batch).where(
                    Batch.name == bdata["name"],
                    Batch.institute_id == inst_id,
                    Batch.deleted_at.is_(None),
                )
            )
            batch = result.scalar_one_or_none()
            if not batch:
                batch = Batch(
                    name=bdata["name"],
                    teacher_id=bdata["teacher_id"],
                    start_date=bdata["start_date"],
                    end_date=bdata["end_date"],
                    created_by=admin_id,
                    institute_id=inst_id,
                )
                session.add(batch)
                await session.flush()
                print(f"Created batch: {bdata['name']}")
            batch_ids.append(batch.id)

        # ── 7. Enroll student in first batch ────────────────────
        result = await session.execute(
            select(StudentBatch).where(
                StudentBatch.student_id == student_id,
                StudentBatch.batch_id == batch_ids[0],
                StudentBatch.removed_at.is_(None),
            )
        )
        if not result.scalar_one_or_none():
            session.add(StudentBatch(
                student_id=student_id,
                batch_id=batch_ids[0],
                enrolled_by=admin_id,
                institute_id=inst_id,
            ))
            await session.flush()
            print("Enrolled student in ICT Web Development 2026")

        # ── 8. Create courses ───────────────────────────────────
        courses_data = [
            {
                "title": "Introduction to Programming with Python",
                "description": "A comprehensive introduction to programming using Python. Covers variables, control flow, functions, OOP, file handling, and real-world projects.",
                "batch_index": 1,
                "modules": [
                    {"title": "Python Basics", "topics": ["Installing Python", "REPL & IDEs", "Variables & Data Types", "Operators"], "order": 1},
                    {"title": "Control Flow", "topics": ["If/Elif/Else", "For Loops", "While Loops", "Break & Continue"], "order": 2},
                    {"title": "Functions & Modules", "topics": ["Defining Functions", "Parameters & Return", "Scope", "Importing Modules"], "order": 3},
                    {"title": "Object-Oriented Programming", "topics": ["Classes & Objects", "Inheritance", "Encapsulation", "Polymorphism"], "order": 4},
                ],
                "lectures": [
                    {"title": "Python Installation & Setup", "url": "https://www.youtube.com/watch?v=YYXdXT2l-Gg", "duration": 1560, "order": 1},
                    {"title": "Variables and Data Types", "url": "https://www.youtube.com/watch?v=kqtD5dpn9C8", "duration": 2040, "order": 2},
                    {"title": "Control Flow in Python", "url": "https://www.youtube.com/watch?v=Zp5MuPOtsSY", "duration": 1800, "order": 3},
                    {"title": "Functions in Python", "url": "https://www.youtube.com/watch?v=9Os0o3wzS_I", "duration": 2400, "order": 4},
                    {"title": "OOP in Python", "url": "https://www.youtube.com/watch?v=JeznW_7DlB0", "duration": 3600, "order": 5},
                ],
            },
            {
                "title": "Web Development Fundamentals",
                "description": "Build responsive websites from scratch using HTML5, CSS3, and JavaScript. Covers modern layout techniques, DOM manipulation, and responsive design.",
                "batch_index": 0,
                "modules": [
                    {"title": "HTML5 Essentials", "topics": ["Document Structure", "Semantic Elements", "Forms & Inputs", "Tables & Lists"], "order": 1},
                    {"title": "CSS3 Styling", "topics": ["Selectors & Specificity", "Box Model", "Flexbox", "CSS Grid"], "order": 2},
                    {"title": "Responsive Design", "topics": ["Media Queries", "Mobile-First", "Viewport Units", "Responsive Images"], "order": 3},
                    {"title": "JavaScript Basics", "topics": ["Variables & Types", "DOM Manipulation", "Events", "Fetch API"], "order": 4},
                ],
                "lectures": [
                    {"title": "HTML Crash Course", "url": "https://www.youtube.com/watch?v=UB1O30fR-EE", "duration": 3600, "order": 1},
                    {"title": "CSS Fundamentals", "url": "https://www.youtube.com/watch?v=yfoY53QXEnI", "duration": 4200, "order": 2},
                    {"title": "Flexbox Tutorial", "url": "https://www.youtube.com/watch?v=JJSoEo8JSnc", "duration": 1200, "order": 3},
                    {"title": "JavaScript for Beginners", "url": "https://www.youtube.com/watch?v=W6NZfCO5SIk", "duration": 4800, "order": 4},
                ],
            },
            {
                "title": "Database Management with SQL",
                "description": "Learn relational database concepts, SQL queries, joins, subqueries, and database design. Hands-on with PostgreSQL.",
                "batch_index": 1,
                "modules": [
                    {"title": "Introduction to Databases", "topics": ["What is a Database?", "RDBMS Concepts", "Installing PostgreSQL", "psql CLI"], "order": 1},
                    {"title": "SQL Fundamentals", "topics": ["SELECT", "WHERE & Filtering", "ORDER BY & LIMIT", "INSERT/UPDATE/DELETE"], "order": 2},
                    {"title": "Joins & Relationships", "topics": ["INNER JOIN", "LEFT/RIGHT JOIN", "Many-to-Many", "Foreign Keys"], "order": 3},
                ],
                "lectures": [
                    {"title": "SQL Tutorial for Beginners", "url": "https://www.youtube.com/watch?v=HXV3zeQKqGY", "duration": 5400, "order": 1},
                    {"title": "PostgreSQL Full Course", "url": "https://www.youtube.com/watch?v=qw--VYLpxG4", "duration": 7200, "order": 2},
                ],
            },
        ]

        for cdata in courses_data:
            target_batch_id = batch_ids[cdata["batch_index"]]

            result = await session.execute(
                select(Course).where(
                    Course.title == cdata["title"],
                    Course.institute_id == inst_id,
                    Course.deleted_at.is_(None),
                )
            )
            course = result.scalar_one_or_none()
            if not course:
                course = Course(
                    title=cdata["title"],
                    description=cdata["description"],
                    status=CourseStatus.active,
                    created_by=cc_id,
                    institute_id=inst_id,
                )
                session.add(course)
                await session.flush()
                print(f"Created course: {cdata['title']}")
            course_id = course.id

            # Link course to batch
            result = await session.execute(
                select(BatchCourse).where(
                    BatchCourse.batch_id == target_batch_id,
                    BatchCourse.course_id == course_id,
                    BatchCourse.deleted_at.is_(None),
                )
            )
            if not result.scalar_one_or_none():
                session.add(BatchCourse(
                    batch_id=target_batch_id,
                    course_id=course_id,
                    assigned_by=admin_id,
                    institute_id=inst_id,
                ))
                await session.flush()
                print(f"  Linked to batch")

            # Curriculum modules
            for mdata in cdata["modules"]:
                result = await session.execute(
                    select(CurriculumModule).where(
                        CurriculumModule.course_id == course_id,
                        CurriculumModule.title == mdata["title"],
                        CurriculumModule.deleted_at.is_(None),
                    )
                )
                if not result.scalar_one_or_none():
                    session.add(CurriculumModule(
                        course_id=course_id,
                        title=mdata["title"],
                        description=f"Module: {mdata['title']}",
                        sequence_order=mdata["order"],
                        topics=mdata["topics"],
                        created_by=cc_id,
                        institute_id=inst_id,
                    ))
                    print(f"  Created module: {mdata['title']}")

            # Lectures (external YouTube URLs)
            for ldata in cdata["lectures"]:
                result = await session.execute(
                    select(Lecture).where(
                        Lecture.course_id == course_id,
                        Lecture.title == ldata["title"],
                        Lecture.deleted_at.is_(None),
                    )
                )
                if not result.scalar_one_or_none():
                    session.add(Lecture(
                        batch_id=target_batch_id,
                        course_id=course_id,
                        title=ldata["title"],
                        description=f"Watch: {ldata['title']}",
                        duration=ldata["duration"],
                        video_type=VideoType.external,
                        video_url=ldata["url"],
                        video_status="ready",
                        sequence_order=ldata["order"],
                        created_by=cc_id,
                        institute_id=inst_id,
                    ))
                    print(f"  Created lecture: {ldata['title']}")

            await session.flush()

        # ── 9. Create announcements ─────────────────────────────
        announcements_data = [
            {
                "title": "Welcome to ICT Institute!",
                "content": "Welcome to ICT Institute! We are excited to have you here. Please check your batch schedule and start exploring the courses assigned to you. If you have any questions, reach out to your teacher or the admin.",
                "scope": AnnouncementScope.institute,
            },
            {
                "title": "Web Development Batch — Important Update",
                "content": "All students enrolled in the Web Development 2026 batch: please ensure you complete the HTML & CSS modules before the end of April. Assignments will be posted shortly.",
                "scope": AnnouncementScope.batch,
                "batch_id": batch_ids[0],
            },
        ]

        for adata in announcements_data:
            result = await session.execute(
                select(Announcement).where(
                    Announcement.title == adata["title"],
                    Announcement.institute_id == inst_id,
                )
            )
            if not result.scalar_one_or_none():
                ann = Announcement(
                    title=adata["title"],
                    content=adata["content"],
                    scope=adata["scope"],
                    posted_by=admin_id,
                    institute_id=inst_id,
                )
                if "batch_id" in adata:
                    ann.batch_id = adata["batch_id"]
                session.add(ann)
                print(f"Created announcement: {adata['title']}")

        # ── 10. Create job postings ─────────────────────────────
        jobs_data = [
            {
                "title": "Junior Web Developer",
                "company": "ICT Solutions Pvt Ltd",
                "location": "Islamabad, Pakistan",
                "job_type": JobType.full_time,
                "salary": "80,000 - 120,000 PKR",
                "description": "We are looking for a junior web developer proficient in HTML, CSS, JavaScript, and React. Experience with REST APIs is a plus.",
                "requirements": ["HTML/CSS", "JavaScript", "React", "Git", "REST APIs"],
                "deadline": datetime(2026, 9, 30, tzinfo=timezone.utc),
            },
            {
                "title": "Python Backend Intern",
                "company": "DataTech Pakistan",
                "location": "Lahore, Pakistan",
                "job_type": JobType.internship,
                "salary": "30,000 - 50,000 PKR",
                "description": "3-month paid internship for students who have completed Python fundamentals. You will work with FastAPI and PostgreSQL.",
                "requirements": ["Python", "SQL", "Basic API knowledge"],
                "deadline": datetime(2026, 7, 31, tzinfo=timezone.utc),
            },
        ]

        for jdata in jobs_data:
            result = await session.execute(
                select(Job).where(
                    Job.title == jdata["title"],
                    Job.institute_id == inst_id,
                )
            )
            if not result.scalar_one_or_none():
                session.add(Job(
                    title=jdata["title"],
                    company=jdata["company"],
                    location=jdata["location"],
                    job_type=jdata["job_type"],
                    salary=jdata["salary"],
                    description=jdata["description"],
                    requirements=jdata["requirements"],
                    deadline=jdata["deadline"],
                    posted_by=admin_id,
                    institute_id=inst_id,
                ))
                print(f"Created job: {jdata['title']}")

        # ── 11. Create notifications for student ────────────────
        notifs = [
            {"type": "enrollment", "title": "Batch Enrollment", "message": "You have been enrolled in ICT Web Development 2026."},
            {"type": "announcement", "title": "New Announcement", "message": "Welcome to ICT Institute! — Check it out.", "link": "/announcements"},
            {"type": "system", "title": "Complete Your Profile", "message": "Please update your profile photo and phone number.", "link": "/profile/edit"},
        ]
        for ndata in notifs:
            result = await session.execute(
                select(Notification).where(
                    Notification.user_id == student_id,
                    Notification.title == ndata["title"],
                    Notification.institute_id == inst_id,
                )
            )
            if not result.scalar_one_or_none():
                session.add(Notification(
                    user_id=student_id,
                    type=ndata["type"],
                    title=ndata["title"],
                    message=ndata["message"],
                    link=ndata.get("link"),
                    institute_id=inst_id,
                ))
                print(f"Created notification: {ndata['title']}")

        # ── 12. Update institute usage ──────────────────────────
        result = await session.execute(
            select(InstituteUsage).where(InstituteUsage.institute_id == inst_id)
        )
        usage = result.scalar_one_or_none()
        if usage:
            usage.current_users = 4  # admin, cc, teacher, student
            usage.last_calculated_at = datetime.now(timezone.utc)

        await session.commit()

        print("\n" + "=" * 50)
        print("  ICT Institute seed complete!")
        print("=" * 50)
        print(f"\n  Institute slug: {SLUG}")
        print(f"  Login URL:      https://{SLUG}.ict.zensbot.site")
        print()
        print("  Accounts:")
        print(f"    Admin:          {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        print(f"    Course Creator: {CC_EMAIL} / {CC_PASSWORD}")
        print(f"    Teacher:        {TEACHER_EMAIL} / {TEACHER_PASSWORD}")
        print(f"    Student:        {STUDENT_EMAIL} / {STUDENT_PASSWORD}")
        print()
        print("  Data created:")
        print("    2 batches, 3 courses, 11 modules, 11 lectures")
        print("    2 announcements, 2 job postings, 3 notifications")
        print()


if __name__ == "__main__":
    asyncio.run(main())
