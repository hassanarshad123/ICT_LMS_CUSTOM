'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  getSAAlertCount, listSAAlerts, markSAAlertRead, markAllSAAlertsRead,
  type SAAlertItem,
} from '@/lib/api/super-admin';
import { toast } from 'sonner';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SANotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [alerts, setAlerts] = useState<SAAlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCount = () => {
      getSAAlertCount().then((r) => setCount(r.count)).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listSAAlerts({ per_page: 10, unread_only: false })
      .then((r) => setAlerts(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkRead = async (alertId: string) => {
    try {
      await markSAAlertRead(alertId);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, read: true } : a)));
      setCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllSAAlertsRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
      setCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleClickAlert = (alert: SAAlertItem) => {
    if (!alert.read) handleMarkRead(alert.id);
    if (alert.link) {
      router.push(alert.link);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-zinc-100 transition-colors"
      >
        <Bell size={20} className="text-zinc-600" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-900">Notifications</h3>
            {count > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-zinc-500 hover:text-zinc-900">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-zinc-900" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-400">No notifications</div>
            ) : (
              alerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => handleClickAlert(alert)}
                  className={`w-full text-left px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50 transition-colors ${!alert.read ? 'bg-zinc-50/80' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${!alert.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${SEVERITY_COLORS[alert.severity] || 'text-zinc-500'}`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs text-zinc-400">{timeAgo(alert.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-zinc-900 mt-0.5 truncate">{alert.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{alert.message}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-zinc-100 bg-zinc-50">
            <button
              onClick={() => { router.push('/sa/notifications'); setOpen(false); }}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
