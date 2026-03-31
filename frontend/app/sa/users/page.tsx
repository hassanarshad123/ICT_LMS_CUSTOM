'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, MoreVertical, Key, UserX, UserCheck } from 'lucide-react';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  searchUsers, resetUserPassword, deactivateUser, impersonateUser,
  type SAUserItem,
} from '@/lib/api/super-admin';
import { toast } from 'sonner';

export default function SAUsersPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [resetModalId, setResetModalId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const { data, refetch } = useApi(
    () => debouncedQuery.length >= 2
      ? searchUsers(debouncedQuery, { page, per_page: 20 })
      : Promise.resolve({ data: [], total: 0, page: 1, perPage: 20, totalPages: 0 }),
    [debouncedQuery, page],
  );

  const { execute: doReset, loading: resetting } = useMutation(
    (userId: string, pw: string) => resetUserPassword(userId, pw),
  );

  const { execute: doDeactivate } = useMutation(
    (userId: string) => deactivateUser(userId),
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
      toast.success('User deactivated');
      setActionUserId(null);
      refetch();
    } catch {
      toast.error('Failed to deactivate');
    }
  };

  const handleImpersonate = async (user: SAUserItem) => {
    try {
      const res = await impersonateUser(user.id);
      const host = `${res.instituteSlug}.zensbot.online`;
      const url = `https://${host}/impersonate-callback?token=${res.token}`;
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to impersonate');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Global User Search</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Search users across all institutes</p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email or name..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C5D86D]/50 focus:border-[#C5D86D]"
        />
      </div>

      {/* Results */}
      {debouncedQuery.length >= 2 && (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-5 py-3 font-medium text-zinc-500">User</th>
                  <th className="px-5 py-3 font-medium text-zinc-500">Role</th>
                  <th className="px-5 py-3 font-medium text-zinc-500">Institute</th>
                  <th className="px-5 py-3 font-medium text-zinc-500">Status</th>
                  <th className="px-5 py-3 font-medium text-zinc-500">Joined</th>
                  <th className="px-5 py-3 font-medium text-zinc-500 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {(data?.data || []).map((user) => (
                  <tr key={user.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-5 py-3">
                      <div className="text-zinc-900 font-medium">{user.name}</div>
                      <div className="text-xs text-zinc-500">{user.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 capitalize">
                        {user.role?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-600">{user.instituteName || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500 whitespace-nowrap">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-5 py-3 relative">
                      <button
                        onClick={() => setActionUserId(actionUserId === user.id ? null : user.id)}
                        className="p-1 hover:bg-zinc-100 rounded-lg"
                      >
                        <MoreVertical size={16} className="text-zinc-400" />
                      </button>
                      {actionUserId === user.id && (
                        <div className="absolute right-5 top-10 z-10 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 w-44">
                          <button
                            onClick={() => { setResetModalId(user.id); setActionUserId(null); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50"
                          >
                            <Key size={14} /> Reset Password
                          </button>
                          {user.status === 'active' && (
                            <button
                              onClick={() => handleDeactivate(user.id)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                            >
                              <UserX size={14} /> Deactivate
                            </button>
                          )}
                          {user.instituteSlug && (
                            <button
                              onClick={() => { handleImpersonate(user); setActionUserId(null); }}
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
                {data && data.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-zinc-400">
                      No users found for &quot;{debouncedQuery}&quot;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-zinc-100">
              <span className="text-xs text-zinc-500">Page {data.page} of {data.totalPages} ({data.total} results)</span>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Prev</button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.totalPages} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {debouncedQuery.length > 0 && debouncedQuery.length < 2 && (
        <p className="text-sm text-zinc-400">Type at least 2 characters to search</p>
      )}

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
