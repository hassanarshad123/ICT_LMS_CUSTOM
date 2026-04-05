import { NextRequest, NextResponse } from 'next/server';

// CSP is set here (not in next.config.js) so we can conditionally include
// 'unsafe-eval' in dev mode only. Nonce-based CSP requires Next.js 14+ for
// automatic nonce propagation — until then, 'unsafe-inline' is required for scripts.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  // 'unsafe-inline' required because Next.js 13 injects inline scripts without nonce support.
  // 'unsafe-eval' only in dev mode for Fast Refresh / HMR.
  // TODO: migrate to nonce-based CSP after upgrading to Next.js 14+
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  // Keep unsafe-inline for styles — Tailwind, Radix, chart.tsx dynamic CSS, branding system
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.bunny.net https://*.bunnycdn.com https://*.b-cdn.net https://*.mediadelivery.net https://*.amazonaws.com https://www.google-analytics.com https://www.googletagmanager.com",
  "media-src 'self' blob: https://*.bunny.net https://*.bunnycdn.com https://*.b-cdn.net https://*.mediadelivery.net",
  "frame-src 'self' https://*.bunny.net https://*.mediadelivery.net https://www.youtube.com https://player.vimeo.com https://*.zoom.us",
  // Restrict WebSocket to specific domains (was bare wss:/ws: before)
  "connect-src 'self' https://*.bunny.net https://*.bunnycdn.com https://*.b-cdn.net https://*.mediadelivery.net https://*.amazonaws.com wss://*.zensbot.site wss://*.zensbot.online ws://localhost:* https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com https://*.analytics.google.com",
  "frame-ancestors 'none'",
].join('; ');

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // All root paths → login (bare domain and subdomains)
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const response = NextResponse.rewrite(url);
    response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);
    return response;
  }

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
