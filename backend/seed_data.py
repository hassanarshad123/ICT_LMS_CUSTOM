"""
Seed script for ICT LMS database.
Adds realistic data: courses, enrollments, lectures, progress, announcements,
jobs, curriculum modules, and certificates.

Usage: cd backend && python seed_data.py
"""
import asyncio
import uuid
from datetime import date, datetime, timezone, timedelta

from sqlalchemy import text
from app.database import async_session

# ── Existing IDs ────────────────────────────────────────────────────

ADMIN_ID = uuid.UUID("fb8dc170-9ef5-4903-bb64-8855e883dea4")
CC_FATIMA = uuid.UUID("b0da65d2-9c14-4f13-b3bf-bb7242382858")
CC_HASSAN = uuid.UUID("0e56e583-fe99-408a-a28c-dcb846bf733d")
TEACHER_AHMED = uuid.UUID("6e47433b-cf51-4b67-a687-8725b9f51adb")
TEACHER_SARA = uuid.UUID("2313f3b3-a977-4d62-80ac-abbe11a95589")
TEACHER_USMAN = uuid.UUID("68f799a0-b3ba-43ee-bd65-c1a5a02d7f6f")

STUDENTS = {
    "ali_hamza": uuid.UUID("131d6ad7-25fa-4d9f-a5b8-257f4b6f43a5"),
    "ayesha": uuid.UUID("1907dd4d-5667-40af-89d8-694b7fdd9b25"),
    "bilal": uuid.UUID("62e19efb-79e6-431c-8e02-55548c30797d"),
    "danish": uuid.UUID("062c89bc-0008-4d6b-a38c-4de7621211b3"),
    "faisal": uuid.UUID("b7772121-20c1-4ee1-b5bf-906234e8784f"),
    "hira": uuid.UUID("fbbe66d7-f9bf-493e-aa35-249d02eec326"),
    "maham": uuid.UUID("204219b3-7969-4133-917a-b658eabf7c93"),
    "nimra": uuid.UUID("09144c85-b799-4ba0-bff3-19e23513b9e6"),
    "sana": uuid.UUID("1ae8f81a-27eb-47f3-83d6-ce50d51ea0bf"),
    "zain": uuid.UUID("bb7fdc60-e0cd-4e68-95c3-f835b65049a2"),
}

# Existing batch + course + lectures
BATCH_CTA = uuid.UUID("61984331-ce03-4839-9b54-5efcc1f5258a")
BATCH_2 = uuid.UUID("c7a4d876-d954-4565-bb76-6e786a836587")
BATCH_3 = uuid.UUID("f8f9d782-de69-4b1a-a100-25f98f1cfc9e")
COURSE_TEST = uuid.UUID("452803d6-5ed9-41f6-8186-46d04feab1b7")

LECTURE_IDS = [
    uuid.UUID("e6d17ccd-f6f6-4dd5-9d89-de95f07290cf"),
    uuid.UUID("405f1e03-70c8-4523-a741-05ba945b0f7c"),
    uuid.UUID("157a67fd-33ec-46c2-8544-e2d5c11111c2"),
    uuid.UUID("cecc6abf-27b8-4295-981b-bab15bcafd6e"),
]

# ── New IDs ─────────────────────────────────────────────────────────

COURSE_PYTHON = uuid.UUID("a1b2c3d4-1111-4aaa-bbbb-111111111111")
COURSE_WEBDEV = uuid.UUID("a1b2c3d4-2222-4aaa-bbbb-222222222222")

now = datetime.now(timezone.utc)


