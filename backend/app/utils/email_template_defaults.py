"""Default email template registry — 22 templates with Mustache-style {{variable}} placeholders.

Each TemplateDefault captures the inner body HTML (the part that goes *inside* the
_base_template() wrapper, not the full wrapped email) and the subject line.
The rendering layer adds the header/footer/branding and handles HTML escaping.
"""
from dataclasses import dataclass, field


@dataclass
class TemplateDefault:
    key: str
    label: str
    category: str
    default_subject: str
    default_body: str
    variables: dict[str, str] = field(default_factory=dict)


TEMPLATE_DEFAULTS: dict[str, TemplateDefault] = {}


def _register(t: TemplateDefault) -> None:
    TEMPLATE_DEFAULTS[t.key] = t


# ── 1. Welcome ──────────────────────────────────────────────────────────────

_register(TemplateDefault(
    key="welcome",
    label="Welcome Email",
    category="student_lifecycle",
    default_subject="Welcome to {{institute_name}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">Welcome, {{student_name}}!</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Your account has been created at <strong>{{institute_name}}</strong>. Here are your login details:
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:100px;">Email</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{{email}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Password</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{{default_password}}</td></tr>
</table>
<p style="margin:20px 0;text-align:center;">
<a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background-color:{{accent_color}};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Login to Your Account</a>
</p>
<p style="color:#71717a;font-size:13px;margin-top:20px;">
For security, we recommend changing your password after your first login.
<a href="{{reset_url}}" style="color:{{accent_color}};">Reset your password here</a>.
</p>
""",
    variables={
        "student_name": "Full name of the new student",
        "email": "Student's login email address",
        "default_password": "Temporary password assigned by the system",
        "login_url": "URL to the LMS login page",
        "reset_url": "URL to the password-reset page",
        "institute_name": "Name of the institute",
        "accent_color": "Brand accent colour (hex)",
    },
))


# ── 2. Enrollment Confirmation ──────────────────────────────────────────────

_register(TemplateDefault(
    key="enrollment",
    label="Enrollment Confirmation",
    category="student_lifecycle",
    default_subject="Enrolled in {{batch_name}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">You've Been Enrolled!</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, you have been enrolled in a new batch:
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:100px;">Batch</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{{batch_name}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Start Date</td><td style="color:#1a1a1a;font-size:14px;">{{start_date}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">End Date</td><td style="color:#1a1a1a;font-size:14px;">{{end_date}}</td></tr>
{{teacher_row}}
</table>
<p style="margin:20px 0;text-align:center;">
<a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background-color:{{accent_color}};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Go to Your Dashboard</a>
</p>
""",
    variables={
        "student_name": "Full name of the enrolled student",
        "batch_name": "Name of the batch the student was enrolled in",
        "start_date": "Batch start date (formatted string)",
        "end_date": "Batch end/expiry date (formatted string)",
        "teacher_row": "Optional HTML table row for the teacher's name; empty string if no teacher assigned",
        "login_url": "URL to the LMS dashboard",
        "institute_name": "Name of the institute",
        "accent_color": "Brand accent colour (hex)",
    },
))


# ── 3. Batch Expiry Warning ─────────────────────────────────────────────────

