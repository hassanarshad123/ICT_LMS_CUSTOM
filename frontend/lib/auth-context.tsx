'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from './types';
import { login as apiLogin, logout as apiLogout, getMe, AuthUser } from './api/auth';
import { initErrorReporter } from './utils/error-reporter';
import { setAnalyticsUser, clearAnalyticsUser, trackLogin, trackLogout } from './analytics';
import { getInstituteSlug } from './utils/subdomain';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getInitialUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('user');
  const token = localStorage.getItem('access_token');
  if (stored && token) {
    try { return JSON.parse(stored); } catch { return null; }
  }
  return null;
}

function getInitialImpersonating(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('is_impersonating') === 'true';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);
  const [isLoading] = useState(false);
  const [isImpersonating] = useState(getInitialImpersonating);
  const router = useRouter();
  const errorReporterInit = useRef(false);

  useEffect(() => {
    if (!errorReporterInit.current) {
      initErrorReporter();
      errorReporterInit.current = true;
    }
    // Restore analytics user properties for returning sessions
    const initialUser = getInitialUser();
    if (initialUser) {
      setAnalyticsUser(initialUser.id, initialUser.role, getInstituteSlug());
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await apiLogin(email, password);
    // API response is auto-converted to camelCase
    localStorage.setItem('access_token', res.accessToken);
    localStorage.setItem('refresh_token', res.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.user));
    setUser(res.user);
    setAnalyticsUser(res.user.id, res.user.role, getInstituteSlug());
    trackLogin();
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    const impersonating = localStorage.getItem('is_impersonating') === 'true';

    if (impersonating) {
      // Impersonation logout: clear tokens, close tab
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('is_impersonating');
      localStorage.removeItem('impersonator_id');
      setUser(null);
      window.close();
      // Fallback if browser blocks window.close()
      setTimeout(() => { window.location.href = '/sa/institutes'; }, 300);
      return;
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await apiLogout(refreshToken);
      } catch (err) {
        console.warn('Backend logout failed (session may remain active server-side):', err);
      }
    }
    trackLogout();
    clearAnalyticsUser();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isImpersonating, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Fallback for components outside AuthProvider — return a mock-like object
    // This keeps existing pages working during the migration
    return {
      id: '',
      name: '',
      email: '',
      phone: '',
      role: 'student' as UserRole,
      user: null as AuthUser | null,
      isLoading: true,
      isImpersonating: false,
      login: async () => ({} as AuthUser),
      logout: async () => {},
    };
  }

  // Return user properties directly for backward compatibility
  const u = ctx.user;
  return {
    // Legacy properties (direct user fields)
    id: u?.id || '',
    name: u?.name || '',
    email: u?.email || '',
    phone: u?.phone || '',
    role: (u?.role?.replace('_', '-') || 'student') as UserRole,
    batchIds: u?.batchIds || [],
    batchNames: u?.batchNames || [],
    teacherId: u?.id,
    emailVerified: u?.emailVerified ?? true,
    // New properties
    user: u,
    isLoading: ctx.isLoading,
    isImpersonating: ctx.isImpersonating,
    login: ctx.login,
    logout: ctx.logout,
  };
}
