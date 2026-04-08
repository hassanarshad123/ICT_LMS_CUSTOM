/**
 * Next.js instrumentation hook.
 *
 * Runs before the app starts on server + edge runtimes. We use it to
 * initialize Sentry so errors thrown during SSR, API routes, and middleware
 * are captured. The client-side init lives in sentry.client.config.ts.
 *
 * Sentry is a no-op unless SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN is set —
 * safe for local dev and for environments without Sentry credentials.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
