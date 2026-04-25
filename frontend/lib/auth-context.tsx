'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from './types';
import type { ViewType } from './types/rbac';
import { login as apiLogin, logout as apiLogout, getMe, AuthUser } from './api/auth';
import { getMyPermissions } from './api/rbac';
import { initErrorReporter } from './utils/error-reporter';
import { setAnalyticsUser, clearAnalyticsUser, trackLogin, trackLogout } from './analytics';
import { getInstituteSlug } from './utils/subdomain';
import { SYSTEM_ROLE_VIEW_TYPE } from './utils/view-type-resolver';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isImpersonating: boolean;
  permissions: string[];
  viewType: ViewType | null;
  customRoleId: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  refreshPermissions: () => Promise<void>;
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

function getInitialPermissions(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('user_permissions');
  if (stored) {
    try { return JSON.parse(stored); } catch { return []; }
  }
  return [];
}

function getInitialViewType(): ViewType | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('user_view_type');
  return (stored as ViewType) || null;
}

function getInitialCustomRoleId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('user_custom_role_id') || null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);
  const [isLoading] = useState(false);
  const [isImpersonating] = useState(getInitialImpersonating);
  const [permissions, setPermissions] = useState<string[]>(getInitialPermissions);
  const [viewType, setViewType] = useState<ViewType | null>(getInitialViewType);
  const [customRoleId, setCustomRoleId] = useState<string | null>(getInitialCustomRoleId);
  const router = useRouter();
  const errorReporterInit = useRef(false);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await getMyPermissions();
      setPermissions(res.permissions);
      setViewType(res.viewType);
      setCustomRoleId(res.customRoleId);
      localStorage.setItem('user_permissions', JSON.stringify(res.permissions));
      localStorage.setItem('user_view_type', res.viewType || '');
      localStorage.setItem('user_custom_role_id', res.customRoleId || '');
    } catch {
      // Backend may not have the endpoint yet — fall back gracefully
      const u = getInitialUser();
      if (u) {
        const vt = SYSTEM_ROLE_VIEW_TYPE[u.role?.replace('_', '-')] || null;
        setViewType(vt);
      }
    }
  }, []);

  useEffect(() => {
    if (!errorReporterInit.current) {
      initErrorReporter();
      errorReporterInit.current = true;
    }
    const initialUser = getInitialUser();
    if (initialUser) {
      setAnalyticsUser(initialUser.id, initialUser.role, getInstituteSlug());
      fetchPermissions();
    }
  }, [fetchPermissions]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await apiLogin(email, password);
    localStorage.setItem('access_token', res.accessToken);
    localStorage.setItem('refresh_token', res.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.user));
    setUser(res.user);
    setAnalyticsUser(res.user.id, res.user.role, getInstituteSlug());
    trackLogin();
    fetchPermissions();
    return res.user;
  }, [fetchPermissions]);

  const logout = useCallback(async () => {
    const impersonating = localStorage.getItem('is_impersonating') === 'true';

    if (impersonating) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('user_permissions');
      localStorage.removeItem('user_view_type');
      localStorage.removeItem('user_custom_role_id');
      localStorage.removeItem('is_impersonating');
      localStorage.removeItem('impersonator_id');
      setUser(null);
      setPermissions([]);
      setViewType(null);
      setCustomRoleId(null);
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
    localStorage.removeItem('user_permissions');
    localStorage.removeItem('user_view_type');
    localStorage.removeItem('user_custom_role_id');
    setUser(null);
    setPermissions([]);
    setViewType(null);
    setCustomRoleId(null);
    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) return null;
    try {
      const fresh = await getMe();
      localStorage.setItem('user', JSON.stringify(fresh));
      setUser(fresh);
      return fresh;
    } catch {
      // Silently ignore — a failed refresh shouldn't log the user out.
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoading, isImpersonating,
      permissions, viewType, customRoleId,
      login, logout, refreshUser, refreshPermissions: fetchPermissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
}


const _noopPermCheck = () => false;
const _noopVarPermCheck = (..._: string[]) => false;

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      id: '',
      name: '',
      email: '',
      phone: '',
      role: 'student' as UserRole,
      user: null as AuthUser | null,
      isLoading: true,
      isImpersonating: false,
      permissions: [] as string[],
      viewType: null as ViewType | null,
      customRoleId: null as string | null,
      hasPermission: _noopPermCheck,
      hasAnyPermission: _noopVarPermCheck,
      hasAllPermissions: _noopVarPermCheck,
      login: async () => ({} as AuthUser),
      logout: async () => {},
      refreshUser: async () => null as AuthUser | null,
      refreshPermissions: async () => {},
    };
  }

  const u = ctx.user;
  const perms = ctx.permissions;
  const permSet = new Set(perms);

  return {
    id: u?.id || '',
    name: u?.name || '',
    email: u?.email || '',
    phone: u?.phone || '',
    role: (u?.role?.replace('_', '-') || 'student') as UserRole,
    batchIds: u?.batchIds || [],
    batchNames: u?.batchNames || [],
    teacherId: u?.id,
    emailVerified: u?.emailVerified ?? true,
    user: u,
    isLoading: ctx.isLoading,
    isImpersonating: ctx.isImpersonating,
    permissions: perms,
    viewType: ctx.viewType,
    customRoleId: ctx.customRoleId,
    hasPermission: (perm: string) => permSet.has(perm) || permSet.has('*'),
    hasAnyPermission: (...ps: string[]) => ps.some(p => permSet.has(p) || permSet.has('*')),
    hasAllPermissions: (...ps: string[]) => permSet.has('*') || ps.every(p => permSet.has(p)),
    login: ctx.login,
    logout: ctx.logout,
    refreshUser: ctx.refreshUser,
    refreshPermissions: ctx.refreshPermissions,
  };
}