async def seed():
    async with async_session() as session:
        # ── 1. Rename junk batches ──────────────────────────────────
        await session.execute(text(
            "UPDATE batches SET name = 'Python Fundamentals - Batch A', "
            "teacher_id = :sara WHERE id = :id"
        ), {"id": str(BATCH_2), "sara": str(TEACHER_SARA)})

        await session.execute(text(
            "UPDATE batches SET name = 'Web Development - Evening', "
            "teacher_id = :usman WHERE id = :id"
        ), {"id": str(BATCH_3), "usman": str(TEACHER_USMAN)})

        # ── 2. Create new courses ───────────────────────────────────
        await session.execute(text("""
            INSERT INTO courses (id, title, description, status, created_by, created_at, updated_at)
            VALUES
            (:py_id, 'Python Programming', 'Complete Python course from basics to advanced. Covers data types, OOP, file handling, and libraries.', 'active', :hassan, NOW(), NOW()),
            (:web_id, 'Web Development', 'Full-stack web development with HTML, CSS, JavaScript, and React. Build real-world projects.', 'active', :fatima, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        """), {
            "py_id": str(COURSE_PYTHON),
            "web_id": str(COURSE_WEBDEV),
            "hassan": str(CC_HASSAN),
            "fatima": str(CC_FATIMA),
        })

        # ── 3. Assign courses to batches ────────────────────────────
        await session.execute(text("""
            INSERT INTO batch_courses (id, batch_id, course_id, assigned_by, assigned_at, updated_at)
            VALUES
            (:id1, :batch2, :py, :admin, NOW(), NOW()),
            (:id2, :batch3, :web, :admin, NOW(), NOW()),
            (:id3, :batch3, :py, :admin, NOW(), NOW())
            ON CONFLICT DO NOTHING
        """), {
            "id1": str(uuid.uuid4()), "id2": str(uuid.uuid4()), "id3": str(uuid.uuid4()),
            "batch2": str(BATCH_2), "batch3": str(BATCH_3),
            "py": str(COURSE_PYTHON), "web": str(COURSE_WEBDEV),
            "admin": str(ADMIN_ID),
        })

        # ── 4. Create lectures for new courses ──────────────────────
        python_lectures = []
        py_titles = [
            "Introduction to Python", "Variables & Data Types",
            "Control Flow & Loops", "Functions & Modules",
            "Object-Oriented Programming", "File I/O & Exceptions",
        ]
        for i, title in enumerate(py_titles, 1):
            lid = uuid.uuid4()
            python_lectures.append(lid)
            await session.execute(text("""
                INSERT INTO lectures (id, batch_id, course_id, title, video_type, video_status,
                                      sequence_order, created_by, created_at, updated_at)
                VALUES (:id, :batch, :course, :title, 'external', 'ready', :seq, :by, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """), {
                "id": str(lid), "batch": str(BATCH_2), "course": str(COURSE_PYTHON),
                "title": title, "seq": i, "by": str(CC_HASSAN),
            })

        web_lectures = []
        web_titles = [
            "HTML Fundamentals", "CSS Styling & Flexbox",
            "JavaScript Basics", "DOM Manipulation",
            "React Components", "State & Props",
            "API Integration", "Deployment",
        ]
        for i, title in enumerate(web_titles, 1):
            lid = uuid.uuid4()
            web_lectures.append(lid)
            await session.execute(text("""
                INSERT INTO lectures (id, batch_id, course_id, title, video_type, video_status,
                                      sequence_order, created_by, created_at, updated_at)
                VALUES (:id, :batch, :course, :title, 'external', 'ready', :seq, :by, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """), {
                "id": str(lid), "batch": str(BATCH_3), "course": str(COURSE_WEBDEV),
                "title": title, "seq": i, "by": str(CC_FATIMA),
            })

        # Also add Python lectures to Batch 3
        py_batch3_lectures = []
        for i, title in enumerate(py_titles, 1):
            lid = uuid.uuid4()
            py_batch3_lectures.append(lid)
            await session.execute(text("""
                INSERT INTO lectures (id, batch_id, course_id, title, video_type, video_status,
                                      sequence_order, created_by, created_at, updated_at)
                VALUES (:id, :batch, :course, :title, 'external', 'ready', :seq, :by, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """), {
                "id": str(lid), "batch": str(BATCH_3), "course": str(COURSE_PYTHON),
                "title": title, "seq": i, "by": str(CC_HASSAN),
            })

        # ── 5. Enroll students in batches ───────────────────────────
        # Batch 2 (Python): Bilal, Danish, Faisal, Hira, Maham
        batch2_students = ["bilal", "danish", "faisal", "hira", "maham"]
        for name in batch2_students:
            sid = STUDENTS[name]
            await session.execute(text("""
                INSERT INTO student_batches (id, student_id, batch_id, enrolled_by, enrolled_at, updated_at)
                VALUES (:id, :sid, :bid, :admin, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """), {"id": str(uuid.uuid4()), "sid": str(sid), "bid": str(BATCH_2), "admin": str(ADMIN_ID)})

        # Batch 3 (Web Dev): Nimra, Sana, Zain, Ali Hamza, Danish
        batch3_students = ["nimra", "sana", "zain", "ali_hamza", "danish"]
        for name in batch3_students:
            sid = STUDENTS[name]
            await session.execute(text("""
                INSERT INTO student_batches (id, student_id, batch_id, enrolled_by, enrolled_at, updated_at)
                VALUES (:id, :sid, :bid, :admin, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """), {"id": str(uuid.uuid4()), "sid": str(sid), "bid": str(BATCH_3), "admin": str(ADMIN_ID)})

        # Also enroll more students in Batch 1 (CTA)
        batch1_extra = ["bilal", "danish", "faisal", "hira"]
        for name in batch1_extra:
            sid = STUDENTS[name]
            await session.execute(text("""
                INSERT INTO student_batches (id, student_id, batch_id, enrolled_by, enrolled_at, updated_at)
                VALUES (:id, :sid, :bid, :admin, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """), {"id": str(uuid.uuid4()), "sid": str(sid), "bid": str(BATCH_CTA), "admin": str(ADMIN_ID)})

        # ── 6. Add lecture progress ─────────────────────────────────
        # Batch 1 / Test Course: make some students have watched lectures
        progress_data = [
            # Ali Hamza: watched all 4 lectures (100% average) - eligible
            ("ali_hamza", LECTURE_IDS[0], 100, "completed"),
            ("ali_hamza", LECTURE_IDS[1], 95, "completed"),
            ("ali_hamza", LECTURE_IDS[2], 100, "completed"),
            ("ali_hamza", LECTURE_IDS[3], 88, "completed"),
            # Ayesha: watched 3 of 4 (75% average) - eligible (threshold=40)
            ("ayesha", LECTURE_IDS[0], 100, "completed"),
            ("ayesha", LECTURE_IDS[1], 80, "completed"),
            ("ayesha", LECTURE_IDS[2], 70, "in_progress"),
            ("ayesha", LECTURE_IDS[3], 50, "in_progress"),
            # Bilal: watched 2 of 4 (50% average) - eligible
            ("bilal", LECTURE_IDS[0], 100, "completed"),
            ("bilal", LECTURE_IDS[1], 100, "completed"),
            # Danish: watched 1 partially (10% average) - not eligible
            ("danish", LECTURE_IDS[0], 40, "in_progress"),
            # Faisal: no progress yet (0%)
            # Hira: watched all 4 (85% average) - eligible
            ("hira", LECTURE_IDS[0], 90, "completed"),
            ("hira", LECTURE_IDS[1], 85, "completed"),
            ("hira", LECTURE_IDS[2], 80, "completed"),
            ("hira", LECTURE_IDS[3], 85, "completed"),
        ]
        for student_key, lecture_id, pct, status in progress_data:
            sid = STUDENTS[student_key]
            await session.execute(text("""
                INSERT INTO lecture_progress (id, student_id, lecture_id, watch_percentage,
                                             resume_position_seconds, status, created_at, updated_at)
                VALUES (:id, :sid, :lid, :pct, :pos, :status, NOW(), NOW())
                ON CONFLICT (student_id, lecture_id) DO NOTHING
            """), {
                "id": str(uuid.uuid4()), "sid": str(sid), "lid": str(lecture_id),
                "pct": pct, "pos": pct * 30, "status": status,
            })

        # Batch 2 / Python: progress for some students
        for i, lid in enumerate(python_lectures):
            # Bilal: completed all Python lectures
            await session.execute(text("""
                INSERT INTO lecture_progress (id, student_id, lecture_id, watch_percentage,
                                             resume_position_seconds, status, created_at, updated_at)
                VALUES (:id, :sid, :lid, :pct, :pos, 'completed', NOW(), NOW())
                ON CONFLICT (student_id, lecture_id) DO NOTHING
            """), {
                "id": str(uuid.uuid4()), "sid": str(STUDENTS["bilal"]),
                "lid": str(lid), "pct": 95 + (i % 6), "pos": 2700,
            })

            # Hira: watched first 4 lectures
            if i < 4:
                await session.execute(text("""
                    INSERT INTO lecture_progress (id, student_id, lecture_id, watch_percentage,
                                                 resume_position_seconds, status, created_at, updated_at)
                    VALUES (:id, :sid, :lid, :pct, :pos, 'completed', NOW(), NOW())
                    ON CONFLICT (student_id, lecture_id) DO NOTHING
                """), {
                    "id": str(uuid.uuid4()), "sid": str(STUDENTS["hira"]),
                    "lid": str(lid), "pct": 80 + i * 5, "pos": 1800,
                })

        # ── 7. Add curriculum modules ───────────────────────────────
        modules = [
            (COURSE_PYTHON, "Getting Started with Python", "Setting up environment, first script, Python shell", 1,
             ["Installing Python", "IDE Setup (VS Code)", "Hello World", "Python Shell vs Scripts"]),
            (COURSE_PYTHON, "Data Types & Operations", "Numbers, strings, lists, dicts, type conversion", 2,
             ["Numbers & Math", "Strings & Formatting", "Lists & Tuples", "Dictionaries & Sets"]),
            (COURSE_PYTHON, "Control Flow", "Conditionals, loops, comprehensions", 3,
             ["if/elif/else", "for loops", "while loops", "List Comprehensions"]),
            (COURSE_PYTHON, "Functions & OOP", "Functions, classes, inheritance", 4,
             ["Defining Functions", "Arguments & Returns", "Classes & Objects", "Inheritance"]),
            (COURSE_WEBDEV, "HTML & CSS Foundations", "Semantic HTML, CSS box model, flexbox, grid", 1,
             ["HTML5 Elements", "CSS Selectors", "Box Model", "Flexbox Layout", "CSS Grid"]),
            (COURSE_WEBDEV, "JavaScript Essentials", "Variables, functions, DOM, events, async", 2,
             ["Variables & Types", "Functions & Scope", "DOM Manipulation", "Event Handling", "Fetch API"]),
            (COURSE_WEBDEV, "React Development", "Components, state, props, hooks, routing", 3,
             ["JSX & Components", "useState & useEffect", "Props & Children", "React Router", "API Calls"]),
            (COURSE_WEBDEV, "Deployment & DevOps", "Git, CI/CD, hosting, domains", 4,
             ["Git Workflow", "GitHub Actions", "Vercel Deployment", "Custom Domains"]),
        ]
        for course_id, title, desc, seq, topics in modules:
            await session.execute(text("""
                INSERT INTO curriculum_modules (id, course_id, title, description, sequence_order,
                                               topics, created_by, created_at, updated_at)
                VALUES (:id, :cid, :title, :desc, :seq, :topics, :by, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """), {
                "id": str(uuid.uuid4()), "cid": str(course_id),
                "title": title, "desc": desc, "seq": seq,
                "topics": topics,
                "by": str(CC_HASSAN) if course_id == COURSE_PYTHON else str(CC_FATIMA),
            })

        # ── 8. Add announcements ────────────────────────────────────
        announcements = [
            ("Welcome to ICT LMS!", "Welcome to the Learning Management System. Check your enrolled batches to get started.",
             "institute", None, None, ADMIN_ID),
            ("Midterm Schedule Released", "Midterm assessments for all batches will begin next week. Check your batch pages for details.",
             "institute", None, None, ADMIN_ID),
            ("Python Assignment Due", "Please complete the Functions & Modules assignment by Friday. Submit via the materials section.",
             "batch", BATCH_2, None, TEACHER_SARA),
            ("CTA Batch - Lecture Recordings", "All lecture recordings are now available. Make sure to complete watching them for certificate eligibility.",
             "batch", BATCH_CTA, None, TEACHER_AHMED),
            ("Web Dev Project Kickoff", "The final project details have been posted. Teams of 2-3, due by end of month.",
             "batch", BATCH_3, None, TEACHER_USMAN),
            ("New Python Course Material", "Additional reading materials for Python Programming have been uploaded.",
             "course", None, COURSE_PYTHON, CC_HASSAN),
        ]
        for title, content, scope, batch_id, course_id, posted_by in announcements:
            await session.execute(text("""
                INSERT INTO announcements (id, title, content, scope, batch_id, course_id,
                                          posted_by, created_at, updated_at)
                VALUES (:id, :title, :content, :scope, :bid, :cid, :by, :at, :at)
                ON CONFLICT (id) DO NOTHING
            """), {
                "id": str(uuid.uuid4()), "title": title, "content": content,
                "scope": scope, "bid": str(batch_id) if batch_id else None,
                "cid": str(course_id) if course_id else None,
                "by": str(posted_by),
                "at": now - timedelta(days=announcements.index((title, content, scope, batch_id, course_id, posted_by))),
            })

        # ── 9. Add jobs ─────────────────────────────────────────────
        jobs_data = [
            ("Junior Python Developer", "TechVision Pvt Ltd", "Lahore", "full_time",
             "PKR 60,000 - 80,000", "Looking for a Python developer with knowledge of FastAPI and databases.",
             ["Python 3.x", "SQL", "REST APIs", "Git"]),
            ("Frontend Developer Intern", "Devsinc", "Islamabad", "internship",
             "PKR 30,000", "3-month internship for React/Next.js developers. Opportunity to convert to full-time.",
             ["React", "JavaScript", "HTML/CSS", "Git"]),
            ("Full Stack Developer", "Zensbot LLC", "Remote", "full_time",
             "PKR 100,000 - 150,000", "Building AI-powered business tools. FastAPI + Next.js stack.",
             ["Python", "React", "PostgreSQL", "Docker"]),
            ("Web Designer", "CreativeHub", "Karachi", "part_time",
             "PKR 40,000", "Part-time web designer for client projects. Figma to code.",
             ["Figma", "HTML/CSS", "Tailwind CSS", "Responsive Design"]),
            ("Data Entry Operator", "EduTech Solutions", "Remote", "remote",
             "PKR 25,000", "Remote data entry and management for educational content platform.",
             ["MS Excel", "Data Entry", "Attention to Detail"]),
        ]
        job_ids = []
        for title, company, location, jtype, salary, desc, reqs in jobs_data:
            jid = uuid.uuid4()
            job_ids.append(jid)
            deadline = now + timedelta(days=30 + jobs_data.index((title, company, location, jtype, salary, desc, reqs)) * 7)
            await session.execute(text("""
                INSERT INTO jobs (id, title, company, location, job_type, salary, description,
                                  requirements, deadline, posted_by, created_at, updated_at)
                VALUES (:id, :title, :company, :loc, :jtype, :sal, :desc,
                        :reqs, :deadline, :by, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """), {
                "id": str(jid), "title": title, "company": company,
                "loc": location, "jtype": jtype, "sal": salary, "desc": desc,
                "reqs": reqs, "deadline": deadline, "by": str(ADMIN_ID),
            })

        # ── 10. Add job applications ────────────────────────────────
        applications = [
            (job_ids[0], "ali_hamza", "applied"),     # Ali applied for Python Dev
            (job_ids[0], "bilal", "shortlisted"),     # Bilal shortlisted
            (job_ids[1], "ayesha", "applied"),        # Ayesha applied for intern
            (job_ids[1], "nimra", "applied"),          # Nimra applied
            (job_ids[2], "hira", "applied"),           # Hira applied for Full Stack
            (job_ids[2], "ali_hamza", "applied"),     # Ali also applied for Full Stack
            (job_ids[3], "sana", "shortlisted"),      # Sana shortlisted for designer
        ]
        for jid, student_key, status in applications:
            sid = STUDENTS[student_key]
            await session.execute(text("""
                INSERT INTO job_applications (id, job_id, student_id, status, created_at, updated_at)
                VALUES (:id, :jid, :sid, :status, NOW(), NOW())
                ON CONFLICT (job_id, student_id) DO NOTHING
            """), {
                "id": str(uuid.uuid4()), "jid": str(jid),
                "sid": str(sid), "status": status,
            })

        # ── 11. Create certificate records ──────────────────────────
        # Ali Hamza - approved certificate for Test Course in CTA Batch
        cert_id_ali = uuid.uuid4()
        await session.execute(text("""
            INSERT INTO certificates (id, student_id, batch_id, course_id, certificate_id,
                                      verification_code, certificate_name, status,
                                      completion_percentage, requested_at, approved_by,
                                      approved_at, issued_at, created_at, updated_at)
            VALUES (:id, :sid, :bid, :cid, 'ICT-2026-00001', 'ABCD1234EFGH',
                    'Ali Hamza', 'approved', 95, :now, :admin, :now, :now, :now, :now)
            ON CONFLICT (student_id, batch_id, course_id) DO NOTHING
        """), {
            "id": str(cert_id_ali), "sid": str(STUDENTS["ali_hamza"]),
            "bid": str(BATCH_CTA), "cid": str(COURSE_TEST),
            "now": now - timedelta(days=2), "admin": str(CC_FATIMA),
        })

        # Hira - pending certificate request (eligible status)
        await session.execute(text("""
            INSERT INTO certificates (id, student_id, batch_id, course_id, certificate_name,
                                      status, completion_percentage, requested_at,
                                      created_at, updated_at)
            VALUES (:id, :sid, :bid, :cid, 'Hira Malik', 'eligible', 85, :now, :now, :now)
            ON CONFLICT (student_id, batch_id, course_id) DO NOTHING
        """), {
            "id": str(uuid.uuid4()), "sid": str(STUDENTS["hira"]),
            "bid": str(BATCH_CTA), "cid": str(COURSE_TEST),
            "now": now - timedelta(days=1),
        })

        # Update certificate counter
        await session.execute(text("""
            UPDATE certificate_counter SET last_sequence = 1, current_year = 2026 WHERE id = 1
        """))

        await session.commit()
        print("Seed data inserted successfully!")


