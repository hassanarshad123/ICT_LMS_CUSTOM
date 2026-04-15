'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useBasePath } from '@/hooks/use-base-path';
import { useAuth } from '@/lib/auth-context';
import { useNotificationCount } from '@/hooks/use-websocket';
import { listNotifications, getUnreadCount, markAsRead, markAllRead, NotificationItem } from '@/lib/api/notifications';
import {
  Bell,
  Megaphone,
  MessageSquare,
  Video,
  Award,
  Users,
  CheckCheck,
  Loader2,
  Wallet,
  AlertTriangle,
  Plug,
  X,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  announcement: <Megaphone size={16} className="text-blue-500" />,
  class_scheduled: <Video size={16} className="text-purple-500" />,
  class_reminder: <Video size={16} className="text-orange-500" />,
  certificate_issued: <Award size={16} className="text-green-500" />,
  enrollment: <Users size={16} className="text-primary" />,
  new_feedback: <MessageSquare size={16} className="text-amber-500" />,
  feedback_response: <MessageSquare size={16} className="text-green-500" />,
  integration_sync_failure: <Plug size={16} className="text-red-500" />,
};

/** Fee reminder types carry an installment UUID suffix (``fee_due_soon_7d:<id>``).
 * Match by prefix so every suffix gets the right icon. */
function iconForType(raw: string): React.ReactNode {
  const exact = ICON_MAP[raw];
  if (exact) return exact;
  if (raw.startsWith('fee_due_soon')) return <Wallet size={16} className="text-amber-500" />;
  if (raw.startsWith('fee_overdue_alert')) return <AlertTriangle size={16} className="text-red-500" />;
  if (raw.startsWith('fee_overdue')) return <AlertTriangle size={16} className="text-red-500" />;
  return <Bell size={16} className="text-gray-400" />;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationDropdown() {
  const router = useRouter();
  const basePath = useBasePath();
  const { id: userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { count } = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently fail — not critical
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listNotifications({ page: 1, per_page: 20 });
      setNotifications(result.data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time notification count via WebSocket
  const handleWsCountChange = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);
  useNotificationCount(userId, handleWsCountChange);

  // Fallback: poll every 60s (in case WS disconnects). Initial fetch on mount.
  useEffect(() => {
    fetchUnreadCount();
    pollRef.current = setInterval(fetchUnreadCount, 60000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchUnreadCount]);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      try {
        await markAsRead(notif.id);
        setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
    if (notif.link) {
      router.push(`${basePath}${notif.link}`);
      setOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors relative"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-gray-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 sm:right-0 top-12 w-[calc(100vw-1.5rem)] sm:w-80 md:w-96 max-w-[400px] bg-white rounded-2xl card-shadow border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-primary">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors disabled:opacity-50"
                >
                  {markingAll ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={14} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                    !notif.read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {iconForType(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!notif.read ? 'font-semibold text-primary' : 'font-medium text-gray-700'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(notif.createdAt)}</p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
