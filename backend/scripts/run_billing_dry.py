"""Manual trigger for the pricing-v2 billing cron jobs.

Used during the dry-run verification phase (see docs/pricing-v2-dry-run-verification.md)
so the team doesn't have to wait for the 1st of the month to see what the
monthly cron would do.

Usage (from the backend/ directory):

    # Dry-run (default — set BILLING_CRON_DRY_RUN=true in env):
    python scripts/run_billing_dry.py monthly
    python scripts/run_billing_dry.py late

    # Run both back-to-back:
    python scripts/run_billing_dry.py all

Point the script at a staging or prod DB by setting ``DATABASE_URL`` in env
before running. The script respects ``BILLING_CRON_DRY_RUN`` — set it to
``false`` only on staging after a verified dry-run cycle.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings  # noqa: E402
from app.scheduler.billing_jobs import (  # noqa: E402
    enforce_late_payments,
    generate_monthly_invoices,
)


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


async def _run(job: str) -> None:
    settings = get_settings()
    print(
        f"\n[run_billing_dry] job={job} dry_run={settings.BILLING_CRON_DRY_RUN} "
        f"app_env={settings.APP_ENV}\n"
    )

    if job in ("monthly", "all"):
        print("=== generate_monthly_invoices ===")
        await generate_monthly_invoices()

    if job in ("late", "all"):
        print("\n=== enforce_late_payments ===")
        await enforce_late_payments()


def main() -> None:
    _configure_logging()
    parser = argparse.ArgumentParser(
        description="Manually trigger the v2 billing cron jobs.",
    )
    parser.add_argument(
        "job",
        choices=["monthly", "late", "all"],
        help="Which job to run.",
    )
    args = parser.parse_args()

    asyncio.run(_run(args.job))


if __name__ == "__main__":
    main()
