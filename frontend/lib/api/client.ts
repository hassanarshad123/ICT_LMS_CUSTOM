import { snakeToCamel, camelToSnake } from '@/lib/utils/case-convert';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
  skipConversion?: boolean;
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    localStorage.setItem('access_token', data.access_token);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function apiClient<T = any>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, headers: customHeaders, skipConversion, ...rest } = options;

  // Build URL with query params (query params stay snake_case)
  let url = `${API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };

  // Convert request body from camelCase to snake_case (unless skipped or FormData)
  let processedBody = rest.body;
  if (processedBody && typeof processedBody === 'string' && !skipConversion && !(rest.body instanceof FormData)) {
    try {
      const parsed = JSON.parse(processedBody);
      processedBody = JSON.stringify(camelToSnake(parsed));
    } catch {
      // not JSON, leave as-is
    }
  }

  // Don't set Content-Type for FormData
  if (!(rest.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(url, { ...rest, body: processedBody, headers });

  // Try refresh on 401
  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...rest, body: processedBody, headers });
    } else {
      // Clear tokens and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/';
      throw new Error('Session expired');
    }
  }

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  const json = await res.json();

  // Auto-convert response from snake_case to camelCase (unless skipped)
  if (skipConversion) return json;
  return snakeToCamel(json);
}
