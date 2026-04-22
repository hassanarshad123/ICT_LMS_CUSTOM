'use client';

import { useState } from 'react';
import { Bell, Settings } from 'lucide-react';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  listSAAlerts, markSAAlertRead, markAllSAAlertsRead,
  getSAAlertPreferences, updateSAAlertPreference,
  type SAAlertItem, type SAAlertPreference,
} from '@/lib/api/super-admin';
import { toast } from 'sonner';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
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

export default function SANotificationsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  const { data, refetch } = useApi(
    () => listSAAlerts({ page, per_page: 20, alert_type: typeFilter || undefined, unread_only: unreadOnly }),
    [page, typeFilter, unreadOnly],
  );

  const { data: prefs, refetch: refetchPrefs } = useApi(
    () => getSAAlertPreferences(),
    [],
  );

  const { execute: doMarkRead } = useMutation((id: string) => markSAAlertRead(id));

  const handleMarkRead = async (id: string) => {
    try {
      await doMarkRead(id);
      refetch();
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllSAAlertsRead();
      toast.success('All marked as read');
      refetch();
    } catch {
      toast.error('Failed');
    }
  };

  const handleTogglePref = async (alertType: string, muted: boolean) => {
    try {
      await updateSAAlertPreference(alertType, muted);
      refetchPrefs();
      toast.success(muted ? 'Muted' : 'Unmuted');
    } catch {
      toast.error('Failed to update preference');
    }
  };

  const alerts = data?.data || [];
  const totalPages = data?.totalPages || 0;

  const alertTypes = [
    { value: '', label: 'All Types' },
    { value: 'quota_warning_80', label: 'Quota (80%)' },
    { value: 'quota_warning_90', label: 'Quota (90%)' },
    { value: 'invoice_overdue', label: 'Invoice Overdue' },
    { value: 'payment_received', label: 'Payment Received' },
    { value: 'job_failure', label: 'Job Failure' },
    { value: 'error_rate_spike', label: 'Error Spike' },
    { value: 'billing_escalation_15', label: 'Escalation (15d)' },
    { value: 'billing_escalation_30', label: 'Escalation (30d)' },
    { value: 'billing_escalation_60', label: 'Escalation (60d)' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Notifications</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{data?.total ?? 0} total alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className="px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            Mark All Read
          </button>
          <button
            onClick={() => setShowPrefs(!showPrefs)}
            className="p-2 rounded-lg hover:bg-zinc-100 transition-colors"
            title="Alert preferences"
          >
            <Settings size={18} className="text-zinc-500" />
          </button>
        </div>
      </div>

      {showPrefs && prefs && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Alert Preferences</h2>
          <p className="text-xs text-zinc-500 mb-4">Muted alerts won&apos;t appear in your notifications.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(prefs as SAAlertPreference[]).map((p) => (
              <div key={p.alertType} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-zinc-50">
                <div>
                  <div className="text-sm text-zinc-900">{p.label}</div>
                  <div className="text-xs text-zinc-500 capitalize">{p.category}</div>
                </div>
                <button
                  onClick={() => handleTogglePref(p.alertType, !p.muted)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${p.muted ? 'bg-zinc-300' : 'bg-[#C5D86D]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${p.muted ? 'left-0.5' : 'left-5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm"
        >
          {alertTypes.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
            className="rounded border-zinc-300"
          />
          Unread only
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {alerts.length === 0 ? (
          <div className="text-center py-12">
            <Bell size={40} className="mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-500">No notifications</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-zinc-50">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors ${!alert.read ? 'bg-blue-50/30' : ''}`}
                >
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!alert.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[alert.severity] || 'bg-zinc-100 text-zinc-700'}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-zinc-400">{alert.alertType.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-zinc-400 ml-auto">{timeAgo(alert.createdAt)}</span>
                    </div>
                    <p className="text-sm font-medium text-zinc-900">{alert.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{alert.message}</p>
                  </div>
                  {!alert.read && (
                    <button
                      onClick={() => handleMarkRead(alert.id)}
                      className="text-xs text-zinc-500 hover:text-zinc-900 whitespace-nowrap"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-zinc-100">
                <span className="text-xs text-zinc-500">Page {data?.page} of {totalPages}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Prev</button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
