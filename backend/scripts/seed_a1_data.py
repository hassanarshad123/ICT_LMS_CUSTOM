"""
Seed demo data for the 'a1' institute.

Creates: student, course_creator, batch, courses, curriculum, lectures,
         announcement, job, notifications.

Usage (on production server):
    cd /home/ubuntu/ICT_LMS_CUSTOM/backend
    source venv/bin/activate
    python scripts/seed_a1_data.py
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
    from app.models.institute import Institute
    from app.models.batch import Batch, StudentBatch
    from app.models.course import Course, BatchCourse, Lecture, CurriculumModule, BatchMaterial
    from app.models.announcement import Announcement
    from app.models.job import Job
    from app.models.notification import Notification
    from app.models.enums import (
        UserRole, CourseStatus, VideoType, AnnouncementScope,
        JobType, MaterialFileType,
    )
    from app.utils.security import hash_password
    from sqlmodel import select

    STUDENT_EMAIL = "student@a1.test"
    STUDENT_PASSWORD = "student123"
    CC_EMAIL = "cc@a1.test"

    async with async_session() as session:
        # ── 1. Find the a1 institute ─────────────────────────────
        result = await session.execute(
            select(Institute).where(Institute.slug == "a1", Institute.deleted_at.is_(None))
        )
        institute = result.scalar_one_or_none()
        if not institute:
            print("ERROR: Institute 'a1' not found. Create it first.")
            return
        inst_id = institute.id
        print(f"Found institute: {institute.name} (id={inst_id})")

        # ── 2. Find the admin (a1@test.com) ──────────────────────
        result = await session.execute(
            select(User).where(User.email == "a1@test.com", User.institute_id == inst_id)
        )
        admin = result.scalar_one_or_none()
        if not admin:
            print("ERROR: Admin user a1@test.com not found.")
            return
        admin_id = admin.id

        # ── 3. Create course_creator ─────────────────────────────
        result = await session.execute(
            select(User).where(User.email == CC_EMAIL, User.institute_id == inst_id)
        )
        cc = result.scalar_one_or_none()
        if not cc:
            cc = User(
                email=CC_EMAIL,
                name="Demo Course Creator",
                hashed_password=hash_password("cc123456"),
                role=UserRole.course_creator,
                institute_id=inst_id,
            )
            session.add(cc)
            await session.flush()
            print(f"Created course creator: {CC_EMAIL}")
        cc_id = cc.id

        # ── 4. Create student ────────────────────────────────────
        result = await session.execute(
            select(User).where(User.email == STUDENT_EMAIL, User.institute_id == inst_id)
        )
        student = result.scalar_one_or_none()
        if not student:
            student = User(
                email=STUDENT_EMAIL,
                name="Demo Student",
                phone="+923001234567",
                hashed_password=hash_password(STUDENT_PASSWORD),
                role=UserRole.student,
                institute_id=inst_id,
            )
            session.add(student)
            await session.flush()
            print(f"Created student: {STUDENT_EMAIL}")
        student_id = student.id

        # ── 5. Create batch ──────────────────────────────────────
        result = await session.execute(
            select(Batch).where(Batch.name == "Web Development 2026", Batch.institute_id == inst_id)
        )
        batch = result.scalar_one_or_none()
        if not batch:
            batch = Batch(
                name="Web Development 2026",
                teacher_id=cc_id,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 12, 31),
                created_by=admin_id,
                institute_id=inst_id,
            )
            session.add(batch)
            await session.flush()
            print(f"Created batch: {batch.name}")
        batch_id = batch.id

        # ── 6. Enroll student in batch ───────────────────────────
        result = await session.execute(
            select(StudentBatch).where(
                StudentBatch.student_id == student_id,
                StudentBatch.batch_id == batch_id,
                StudentBatch.removed_at.is_(None),
            )
        )
        if not result.scalar_one_or_none():
            session.add(StudentBatch(
                student_id=student_id,
                batch_id=batch_id,
                enrolled_by=admin_id,
                institute_id=inst_id,
            ))
            await session.flush()
            print("Enrolled student in batch")

        # ── 7. Create courses ────────────────────────────────────
        courses_data = [
            {
                "title": "Python Fundamentals",
                "description": "Learn Python from scratch — variables, control flow, functions, OOP, and real-world projects.",
                "modules": [
                    {"title": "Getting Started", "topics": ["Installing Python", "Hello World", "Variables & Types"], "order": 1},
                    {"title": "Control Flow", "topics": ["If/Else", "Loops", "List Comprehensions"], "order": 2},
                    {"title": "Functions & OOP", "topics": ["Functions", "Classes", "Inheritance", "Modules"], "order": 3},
                ],
                "lectures": [
                    {"title": "Python Installation & Setup", "url": "https://www.youtube.com/watch?v=YYXdXT2l-Gg", "duration": 1560, "order": 1},
                    {"title": "Variables and Data Types", "url": "https://www.youtube.com/watch?v=kqtD5dpn9C8", "duration": 2040, "order": 2},
                    {"title": "Control Flow — If, For, While", "url": "https://www.youtube.com/watch?v=Zp5MuPOtsSY", "duration": 1800, "order": 3},
                    {"title": "Functions in Python", "url": "https://www.youtube.com/watch?v=9Os0o3wzS_I", "duration": 2400, "order": 4},
                ],
            },
            {
                "title": "Web Development with HTML & CSS",
                "description": "Build responsive websites with modern HTML5 and CSS3 — from basics to Flexbox and Grid.",
                "modules": [
                    {"title": "HTML Essentials", "topics": ["Tags & Elements", "Forms", "Semantic HTML"], "order": 1},
                    {"title": "CSS Styling", "topics": ["Selectors", "Box Model", "Flexbox", "Grid"], "order": 2},
                ],
                "lectures": [
                    {"title": "HTML Crash Course", "url": "https://www.youtube.com/watch?v=UB1O30fR-EE", "duration": 3600, "order": 1},
                    {"title": "CSS Basics", "url": "https://www.youtube.com/watch?v=yfoY53QXEnI", "duration": 4200, "order": 2},
                    {"title": "Flexbox in 20 Minutes", "url": "https://www.youtube.com/watch?v=JJSoEo8JSnc", "duration": 1200, "order": 3},
                ],
            },
        ]

        for cdata in courses_data:
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
                    BatchCourse.batch_id == batch_id,
                    BatchCourse.course_id == course_id,
                    BatchCourse.deleted_at.is_(None),
                )
            )
            if not result.scalar_one_or_none():
                session.add(BatchCourse(
                    batch_id=batch_id,
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
                        batch_id=batch_id,
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

        # ── 8. Create announcement ───────────────────────────────
        result = await session.execute(
            select(Announcement).where(
                Announcement.title == "Welcome to Web Development 2026!",
                Announcement.institute_id == inst_id,
            )
        )
        if not result.scalar_one_or_none():
            session.add(Announcement(
                title="Welcome to Web Development 2026!",
                content="Welcome to our institute! Check out the courses assigned to your batch. Start with Python Fundamentals and then move on to Web Development. Good luck!",
                scope=AnnouncementScope.institute,
                posted_by=admin_id,
                institute_id=inst_id,
            ))
            print("Created announcement")

        # ── 9. Create job posting ────────────────────────────────
        result = await session.execute(
            select(Job).where(
                Job.title == "Junior Python Developer",
                Job.institute_id == inst_id,
            )
        )
        if not result.scalar_one_or_none():
            session.add(Job(
                title="Junior Python Developer",
                company="TechVentures Islamabad",
                location="Islamabad, Pakistan",
                job_type=JobType.full_time,
                salary="80,000 - 120,000 PKR",
                description="We are looking for a junior Python developer to join our backend team. You will work on FastAPI microservices and PostgreSQL databases.",
                requirements=["Python", "FastAPI or Django", "SQL", "Git"],
                deadline=datetime(2026, 6, 30, tzinfo=timezone.utc),
                posted_by=admin_id,
                institute_id=inst_id,
            ))
            print("Created job posting")

        # ── 10. Create notifications for student ─────────────────
        notifs = [
            {"type": "enrollment", "title": "Batch Enrollment", "message": "You have been enrolled in Web Development 2026."},
            {"type": "announcement", "title": "New Announcement", "message": "Welcome to Web Development 2026! — Check it out.", "link": "/announcements"},
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

        await session.commit()
        print("\n✓ Seed complete!")
        print(f"  Student login: {STUDENT_EMAIL} / {STUDENT_PASSWORD}")
        print(f"  Institute slug: a1")


if __name__ == "__main__":
    asyncio.run(main())
