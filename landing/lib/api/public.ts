import { fetchWithTimeout, extractErrorMessage } from './fetch-utils';

// Re-export so existing imports from '@/lib/api/public' keep working.
export { extractErrorMessage } from './fetch-utils';

const API_BASE = '/api/v1';

export interface SignupData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  instituteName: string;
  instituteSlug: string;
  website?: string;
  cfTurnstileToken?: string;
}

export interface SignupResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: string;
    instituteId: string;
  };
  institute: {
    id: string;
    name: string;
    slug: string;
    status: string;
    planTier: string;
    expiresAt: string | null;
  };
}

export interface SlugCheckResponse {
  slug: string;
  available: boolean;
  reason: string;
}

export async function checkSlug(slug: string, signal?: AbortSignal): Promise<SlugCheckResponse> {
  const res = await fetchWithTimeout(
    `${API_BASE}/signup/check-slug?slug=${encodeURIComponent(slug)}`,
    { timeoutMs: 15_000, signal },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to check slug' }));
    throw new Error(extractErrorMessage(err, 'Failed to check slug'));
  }
  const data = await res.json();
  return data;
}

export async function signup(data: SignupData): Promise<SignupResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/signup/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeoutMs: 30_000,
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone || null,
      institute_name: data.instituteName,
      institute_slug: data.instituteSlug,
      website: data.website || null,
      cf_turnstile_token: data.cfTurnstileToken || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Signup failed' }));
    throw new Error(extractErrorMessage(err, 'Signup failed'));
  }
  const raw = await res.json();
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    tokenType: raw.token_type,
    user: {
      id: raw.user.id,
      email: raw.user.email,
      name: raw.user.name,
      phone: raw.user.phone,
      role: raw.user.role,
      instituteId: raw.user.institute_id,
    },
    institute: {
      id: raw.institute.id,
      name: raw.institute.name,
      slug: raw.institute.slug,
      status: raw.institute.status,
      planTier: raw.institute.plan_tier,
      expiresAt: raw.institute.expires_at,
    },
  };
}

export async function createHandoffToken(accessToken: string): Promise<{ handoffToken: string; instituteSlug: string }> {
  const res = await fetchWithTimeout(`${API_BASE}/auth/handoff-token`, {
    method: 'POST',
    timeoutMs: 15_000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create handoff token' }));
    throw new Error(extractErrorMessage(err, 'Failed to create handoff token'));
  }
  const data = await res.json();
  return {
    handoffToken: data.handoff_token,
    instituteSlug: data.institute_slug,
  };
}

export async function exchangeHandoffToken(token: string): Promise<{
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: string;
    status: string;
    avatarUrl: string | null;
    batchIds: string[];
    batchNames: string[];
    instituteId: string | null;
    instituteSlug: string | null;
  };
}> {
  const res = await fetchWithTimeout(`${API_BASE}/auth/exchange-handoff`, {
    method: 'POST',
    timeoutMs: 15_000,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Invalid or expired token' }));
    throw new Error(extractErrorMessage(err, 'Invalid or expired token'));
  }
  const raw = await res.json();
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    user: {
      id: raw.user.id,
      email: raw.user.email,
      name: raw.user.name,
      phone: raw.user.phone || null,
      role: raw.user.role,
      status: raw.user.status || 'active',
      avatarUrl: raw.user.avatar_url || null,
      batchIds: raw.user.batch_ids || [],
      batchNames: raw.user.batch_names || [],
      instituteId: raw.user.institute_id || null,
      instituteSlug: raw.user.institute_slug || null,
    },
  };
}
