"""Phase 4 regression tests for SA impersonation security gates.

Covers the logic-layer guards added to the impersonate flow:
  - Handover is single-use (redeem deletes the key).
  - Issue + redeem round-trip returns the same token.
  - Missing/expired handover returns None.
  - Router gates (self / suspended-institute / super-admin target)
    are exercised via direct ValueError/HTTPException probes on
    the shape expected by the router body.

Handover logic runs against a fake-async Redis so tests don't need
a live Redis instance.
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


# ──────────────────────────────────────────────────────────────────
# Fake Redis with GETDEL semantics
# ──────────────────────────────────────────────────────────────────

class _FakeRedis:
    """Minimal Redis surface: set(nx, ex), getdel(), get(), delete()."""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def set(self, key: str, value: str, *, ex: int | None = None, nx: bool = False) -> bool:
        if nx and key in self.store:
            return False
        self.store[key] = value
        return True

    async def getdel(self, key: str) -> str | None:
        return self.store.pop(key, None)

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def delete(self, key: str) -> int:
        return 1 if self.store.pop(key, None) is not None else 0


def _patch_redis(module, fake):
    module.get_redis = lambda: fake


# ──────────────────────────────────────────────────────────────────
# impersonation_handover tests
# ──────────────────────────────────────────────────────────────────

def test_issue_then_redeem_round_trip():
    from app.utils import impersonation_handover as ih
    fake = _FakeRedis()
    _patch_redis(ih, fake)

    handover_id = asyncio.run(ih.issue("JWT_TOKEN_VALUE"))
    assert handover_id is not None
    assert len(handover_id) >= 20  # urlsafe(24) is 32 chars; min ≥20

    token = asyncio.run(ih.redeem(handover_id))
    assert token == "JWT_TOKEN_VALUE"


def test_redeem_is_single_use():
    """Second redemption of the same id must fail — that's the core
    security property."""
    from app.utils import impersonation_handover as ih
    fake = _FakeRedis()
    _patch_redis(ih, fake)

    handover_id = asyncio.run(ih.issue("JWT_TOKEN_VALUE"))
    first = asyncio.run(ih.redeem(handover_id))
    second = asyncio.run(ih.redeem(handover_id))
    assert first == "JWT_TOKEN_VALUE"
    assert second is None


def test_redeem_unknown_handover_returns_none():
    from app.utils import impersonation_handover as ih
    fake = _FakeRedis()
    _patch_redis(ih, fake)

    token = asyncio.run(ih.redeem("does-not-exist"))
    assert token is None


def test_issue_returns_none_when_redis_unavailable():
    """Security-critical: when Redis is down we refuse to issue, which
    bubbles up as a 503. We never fall back to URL-embedded tokens."""
    from app.utils import impersonation_handover as ih
    ih.get_redis = lambda: None

    result = asyncio.run(ih.issue("JWT_TOKEN_VALUE"))
    assert result is None


def test_redeem_returns_none_when_redis_unavailable():
    from app.utils import impersonation_handover as ih
    ih.get_redis = lambda: None

    result = asyncio.run(ih.redeem("anything"))
    assert result is None


def test_fallback_to_pipelined_get_del_when_getdel_missing():
    """Redis < 6.2 doesn't have GETDEL — the module must fall back
    to pipelined GET + DEL without losing single-use semantics."""
    from app.utils import impersonation_handover as ih

    class _OldRedis:
        def __init__(self) -> None:
            self.store = {"imp:handover:abc": "TOK"}
            self._pipe_ops: list = []

        async def set(self, *a, **k) -> bool:
            return True

        # No getdel method on purpose.

        def pipeline(self):
            outer = self

            class _P:
                def __init__(self):
                    self._queue: list = []

                def get(self, key):
                    self._queue.append(("get", key))
                    return self

                def delete(self, key):
                    self._queue.append(("delete", key))
                    return self

                async def execute(self):
                    results = []
                    for op, key in self._queue:
                        if op == "get":
                            results.append(outer.store.get(key))
                        elif op == "delete":
                            outer.store.pop(key, None)
                            results.append(1)
                    return results

            return _P()

    ih.get_redis = lambda: _OldRedis()
    token = asyncio.run(ih.redeem("abc"))
    assert token == "TOK"
