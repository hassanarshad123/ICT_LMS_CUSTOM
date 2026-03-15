const API_BASE = '/api/v1';

export interface SignupData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  instituteName: string;
  instituteSlug: string;
  website?: string;
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

export async function checkSlug(slug: string): Promise<SlugCheckResponse> {
  const res = await fetch(`${API_BASE}/signup/check-slug?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to check slug' }));
    throw new Error(err.detail || 'Failed to check slug');
  }
  const data = await res.json();
  return data;
}

export async function signup(data: SignupData): Promise<SignupResponse> {
  const res = await fetch(`${API_BASE}/signup/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone || null,
      institute_name: data.instituteName,
      institute_slug: data.instituteSlug,
      website: data.website || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Signup failed' }));
    throw new Error(err.detail || 'Signup failed');
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
  const res = await fetch(`${API_BASE}/auth/handoff-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create handoff token' }));
    throw new Error(err.detail || 'Failed to create handoff token');
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
  const res = await fetch(`${API_BASE}/auth/exchange-handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Invalid or expired token' }));
    throw new Error(err.detail || 'Invalid or expired token');
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
