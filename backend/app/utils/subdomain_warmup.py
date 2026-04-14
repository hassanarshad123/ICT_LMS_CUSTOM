"""Subdomain warmup helper.

When a new tenant institute is created, the tenant-scoped verification
email link points to ``https://{slug}.{FRONTEND_BASE_DOMAIN}/verify-email``.
Vercel provisions its wildcard SSL certificate lazily on first request to
each new subdomain, so clicking the link within ~30-60s of signup can
fail with SSL / "site not available" errors.

This module fires a server-side HTTP GET to the new subdomain right after
the institute is committed, which triggers Vercel to provision the cert
before the user clicks the email link.

The warmup is fire-and-forget: it must never block the signup response
and must never raise exceptions back to the caller.
"""
from __future__ import annotations

import asyncio
import logging
import re
import ssl

import httpx

from app.config import get_settings


logger = logging.getLogger(__name__)

# Lowercase alphanumerics + hyphens, 3-30 chars, cannot start/end with hyphen.
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$")


async def warmup_subdomain(slug: str) -> None:
    """Fire a GET at ``https://{slug}.{FRONTEND_BASE_DOMAIN}/`` with retries.

    Never raises. Silently returns on any configuration problem, invalid
    slug, or unexpected failure.
    """
    try:
        settings = get_settings()

        if not settings.SUBDOMAIN_WARMUP_ENABLED:
            return

        base_domain = (settings.FRONTEND_BASE_DOMAIN or "").strip()
        if not base_domain or "localhost" in base_domain:
            # Dev / unconfigured — nothing to warm.
            return

        # SSRF guard: even though signup validates slug, re-check here so this
        # helper is safe to call from anywhere.
        if not isinstance(slug, str) or not _SLUG_RE.match(slug):
            logger.warning("subdomain_warmup: rejecting invalid slug=%r", slug)
            return

        url = f"https://{slug}.{base_domain}/"
        max_attempts = max(1, int(settings.SUBDOMAIN_WARMUP_MAX_ATTEMPTS))
        delay = float(settings.SUBDOMAIN_WARMUP_DELAY_SECONDS)

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            for attempt in range(1, max_attempts + 1):
                try:
                    resp = await client.get(url)
                    if resp.status_code < 500:
                        logger.info(
                            "subdomain_warmup: ok slug=%s status=%s attempt=%d",
                            slug,
                            resp.status_code,
                            attempt,
                        )
                        return
                    logger.debug(
                        "subdomain_warmup: 5xx slug=%s status=%s attempt=%d",
                        slug,
                        resp.status_code,
                        attempt,
                    )
                except (
                    httpx.ConnectError,
                    httpx.ReadError,
                    httpx.ConnectTimeout,
                    ssl.SSLError,
                ) as e:
                    logger.debug(
                        "subdomain_warmup: transient slug=%s attempt=%d err=%s",
                        slug,
                        attempt,
                        e,
                    )
                except Exception as e:  # noqa: BLE001 - fire-and-forget
                    logger.debug(
                        "subdomain_warmup: unexpected slug=%s attempt=%d err=%s",
                        slug,
                        attempt,
                        e,
                    )

                if attempt < max_attempts:
                    await asyncio.sleep(delay)

        logger.warning("subdomain_warmup: exhausted slug=%s attempts=%d", slug, max_attempts)
    except Exception as e:  # noqa: BLE001 - must never raise
        logger.warning("subdomain_warmup: swallowed top-level error slug=%r err=%s", slug, e)
