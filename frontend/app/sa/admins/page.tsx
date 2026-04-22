'use client';

import { useState } from 'react';
import { Shield, MoreVertical, Key, UserX, UserCheck } from 'lucide-react';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  listAdmins, resetUserPassword, deactivateUser, activateUser, impersonateUser,
  type AdminListItem,
} from '@/lib/api/super-admin';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SAAdminsPage() {
  const [page, setPage] = useState(1);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [resetModalId, setResetModalId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const { data, refetch } = useApi(
    () => listAdmins({ page, per_page: 20 }),
    [page],
  );

  const { execute: doReset, loading: resetting } = useMutation(
    (userId: string, pw: string) => resetUserPassword(userId, pw),
  );

  const { execute: doDeactivate } = useMutation(
    (userId: string) => deactivateUser(userId),
  );

  const { execute: doActivate } = useMutation(
    (userId: string) => activateUser(userId),
  );

  const handleReset = async () => {
    if (!resetModalId || !newPassword) return;
    try {
      await doReset(resetModalId, newPassword);
      toast.success('Password reset successfully');
      setResetModalId(null);
      setNewPassword('');
    } catch {
      toast.error('Failed to reset password');
    }
  };

  const handleDeactivate = async (userId: string) => {
    try {
      await doDeactivate(userId);
      toast.success('Admin deactivated');
      setActionUserId(null);
      refetch();
    } catch {
      toast.error('Failed to deactivate');
    }
  };

  const handleActivate = async (userId: string) => {
    try {
      await doActivate(userId);
      toast.success('Admin activated');
      setActionUserId(null);
      refetch();
    } catch {
      toast.error('Failed to activate');
    }
  };

  const handleImpersonate = async (admin: AdminListItem) => {
    if (!admin.instituteId) return;
    try {
      const res = await impersonateUser(admin.id);
      const url = `https://${res.instituteSlug}.zensbot.online/impersonate-callback?hid=${encodeURIComponent(res.handoverId)}`;
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to impersonate');
    }
  };

  const admins = data?.data || [];
  const totalPages = data?.totalPages || 0;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Institute Admins</h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          {data?.total ?? 0} admins across all institutes
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {admins.length === 0 && !data ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900" />
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12">
            <Shield size={40} className="mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-500">No admins found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left">
                    <th className="px-5 py-3 font-medium text-zinc-500">Admin</th>
                    <th className="px-5 py-3 font-medium text-zinc-500">Institute</th>
                    <th className="px-5 py-3 font-medium text-zinc-500">Status</th>
                    <th className="px-5 py-3 font-medium text-zinc-500">Created</th>
                    <th className="px-5 py-3 font-medium text-zinc-500 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-5 py-3">
                        <div className="text-zinc-900 font-medium">{admin.name}</div>
                        <div className="text-xs text-zinc-500">{admin.email}</div>
                      </td>
                      <td className="px-5 py-3 text-zinc-600">
                        {admin.instituteName || '-'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          admin.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {admin.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500 whitespace-nowrap">
                        {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-5 py-3 relative">
                        <button
                          onClick={() => setActionUserId(actionUserId === admin.id ? null : admin.id)}
                          className="p-1 hover:bg-zinc-100 rounded-lg"
                        >
                          <MoreVertical size={16} className="text-zinc-400" />
                        </button>
                        {actionUserId === admin.id && (
                          <div className="absolute right-5 top-10 z-10 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 w-44">
                            <button
                              onClick={() => { setResetModalId(admin.id); setActionUserId(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                            >
                              <Key size={14} /> Reset Password
                            </button>
                            {admin.status === 'active' ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                                    <UserX size={14} /> Deactivate
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Deactivate Admin?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will deactivate {admin.name} ({admin.email}), terminate their sessions, and revoke tokens. The institute will lose its admin.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeactivate(admin.id)} className="bg-red-600 hover:bg-red-700">
                                      Deactivate
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <button
                                onClick={() => handleActivate(admin.id)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-green-600 hover:bg-green-50"
                              >
                                <UserCheck size={14} /> Activate
                              </button>
                            )}
                            {admin.instituteId && (
                              <button
                                onClick={() => { handleImpersonate(admin); setActionUserId(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                              >
                                <UserCheck size={14} /> Impersonate
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-zinc-100">
                <span className="text-xs text-zinc-500">Page {data?.page} of {totalPages} ({data?.total} admins)</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Prev</button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Password Reset Modal */}
      {resetModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-zinc-900 mb-4">Reset Password</h3>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setResetModalId(null); setNewPassword(''); }}
                className="px-4 py-2 text-xs rounded-lg border border-zinc-200 text-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={!newPassword || resetting}
                className="px-4 py-2 text-xs rounded-lg bg-[#1A1A1A] text-white disabled:opacity-40"
              >
                {resetting ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
