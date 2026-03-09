import { apiClient } from './client';

export interface BrandingData {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  instituteName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  presetTheme: string | null;
}

export interface BrandingUpdate {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  instituteName?: string;
  tagline?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  presetTheme?: string | null;
}

export interface PresetThemes {
  [key: string]: { primary: string; accent: string; background: string };
}

// Use relative path so requests go through Next.js rewrites (same as apiClient)
const API_BASE = '/api/v1';

/**
 * Public endpoint — fetches branding without auth.
 * Uses raw fetch (not apiClient) since this is called before auth is available.
 */
export async function getBranding(): Promise<BrandingData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/branding/`, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error('Failed to fetch branding');
  const data = await res.json();
  // Manual snake_case to camelCase conversion for this public endpoint
  return {
    primaryColor: data.primary_color ?? '#1A1A1A',
    accentColor: data.accent_color ?? '#C5D86D',
    backgroundColor: data.background_color ?? '#F0F0F0',
    instituteName: data.institute_name ?? 'ICT Institute',
    tagline: data.tagline ?? 'Learning Management System',
    logoUrl: data.logo_url ?? null,
    faviconUrl: data.favicon_url ?? null,
    presetTheme: data.preset_theme ?? null,
  };
}

export async function updateBranding(data: BrandingUpdate): Promise<BrandingData> {
  return apiClient<BrandingData>('/branding/', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function uploadLogo(file: File): Promise<{ logoUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient<{ logoUrl: string }>('/branding/logo-upload', {
    method: 'POST',
    body: formData,
  });
}

export async function getPresetThemes(): Promise<PresetThemes> {
  const res = await fetch(`${API_BASE}/branding/preset-themes`);
  if (!res.ok) throw new Error('Failed to fetch preset themes');
  return res.json();
}
