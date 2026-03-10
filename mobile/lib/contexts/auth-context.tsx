import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, getMe } from '@/lib/api/auth';
import { setForceLogout } from '@/lib/api/client';
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  getStoredUser,
  setStoredUser,
  clearAll,
} from '@/lib/utils/storage';
import type { AuthUser } from '@/lib/types/auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Force logout callback for apiClient (module-level, can't use hooks)
  const handleForceLogout = useCallback(() => {
    setUser(null);
    clearAll();
  }, []);

  useEffect(() => {
    setForceLogout(handleForceLogout);
  }, [handleForceLogout]);

  // Check stored tokens on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          setIsLoading(false);
          return;
        }
        // Validate token with getMe
        const me = await getMe();
        setUser(me);
        await setStoredUser(me);
      } catch {
        // Token invalid — clear storage
        await clearAll();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await apiLogin(email, password);
    await setAccessToken(res.accessToken);
    await setRefreshToken(res.refreshToken);
    await setStoredUser(res.user);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      try {
        await apiLogout(refreshToken);
      } catch {
        // ignore — still clear local state
      }
    }
    await clearAll();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
      await setStoredUser(me);
    } catch {
      // ignore — keep current user
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
