import { API_BASE_URL } from '@/lib/constants/config';
import type { BrandingData } from '@/lib/types/branding';

/**
 * Public endpoint — fetches branding without auth.
 * Uses raw fetch (not apiClient) since this is called before auth is available.
 */
export async function getBranding(): Promise<BrandingData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/branding`, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error('Failed to fetch branding');
  const data = await res.json();
  // Manual snake_case → camelCase for this public endpoint
  return {
    primaryColor: data.primary_color ?? '#1A1A1A',
    accentColor: data.accent_color ?? '#C5D86D',
    backgroundColor: data.background_color ?? '#F0F0F0',
    instituteName: data.institute_name ?? 'ICT Institute',
    tagline: data.tagline ?? 'Learning Management System',
    logoUrl: data.logo_url ?? null,
    faviconUrl: data.favicon_url ?? null,
  };
}
