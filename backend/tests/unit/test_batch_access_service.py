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
        assert logged[0].extension_type == "initial"
        assert logged[0].reason == "scholarship"

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
