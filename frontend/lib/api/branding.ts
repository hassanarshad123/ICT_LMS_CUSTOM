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
  watermarkEnabled: boolean;
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
 * Accepts optional slug to send X-Institute-Slug header for tenant routing.
 */
export async function getBranding(slug?: string | null): Promise<BrandingData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const headers: Record<string, string> = {};
  if (slug) headers['X-Institute-Slug'] = slug;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/branding`, { signal: controller.signal, headers });
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
    watermarkEnabled: data.watermark_enabled !== false,
  };
}

export async function updateBranding(data: BrandingUpdate): Promise<BrandingData> {
  return apiClient<BrandingData>('/branding', {
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
  const { getInstituteSlug } = await import('@/lib/utils/subdomain');
  const slug = getInstituteSlug();
  const headers: Record<string, string> = {};
  if (slug) headers['X-Institute-Slug'] = slug;
  const res = await fetch(`${API_BASE}/branding/preset-themes`, { headers });
  if (!res.ok) throw new Error('Failed to fetch preset themes');
  return res.json();
}

// ── Certificate Design ────────────────────────────────────────────────

export interface CertificateDesign {
  primaryColor: string;
  accentColor: string;
  instituteName: string;
  websiteUrl: string;
  logoUrl: string | null;
  title: string;
  bodyLine1: string;
  bodyLine2: string;
  sig1Label: string;
  sig1Name: string;
  sig1Image: string | null;
  sig2Label: string;
  sig2Name: string;
  sig2Image: string | null;
  idPrefix: string;
  borderStyle: string;
}

export async function getCertificateDesign(): Promise<CertificateDesign> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let res: Response;
  try {
    const { getInstituteSlug } = await import('@/lib/utils/subdomain');
    const certSlug = getInstituteSlug();
    const certHeaders: Record<string, string> = {};
    if (certSlug) certHeaders['X-Institute-Slug'] = certSlug;
    res = await fetch(`${API_BASE}/branding/certificate-design`, { signal: controller.signal, headers: certHeaders });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error('Failed to fetch certificate design');
  const data = await res.json();
  return {
    primaryColor: data.primary_color ?? '#1A1A1A',
    accentColor: data.accent_color ?? '#C5D86D',
    instituteName: data.institute_name ?? 'ICT INSTITUTE',
    websiteUrl: data.website_url ?? 'https://ict.net.pk',
    logoUrl: data.logo_url ?? null,
    title: data.title ?? 'CERTIFICATE OF COMPLETION',
    bodyLine1: data.body_line1 ?? 'This is to certify that',
    bodyLine2: data.body_line2 ?? 'has successfully completed the course',
    sig1Label: data.sig1_label ?? 'Director',
    sig1Name: data.sig1_name ?? '',
    sig1Image: data.sig1_image ?? null,
    sig2Label: data.sig2_label ?? 'Course Instructor',
    sig2Name: data.sig2_name ?? '',
    sig2Image: data.sig2_image ?? null,
    idPrefix: data.id_prefix ?? 'ICT',
    borderStyle: data.border_style ?? 'classic',
  };
}

export async function updateCertificateDesign(data: Partial<CertificateDesign>): Promise<CertificateDesign> {
  return apiClient<CertificateDesign>('/branding/certificate-design', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function uploadSignature(file: File, position: 1 | 2): Promise<{ imageUrl: string; position: number }> {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient<{ imageUrl: string; position: number }>(`/branding/signature-upload?position=${position}`, {
    method: 'POST',
    body: formData,
  });
}