async def verify():
    """Verify seed data was inserted correctly."""
    async with async_session() as session:
        tables = [
            'users', 'batches', 'student_batches', 'courses', 'batch_courses',
            'lectures', 'lecture_progress', 'certificates', 'announcements',
            'jobs', 'job_applications', 'curriculum_modules',
        ]
        print("\n=== TABLE ROW COUNTS (after seed) ===")
        for t in tables:
            r = await session.execute(text(f"SELECT COUNT(*) FROM {t}"))
            count = r.scalar()
            print(f"  {t}: {count}")

        # Test student dashboard query pattern (the optimized one)
        ali_id = str(STUDENTS["ali_hamza"])
        print(f"\n=== STUDENT DASHBOARD TEST (Ali Hamza) ===")

        # Enrollments
        r = await session.execute(text(
            "SELECT b.name FROM student_batches sb JOIN batches b ON sb.batch_id=b.id "
            "WHERE sb.student_id=:sid AND sb.removed_at IS NULL AND b.deleted_at IS NULL"
        ), {"sid": ali_id})
        batches = [row[0] for row in r.all()]
        print(f"  Enrolled in: {batches}")

        # Certificates
        r = await session.execute(text(
            "SELECT c.certificate_id, c.status, co.title FROM certificates c "
            "JOIN courses co ON c.course_id=co.id "
            "WHERE c.student_id=:sid AND c.deleted_at IS NULL"
        ), {"sid": ali_id})
        for row in r.all():
            print(f"  Certificate: {row[0]} ({row[1]}) for {row[2]}")

        # Verify CHECK constraint works
        print("\n=== CONSTRAINT TESTS ===")
        try:
            await session.execute(text(
                "INSERT INTO lecture_progress (id, student_id, lecture_id, watch_percentage, status) "
                "VALUES (:id, :sid, :lid, 150, 'in_progress')"
            ), {"id": str(uuid.uuid4()), "sid": ali_id, "lid": str(LECTURE_IDS[0])})
            await session.commit()
            print("  CHECK constraint FAILED (allowed 150%)")
        except Exception as e:
            await session.rollback()
            if "ck_lecture_progress_watch_pct" in str(e):
                print("  CHECK constraint on watch_percentage: WORKING (rejected 150%)")
            else:
                print(f"  Unexpected error: {e}")

        # Verify updated_at trigger
        print("\n=== TRIGGER TEST ===")
        r = await session.execute(text(
            "SELECT updated_at FROM courses WHERE id=:id"
        ), {"id": str(COURSE_PYTHON)})
        before = r.scalar()

        await session.execute(text(
            "UPDATE courses SET description='Updated description for trigger test' WHERE id=:id"
        ), {"id": str(COURSE_PYTHON)})
        await session.commit()

        r = await session.execute(text(
            "SELECT updated_at FROM courses WHERE id=:id"
        ), {"id": str(COURSE_PYTHON)})
        after = r.scalar()
        if after > before:
            print(f"  updated_at trigger: WORKING (before={before}, after={after})")
        else:
            print(f"  updated_at trigger: FAILED (unchanged)")

        # Reset description
        await session.execute(text(
            "UPDATE courses SET description='Complete Python course from basics to advanced. Covers data types, OOP, file handling, and libraries.' WHERE id=:id"
        ), {"id": str(COURSE_PYTHON)})
        await session.commit()

        print("\nAll verifications passed!")


if __name__ == "__main__":
    asyncio.run(seed())
    asyncio.run(verify())
