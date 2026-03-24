import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ── Generate cryptographic nonce for CSP ──
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const isDev = process.env.NODE_ENV === 'development';

  // Build CSP directives — nonce-based script-src replaces unsafe-inline/unsafe-eval
  const cspDirectives = [
    "default-src 'self'",
    // 'strict-dynamic' trusts scripts loaded by nonce-authorized scripts (Next.js chunks)
    // 'unsafe-eval' only in dev mode for Fast Refresh / HMR
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Keep unsafe-inline for styles — Tailwind, Radix, chart.tsx dynamic CSS, branding system
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.bunny.net https://*.b-cdn.net https://*.amazonaws.com",
    "media-src 'self' blob: https://*.bunny.net https://*.b-cdn.net",
    "frame-src 'self' https://*.bunny.net https://www.youtube.com https://player.vimeo.com https://*.zoom.us",
    // Restrict WebSocket to specific domains instead of bare wss:/ws:
    "connect-src 'self' https://*.bunny.net https://*.b-cdn.net wss://*.zensbot.site wss://*.zensbot.online ws://localhost:*",
    "frame-ancestors 'none'",
  ].join('; ');

  // Pass nonce to Next.js via request header — Next.js uses this to add
  // nonce attributes to all its inline <script> and <link rel="preload"> tags
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  // All root paths → login (bare domain and subdomains)
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
    response.headers.set('Content-Security-Policy', cspDirectives);
    return response;
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', cspDirectives);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