_register(TemplateDefault(
    key="batch_expiry_warning",
    label="Batch Expiry Warning",
    category="batch_access",
    default_subject="Batch access expiring {{urgency}} - {{batch_name}}",
    default_body="""
<h2 style="margin:0 0 8px;color:{{urgency_color}};font-size:22px;">Batch Access Expiring Soon</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, your access to <strong>{{batch_name}}</strong> expires <strong>{{urgency}}</strong>.
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:120px;">Batch</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{{batch_name}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Expires On</td><td style="color:{{urgency_color}};font-size:14px;font-weight:bold;">{{end_date}}</td></tr>
</table>
<p style="color:#52525b;font-size:14px;">Make sure to complete your pending lectures and quizzes before access ends.</p>
<p style="margin:20px 0;text-align:center;">
<a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background-color:{{accent_color}};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Continue Learning</a>
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "batch_name": "Name of the batch",
        "urgency": "Human-readable time phrase, e.g. 'tomorrow' or 'in 5 days'",
        "urgency_color": "Hex colour for urgency indicator (#DC2626 if <=1 day, #F59E0B otherwise)",
        "end_date": "Date the batch access expires (formatted string)",
        "login_url": "URL to the LMS",
        "institute_name": "Name of the institute",
        "accent_color": "Brand accent colour (hex)",
    },
))


# ── 4. Batch Expired ────────────────────────────────────────────────────────

_register(TemplateDefault(
    key="batch_expired",
    label="Batch Access Expired",
    category="batch_access",
    default_subject="Batch access expired - {{batch_name}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#DC2626;font-size:22px;">Batch Access Expired</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, your access to <strong>{{batch_name}}</strong> has expired.
</p>
<p style="color:#52525b;font-size:14px;">
If you believe this is an error or need an extension, please contact your institute administrator.
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "batch_name": "Name of the batch whose access has expired",
        "institute_name": "Name of the institute",
    },
))


# ── 5. Certificate Issued ───────────────────────────────────────────────────

_register(TemplateDefault(
    key="certificate_issued",
    label="Certificate Issued",
    category="student_lifecycle",
    default_subject="Certificate Issued - {{course_name}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">Congratulations, {{student_name}}!</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Your certificate for <strong>{{course_name}}</strong> has been issued.
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:140px;">Certificate ID</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{{cert_id}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Verification Code</td><td style="color:#1a1a1a;font-size:14px;font-family:monospace;">{{verification_code}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Course</td><td style="color:#1a1a1a;font-size:14px;">{{course_name}}</td></tr>
</table>
<p style="margin:20px 0;text-align:center;">
<a href="{{portal_url}}" style="display:inline-block;padding:12px 28px;background-color:{{accent_color}};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View Certificate</a>
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "course_name": "Name of the course the certificate was issued for",
        "cert_id": "Unique certificate identifier",
        "verification_code": "Short alphanumeric code for public certificate verification",
        "portal_url": "URL to the certificate view/download page",
        "institute_name": "Name of the institute",
        "accent_color": "Brand accent colour (hex)",
    },
))


# ── 6. Announcement ─────────────────────────────────────────────────────────

_register(TemplateDefault(
    key="announcement",
    label="Announcement",
    category="communication",
    default_subject="Announcement: {{title}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">{{title}}</h2>
<p style="color:#71717a;font-size:12px;margin-bottom:16px;">
Posted by {{posted_by}} &middot; {{scope_label}}
</p>
<div style="color:#52525b;font-size:15px;line-height:1.6;border-left:3px solid {{accent_color}};padding-left:16px;margin:16px 0;">
{{content}}
</div>
<p style="margin:20px 0;text-align:center;">
<a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background-color:{{accent_color}};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View in Portal</a>
</p>
""",
    variables={
        "student_name": "Full name of the recipient student",
        "title": "Announcement title",
        "content": "Announcement body text",
        "posted_by": "Name of the person who posted the announcement",
        "scope_label": "Human-readable scope, e.g. 'All Students' or 'Batch: Python 2024'",
        "login_url": "URL to the portal",
        "institute_name": "Name of the institute",
        "accent_color": "Brand accent colour (hex)",
    },
))


# ── 7. Quiz Graded ──────────────────────────────────────────────────────────

_register(TemplateDefault(
    key="quiz_graded",
    label="Quiz Graded",
    category="communication",
    default_subject="Quiz Graded: {{quiz_title}} - {{result_text}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">Quiz Results Available</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, your quiz <strong>{{quiz_title}}</strong> has been graded.
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:100px;">Quiz</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{{quiz_title}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Score</td><td style="color:#1a1a1a;font-size:14px;">{{score}}/{{max_score}} ({{percentage}}%)</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Result</td><td style="color:{{result_color}};font-size:14px;font-weight:bold;">{{result_text}}</td></tr>
</table>
<p style="margin:20px 0;text-align:center;">
<a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background-color:{{accent_color}};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View Detailed Results</a>
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "quiz_title": "Title of the graded quiz",
        "score": "Points scored by the student",
        "max_score": "Maximum possible points",
        "percentage": "Score as a whole-number percentage, e.g. '85'",
        "result_text": "'Passed' or 'Not Passed'",
        "result_color": "Hex colour for result (#16A34A for passed, #DC2626 for not passed)",
        "login_url": "URL to view the detailed results",
        "institute_name": "Name of the institute",
        "accent_color": "Brand accent colour (hex)",
    },
))


