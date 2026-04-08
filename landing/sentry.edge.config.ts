/**
 * Sentry edge runtime configuration for the landing app.
 *
 * This file runs in the Next.js edge runtime (middleware, edge route
 * handlers). If SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN is empty, Sentry
 * is a no-op (safe for local dev).
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === 'production',
    initialScope: {
      tags: { app: 'landing', runtime: 'edge' },
    },
    sendDefaultPii: false,
  });
}
