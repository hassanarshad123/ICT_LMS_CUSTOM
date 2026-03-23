export function getInstituteSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname; // "acme.zensbot.online"
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

  // Skip www prefix
  const startIndex = parts[0] === 'www' ? 1 : 0;

  // Bare domain (e.g., "zensbot.online") — 2 parts after skipping www
  if (parts.length - startIndex <= 2) return null;

  // Subdomain (e.g., "acme.zensbot.online") — 3+ parts
  return parts[startIndex];
}

export function isSuperAdminDomain(): boolean {
  return getInstituteSlug() === null;
}