# ── 8. Class Scheduled ─────────────────────────────────────────────────────

_register(TemplateDefault(
    key="class_scheduled",
    label="Class Scheduled",
    category="classes",
    default_subject="New Class: {{class_title}} on {{scheduled_date}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">New Class Scheduled</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, a new live class has been scheduled for your batch.
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:100px;">Class</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{{class_title}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Batch</td><td style="color:#1a1a1a;font-size:14px;">{{batch_name}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Teacher</td><td style="color:#1a1a1a;font-size:14px;">{{teacher_name}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Date</td><td style="color:#1a1a1a;font-size:14px;">{{scheduled_date}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Time</td><td style="color:#1a1a1a;font-size:14px;">{{scheduled_time}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Duration</td><td style="color:#1a1a1a;font-size:14px;">{{duration}} minutes</td></tr>
</table>
<p style="margin:20px 0;text-align:center;">
<a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background-color:{{accent_color}};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View Classes</a>
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "class_title": "Title of the scheduled class",
        "batch_name": "Name of the batch",
        "teacher_name": "Name of the class teacher",
        "scheduled_date": "Date of the class (formatted string)",
        "scheduled_time": "Time of the class (formatted string)",
        "duration": "Duration of the class in minutes",
        "login_url": "URL to the classes page",
        "institute_name": "Name of the institute",
        "accent_color": "Brand accent colour (hex)",
    },
))


# ── 9. Class Live ──────────────────────────────────────────────────────────

_register(TemplateDefault(
    key="class_live",
    label="Class Is Live",
    category="classes",
    default_subject="LIVE NOW: {{class_title}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#16A34A;font-size:22px;">Class is LIVE!</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, <strong>{{class_title}}</strong> is happening right now. Join before you miss it!
</p>
<p style="margin:24px 0;text-align:center;">
<a href="{{join_url}}" style="display:inline-block;padding:12px 28px;background-color:#16A34A;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Join Class Now</a>
</p>
<p style="color:#a1a1aa;font-size:12px;text-align:center;">
If the button doesn't work, copy this link into your browser:<br>
<a href="{{join_url}}" style="color:#6366f1;word-break:break-all;">{{join_url}}</a>
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "class_title": "Title of the live class",
        "join_url": "Direct Zoom/meeting join URL",
        "institute_name": "Name of the institute",
    },
))


# ── 10. Class Cancelled ────────────────────────────────────────────────────

_register(TemplateDefault(
    key="class_cancelled",
    label="Class Cancelled",
    category="classes",
    default_subject="Class Cancelled: {{class_title}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#DC2626;font-size:22px;">Class Cancelled</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, the following class has been cancelled:
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:100px;">Class</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{{class_title}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Batch</td><td style="color:#1a1a1a;font-size:14px;">{{batch_name}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Was Scheduled</td><td style="color:#DC2626;font-size:14px;">{{scheduled_date}} at {{scheduled_time}}</td></tr>
</table>
<p style="color:#52525b;font-size:14px;">
If you have any questions, please contact your instructor or administrator.
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "class_title": "Title of the cancelled class",
        "batch_name": "Name of the batch",
        "scheduled_date": "The date the class was originally scheduled for",
        "scheduled_time": "The time the class was originally scheduled for",
        "institute_name": "Name of the institute",
    },
))


# ── 11. Class Rescheduled ──────────────────────────────────────────────────

