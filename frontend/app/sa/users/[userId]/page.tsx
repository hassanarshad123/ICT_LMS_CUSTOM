'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Key, UserX, UserCheck, ExternalLink, Mail, Phone, Building2, Calendar, Clock } from 'lucide-react';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  getUserDetail, resetUserPassword, deactivateUser, activateUser, impersonateUser,
  getSAActivityLog, type SAUserItem, type ActivityLogItem,
} from '@/lib/api/super-admin';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function SAUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const { data: user, loading, refetch } = useApi<SAUserItem>(
    () => getUserDetail(userId), [userId]
  );

  const { data: activityData } = useApi<{ data: ActivityLogItem[] }>(
    () => getSAActivityLog({ user_id: userId, per_page: 10 }),
    [userId],
  );

  const { execute: doReset, loading: resetting } = useMutation(
    (uid: string, pw: string) => resetUserPassword(uid, pw),
  );

  const { execute: doDeactivate } = useMutation(
    (uid: string) => deactivateUser(uid),
  );

  const { execute: doActivate } = useMutation(
    (uid: string) => activateUser(uid),
  );

  const handleReset = async () => {
    if (!newPassword) return;
    try {
      await doReset(userId, newPassword);
      toast.success('Password reset successfully');
      setResetOpen(false);
      setNewPassword('');
    } catch {
      toast.error('Failed to reset password');
    }
  };

  const handleDeactivate = async () => {
    try {
      await doDeactivate(userId);
      toast.success('User deactivated');
      setDeactivateOpen(false);
      refetch();
    } catch {
      toast.error('Failed to deactivate');
    }
  };

  const handleActivate = async () => {
    try {
      await doActivate(userId);
      toast.success('User activated');
      refetch();
    } catch {
      toast.error('Failed to activate');
    }
  };

  const handleImpersonate = async () => {
    if (!user?.instituteSlug) return;
    try {
      const res = await impersonateUser(userId);
      const url = `https://${res.instituteSlug}.zensbot.online/impersonate-callback?hid=${encodeURIComponent(res.handoverId)}`;
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to impersonate');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl">User not found</div>
      </div>
    );
  }

  const activity = activityData?.data ?? [];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-zinc-100 rounded-lg">
          <ArrowLeft size={18} className="text-zinc-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-900">{user.name}</h1>
          <p className="text-zinc-500 text-sm">{user.email}</p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${
          user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {user.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profile Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-4">Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Mail size={16} className="text-zinc-400 mt-0.5" />
              <div>
                <div className="text-xs text-zinc-500">Email</div>
                <div className="text-sm text-zinc-900">{user.email}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone size={16} className="text-zinc-400 mt-0.5" />
              <div>
                <div className="text-xs text-zinc-500">Phone</div>
                <div className="text-sm text-zinc-900">{user.phone || '-'}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 size={16} className="text-zinc-400 mt-0.5" />
              <div>
                <div className="text-xs text-zinc-500">Institute</div>
                {user.instituteId ? (
                  <Link href={`/sa/institutes/${user.instituteId}`} className="text-sm text-blue-600 hover:underline">
                    {user.instituteName}
                  </Link>
                ) : (
                  <div className="text-sm text-zinc-400">-</div>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Key size={16} className="text-zinc-400 mt-0.5" />
              <div>
                <div className="text-xs text-zinc-500">Role</div>
                <div className="text-sm text-zinc-900 capitalize">{user.role?.replace('_', ' ')}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar size={16} className="text-zinc-400 mt-0.5" />
              <div>
                <div className="text-xs text-zinc-500">Joined</div>
                <div className="text-sm text-zinc-900">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock size={16} className="text-zinc-400 mt-0.5" />
              <div>
                <div className="text-xs text-zinc-500">Last Login</div>
                <div className="text-sm text-zinc-900">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Card */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-4">Actions</h2>
          <div className="space-y-2">
            <button
              onClick={() => setResetOpen(true)}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-lg border border-zinc-200"
            >
              <Key size={16} /> Reset Password
            </button>

            {user.status === 'active' ? (
              <button
                onClick={() => setDeactivateOpen(true)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
              >
                <UserX size={16} /> Deactivate User
              </button>
            ) : (
              <button
                onClick={handleActivate}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-green-600 hover:bg-green-50 rounded-lg border border-green-200"
              >
                <UserCheck size={16} /> Activate User
              </button>
            )}

            {user.instituteSlug && (
              <button
                onClick={handleImpersonate}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-lg border border-zinc-200"
              >
                <ExternalLink size={16} /> Impersonate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-white rounded-2xl border border-zinc-200">
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">Recent Activity</h2>
          <Link href={`/sa/activity?user_id=${userId}`} className="text-xs text-zinc-500 hover:text-zinc-900">
            View all
          </Link>
        </div>
        {activity.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-sm">No activity recorded</div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {activity.map((item, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-medium">
                    {item.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-zinc-500 ml-2">
                    {item.entityType ? `on ${item.entityType}` : ''}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 whitespace-nowrap">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Password Reset Dialog */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-zinc-900 mb-2">Reset Password</h3>
            <p className="text-xs text-zinc-500 mb-4">Set a new password for {user.name}</p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setResetOpen(false); setNewPassword(''); }}
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

      {/* Deactivate Confirm */}
      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate {user.name} ({user.email}), terminate all their sessions, and revoke tokens. This can be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-red-600 hover:bg-red-700">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
