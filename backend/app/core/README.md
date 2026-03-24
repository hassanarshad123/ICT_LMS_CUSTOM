# Core

Infrastructure services shared across the application.

- `redis.py` — Async Redis connection pool (fail-open design)
- `cache.py` — CacheService with get/set/delete/get_or_set_swr (stale-while-revalidate)
- `sentry.py` — Centralized Sentry init, PII scrubbing, release tagging
- `scheduler_lock.py` — Redis-based distributed lock for blue-green scheduler dedup