_register(TemplateDefault(
    key="class_rescheduled",
    label="Class Rescheduled",
    category="classes",
    default_subject="Class Rescheduled: {{class_title}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#F59E0B;font-size:22px;">Class Rescheduled</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, a class in <strong>{{batch_name}}</strong> has been moved to a new time:
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:120px;">Class</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{{class_title}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Previous Time</td><td style="color:#DC2626;font-size:14px;text-decoration:line-through;">{{old_date}} at {{old_time}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">New Time</td><td style="color:#16A34A;font-size:14px;font-weight:bold;">{{new_date}} at {{new_time}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Duration</td><td style="color:#1a1a1a;font-size:14px;">{{duration}} minutes</td></tr>
</table>
<p style="margin:20px 0;text-align:center;">
<a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background-color:{{accent_color}};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View Updated Schedule</a>
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "class_title": "Title of the rescheduled class",
        "batch_name": "Name of the batch",
        "old_date": "Original date of the class",
        "old_time": "Original time of the class",
        "new_date": "New date of the class",
        "new_time": "New time of the class",
        "duration": "Duration of the class in minutes",
        "login_url": "URL to view the updated schedule",
        "institute_name": "Name of the institute",
        "accent_color": "Brand accent colour (hex)",
    },
))


# ── 12. Recording Available ────────────────────────────────────────────────

_register(TemplateDefault(
    key="recording_available",
    label="Recording Available",
    category="classes",
    default_subject="Recording Ready: {{class_title}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">Recording Available</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, the recording for <strong>{{class_title}}</strong> is now ready to watch.
</p>
<p style="color:#52525b;font-size:14px;">
You can watch it anytime from your classes page.
</p>
<p style="margin:24px 0;text-align:center;">
<a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background-color:{{accent_color}};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Watch Recording</a>
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "class_title": "Title of the class whose recording is now available",
        "login_url": "URL to the classes/recording page",
        "institute_name": "Name of the institute",
        "accent_color": "Brand accent colour (hex)",
    },
))


# ── 13. Email Verification ─────────────────────────────────────────────────

_register(TemplateDefault(
    key="email_verification",
    label="Email Verification",
    category="system",
    default_subject="Verify your email address",
    default_body="""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">Verify Your Email</h2>
<p style="color:#52525b;font-size:14px;line-height:1.6;">
Hi {{user_name}}, welcome to <strong>{{institute_name}}</strong>!
Please verify your email address to fully activate your account.
</p>
<p style="color:#52525b;font-size:14px;line-height:1.6;">
You can use your LMS for the next 24 hours, but after that your account
will be deactivated until you verify.
</p>
<div style="text-align:center;margin:24px 0;">
<a href="{{verification_url}}" style="display:inline-block;padding:12px 28px;background-color:{{accent_color}};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Verify Email</a>
</div>
<p style="color:#a1a1aa;font-size:12px;">
If the button doesn't work, copy and paste this link into your browser:<br>
<a href="{{verification_url}}" style="color:#6366f1;word-break:break-all;">{{verification_url}}</a>
</p>
<p style="color:#a1a1aa;font-size:12px;">
This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.
</p>
""",
    variables={
        "user_name": "Full name of the user verifying their email",
        "institute_name": "Name of the institute (falls back to 'your LMS' if empty)",
        "verification_url": "One-time email verification URL (expires in 24 hours)",
        "accent_color": "Brand accent colour (hex)",
    },
))


# ── 14. Fee Due Soon ───────────────────────────────────────────────────────

_register(TemplateDefault(
    key="fee_due_soon",
    label="Fee Due Soon",
    category="fees",
    default_subject="Fee payment due {{urgency}} — {{batch_name}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">Fee payment due {{urgency}}</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, your next fee installment for <strong>{{batch_name}}</strong> is due <strong>{{urgency}}</strong>.
</p>
<table style="background-color:#f4f4f5;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#71717a;font-size:13px;width:120px;">Batch</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{{batch_name}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Amount Due</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{{amount_str}}</td></tr>
<tr><td style="color:#71717a;font-size:13px;">Due Date</td><td style="color:#1a1a1a;font-size:14px;font-weight:bold;">{{due_date}}</td></tr>
</table>
<p style="color:#52525b;font-size:14px;">Please contact your admissions officer to arrange payment. You can review your fee history in the LMS.</p>
<p style="margin:20px 0;text-align:center;">
<a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background-color:{{accent_color}};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View My Fees</a>
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "batch_name": "Name of the batch the fee is for",
        "urgency": "Human-readable time phrase, e.g. 'tomorrow' or 'in 3 days'",
        "amount_str": "Formatted amount string, e.g. 'PKR 5,000'",
        "due_date": "Fee due date (formatted string)",
        "login_url": "URL to the fee history page",
        "institute_name": "Name of the institute",
        "accent_color": "Brand accent colour (hex)",
    },
))


