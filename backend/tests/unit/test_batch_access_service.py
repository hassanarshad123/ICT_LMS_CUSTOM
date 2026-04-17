import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.batch_service import set_student_access
from app.models.batch import StudentBatch, Batch


def _make_mock_session(student_batch, batch):
    session = AsyncMock()
    exec_result = MagicMock()
    exec_result.scalar_one_or_none = MagicMock(return_value=(student_batch, batch))
    session.execute = AsyncMock(return_value=exec_result)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    return session


@pytest.fixture
def sample_ids():
    return {
        "institute_id": uuid.uuid4(),
        "student_id": uuid.uuid4(),
        "batch_id": uuid.uuid4(),
        "actor_id": uuid.uuid4(),
    }


@pytest.fixture
def sample_batch(sample_ids):
    return Batch(
        id=sample_ids["batch_id"],
        name="Batch A",
        start_date=date.today() - timedelta(days=30),
        end_date=date.today() + timedelta(days=90),
        institute_id=sample_ids["institute_id"],
    )


@pytest.fixture
def sample_enrollment(sample_ids):
    return StudentBatch(
        id=uuid.uuid4(),
        student_id=sample_ids["student_id"],
        batch_id=sample_ids["batch_id"],
        institute_id=sample_ids["institute_id"],
        is_active=True,
        extended_end_date=None,
    )


class TestSetStudentAccessValidation:
    @pytest.mark.asyncio
    async def test_rejects_both_days_and_end_date(self, sample_ids, sample_batch, sample_enrollment):
        session = _make_mock_session(sample_enrollment, sample_batch)
        with pytest.raises(ValueError, match="either.*or"):
            await set_student_access(
                session,
                institute_id=sample_ids["institute_id"],
                student_id=sample_ids["student_id"],
                batch_id=sample_ids["batch_id"],
                days=30,
                end_date=date.today() + timedelta(days=60),
                actor_id=sample_ids["actor_id"],
                context="adjust",
            )

    @pytest.mark.asyncio
    async def test_rejects_past_date(self, sample_ids, sample_batch, sample_enrollment):
        session = _make_mock_session(sample_enrollment, sample_batch)
        with pytest.raises(ValueError, match="future"):
            await set_student_access(
                session,
                institute_id=sample_ids["institute_id"],
                student_id=sample_ids["student_id"],
                batch_id=sample_ids["batch_id"],
                end_date=date.today() - timedelta(days=1),
                actor_id=sample_ids["actor_id"],
                context="adjust",
            )

    @pytest.mark.asyncio
    async def test_rejects_enrollment_not_found(self, sample_ids, sample_batch):
        session = AsyncMock()
        exec_result = MagicMock()
        exec_result.scalar_one_or_none = MagicMock(return_value=None)
        session.execute = AsyncMock(return_value=exec_result)
        with pytest.raises(LookupError):
            await set_student_access(
                session,
                institute_id=sample_ids["institute_id"],
                student_id=sample_ids["student_id"],
                batch_id=sample_ids["batch_id"],
                days=30,
                actor_id=sample_ids["actor_id"],
                context="adjust",
            )


class TestSetStudentAccessDirection:
    @pytest.mark.asyncio
    async def test_days_path_computes_from_today(self, sample_ids, sample_batch, sample_enrollment):
        session = _make_mock_session(sample_enrollment, sample_batch)
        result = await set_student_access(
            session,
            institute_id=sample_ids["institute_id"],
            student_id=sample_ids["student_id"],
            batch_id=sample_ids["batch_id"],
            days=30,
            actor_id=sample_ids["actor_id"],
            context="initial",
        )
        assert result["new_end_date"] == date.today() + timedelta(days=30)
        assert result["extension_type"] == "initial"
        assert sample_enrollment.extended_end_date == date.today() + timedelta(days=30)

    @pytest.mark.asyncio
    async def test_adjust_context_detects_shorten(self, sample_ids, sample_batch, sample_enrollment):
        session = _make_mock_session(sample_enrollment, sample_batch)
        result = await set_student_access(
            session,
            institute_id=sample_ids["institute_id"],
            student_id=sample_ids["student_id"],
            batch_id=sample_ids["batch_id"],
            days=10,
            actor_id=sample_ids["actor_id"],
            context="adjust",
        )
        assert result["extension_type"] == "shorten"

    @pytest.mark.asyncio
    async def test_adjust_context_detects_extend(self, sample_ids, sample_batch, sample_enrollment):
        session = _make_mock_session(sample_enrollment, sample_batch)
        result = await set_student_access(
            session,
            institute_id=sample_ids["institute_id"],
            student_id=sample_ids["student_id"],
            batch_id=sample_ids["batch_id"],
            days=200,
            actor_id=sample_ids["actor_id"],
            context="adjust",
        )
        assert result["extension_type"] == "extend"


