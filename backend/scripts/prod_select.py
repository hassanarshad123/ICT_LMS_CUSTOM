"""Read-only Postgres query runner.

Hard-enforces SELECT-only queries against whatever DB DATABASE_URL_DIRECT
points at. Blocks any mutation keyword at the SQL-text level (defense in
depth — asyncpg also runs inside a READ ONLY transaction).

Usage:
    python backend/scripts/prod_select.py "SELECT slug, plan_tier FROM institutes LIMIT 5"
    python backend/scripts/prod_select.py --file /tmp/query.sql
    echo "SELECT 1" | python backend/scripts/prod_select.py --stdin

Output: JSON array of dicts, one per row, printed to stdout.

Connection: reads DATABASE_URL_DIRECT from backend/.env (direct endpoint,
not the pooler — better for one-off ad-hoc queries).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import asyncpg

REPO_ROOT = Path(__file__).resolve().parents[2] if len(Path(__file__).resolve().parents) >= 3 else Path(".").resolve()
DEFAULT_ENV_PATH = REPO_ROOT / "backend" / ".env"

FORBIDDEN_TOKEN_PATTERN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|REINDEX|"
    r"VACUUM|CLUSTER|COPY|CALL|EXECUTE|DO|MERGE|LOCK|SET|RESET|COMMENT|SECURITY|"
    r"REFRESH|IMPORT|NOTIFY|LISTEN|UNLISTEN|DISCARD|PREPARE|DEALLOCATE)\b",
    re.IGNORECASE,
)

ALLOWED_LEADING = re.compile(r"^\s*(SELECT|WITH|EXPLAIN|SHOW|TABLE|VALUES)\b", re.IGNORECASE)


def _load_env(env_path: Path) -> dict[str, str]:
    if not env_path.exists():
        raise FileNotFoundError(f"Expected env file at {env_path}")
    env: dict[str, str] = {}
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def _assert_read_only(sql: str) -> None:
    stripped = sql.strip().rstrip(";")
    if ";" in stripped:
        raise ValueError("Only a single statement is allowed (semicolons forbidden).")
    if not ALLOWED_LEADING.match(stripped):
        raise ValueError(
            "Query must begin with SELECT/WITH/EXPLAIN/SHOW/TABLE/VALUES."
        )
    hit = FORBIDDEN_TOKEN_PATTERN.search(stripped)
    if hit:
        raise ValueError(f"Forbidden mutation keyword found: {hit.group(0)!r}")


def _json_default(value: object) -> object:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value).hex()
    raise TypeError(f"Cannot serialize {type(value).__name__}")


async def _run(sql: str, env_path: Path) -> list[dict]:
    # Prefer an explicit .env file when present (local dev);
    # fall back to OS env vars (useful inside Docker containers).
    env: dict[str, str] = {}
    if env_path.exists():
        env = _load_env(env_path)
    url = (
        env.get("DATABASE_URL_DIRECT")
        or env.get("DATABASE_URL")
        or os.environ.get("DATABASE_URL_DIRECT")
        or os.environ.get("DATABASE_URL")
    )
    if not url:
        raise RuntimeError(
            f"No DATABASE_URL_DIRECT/DATABASE_URL in {env_path} or os.environ"
        )
    url = url.replace("postgresql+asyncpg://", "postgresql://")

    conn = await asyncpg.connect(url)
    try:
        # Belt + suspenders: run inside a read-only transaction.
        await conn.execute("BEGIN READ ONLY")
        try:
            rows = await conn.fetch(sql)
        finally:
            await conn.execute("ROLLBACK")
    finally:
        await conn.close()

    return [dict(r) for r in rows]


def _read_sql(args: argparse.Namespace) -> str:
    if args.stdin:
        return sys.stdin.read()
    if args.file:
        return Path(args.file).read_text(encoding="utf-8")
    if args.sql:
        return args.sql
    raise SystemExit("Provide SQL as positional arg, --file PATH, or --stdin.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sql", nargs="?", help="Inline SELECT statement")
    parser.add_argument("--file", help="Path to a .sql file")
    parser.add_argument("--stdin", action="store_true", help="Read SQL from stdin")
    parser.add_argument(
        "--format",
        choices=("json", "lines"),
        default="json",
        help="json (default) prints a JSON array; lines prints one dict per line",
    )
    parser.add_argument(
        "--env-file",
        help=f"Path to .env file (default: {DEFAULT_ENV_PATH})",
    )
    args = parser.parse_args()

    sql = _read_sql(args)
    _assert_read_only(sql)

    env_path = Path(args.env_file) if args.env_file else DEFAULT_ENV_PATH
    rows = asyncio.run(_run(sql, env_path))

    if args.format == "lines":
        for row in rows:
            print(json.dumps(row, default=_json_default, ensure_ascii=False))
    else:
        print(json.dumps(rows, default=_json_default, ensure_ascii=False, indent=2))
    print(f"\n-- {len(rows)} row(s) --", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
