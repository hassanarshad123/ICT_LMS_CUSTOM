# Backward-compatibility shim — classes moved to individual modules.
# Kept so existing imports like `from app.models.other import UserSession` still resolve.
from app.models.announcement import Announcement  # noqa: F401
from app.models.progress import LectureProgress  # noqa: F401
from app.models.job import Job, JobApplication  # noqa: F401
from app.models.session import UserSession  # noqa: F401
from app.models.settings import SystemSetting  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.activity import ActivityLog  # noqa: F401
