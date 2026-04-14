#!/usr/bin/env python3
"""Post-deploy smoke test for the Frappe/ERPNext integration surface.

Usage:
    python backend/scripts/smoke_integrations.py <base_url> <admin_jwt>

Exit codes:
    0 — all checks green
    1 — at least one check failed

Example:
    python backend/scripts/smoke_integrations.py \\
        https://apiict.zensbot.site eyJhbGciOiJIUzI1NiIs...

The admin JWT can be fetched via:
    curl -X POST https://apiict.zensbot.site/api/v1/auth/login \\
        -H 'Content-Type: application/json' \\
        -H 'X-Institute-Slug: ict' \\
        -d '{"email":"admin@ict.net.pk","password":"..."}'

This script performs READ-ONLY operations — it does NOT create, update, or
delete anything. Safe to run against production.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass

import httpx


@dataclass
class Check:
    name: str
    ok: bool
    detail: str


def run(base_url: str, admin_token: str) -> list[Check]:
    results: list[Check] = []
    api = f"{base_url.rstrip('/')}/api/v1"
    headers = {"Authorization": f"Bearer {admin_token}"}
    client = httpx.Client(timeout=15.0)

    # 1. Health endpoint
    try:
        r = client.get(f"{base_url.rstrip('/')}/api/health")
        results.append(Check(
            "Health endpoint (/api/health)",
            r.status_code == 200 and r.json().get("status") == "ok",
            f"HTTP {r.status_code}, database={r.json().get('database', '?')}",
        ))
    except Exception as e:
        results.append(Check("Health endpoint", False, f"Exception: {type(e).__name__}: {e}"))

    # 2. Frappe config GET (expect 200 with frappe_enabled=false by default)
    try:
        r = client.get(f"{api}/integrations/frappe", headers=headers)
        if r.status_code == 200:
            body = r.json()
            enabled = body.get("frappe_enabled", body.get("frappeEnabled", None))
            results.append(Check(
                "GET /integrations/frappe (admin)",
                True,
                f"HTTP 200, frappe_enabled={enabled}",
            ))
        else:
            results.append(Check(
                "GET /integrations/frappe (admin)",
                False,
                f"HTTP {r.status_code} — expected 200",
            ))
    except Exception as e:
        results.append(Check("GET /integrations/frappe", False, f"Exception: {type(e).__name__}: {e}"))

    # 3. Sync log list
    try:
        r = client.get(f"{api}/integrations/sync-log", headers=headers)
        results.append(Check(
            "GET /integrations/sync-log (admin)",
            r.status_code == 200,
            f"HTTP {r.status_code}",
        ))
    except Exception as e:
        results.append(Check("GET /integrations/sync-log", False, f"Exception: {type(e).__name__}: {e}"))

    # 4. Sync log KPIs
    try:
        r = client.get(f"{api}/integrations/sync-log/kpis", headers=headers)
        if r.status_code == 200:
            body = r.json()
            rate = body.get("success_rate_24h", body.get("successRate24h"))
            results.append(Check(
                "GET /integrations/sync-log/kpis (admin)",
                True,
                f"HTTP 200, success_rate_24h={rate}%",
            ))
        else:
            results.append(Check(
                "GET /integrations/sync-log/kpis (admin)",
                False,
                f"HTTP {r.status_code} — expected 200",
            ))
    except Exception as e:
        results.append(Check("GET /integrations/sync-log/kpis", False, f"Exception: {type(e).__name__}: {e}"))

    # 5. Bulk import templates (3 entities)
    for entity in ("students", "fee_plans", "payments"):
        try:
            r = client.get(
                f"{api}/admin/bulk-import/template/{entity}", headers=headers,
            )
            ok = r.status_code == 200 and "csv" in r.headers.get("content-type", "").lower()
            results.append(Check(
                f"GET /admin/bulk-import/template/{entity}",
                ok,
                f"HTTP {r.status_code}, content-type={r.headers.get('content-type', '?')}",
            ))
        except Exception as e:
            results.append(Check(
                f"GET /admin/bulk-import/template/{entity}",
                False,
                f"Exception: {type(e).__name__}: {e}",
            ))

    # 6. Bulk import jobs list
    try:
        r = client.get(f"{api}/admin/bulk-import/jobs", headers=headers)
        results.append(Check(
            "GET /admin/bulk-import/jobs (admin)",
            r.status_code == 200,
            f"HTTP {r.status_code}",
        ))
    except Exception as e:
        results.append(Check("GET /admin/bulk-import/jobs", False, f"Exception: {type(e).__name__}: {e}"))

    # 7. Verify inbound webhook endpoint exists (expect 400/401 — not 404)
    try:
        r = client.post(f"{api}/integrations/frappe/webhook", json={})
        ok = r.status_code in (400, 401)  # Endpoint reachable; rejects unauthenticated
        results.append(Check(
            "POST /integrations/frappe/webhook (unauthenticated)",
            ok,
            f"HTTP {r.status_code} — expected 400/401 (reachable + auth guard)",
        ))
    except Exception as e:
        results.append(Check(
            "POST /integrations/frappe/webhook",
            False,
            f"Exception: {type(e).__name__}: {e}",
        ))

    client.close()
    return results


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2

    base_url = sys.argv[1]
    admin_token = sys.argv[2]

    print(f"Smoke-testing integration surface at {base_url}\n")
    results = run(base_url, admin_token)

    passed = sum(1 for r in results if r.ok)
    failed = len(results) - passed

    for r in results:
        marker = "OK " if r.ok else "FAIL"
        print(f"  [{marker}] {r.name}")
        if not r.ok or "frappe_enabled" in r.detail or "success_rate" in r.detail:
            print(f"         {r.detail}")

    print()
    if failed == 0:
        print(f"All {passed}/{len(results)} checks PASSED — integration surface is alive.")
        return 0
    print(f"{failed}/{len(results)} checks FAILED — investigate before enabling pilot institute.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
