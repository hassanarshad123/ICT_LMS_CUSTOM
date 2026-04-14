"""Unit tests for the blue-green scheduler ownership check.

The bug this fixes: prior to this change, the APScheduler only ran on whichever
slot was marked via SCHEDULER_ENABLED env var at container startup. After a
blue-green deploy drained the old slot, the scheduler stopped completely until
the next deploy — so daily jobs (fee reminders, trial expiry), minute-cadence
jobs (webhook deliveries), and the 30s Frappe sync job all paused between
deploys.

The fix: scheduler runs on every slot, but each job checks
`lms:scheduler:owner` in Redis before executing. The deploy script writes this
key at cutover so only the active slot actually performs work.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core import sentry as sentry_mod


@pytest.fixture
def enable_auto_redis(monkeypatch):
    """Patch get_settings().DEPLOY_SLOT to a known value."""
    fake_settings = MagicMock()
    fake_settings.DEPLOY_SLOT = "blue"
    monkeypatch.setattr("app.config.get_settings", lambda: fake_settings)
    return fake_settings


class TestIsSchedulerOwner:
    """_is_scheduler_owner is the new gate on every scheduler job."""

    @pytest.mark.asyncio
    async def test_returns_true_when_redis_unavailable(self, monkeypatch):
        """Fail-open: Redis down → jobs run anyway. Better duplicates than silence."""
        monkeypatch.setattr("app.core.redis.get_redis", lambda: None)
        assert await sentry_mod._is_scheduler_owner() is True

    @pytest.mark.asyncio
    async def test_returns_true_when_owner_key_missing(self, monkeypatch, enable_auto_redis):
        """First deploy case: no key yet → run."""
        fake_redis = MagicMock()
        fake_redis.get = AsyncMock(return_value=None)
        monkeypatch.setattr("app.core.redis.get_redis", lambda: fake_redis)
        assert await sentry_mod._is_scheduler_owner() is True

    @pytest.mark.asyncio
    async def test_returns_true_when_owner_matches_slot(self, monkeypatch, enable_auto_redis):
        fake_redis = MagicMock()
        fake_redis.get = AsyncMock(return_value=b"blue")  # matches DEPLOY_SLOT=blue
        monkeypatch.setattr("app.core.redis.get_redis", lambda: fake_redis)
        assert await sentry_mod._is_scheduler_owner() is True

    @pytest.mark.asyncio
    async def test_returns_false_when_owner_differs(self, monkeypatch, enable_auto_redis):
        fake_redis = MagicMock()
        fake_redis.get = AsyncMock(return_value=b"green")  # slot is blue
        monkeypatch.setattr("app.core.redis.get_redis", lambda: fake_redis)
        assert await sentry_mod._is_scheduler_owner() is False

    @pytest.mark.asyncio
    async def test_handles_str_value_from_redis(self, monkeypatch, enable_auto_redis):
        """decode_responses=False returns bytes, but tolerate str in case redis client
        is reconfigured."""
        fake_redis = MagicMock()
        fake_redis.get = AsyncMock(return_value="blue")
        monkeypatch.setattr("app.core.redis.get_redis", lambda: fake_redis)
        assert await sentry_mod._is_scheduler_owner() is True

    @pytest.mark.asyncio
    async def test_fails_open_on_redis_exception(self, monkeypatch, enable_auto_redis):
        """Redis call blows up mid-request → run job anyway."""
        fake_redis = MagicMock()
        fake_redis.get = AsyncMock(side_effect=ConnectionError("redis gone"))
        monkeypatch.setattr("app.core.redis.get_redis", lambda: fake_redis)
        assert await sentry_mod._is_scheduler_owner() is True


class TestSentryJobWrapperOwnershipGate:
    """The wrapper must SKIP work when not the owner, without logging errors."""

    @pytest.mark.asyncio
    async def test_job_skipped_when_not_owner(self, monkeypatch):
        monkeypatch.setattr(sentry_mod, "_is_scheduler_owner", AsyncMock(return_value=False))

        called = {"count": 0}

        @sentry_mod.sentry_job_wrapper("test_job")
        async def job():
            called["count"] += 1

        result = await job()
        assert called["count"] == 0
        assert result is None

    @pytest.mark.asyncio
    async def test_job_runs_when_owner(self, monkeypatch):
        monkeypatch.setattr(sentry_mod, "_is_scheduler_owner", AsyncMock(return_value=True))

        called = {"count": 0}

        @sentry_mod.sentry_job_wrapper("test_job")
        async def job():
            called["count"] += 1
            return "ok"

        result = await job()
        assert called["count"] == 1
        assert result == "ok"

    @pytest.mark.asyncio
    async def test_job_runs_and_raises_when_owner(self, monkeypatch):
        """Exceptions still propagate — we don't want to silently swallow them."""
        monkeypatch.setattr(sentry_mod, "_is_scheduler_owner", AsyncMock(return_value=True))

        @sentry_mod.sentry_job_wrapper("failing_job")
        async def job():
            raise RuntimeError("boom")

        with pytest.raises(RuntimeError, match="boom"):
            await job()

    @pytest.mark.asyncio
    async def test_ownership_checked_before_sentry_scope(self, monkeypatch):
        """Non-owner slot should short-circuit before creating a Sentry scope —
        no need to tag every no-op fire."""
        monkeypatch.setattr(sentry_mod, "_is_scheduler_owner", AsyncMock(return_value=False))

        with patch("sentry_sdk.new_scope") as mock_scope:
            @sentry_mod.sentry_job_wrapper("test_job")
            async def job():
                return None

            await job()
            mock_scope.assert_not_called()


