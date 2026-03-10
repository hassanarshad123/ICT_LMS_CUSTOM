import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './auth-context';
import { getUnreadCount } from '@/lib/api/notifications';

interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const POLL_INTERVAL = 60000; // 60 seconds

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await getUnreadCount();
      setUnreadCount(res.count);
    } catch {
      // Silently fail — don't break the app for badge count
    }
  }, [isAuthenticated]);

  const refreshUnreadCount = useCallback(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    // Fetch immediately
    fetchCount();

    // Poll every 60s
    intervalRef.current = setInterval(fetchCount, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, fetchCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
