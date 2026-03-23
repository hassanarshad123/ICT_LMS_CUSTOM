/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
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
