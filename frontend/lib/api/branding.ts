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

export interface LogoUploadResponse {
  uploadUrl: string;
  objectKey: string;
}

export interface PresetThemes {
  [key: string]: { primary: string; accent: string; background: string };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

/**
 * Public endpoint — fetches branding without auth.
 * Uses raw fetch (not apiClient) since this is called before auth is available.
 */
export async function getBranding(): Promise<BrandingData> {
  const res = await fetch(`${API_BASE_URL}/branding/`);
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

export async function getLogoUploadUrl(fileExt: string): Promise<LogoUploadResponse> {
  return apiClient<LogoUploadResponse>(`/branding/logo-upload`, {
    method: 'POST',
    params: { file_ext: fileExt },
  });
}

export async function getPresetThemes(): Promise<PresetThemes> {
  const res = await fetch(`${API_BASE_URL}/branding/preset-themes`);
  if (!res.ok) throw new Error('Failed to fetch preset themes');
  return res.json();
}
