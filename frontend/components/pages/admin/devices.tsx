'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useMutation } from '@/hooks/use-api';
import {
  listDevices,
  terminateSession,
  terminateAllUserSessions,
  type UserDeviceSummary,
} from '@/lib/api/admin';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Search, Trash2, ChevronDown, ChevronRight, Monitor } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { roleBadgeColors, roleLabels } from '@/lib/constants';

const ALL_ROLE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'course-creator', label: 'Course Creator' },
];

// Course creators can only manage student + teacher device sessions.
const CC_ROLE_OPTIONS = ALL_ROLE_OPTIONS.filter(
  (opt) => opt.value !== 'course-creator',
);

export default function AdminDevicesPage() {
  const { name, role: currentRole } = useAuth();
  const basePath = useBasePath();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; sessionId: string | null } | null>(null);

  const isCourseCreator = currentRole === 'course-creator';
  const roleOptions = isCourseCreator ? CC_ROLE_OPTIONS : ALL_ROLE_OPTIONS;

  const {
    data: deviceList,
    total,
    page,
    totalPages,
    extra,
    loading,
    error,
    setPage,
    refetch,
  } = usePaginatedApi<UserDeviceSummary>(
    (params) => listDevices({
      ...params,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      search: search || undefined,
    }),
    15,
    [roleFilter, search],
  );

  const deviceLimit = (extra.deviceLimit as number | undefined) ?? 2;

  const { execute: doTerminate } = useMutation(terminateSession);
  const { execute: doTerminateAll } = useMutation(terminateAllUserSessions);

  const handleRemoveSession = async (userId: string, sessionId: string) => {
    try {
      await doTerminate(sessionId);
      toast.success('Session terminated');
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteTarget(null);
    }
  };

  const handleRemoveAll = async (userId: string) => {
    try {
      await doTerminateAll(userId);
      toast.success('All sessions terminated');
      setExpandedUserId(null);
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteTarget(null);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.sessionId) {
      handleRemoveSession(deleteTarget.userId, deleteTarget.sessionId);
    } else {
      handleRemoveAll(deleteTarget.userId);
    }
  };

  const toggleExpand = (userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  };

  const deleteDialogTitle = deleteTarget?.sessionId ? 'Remove Device' : 'Remove All Devices';
  const deleteDialogDesc = deleteTarget?.sessionId
    ? 'Are you sure you want to remove this device session? The user will be logged out from this device.'
    : 'Are you sure you want to remove all device sessions for this user? They will be logged out from every device.';

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Devices" subtitle="Manage user device sessions" />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white w-full sm:w-72" />
        </div>
        <div className="flex gap-1 bg-white rounded-xl p-1 card-shadow w-fit">
          {roleOptions.map((opt) => (
            <button key={opt.value} onClick={() => setRoleFilter(opt.value)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${roleFilter === opt.value ? 'bg-primary text-white' : 'text-gray-500 hover:text-primary'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <PageLoading variant="table" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && deviceList.length === 0 ? (
        <EmptyState icon={<Monitor size={28} className="text-gray-400" />} title="No device sessions" description="No active device sessions found." />
      ) : !loading && !error && (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          {/* Mobile card view */}
          <div className="md:hidden space-y-3 p-4">
            {deviceList.map((user: any) => {
              const sessions = user.activeSessions || [];
              const count = sessions.length;
              const isExpanded = expandedUserId === user.userId;
              const atLimit = count >= deviceLimit;

              return (
                <div key={user.userId} className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-primary">{user.userName?.charAt(0) || '?'}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-primary block truncate">{user.userName}</span>
                      <span className="text-xs text-gray-500 truncate block">{user.userEmail}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${roleBadgeColors[user.userRole] || 'bg-gray-100 text-gray-600'}`}>{roleLabels[user.userRole] || user.userRole}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className={`text-sm font-semibold ${atLimit ? 'text-red-600' : count === 0 ? 'text-gray-400' : 'text-primary'}`}>{count}/{deviceLimit} devices</span>
                    <div className="flex items-center gap-2">
                      {count > 0 && (
                        <button onClick={() => setDeleteTarget({ userId: user.userId, sessionId: null })} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">Remove All</button>
                      )}
                      {count > 0 && (
                        <button onClick={() => toggleExpand(user.userId)} className="p-1.5 text-gray-400 hover:text-primary rounded-lg transition-colors">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && sessions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {sessions.map((session: any) => (
                        <div key={session.id} className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <Monitor size={14} className="text-gray-400 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-primary truncate">{session.deviceInfo}</p>
                              <p className="text-xs text-gray-500">IP: {session.ipAddress}</p>
                              <p className="text-xs text-gray-500">Last active: {formatDateTime(session.lastActiveAt)}</p>
                            </div>
                          </div>
                          <button onClick={() => setDeleteTarget({ userId: user.userId, sessionId: session.id })} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Active Devices</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deviceList.map((user: any) => {
                  const sessions = user.activeSessions || [];
                  const count = sessions.length;
                  const isExpanded = expandedUserId === user.userId;
                  const atLimit = count >= deviceLimit;

                  return (
                    <tr key={user.userId} className="border-b border-gray-50">
                      <td colSpan={5} className="p-0">
                        <div onClick={() => count > 0 && toggleExpand(user.userId)} className={`flex items-center hover:bg-gray-50 transition-colors ${count > 0 ? 'cursor-pointer' : ''}`}>
                          <div className="flex items-center gap-3 px-3 sm:px-6 py-3 sm:py-4 w-[25%] min-w-[150px]">
                            {count > 0 ? (isExpanded ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />) : <span className="w-4 shrink-0" />}
                            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-primary">{user.userName?.charAt(0) || '?'}</div>
                            <span className="text-sm font-medium text-primary truncate">{user.userName}</span>
                          </div>
                          <div className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600 w-[25%] min-w-[150px] truncate">{user.userEmail}</div>
                          <div className="px-3 sm:px-6 py-3 sm:py-4 w-[18%] min-w-[120px]">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleBadgeColors[user.userRole] || 'bg-gray-100 text-gray-600'}`}>{roleLabels[user.userRole] || user.userRole}</span>
                          </div>
                          <div className="px-3 sm:px-6 py-3 sm:py-4 w-[16%] min-w-[100px]">
                            <span className={`text-sm font-semibold ${atLimit ? 'text-red-600' : count === 0 ? 'text-gray-400' : 'text-primary'}`}>{count}/{deviceLimit}</span>
                          </div>
                          <div className="px-3 sm:px-6 py-3 sm:py-4 w-[16%] min-w-[120px]">
                            {count > 0 && (
                              <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ userId: user.userId, sessionId: null }); }} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">Remove All</button>
                            )}
                          </div>
                        </div>
                        {isExpanded && sessions.length > 0 && (
                          <div className="bg-gray-50 border-t border-gray-100">
                            {sessions.map((session: any) => (
                              <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-6 sm:px-12 py-3 border-b border-gray-100 last:border-b-0 gap-2">
                                <div className="flex items-center gap-3">
                                  <Monitor size={16} className="text-gray-400 shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium text-primary">{session.deviceInfo}</p>
                                    <p className="text-xs text-gray-500">IP: {session.ipAddress} &middot; Logged in: {formatDateTime(session.loggedInAt)} &middot; Last active: {formatDateTime(session.lastActiveAt)}</p>
                                  </div>
                                </div>
                                <button onClick={() => setDeleteTarget({ userId: user.userId, sessionId: session.id })} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors self-end sm:self-auto">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                <span className="hidden sm:inline">Page {page} of {totalPages}</span>
                <span className="sm:hidden">{page}/{totalPages}</span>
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDialogDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
