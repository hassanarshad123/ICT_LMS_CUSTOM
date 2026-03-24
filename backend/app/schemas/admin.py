import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ── Dashboard sub-models ─────────────────────────────────────

class RecentBatchOut(BaseModel):
    id: str
    name: str
    start_date: str
    teacher_name: str
    student_count: int
    status: str


class RecentStudentOut(BaseModel):
    id: str
    name: str
    email: str
    status: str
    batch_names: list[str] = []


class DashboardResponse(BaseModel):
    total_batches: int
    active_batches: int
    total_students: int
    active_students: int
    total_teachers: int
    total_course_creators: int
    total_courses: int
    recent_batches: list[RecentBatchOut]
    recent_students: list[RecentStudentOut]


# ── Insights sub-models ──────────────────────────────────────

class MonthlyStatOut(BaseModel):
    month: str
    count: int = 0


class BatchEnrollmentOut(BaseModel):
    batch_id: str
    name: str
    student_count: int


class TeacherWorkloadOut(BaseModel):
    teacher_id: str
    name: str
    batch_count: int
    student_count: int = 0


class LecturesPerCourseOut(BaseModel):
    course_id: str
    title: str
    lecture_count: int


class InsightsResponse(BaseModel):
    monthly: list[MonthlyStatOut]
    students_by_status: dict[str, int]
    batches_by_status: dict[str, int]
    enrollment_per_batch: list[BatchEnrollmentOut]
    teacher_workload: list[TeacherWorkloadOut]
    materials_by_type: dict[str, int]
    lectures_per_course: list[LecturesPerCourseOut]
    device_overview: dict[str, int]


class SessionOut(BaseModel):
    id: uuid.UUID
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    logged_in_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserDeviceSummary(BaseModel):
    user_id: uuid.UUID
    user_name: str
    user_email: str
    user_role: str
    active_sessions: list[SessionOut]


class SettingsResponse(BaseModel):
    settings: dict[str, str]


class SettingsUpdate(BaseModel):
    settings: dict[str, str]


class ActivityLogOut(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    action: str
    entity_type: str
    entity_id: Optional[uuid.UUID] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ExportResponse(BaseModel):
    download_url: str
    expires_at: datetime