# ── 15. Fee Overdue ────────────────────────────────────────────────────────

_register(TemplateDefault(
    key="fee_overdue",
    label="Fee Overdue",
    category="fees",
    default_subject="Overdue fees — {{batch_name}}",
    default_body="""
<h2 style="margin:0 0 8px;color:#DC2626;font-size:22px;">Your fees are overdue</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, an installment for <strong>{{batch_name}}</strong> was due on
<strong>{{due_date}}</strong>. Access to lectures, quizzes, live classes, and certificates is
now temporarily locked until the balance is cleared.
</p>
<table style="background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#B91C1C;font-size:13px;width:120px;">Batch</td><td style="color:#7F1D1D;font-size:14px;font-weight:bold;">{{batch_name}}</td></tr>
<tr><td style="color:#B91C1C;font-size:13px;">Amount Due</td><td style="color:#7F1D1D;font-size:14px;font-weight:bold;">{{amount_str}}</td></tr>
<tr><td style="color:#B91C1C;font-size:13px;">Overdue Since</td><td style="color:#7F1D1D;font-size:14px;font-weight:bold;">{{due_date}}</td></tr>
</table>
<p style="color:#52525b;font-size:14px;">
Contact your admissions officer to record a payment. Content access is restored automatically once the balance is cleared.
</p>
<p style="margin:20px 0;text-align:center;">
<a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background-color:#DC2626;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View My Fees</a>
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "batch_name": "Name of the batch the overdue fee is for",
        "amount_str": "Formatted overdue amount string, e.g. 'PKR 5,000'",
        "due_date": "Date the fee was originally due (formatted string)",
        "login_url": "URL to the fee history page",
        "institute_name": "Name of the institute",
        "accent_color": "Brand accent colour (hex)",
    },
))


# ── 16. Overdue Suspension ─────────────────────────────────────────────────

_register(TemplateDefault(
    key="overdue_suspension",
    label="Overdue Suspension",
    category="fees",
    default_subject="Your {{institute_name}} access has been paused — overdue fees",
    default_body="""
<h2 style="margin:0 0 8px;color:#DC2626;font-size:22px;">Your portal access has been paused</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, one or more fee installments are overdue. Access to
{{institute_name}} has been paused and your login won&apos;t work until
the overdue balance is cleared.
</p>
<table style="background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px;width:100%;margin:16px 0;" cellpadding="6" cellspacing="0">
  <thead>
    <tr>
      <th style="color:#B91C1C;font-size:12px;text-align:left;padding:6px 0;">Installment</th>
      <th style="color:#B91C1C;font-size:12px;text-align:left;padding:6px 0;">Due</th>
      <th style="color:#B91C1C;font-size:12px;text-align:right;padding:6px 0;">Outstanding</th>
    </tr>
  </thead>
  <tbody>
    {{overdue_rows_html}}
    <tr>
      <td colspan="2" style="color:#7F1D1D;font-size:13px;padding:10px 0 0;border-top:1px solid #FECACA;"><strong>Order total</strong></td>
      <td style="color:#7F1D1D;font-size:14px;padding:10px 0 0;border-top:1px solid #FECACA;text-align:right;"><strong>{{currency}} {{grand_total}}</strong></td>
    </tr>
  </tbody>
</table>
<p style="color:#52525b;font-size:14px;">
Please contact your admissions officer to record payment. Your access will be
restored automatically within 24 hours of the balance clearing in our billing
system.
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "institute_name": "Name of the institute",
        "overdue_rows_html": "Pre-rendered HTML table rows, one per overdue installment (label, due date, outstanding amount)",
        "currency": "Currency code, e.g. 'PKR'",
        "grand_total": "Formatted total outstanding amount across all overdue installments",
    },
))


# ── 17. Overdue Reactivation ───────────────────────────────────────────────

