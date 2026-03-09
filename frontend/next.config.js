/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:8000/api/v1';
    const wsUrl = process.env.WS_URL || 'http://localhost:8000';
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
