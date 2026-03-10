import enum


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    course_creator = "course_creator"
    teacher = "teacher"
    student = "student"


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