_register(TemplateDefault(
    key="overdue_reactivation",
    label="Overdue Reactivation",
    category="fees",
    default_subject="Welcome back — your {{institute_name}} access is restored",
    default_body="""
<h2 style="margin:0 0 8px;color:#047857;font-size:22px;">Welcome back — your access is restored</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{student_name}}, thank you for clearing your overdue balance. Your
{{institute_name}} portal access has been restored and you can
log in normally.
</p>
<p style="color:#52525b;font-size:14px;">
If you have trouble logging in, please contact your admissions officer.
</p>
<p style="margin:20px 0;text-align:center;">
<a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background-color:#047857;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Open My Portal</a>
</p>
""",
    variables={
        "student_name": "Full name of the student",
        "institute_name": "Name of the institute (falls back to 'course' if empty)",
        "login_url": "URL to the LMS portal login page",
    },
))


# ── 18. Invoice Issued ─────────────────────────────────────────────────────

_register(TemplateDefault(
    key="invoice_issued",
    label="Invoice Issued",
    category="billing",
    default_subject="Invoice {{invoice_number}} — {{period_label}} (Rs {{total_pkr_formatted}})",
    default_body="""
<h2 style="margin:0 0 8px;color:#18181b;font-size:22px;">Invoice for {{period_label}}</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{admin_name}}, your monthly invoice for <strong>{{institute_name}}</strong> is ready.
</p>
<table style="background-color:#FAFAFA;border:1px solid #E4E4E7;border-radius:8px;width:100%;margin:16px 0;" cellpadding="0" cellspacing="0">
<tr><td style="padding:12px 16px;background-color:#F4F4F5;border-bottom:1px solid #E4E4E7;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Invoice {{invoice_number}}</td></tr>
{{line_items_html}}
<tr>
<td style="padding:12px 16px;color:#18181b;font-size:15px;font-weight:bold;">Total</td>
<td></td>
<td style="padding:12px 16px;color:#18181b;font-size:16px;font-weight:bold;text-align:right;">Rs {{total_pkr_formatted}}</td>
</tr>
</table>
<p style="color:#52525b;font-size:14px;">Due by <strong>{{due_date}}</strong>. Pay via bank transfer, JazzCash, or Easypaisa — details on your billing page.</p>
<p style="margin:20px 0;text-align:center;"><a href="{{pay_now_url}}" style="display:inline-block;padding:12px 28px;background-color:#18181b;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">View invoice &amp; pay</a></p>
""",
    variables={
        "admin_name": "Full name of the institute admin",
        "institute_name": "Name of the institute",
        "invoice_number": "Invoice reference number, e.g. 'INV-2026-05'",
        "period_label": "Billing period label, e.g. 'May 2026'",
        "total_pkr_formatted": "Formatted total amount in PKR, e.g. '12,500'",
        "line_items_html": "Pre-rendered HTML table rows for each line item (label, qty × unit price, total)",
        "due_date": "Invoice due date (formatted string)",
        "pay_now_url": "URL to the billing/payment page",
    },
))


# ── 19. Invoice Reminder ───────────────────────────────────────────────────

_register(TemplateDefault(
    key="invoice_reminder",
    label="Invoice Reminder",
    category="billing",
    default_subject="Payment reminder: invoice {{invoice_number}} ({{days_overdue}} day{{days_overdue_plural}} overdue)",
    default_body="""
<h2 style="margin:0 0 8px;color:#B45309;font-size:22px;">Reminder: invoice {{invoice_number}} is overdue</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">
Hi {{admin_name}}, invoice <strong>{{invoice_number}}</strong> for <strong>{{institute_name}}</strong> was due on
<strong>{{due_date}}</strong> ({{days_overdue}} day{{days_overdue_plural}} ago).
</p>
<table style="background-color:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#92400E;font-size:13px;width:140px;">Invoice</td><td style="color:#78350F;font-size:14px;font-weight:bold;">{{invoice_number}}</td></tr>
<tr><td style="color:#92400E;font-size:13px;">Amount Due</td><td style="color:#78350F;font-size:14px;font-weight:bold;">Rs {{total_pkr_formatted}}</td></tr>
<tr><td style="color:#92400E;font-size:13px;">Days Overdue</td><td style="color:#78350F;font-size:14px;font-weight:bold;">{{days_overdue}}</td></tr>
</table>
<p style="color:#52525b;font-size:14px;">
After 14 days overdue, new student sign-ups and uploads are blocked. After 30 days, the institute goes read-only. Please clear the balance soon to avoid any disruption.
</p>
<p style="margin:20px 0;text-align:center;"><a href="{{pay_now_url}}" style="display:inline-block;padding:12px 28px;background-color:#B45309;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Pay now</a></p>
""",
    variables={
        "admin_name": "Full name of the institute admin",
        "institute_name": "Name of the institute",
        "invoice_number": "Invoice reference number",
        "total_pkr_formatted": "Formatted outstanding amount in PKR, e.g. '12,500'",
        "days_overdue": "Number of days the invoice is overdue (integer as string)",
        "days_overdue_plural": "'s' if days_overdue != 1, else ''",
        "due_date": "Original invoice due date (formatted string)",
        "pay_now_url": "URL to the billing/payment page",
    },
))