class TestMultiWorkerLock:
    """Second dedup layer: serialize across uvicorn workers in a single
    container. Each worker boots its own scheduler; only one should run a
    given interval fire.
    """

    @pytest.mark.asyncio
    async def test_acquired_lock_allows_job_to_run(self, monkeypatch):
        monkeypatch.setattr(sentry_mod, "_is_scheduler_owner", AsyncMock(return_value=True))
        fake_redis = MagicMock()
        fake_redis.set = AsyncMock(return_value=True)   # NX succeeds
        fake_redis.delete = AsyncMock()
        monkeypatch.setattr("app.core.redis.get_redis", lambda: fake_redis)

        runs = {"count": 0}

        @sentry_mod.sentry_job_wrapper("j", lock_ttl_seconds=10)
        async def job():
            runs["count"] += 1

        await job()
        assert runs["count"] == 1
        # Lock is released on success
        fake_redis.delete.assert_called_once_with("lms:scheduler:lock:j")

    @pytest.mark.asyncio
    async def test_held_lock_causes_skip(self, monkeypatch):
        monkeypatch.setattr(sentry_mod, "_is_scheduler_owner", AsyncMock(return_value=True))
        fake_redis = MagicMock()
        fake_redis.set = AsyncMock(return_value=False)  # NX fails — sibling holds it
        fake_redis.delete = AsyncMock()
        monkeypatch.setattr("app.core.redis.get_redis", lambda: fake_redis)

        runs = {"count": 0}

        @sentry_mod.sentry_job_wrapper("j")
        async def job():
            runs["count"] += 1

        await job()
        assert runs["count"] == 0  # skipped
        # Didn't try to delete a lock we don't own
        fake_redis.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_redis_unavailable_fails_open(self, monkeypatch):
        monkeypatch.setattr(sentry_mod, "_is_scheduler_owner", AsyncMock(return_value=True))
        monkeypatch.setattr("app.core.redis.get_redis", lambda: None)

        runs = {"count": 0}

        @sentry_mod.sentry_job_wrapper("j")
        async def job():
            runs["count"] += 1

        await job()
        # No Redis → run anyway (better duplicates than silence)
        assert runs["count"] == 1

    @pytest.mark.asyncio
    async def test_lock_released_on_exception(self, monkeypatch):
        """If the job raises, the lock must STILL be released so the next
        interval can acquire it."""
        monkeypatch.setattr(sentry_mod, "_is_scheduler_owner", AsyncMock(return_value=True))
        fake_redis = MagicMock()
        fake_redis.set = AsyncMock(return_value=True)
        fake_redis.delete = AsyncMock()
        monkeypatch.setattr("app.core.redis.get_redis", lambda: fake_redis)

        @sentry_mod.sentry_job_wrapper("j")
        async def job():
            raise RuntimeError("kaboom")

        with pytest.raises(RuntimeError, match="kaboom"):
            await job()
        fake_redis.delete.assert_called_once_with("lms:scheduler:lock:j")

    @pytest.mark.asyncio
    async def test_lock_ttl_honored(self, monkeypatch):
        """Lock SET call uses the configured TTL so a crashed worker can't
        block forever."""
        monkeypatch.setattr(sentry_mod, "_is_scheduler_owner", AsyncMock(return_value=True))
        fake_redis = MagicMock()
        fake_redis.set = AsyncMock(return_value=True)
        fake_redis.delete = AsyncMock()
        monkeypatch.setattr("app.core.redis.get_redis", lambda: fake_redis)

        @sentry_mod.sentry_job_wrapper("j", lock_ttl_seconds=45)
        async def job():
            return None

        await job()
        # Called as set(key, value, nx=True, ex=45)
        call = fake_redis.set.call_args
        assert call.kwargs.get("nx") is True
        assert call.kwargs.get("ex") == 45
