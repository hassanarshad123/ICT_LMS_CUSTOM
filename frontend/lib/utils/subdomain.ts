export function getInstituteSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname; // "acme.ict.zensbot.site"
  const parts = hostname.split('.');

  // localhost (dev without explicit slug) = no institute
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Support NEXT_PUBLIC_INSTITUTE_SLUG for local dev override
    return (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_INSTITUTE_SLUG) || null;
  }

  // "acme.localhost" pattern for local dev
  if (hostname.endsWith('.localhost') && parts.length === 2) {
    return parts[0];
  }

  // Bare domain (e.g., "ict.zensbot.site") — 3 parts, no subdomain
  if (parts.length <= 3) return null;

  // Subdomain (e.g., "acme.ict.zensbot.site") — 4+ parts
  return parts[0];
}

export function isSuperAdminDomain(): boolean {
  return getInstituteSlug() === null;
}