class TestSetStudentAccessSideEffects:
    @pytest.mark.asyncio
    async def test_writes_batch_extension_log(self, sample_ids, sample_batch, sample_enrollment):
        session = _make_mock_session(sample_enrollment, sample_batch)
        await set_student_access(
            session,
            institute_id=sample_ids["institute_id"],
            student_id=sample_ids["student_id"],
            batch_id=sample_ids["batch_id"],
            days=30,
            actor_id=sample_ids["actor_id"],
            reason="scholarship",
            context="initial",
        )
        add_calls = session.add.call_args_list
        from app.models.batch import BatchExtensionLog
        logged = [c.args[0] for c in add_calls if isinstance(c.args[0], BatchExtensionLog)]
        assert len(logged) == 1
        log = logged[0]
        assert log.extension_type == "initial"
        assert log.reason == "scholarship"
        assert log.previous_end_date == sample_batch.end_date
        assert log.new_end_date == date.today() + timedelta(days=30)
        assert log.duration_days == 30
        assert log.extended_by == sample_ids["actor_id"]
        assert log.institute_id == sample_ids["institute_id"]
        assert log.student_id == sample_ids["student_id"]
        assert log.batch_id == sample_ids["batch_id"]
        assert log.student_batch_id == sample_enrollment.id

    @pytest.mark.asyncio
    async def test_fires_webhook_on_extend_not_on_initial(self, sample_ids, sample_batch, sample_enrollment):
        session = _make_mock_session(sample_enrollment, sample_batch)
        with patch("app.services.batch_service.queue_webhook_event", new=AsyncMock()) as mock_queue:
            await set_student_access(
                session,
                institute_id=sample_ids["institute_id"],
                student_id=sample_ids["student_id"],
                batch_id=sample_ids["batch_id"],
                days=30,
                actor_id=sample_ids["actor_id"],
                context="initial",
            )
            assert mock_queue.await_count == 0

            await set_student_access(
                session,
                institute_id=sample_ids["institute_id"],
                student_id=sample_ids["student_id"],
                batch_id=sample_ids["batch_id"],
                days=200,
                actor_id=sample_ids["actor_id"],
                context="adjust",
            )
            assert mock_queue.await_count == 1
            args = mock_queue.await_args.kwargs
            assert args["event_type"] == "enrollment.access_changed"


