/**
 * Sentry client-side configuration for the landing app.
 *
 * This file runs in the browser and captures client-side errors. If
 * NEXT_PUBLIC_SENTRY_DSN is empty, Sentry is a no-op (safe for local dev).
 *
 * Scope: landing app only (zensbot.site). The ICT tenant and other tenant
 * subdomains run on the separate `frontend/` app and are not affected.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Capture 10% of all transactions for performance monitoring.
    // Keep low — landing page gets heavy ad traffic and we care about
    // errors more than performance histograms.
    tracesSampleRate: 0.1,
    // Only send errors in production — local dev noise is not useful.
    enabled: process.env.NODE_ENV === 'production',
    // Tag all events so we can filter by app in the Sentry dashboard.
    initialScope: {
      tags: { app: 'landing' },
    },
    // Do NOT send PII automatically. We explicitly attach user data only
    // when needed (e.g., during signup error context).
    sendDefaultPii: false,
  });
}
