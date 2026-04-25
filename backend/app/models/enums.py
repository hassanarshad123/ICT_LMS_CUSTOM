import enum


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    course_creator = "course_creator"
    teacher = "teacher"
    student = "student"
    admissions_officer = "admissions_officer"
    custom = "custom"


class ViewType(str, enum.Enum):
    student_view = "student_view"
    staff_view = "staff_view"
    admin_view = "admin_view"


class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class CourseStatus(str, enum.Enum):
    upcoming = "upcoming"
    active = "active"
    completed = "completed"


class ZoomClassStatus(str, enum.Enum):
    upcoming = "upcoming"
    live = "live"
    completed = "completed"


class RecordingStatus(str, enum.Enum):
    processing = "processing"
    ready = "ready"
    failed = "failed"


class JobType(str, enum.Enum):
    full_time = "full_time"
    part_time = "part_time"
    internship = "internship"
    remote = "remote"


class ApplicationStatus(str, enum.Enum):
    applied = "applied"
    shortlisted = "shortlisted"
    rejected = "rejected"


class VideoType(str, enum.Enum):
    upload = "upload"
    external = "external"


class BatchHistoryAction(str, enum.Enum):
    assigned = "assigned"
    removed = "removed"
    deactivated = "deactivated"
    activated = "activated"


class MaterialFileType(str, enum.Enum):
    pdf = "pdf"
    excel = "excel"
    word = "word"
    pptx = "pptx"
    image = "image"
    archive = "archive"
    other = "other"


class AnnouncementScope(str, enum.Enum):
    institute = "institute"
    batch = "batch"
    course = "course"


class LectureWatchStatus(str, enum.Enum):
    unwatched = "unwatched"
    in_progress = "in_progress"
    completed = "completed"


class CertificateStatus(str, enum.Enum):
    eligible = "eligible"
    approved = "approved"
    revoked = "revoked"


class QuestionType(str, enum.Enum):
    mcq = "mcq"
    true_false = "true_false"
    short_answer = "short_answer"


class QuizAttemptStatus(str, enum.Enum):
    in_progress = "in_progress"
    submitted = "submitted"
    graded = "graded"


class FeedbackType(str, enum.Enum):
    bug_report = "bug_report"
    feature_request = "feature_request"
    general_feedback = "general_feedback"
    ux_issue = "ux_issue"


class FeedbackStatus(str, enum.Enum):
    submitted = "submitted"
    under_review = "under_review"
    planned = "planned"
    in_progress = "in_progress"
    done = "done"
    declined = "declined"


class DeviceLimitRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    consumed = "consumed"


class DeviceLimitMode(str, enum.Enum):
    """Institute-wide device limit enforcement mode.

    Stored as a plain string in SystemSetting under key ``device_limit_mode``.
    Kept here so the service layer can validate with a single source of truth.
    """
    evict_oldest = "evict_oldest"
    require_approval = "require_approval"


class FeePlanType(str, enum.Enum):
    """Student fee plan shape. Picked per enrollment by the admissions officer."""
    one_time = "one_time"
    monthly = "monthly"
    installment = "installment"


class FeePlanStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class FeeInstallmentStatus(str, enum.Enum):
    pending = "pending"
    partially_paid = "partially_paid"
    paid = "paid"
    overdue = "overdue"
    waived = "waived"


class FeeDiscountType(str, enum.Enum):
    percent = "percent"
    flat = "flat"