class TestExtendStudentAccessShortening:
    @pytest.mark.asyncio
    async def test_extend_can_shorten_below_batch_end(self, sample_ids, sample_batch, sample_enrollment):
        # Batch ends today+90. Request end_date = today+10 (earlier). Should succeed now.
        from app.services.batch_service import extend_student_access
        session = _make_mock_session(sample_enrollment, sample_batch)
        with patch("app.services.batch_service.queue_webhook_event", new=AsyncMock()):
            result = await extend_student_access(
                session,
                institute_id=sample_ids["institute_id"],
                student_id=sample_ids["student_id"],
                batch_id=sample_ids["batch_id"],
                end_date=date.today() + timedelta(days=10),
                extended_by=sample_ids["actor_id"],
            )
        assert result["new_end_date"] == date.today() + timedelta(days=10)
        assert result["extension_type"] == "shorten"

    @pytest.mark.asyncio
    async def test_extend_still_rejects_past_date(self, sample_ids, sample_batch, sample_enrollment):
        from app.services.batch_service import extend_student_access
        session = _make_mock_session(sample_enrollment, sample_batch)
        with pytest.raises(ValueError, match="future"):
            await extend_student_access(
                session,
                institute_id=sample_ids["institute_id"],
                student_id=sample_ids["student_id"],
                batch_id=sample_ids["batch_id"],
                end_date=date.today() - timedelta(days=1),
                extended_by=sample_ids["actor_id"],
            )

    @pytest.mark.asyncio
    async def test_extend_with_duration_days_works(self, sample_ids, sample_batch, sample_enrollment):
        # Regression: existing callers pass `duration_days=N` (legacy param name).
        from app.services.batch_service import extend_student_access
        session = _make_mock_session(sample_enrollment, sample_batch)
        with patch("app.services.batch_service.queue_webhook_event", new=AsyncMock()):
            result = await extend_student_access(
                session,
                institute_id=sample_ids["institute_id"],
                student_id=sample_ids["student_id"],
                batch_id=sample_ids["batch_id"],
                duration_days=180,
                extended_by=sample_ids["actor_id"],
            )
        assert result["new_end_date"] == date.today() + timedelta(days=180)
        assert result["extension_type"] == "extend"

    @pytest.mark.asyncio
    async def test_extend_returns_ExtensionOut_compatible_shape(self, sample_ids, sample_batch, sample_enrollment):
        # Router validates this shape as ExtensionOut. Must include student_id, batch_id,
        # previous_end_date, new_end_date, extension_type, duration_days, reason.
        from app.services.batch_service import extend_student_access
        from app.schemas.batch import ExtensionOut
        session = _make_mock_session(sample_enrollment, sample_batch)
        with patch("app.services.batch_service.queue_webhook_event", new=AsyncMock()):
            result = await extend_student_access(
                session,
                institute_id=sample_ids["institute_id"],
                student_id=sample_ids["student_id"],
                batch_id=sample_ids["batch_id"],
                duration_days=180,
                reason="scholarship",
                extended_by=sample_ids["actor_id"],
            )
        out = ExtensionOut(**result)
        assert out.student_id == sample_ids["student_id"]
        assert out.batch_id == sample_ids["batch_id"]
        assert out.duration_days == 180
        assert out.reason == "scholarship"
        assert out.extension_type == "extend"

    @pytest.mark.asyncio
    async def test_extend_translates_lookup_error_to_value_error(self, sample_ids, sample_batch):
        # Router catches ValueError; must not let LookupError escape as 500.
        from app.services.batch_service import extend_student_access
        session = AsyncMock()
        exec_result = MagicMock()
        exec_result.scalar_one_or_none = MagicMock(return_value=None)
        session.execute = AsyncMock(return_value=exec_result)
        with pytest.raises(ValueError, match="not found"):
            await extend_student_access(
                session,
                institute_id=sample_ids["institute_id"],
                student_id=sample_ids["student_id"],
                batch_id=sample_ids["batch_id"],
                duration_days=30,
                extended_by=sample_ids["actor_id"],
            )


# ---------------------------------------------------------------------------
# Helpers for enroll_student tests
# The real enroll_student makes 3 session.execute() calls:
#   1. Check student exists (User query)
#   2. Check batch belongs to institute (Batch query)
#   3. Check not already enrolled (StudentBatch query)
# ---------------------------------------------------------------------------

def _make_enroll_session(student_mock, batch_mock, existing_enrollment=None):
    """Build a mock session for enroll_student with the correct 3-execute sequence."""
    from app.models.user import User as UserModel

    session = AsyncMock()

    exec_student = MagicMock()
    exec_student.scalar_one_or_none = MagicMock(return_value=student_mock)

    exec_batch = MagicMock()
    exec_batch.scalar_one_or_none = MagicMock(return_value=batch_mock)

    exec_no_row = MagicMock()
    exec_no_row.scalar_one_or_none = MagicMock(return_value=existing_enrollment)

    session.execute = AsyncMock(side_effect=[exec_student, exec_batch, exec_no_row])
    added = []
    session.add = MagicMock(side_effect=added.append)
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    # get() is used after commit to load Batch for email; return None to skip email path
    session.get = AsyncMock(return_value=None)
    session._added = added
    return session


def _make_mock_student(sample_ids):
    """Create a minimal User mock that passes enroll_student's student check."""
    from app.models.user import User as UserModel
    from app.models.enums import UserRole
    student = MagicMock(spec=UserModel)
    student.id = sample_ids["student_id"]
    student.role = UserRole.student
    student.institute_id = sample_ids["institute_id"]
    student.name = "Test Student"
    student.email = "student@test.com"
    return student


