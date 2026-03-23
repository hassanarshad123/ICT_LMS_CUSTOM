/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.bunny.net' },
      { protocol: 'https', hostname: '**.b-cdn.net' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.bunny.net https://*.b-cdn.net https://*.amazonaws.com",
              "media-src 'self' blob: https://*.bunny.net https://*.b-cdn.net",
              "frame-src 'self' https://*.bunny.net https://www.youtube.com https://player.vimeo.com https://*.zoom.us",
              "connect-src 'self' https://*.bunny.net https://*.b-cdn.net wss: ws:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:8000/api/v1';
    const wsUrl = (process.env.WS_URL || 'http://localhost:8000').replace('wss://', 'https://').replace('ws://', 'http://');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/:path*`,
      },
      {
        source: '/ws/:path*',
        destination: `${wsUrl}/ws/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
