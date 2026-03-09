'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from './types';
import { login as apiLogin, logout as apiLogout, getMe, AuthUser } from './api/auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);
  const [isLoading] = useState(false);
  const router = useRouter();

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await apiLogin(email, password);
    // API response is auto-converted to camelCase
    localStorage.setItem('access_token', res.accessToken);
    localStorage.setItem('refresh_token', res.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await apiLogout(refreshToken);
      } catch {}
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
    specialization: undefined as string | undefined,
    teacherId: u?.id,
    // New properties
    user: u,
    isLoading: ctx.isLoading,
    login: ctx.login,
    logout: ctx.logout,
  };
}
