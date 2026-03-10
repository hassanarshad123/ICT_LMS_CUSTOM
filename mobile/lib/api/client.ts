import { snakeToCamel, camelToSnake } from '@/lib/utils/case-convert';
import { getAccessToken, setAccessToken, getRefreshToken, clearAll } from '@/lib/utils/storage';
import { API_BASE_URL, REQUEST_TIMEOUT } from '@/lib/constants/config';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
  skipConversion?: boolean;
}

// ── Minimal base64 decoder for JWT payload ──────────────────────────

function decodeBase64(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  // Normalize URL-safe base64
  let input = str.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  for (let i = 0; i < input.length; i += 4) {
    const a = chars.indexOf(input[i]);
    const b = chars.indexOf(input[i + 1]);
    const c = chars.indexOf(input[i + 2]);
    const d = chars.indexOf(input[i + 3]);
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    output += String.fromCharCode((n >> 16) & 0xff);
    if (input[i + 2] !== '=') output += String.fromCharCode((n >> 8) & 0xff);
    if (input[i + 3] !== '=') output += String.fromCharCode(n & 0xff);
  }
  return output;
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(decodeBase64(token.split('.')[1]));
    return payload.exp * 1000 < Date.now() + 30000;
  } catch {
    return true;
  }
}

// ── Force logout callback (set by AuthProvider) ─────────────────────

let forceLogoutFn: (() => void) | null = null;

export function setForceLogout(fn: () => void) {
  forceLogoutFn = fn;
}

function forceLogout() {
  clearAll();
  if (forceLogoutFn) forceLogoutFn();
}

// ── Token refresh with deduplication ────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const newToken: string = data.access_token;
      await setAccessToken(newToken);
      return newToken;
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

// ── Main API client ─────────────────────────────────────────────────

export async function apiClient<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, headers: customHeaders, skipConversion, ...rest } = options;

  // Build URL with query params (stay snake_case)
  let url = `${API_BASE_URL}${path}`;
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

  // Convert request body camelCase → snake_case
  let processedBody = rest.body;
  if (processedBody && typeof processedBody === 'string' && !skipConversion) {
    try {
      const parsed = JSON.parse(processedBody);
      processedBody = JSON.stringify(camelToSnake(parsed));
    } catch {
      // not JSON, leave as-is
    }
  }

  headers['Content-Type'] = headers['Content-Type'] || 'application/json';

  // Proactively refresh expired token
  let token = await getAccessToken();
  if (token && isTokenExpired(token)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      token = newToken;
    } else {
      forceLogout();
      throw new Error('Session expired');
    }
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let res: Response;
  try {
    res = await fetch(url, { ...rest, body: processedBody, headers, signal: controller.signal });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  }
  clearTimeout(timeoutId);

  // 401 → try refresh once
  if (res.status === 401) {
    if (token) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), REQUEST_TIMEOUT);
        try {
          res = await fetch(url, { ...rest, body: processedBody, headers, signal: retryController.signal });
        } catch (err: any) {
          clearTimeout(retryTimeout);
          if (err.name === 'AbortError') throw new Error('Request timed out');
          throw err;
        }
        clearTimeout(retryTimeout);
      } else {
        forceLogout();
        throw new Error('Session expired');
      }
    } else {
      forceLogout();
      throw new Error('Not authenticated');
    }
  }

  if (res.status === 204) return undefined as T;

  if (res.status === 403) {
    const error = await res.json().catch(() => ({ detail: 'Forbidden' }));
    throw new Error(error.detail || 'Forbidden');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  const json = await res.json();
  if (skipConversion) return json;
  return snakeToCamel(json);
}
