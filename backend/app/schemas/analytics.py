"""Schemas for the 10x Insights Dashboard — Admin Command Center."""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


# ── Shared ──────────────────────────────────────────────────────

class SparklinePoint(BaseModel):
    date: str
    value: float


class KpiCard(BaseModel):
    value: float
    previous_value: float
    change_pct: Optional[float] = None
    sparkline: list[SparklinePoint] = []


# ── Overview Tab ────────────────────────────────────────────────

class AlertItem(BaseModel):
    type: str           # at_risk_students, pending_certs, expiring_batches, idle_teachers
    count: int
    label: str
    link: Optional[str] = None


class OverviewResponse(BaseModel):
    active_students: KpiCard
    active_batches: KpiCard
    lecture_completion: KpiCard
    quiz_pass_rate: KpiCard
    classes_conducted: KpiCard
    certificates_issued: KpiCard
    avg_attendance: KpiCard
    content_created: KpiCard
    alerts: list[AlertItem] = []
    last_updated: str


# ── Students Tab ────────────────────────────────────────────────

class AtRiskStudent(BaseModel):
    student_id: str
    name: str
    email: str
    batch_name: str
    watch_pct: float
    quiz_avg: Optional[float] = None
    last_active: Optional[str] = None
    risk_level: str     # high, medium, low


class EnrollmentTrendPoint(BaseModel):
    week: str
    count: int


class StudentsResponse(BaseModel):
    students_by_status: dict[str, int]
    enrollment_trend: list[EnrollmentTrendPoint]
    completion_distribution: dict[str, int]    # "0-25": N, "25-50": N, ...
    quiz_score_distribution: dict[str, int]    # "<50": N, "50-70": N, ...
    at_risk_students: list[AtRiskStudent]
    total_students: int
    last_updated: str


# ── Staff Tab ───────────────────────────────────────────────────

class TeacherPerformance(BaseModel):
    teacher_id: str
    name: str
    batches_assigned: int
    classes_conducted: int
    avg_attendance_rate: Optional[float] = None
    students_managed: int
    is_idle: bool = False


class CreatorActivity(BaseModel):
    creator_id: str
    name: str
    courses_created: int
    lectures_uploaded: int
    materials_added: int
    quizzes_created: int
    is_idle: bool = False


class StaffResponse(BaseModel):
    teachers: list[TeacherPerformance]
    creators: list[CreatorActivity]
    idle_teachers: int
    idle_creators: int
    last_updated: str


# ── Courses Tab ─────────────────────────────────────────────────

class CoursePerformance(BaseModel):
    course_id: str
    title: str
    lecture_count: int
    avg_watch_pct: Optional[float] = None
    quiz_pass_rate: Optional[float] = None
    cert_requests: int


class HardestQuiz(BaseModel):
    quiz_id: str
    title: str
    course_title: str
    avg_score: float
    pass_rate: float
    attempt_count: int


class CertificatePipeline(BaseModel):
    eligible: int
    requested: int
    approved: int
    issued: int


class QuizTrendPoint(BaseModel):
    date: str
    attempts: int
    pass_rate: float


class CoursesResponse(BaseModel):
    course_performance: list[CoursePerformance]
    quiz_pass_rate: float
    quiz_fail_rate: float
    hardest_quizzes: list[HardestQuiz]
    quiz_trend: list[QuizTrendPoint]
    certificate_pipeline: CertificatePipeline
    last_updated: str


# ── Engagement Tab ──────────────────────────────────────────────

class LectureRanking(BaseModel):
    lecture_id: str
    title: str
    course_title: str
    avg_watch_pct: float
    student_count: int


class BatchEngagement(BaseModel):
    batch_id: str
    batch_name: str
    watch_completion: float
    attendance_rate: Optional[float] = None


class EngagementTrendPoint(BaseModel):
    date: str
    watch_pct: float
    attendance_pct: Optional[float] = None


class EngagementResponse(BaseModel):
    overall_lecture_completion: float
    overall_attendance_rate: Optional[float] = None
    most_watched: list[LectureRanking]
    least_watched: list[LectureRanking]
    engagement_by_batch: list[BatchEngagement]
    engagement_trend: list[EngagementTrendPoint]
    low_attendance_classes: list[dict]   # {class_id, title, batch_name, attendance_rate, date}
    last_updated: str
