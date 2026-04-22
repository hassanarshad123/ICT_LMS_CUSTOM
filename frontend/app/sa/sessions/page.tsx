'use client';

import { useState, useEffect, useCallback } from 'react';
import { Monitor, Trash2 } from 'lucide-react';
import {
  listActiveSessions, terminateSession, terminateInstituteSessions,
  listInstitutes, type ActiveSessionItem, type InstituteOut,
} from '@/lib/api/super-admin';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function SASessionsPage() {
  const [sessions, setSessions] = useState<ActiveSessionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [instituteFilter, setInstituteFilter] = useState('');
  const [institutes, setInstitutes] = useState<InstituteOut[]>([]);
  const [terminateTarget, setTerminateTarget] = useState<{ id: string; name: string } | null>(null);
  const [bulkTerminateOpen, setBulkTerminateOpen] = useState(false);

  useEffect(() => {
    listInstitutes({ per_page: 100 })
      .then((res) => setInstitutes(res.data || []))
      .catch(() => {});
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listActiveSessions({
        page,
        per_page: 20,
        institute_id: instituteFilter || undefined,
      });
      setSessions(res.data || []);
      setTotal(res.total);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [page, instituteFilter]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleTerminate = async (sessionId: string, userName: string) => {
    try {
      await terminateSession(sessionId);
      toast.success(`Session for ${userName} terminated`);
      setTerminateTarget(null);
      fetchSessions();
    } catch (e: any) {
      toast.error(e.message || 'Failed to terminate session');
    }
  };

  const handleBulkTerminate = async () => {
    if (!instituteFilter) return;
    try {
      await terminateInstituteSessions(instituteFilter);
      const instName = institutes.find((i) => i.id === instituteFilter)?.name || 'Institute';
      toast.success(`All sessions for ${instName} terminated`);
      setBulkTerminateOpen(false);
      fetchSessions();
    } catch (e: any) {
      toast.error(e.message || 'Failed to terminate sessions');
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Active Sessions</h1>
        <p className="text-zinc-500 text-sm mt-0.5">{total} active session(s)</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={instituteFilter}
          onChange={(e) => { setInstituteFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm"
        >
          <option value="">All Institutes</option>
          {institutes.map((inst) => (
            <option key={inst.id} value={inst.id}>{inst.name}</option>
          ))}
        </select>

        {instituteFilter && (
          <button
            onClick={() => setBulkTerminateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
          >
            <Trash2 size={14} />
            Terminate All Sessions
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <Monitor size={40} className="mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-500">No active sessions</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left">
                    <th className="px-5 py-3 font-medium text-zinc-500">User</th>
                    <th className="px-5 py-3 font-medium text-zinc-500">Role</th>
                    <th className="px-5 py-3 font-medium text-zinc-500">Institute</th>
                    <th className="px-5 py-3 font-medium text-zinc-500">Device</th>
                    <th className="px-5 py-3 font-medium text-zinc-500">IP</th>
                    <th className="px-5 py-3 font-medium text-zinc-500">Logged In</th>
                    <th className="px-5 py-3 font-medium text-zinc-500">Last Active</th>
                    <th className="px-5 py-3 font-medium text-zinc-500 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-5 py-3">
                        <div className="text-zinc-900 font-medium">{s.userName}</div>
                        <div className="text-xs text-zinc-500">{s.userEmail}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 capitalize">
                          {s.userRole?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-zinc-600 text-xs">{s.instituteName || '-'}</td>
                      <td className="px-5 py-3 text-xs text-zinc-500 max-w-[200px] truncate">
                        {s.deviceInfo || '-'}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500 font-mono">{s.ipAddress || '-'}</td>
                      <td className="px-5 py-3 text-xs text-zinc-500 whitespace-nowrap">
                        {s.createdAt ? new Date(s.createdAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500 whitespace-nowrap">
                        {timeAgo(s.lastActiveAt)}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setTerminateTarget({ id: s.id, name: s.userName })}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Terminate session"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-zinc-100">
                <span className="text-xs text-zinc-500">Page {page} of {totalPages} ({total} sessions)</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Prev</button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Single Terminate Dialog */}
      <AlertDialog open={!!terminateTarget} onOpenChange={(open) => !open && setTerminateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately end the session for {terminateTarget?.name}. They will need to log in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => terminateTarget && handleTerminate(terminateTarget.id, terminateTarget.name)}
              className="bg-red-600 hover:bg-red-700"
            >
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Terminate Dialog */}
      <AlertDialog open={bulkTerminateOpen} onOpenChange={setBulkTerminateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate All Sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will terminate all active sessions for {institutes.find((i) => i.id === instituteFilter)?.name || 'this institute'}. All users will be logged out immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkTerminate} className="bg-red-600 hover:bg-red-700">
              Terminate All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
