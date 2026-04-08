const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Required in Next.js 13.x for the instrumentation.ts hook. Sentry uses
  // this to initialize the server/edge SDKs without legacy config files.
  experimental: {
    instrumentationHook: true,
  },
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:8000/api/v1';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

// Sentry webpack plugin options.
// - Source maps are generated + uploaded only if SENTRY_AUTH_TOKEN is present.
// - Otherwise the plugin is fully disabled, so local dev and CI without
//   Sentry credentials still build cleanly.
const hasSentryAuth = Boolean(process.env.SENTRY_AUTH_TOKEN);

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !hasSentryAuth, // stay quiet when not configured
  // Skip source map generation entirely when we're not uploading them.
  // Prevents leaking readable source to end users.
  sourcemaps: {
    disable: !hasSentryAuth,
    deleteSourcemapsAfterUpload: true,
  },
  // Suppress the "global error handler" warning — we will add
  // global-error.tsx in Phase 2 when we build the animation error boundary.
  disableLogger: true,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