class TestEnrollStudentWithAccessDuration:
    @pytest.mark.asyncio
    async def test_enroll_with_access_days_sets_extended_end_date(self, sample_ids, sample_batch):
        from app.services.batch_service import enroll_student
        from app.models.batch import StudentBatch as SB, BatchExtensionLog

        student = _make_mock_student(sample_ids)
        session = _make_enroll_session(student, sample_batch, existing_enrollment=None)

        with patch("app.utils.email_sender.send_email_background"):
            result = await enroll_student(
                session,
                batch_id=sample_ids["batch_id"],
                student_id=sample_ids["student_id"],
                enrolled_by=sample_ids["actor_id"],
                institute_id=sample_ids["institute_id"],
                access_days=30,
            )

        sb_added = [o for o in session._added if isinstance(o, SB)]
        assert len(sb_added) == 1
        assert sb_added[0].extended_end_date == date.today() + timedelta(days=30)

        log_added = [o for o in session._added if isinstance(o, BatchExtensionLog)]
        assert len(log_added) == 1
        assert log_added[0].extension_type == "initial"
        assert log_added[0].duration_days == 30
        assert log_added[0].previous_end_date is None

    @pytest.mark.asyncio
    async def test_enroll_with_access_end_date_sets_extended_end_date(self, sample_ids, sample_batch):
        from app.services.batch_service import enroll_student
        from app.models.batch import StudentBatch as SB

        student = _make_mock_student(sample_ids)
        session = _make_enroll_session(student, sample_batch, existing_enrollment=None)
        target = date.today() + timedelta(days=45)

        with patch("app.utils.email_sender.send_email_background"):
            await enroll_student(
                session,
                batch_id=sample_ids["batch_id"],
                student_id=sample_ids["student_id"],
                enrolled_by=sample_ids["actor_id"],
                institute_id=sample_ids["institute_id"],
                access_end_date=target,
            )

        sb_added = [o for o in session._added if isinstance(o, SB)]
        assert sb_added[0].extended_end_date == target

    @pytest.mark.asyncio
    async def test_enroll_without_duration_leaves_extended_end_date_null(self, sample_ids, sample_batch):
        from app.services.batch_service import enroll_student
        from app.models.batch import StudentBatch as SB, BatchExtensionLog

        student = _make_mock_student(sample_ids)
        session = _make_enroll_session(student, sample_batch, existing_enrollment=None)

        with patch("app.utils.email_sender.send_email_background"):
            await enroll_student(
                session,
                batch_id=sample_ids["batch_id"],
                student_id=sample_ids["student_id"],
                enrolled_by=sample_ids["actor_id"],
                institute_id=sample_ids["institute_id"],
            )

        sb_added = [o for o in session._added if isinstance(o, SB)]
        assert sb_added[0].extended_end_date is None

        log_added = [o for o in session._added if isinstance(o, BatchExtensionLog)]
        assert len(log_added) == 0

    @pytest.mark.asyncio
    async def test_enroll_rejects_both_access_fields(self, sample_ids, sample_batch):
        from app.services.batch_service import enroll_student

        student = _make_mock_student(sample_ids)
        session = _make_enroll_session(student, sample_batch, existing_enrollment=None)

        with pytest.raises(ValueError, match="either.*or"):
            await enroll_student(
                session,
                batch_id=sample_ids["batch_id"],
                student_id=sample_ids["student_id"],
                enrolled_by=sample_ids["actor_id"],
                institute_id=sample_ids["institute_id"],
                access_days=30,
                access_end_date=date.today() + timedelta(days=60),
            )

    @pytest.mark.asyncio
    async def test_enroll_rejects_past_access_end_date(self, sample_ids, sample_batch):
        from app.services.batch_service import enroll_student

        student = _make_mock_student(sample_ids)
        session = _make_enroll_session(student, sample_batch, existing_enrollment=None)

        with pytest.raises(ValueError, match="future"):
            await enroll_student(
                session,
                batch_id=sample_ids["batch_id"],
                student_id=sample_ids["student_id"],
                enrolled_by=sample_ids["actor_id"],
                institute_id=sample_ids["institute_id"],
                access_end_date=date.today() - timedelta(days=1),
            )
