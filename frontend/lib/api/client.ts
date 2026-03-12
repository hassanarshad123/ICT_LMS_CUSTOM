import { snakeToCamel, camelToSnake } from '@/lib/utils/case-convert';
import { getInstituteSlug } from '@/lib/utils/subdomain';

const API_BASE = '/api/v1';

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

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Refresh 30s before actual expiry to avoid edge cases
    return payload.exp * 1000 < Date.now() + 30000;
  } catch {
    return true;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const refreshHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      const slug = getInstituteSlug();
      if (slug) refreshHeaders['X-Institute-Slug'] = slug;
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: refreshHeaders,
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      localStorage.setItem('access_token', data.access_token);
      return data.access_token;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
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

  // Add institute slug header for tenant routing
  const slug = getInstituteSlug();
  if (slug) headers['X-Institute-Slug'] = slug;

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

  // Proactively refresh expired tokens before making the request
  const isImpersonating = typeof window !== 'undefined' && localStorage.getItem('is_impersonating') === 'true';
  let token = getAccessToken();
  if (token && isTokenExpired(token)) {
    if (isImpersonating) {
      // Impersonation tokens cannot be refreshed — clear and close tab
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      localStorage.removeItem('is_impersonating');
      localStorage.removeItem('impersonator_id');
      window.close();
      setTimeout(() => { window.location.href = '/sa/institutes'; }, 300);
      throw new Error('Impersonation session expired');
    }
    const newToken = await refreshAccessToken();
    if (newToken) {
      token = newToken;
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let res: Response;
  try {
    res = await fetch(url, { ...rest, body: processedBody, headers, signal: controller.signal });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  }
  clearTimeout(timeoutId);

  // Try refresh on 401
  if (res.status === 401) {
    // Login endpoint returns 401 for bad credentials — don't redirect
    if (path === '/auth/login') {
      const error = await res.json().catch(() => ({ detail: 'Invalid email or password' }));
      throw new Error(error.detail || 'Invalid email or password');
    }
    if (isImpersonating) {
      // Impersonation tokens cannot be refreshed — clear and close tab
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      localStorage.removeItem('is_impersonating');
      localStorage.removeItem('impersonator_id');
      window.close();
      setTimeout(() => { window.location.href = '/sa/institutes'; }, 300);
      throw new Error('Impersonation session expired');
    }
    if (token) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 30000);
        try {
          res = await fetch(url, { ...rest, body: processedBody, headers, signal: retryController.signal });
        } catch (err: any) {
          clearTimeout(retryTimeout);
          if (err.name === 'AbortError') throw new Error('Request timed out');
          throw err;
        }
        clearTimeout(retryTimeout);
      } else {
        // Refresh failed — clear tokens and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    } else {
      // No token at all — redirect to login
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Not authenticated');
    }
  }

  if (res.status === 204) return undefined as T;

  // Handle 403 — access denied (don't logout, user may just lack permission for this endpoint)
  if (res.status === 403) {
    const error = await res.json().catch(() => ({ detail: 'Forbidden' }));
    throw new Error(error.detail || 'Forbidden');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  const json = await res.json();

  // Auto-convert response from snake_case to camelCase (unless skipped)
  if (skipConversion) return json;
  return snakeToCamel(json);
}