# ── 20. Late Payment Restricted ────────────────────────────────────────────

_register(TemplateDefault(
    key="late_payment_restricted",
    label="Late Payment Restriction Activated",
    category="billing",
    default_subject="Action required: invoice {{invoice_number}} overdue",
    default_body="""
<h2 style="margin:0 0 8px;color:#DC2626;font-size:22px;">{{headline}}</h2>
<p style="color:#52525b;font-size:15px;line-height:1.6;">Hi {{admin_name}}, {{detail}}</p>
<table style="background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;width:100%;margin:16px 0;" cellpadding="8" cellspacing="0">
<tr><td style="color:#B91C1C;font-size:13px;width:140px;">Invoice</td><td style="color:#7F1D1D;font-size:14px;font-weight:bold;">{{invoice_number}}</td></tr>
<tr><td style="color:#B91C1C;font-size:13px;">Amount Due</td><td style="color:#7F1D1D;font-size:14px;font-weight:bold;">Rs {{total_pkr_formatted}}</td></tr>
<tr><td style="color:#B91C1C;font-size:13px;">Days Overdue</td><td style="color:#7F1D1D;font-size:14px;font-weight:bold;">{{days_overdue}}</td></tr>
</table>
<p style="margin:20px 0;text-align:center;"><a href="{{pay_now_url}}" style="display:inline-block;padding:12px 28px;background-color:#DC2626;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Pay now &amp; restore access</a></p>
""",
    variables={
        "admin_name": "Full name of the institute admin",
        "invoice_number": "Invoice reference number",
        "total_pkr_formatted": "Formatted outstanding amount in PKR, e.g. '12,500'",
        "days_overdue": "Number of days the invoice is overdue",
        "headline": "Restriction headline, e.g. 'Account is now read-only' or 'New student sign-ups and uploads are now blocked'",
        "detail": "Full detail paragraph describing the restriction and its consequences",
        "pay_now_url": "URL to the billing/payment page",
        "institute_name": "Name of the institute",
    },
))


# ── 21. Zoom Reminder ──────────────────────────────────────────────────────

_register(TemplateDefault(
    key="zoom_reminder",
    label="Zoom Class Reminder",
    category="classes",
    default_subject="Reminder: {{class_title}}",
    default_body="""
<h2>Zoom Class Reminder</h2>
<p>Your class <strong>{{class_title}}</strong> is starting soon.</p>
<p>Scheduled time: {{scheduled_time}}</p>
<p><a href="{{meeting_url}}">Join Meeting</a></p>
""",
    variables={
        "class_title": "Title of the upcoming Zoom class",
        "scheduled_time": "Human-readable scheduled time for the class",
        "meeting_url": "Zoom meeting join URL",
    },
))


# ── 22. Password Reset ─────────────────────────────────────────────────────

_register(TemplateDefault(
    key="password_reset",
    label="Password Reset",
    category="system",
    default_subject="Password Reset",
    default_body="""
<h2>Password Reset</h2>
<p>Hi {{name}},</p>
<p>We received a request to reset your password. Click the link below to set a new password:</p>
<p><a href="{{reset_link}}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a></p>
<p style="margin-top: 16px; font-size: 14px; color: #666;">This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
""",
    variables={
        "name": "Full name of the user requesting a password reset",
        "reset_link": "One-time password reset URL (expires in 15 minutes)",
    },
))
