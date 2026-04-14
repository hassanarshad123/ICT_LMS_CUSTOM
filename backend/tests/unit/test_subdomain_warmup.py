"""Unit tests for the subdomain warmup helper.

These tests are pure unit tests: no DB, no live HTTP, no FastAPI app.
The warmup helper is fire-and-forget and must NEVER raise — every test
also implicitly asserts that.
"""
from __future__ import annotations

import ssl
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.utils import subdomain_warmup as warmup_mod
from app.utils.subdomain_warmup import warmup_subdomain


# ── helpers ───────────────────────────────────────────────────────────


def _fake_settings(
    enabled: bool = True,
    base_domain: str = "zensbot.online",
    max_attempts: int = 5,
    delay: float = 0.0,
):
    return SimpleNamespace(
        SUBDOMAIN_WARMUP_ENABLED=enabled,
        FRONTEND_BASE_DOMAIN=base_domain,
        SUBDOMAIN_WARMUP_MAX_ATTEMPTS=max_attempts,
        SUBDOMAIN_WARMUP_DELAY_SECONDS=delay,
    )


class _FakeClientCtx:
    """Async context manager that yields a client whose .get is an AsyncMock."""

    def __init__(self, get_mock: AsyncMock):
        self._client = MagicMock()
        self._client.get = get_mock

    async def __aenter__(self):
        return self._client

    async def __aexit__(self, exc_type, exc, tb):
        return False


def _patch_httpx(get_mock: AsyncMock):
    return patch.object(
        warmup_mod.httpx,
        "AsyncClient",
        return_value=_FakeClientCtx(get_mock),
    )


def _patch_settings(settings):
    return patch.object(warmup_mod, "get_settings", return_value=settings)


# Speed up retries — patch asyncio.sleep at module level.
@pytest.fixture(autouse=True)
def _no_sleep():
    with patch.object(warmup_mod.asyncio, "sleep", new=AsyncMock(return_value=None)):
        yield


# ── disabled / skip paths ─────────────────────────────────────────────


async def test_warmup_disabled_returns_immediately():
    get_mock = AsyncMock()
    with _patch_settings(_fake_settings(enabled=False)), _patch_httpx(get_mock):
        await warmup_subdomain("acme")
    get_mock.assert_not_called()


async def test_warmup_skips_empty_base_domain():
    get_mock = AsyncMock()
    with _patch_settings(_fake_settings(base_domain="")), _patch_httpx(get_mock):
        await warmup_subdomain("acme")
    get_mock.assert_not_called()


async def test_warmup_skips_localhost_base_domain():
    get_mock = AsyncMock()
    with _patch_settings(_fake_settings(base_domain="localhost:3000")), _patch_httpx(get_mock):
        await warmup_subdomain("acme")
    get_mock.assert_not_called()


# ── SSRF guard ─────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "bad_slug",
    [
        "evil.com/../",
        "a",            # too short
        "ab",           # too short
        "UPPER",        # uppercase
        "foo..bar",     # dots not allowed
        "-leading",     # leading hyphen
        "trailing-",    # trailing hyphen
        "with space",   # whitespace
        "x" * 31,       # too long
        "",             # empty
        "slug/with/path",
        "slug?query=1",
    ],
)
async def test_warmup_rejects_invalid_slug_ssrf_guard(bad_slug):
    get_mock = AsyncMock()
    with _patch_settings(_fake_settings()), _patch_httpx(get_mock):
        await warmup_subdomain(bad_slug)
    get_mock.assert_not_called()


async def test_warmup_rejects_non_string_slug():
    get_mock = AsyncMock()
    with _patch_settings(_fake_settings()), _patch_httpx(get_mock):
        await warmup_subdomain(None)  # type: ignore[arg-type]
        await warmup_subdomain(12345)  # type: ignore[arg-type]
    get_mock.assert_not_called()


# ── happy path ─────────────────────────────────────────────────────────


async def test_warmup_success_first_attempt():
    resp = MagicMock(status_code=200)
    get_mock = AsyncMock(return_value=resp)
    with _patch_settings(_fake_settings()), _patch_httpx(get_mock):
        await warmup_subdomain("acme")
    assert get_mock.call_count == 1
    called_url = get_mock.call_args.args[0]
    assert called_url == "https://acme.zensbot.online/"


async def test_warmup_success_on_4xx_response():
    """A 404 still means the TLS handshake succeeded — warmup is done."""
    resp = MagicMock(status_code=404)
    get_mock = AsyncMock(return_value=resp)
    with _patch_settings(_fake_settings()), _patch_httpx(get_mock):
        await warmup_subdomain("acme")
    assert get_mock.call_count == 1


# ── retry behavior ─────────────────────────────────────────────────────


async def test_warmup_retries_on_ssl_error_then_succeeds():
    ok = MagicMock(status_code=200)
    get_mock = AsyncMock(
        side_effect=[ssl.SSLError("handshake"), ssl.SSLError("handshake"), ok]
    )
    with _patch_settings(_fake_settings(max_attempts=5)), _patch_httpx(get_mock):
        await warmup_subdomain("acme")
    assert get_mock.call_count == 3


async def test_warmup_retries_on_connect_error_then_succeeds():
    ok = MagicMock(status_code=200)
    get_mock = AsyncMock(
        side_effect=[httpx.ConnectError("nope"), httpx.ConnectError("nope"), ok]
    )
    with _patch_settings(_fake_settings(max_attempts=5)), _patch_httpx(get_mock):
        await warmup_subdomain("acme")
    assert get_mock.call_count == 3


async def test_warmup_retries_on_5xx_then_succeeds():
    bad = MagicMock(status_code=502)
    ok = MagicMock(status_code=200)
    get_mock = AsyncMock(side_effect=[bad, ok])
    with _patch_settings(_fake_settings(max_attempts=5)), _patch_httpx(get_mock):
        await warmup_subdomain("acme")
    assert get_mock.call_count == 2


async def test_warmup_exhausts_attempts_without_raising():
    get_mock = AsyncMock(side_effect=httpx.ConnectError("always down"))
    with _patch_settings(_fake_settings(max_attempts=4)), _patch_httpx(get_mock):
        await warmup_subdomain("acme")  # must not raise
    assert get_mock.call_count == 4


async def test_warmup_swallows_unexpected_exception():
    get_mock = AsyncMock(side_effect=RuntimeError("kaboom"))
    with _patch_settings(_fake_settings(max_attempts=2)), _patch_httpx(get_mock):
        await warmup_subdomain("acme")  # must not raise
    assert get_mock.call_count == 2


async def test_warmup_swallows_settings_error():
    """If get_settings itself blows up, warmup must still not raise."""
    with patch.object(warmup_mod, "get_settings", side_effect=RuntimeError("boom")):
        await warmup_subdomain("acme")  # must not raise
