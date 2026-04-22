from app.models.enums import *  # noqa: F401,F403
from app.models.institute import Institute, InstituteUsage  # noqa: F401
from app.models.institute_addon import InstituteAddon  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.batch import Batch, StudentBatch, StudentBatchHistory, BatchExtensionLog  # noqa: F401
from app.models.course import (  # noqa: F401
    Course,
    BatchCourse,
    Lecture,
    CurriculumModule,
    BatchMaterial,
)
from app.models.zoom import (  # noqa: F401
    ZoomAccount,
    ZoomClass,
    ClassRecording,
    ZoomAttendance,
)
from app.models.announcement import Announcement  # noqa: F401
from app.models.progress import LectureProgress  # noqa: F401
from app.models.job import Job, JobApplication  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.session import UserSession  # noqa: F401
from app.models.settings import SystemSetting  # noqa: F401
from app.models.activity import ActivityLog  # noqa: F401
from app.models.certificate import Certificate, CertificateCounter  # noqa: F401
from app.models.error_log import ErrorLog  # noqa: F401
from app.models.api_integration import ApiKey, WebhookEndpoint, WebhookDelivery  # noqa: F401
from app.models.quiz import Quiz, QuizQuestion, QuizAttempt, QuizAnswer  # noqa: F401
from app.models.feedback import Feedback, FeedbackAttachment, FeedbackResponse  # noqa: F401
from app.models.device_request import DeviceLimitRequest  # noqa: F401
from app.models.fee import FeePlan, FeeInstallment, FeePayment, ReceiptCounter  # noqa: F401
from app.models.integration import (  # noqa: F401
    InstituteIntegration,
    IntegrationSyncLog,
    IntegrationSyncTask,
    BulkImportJob,
)
from app.models.system_job import SystemJob  # noqa: F401
from app.models.sa_alert import SAAlert, SAAlertPreference  # noqa: F401
