'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useApi, useMutation } from '@/hooks/use-api';
import { getUser, updateUser, changeUserStatus, resetPassword, deleteUser } from '@/lib/api/users';
import { listBatches } from '@/lib/api/batches';
import { listCourses } from '@/lib/api/courses';
import { listClasses } from '@/lib/api/zoom';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { UserRole } from '@/lib/types';
import { ArrowLeft, Edit3, Save, BookOpen, Video, Briefcase, Users, Calendar, Shield, Loader2, KeyRound, Trash2 } from 'lucide-react';
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

interface UserDetailViewProps {
  role: UserRole;
  userName: string;
  backHref: string;
}

export default function UserDetailView({ role, userName, backHref }: UserDetailViewProps) {
  const params = useParams();
  const userId = params.userId as string;
  const auth = useAuth();
  const router = useRouter();
  const displayName = auth.name || userName;

  const { data: userData, loading, error, refetch } = useApi(() => getUser(userId), [userId]);

  const [editData, setEditData] = useState<Record<string, any> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const { execute: doUpdate, loading: saving } = useMutation(updateUser);
  const { execute: doChangeStatus } = useMutation(changeUserStatus);
  const { execute: doResetPassword } = useMutation(resetPassword);
  const { execute: doDelete } = useMutation(deleteUser);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Initialize edit data when user data loads
  if (userData && !editData) {
    setEditData({ ...userData });
  }

  const user = isEditing ? editData : userData;

  if (loading) {
    return (
      <DashboardLayout role={role} userName={displayName}>
        <PageLoading variant="detail" />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout role={role} userName={displayName}>
        <PageError message={error} onRetry={refetch} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout role={role} userName={displayName}>
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">User not found</h3>
          <p className="text-sm text-gray-500 mb-4">The user you are looking for does not exist.</p>
          <Link href={backHref} className="text-sm font-medium text-[#1A1A1A] hover:underline">Back to Users</Link>
        </div>
      </DashboardLayout>
    );
  }

  const handleSave = async () => {
    if (!editData) return;
    try {
      await doUpdate(userId, {
        name: editData.name,
        email: editData.email,
        phone: editData.phone,
        specialization: editData.specialization,
      });
      toast.success('Profile updated');
      setIsEditing(false);
      setEditData(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleStatus = async () => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await doChangeStatus(userId, newStatus);
      toast.success(`User ${newStatus === 'active' ? 'reactivated' : 'deactivated'}`);
      setShowDeactivateDialog(false);
      setEditData(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResetPassword = async () => {
    try {
      const result = await doResetPassword(userId);
      toast.success(`Password reset. Temporary password: ${result.temporaryPassword}`, { duration: 10000 });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await doDelete(userId);
      toast.success('User deleted');
      setShowDeleteDialog(false);
      router.push(backHref);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const startEditing = () => {
    setEditData({ ...userData });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditData(null);
    setIsEditing(false);
  };

  return (
    <DashboardLayout role={role} userName={displayName}>
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1A1A] transition-colors mb-6">
        <ArrowLeft size={16} />
        Back to Users
      </Link>

      <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#C5D86D] flex items-center justify-center text-xl font-bold text-[#1A1A1A]">{user.name?.charAt(0) || '?'}</div>
            <div>
              <h1 className="text-xl font-bold text-[#1A1A1A]">{user.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleBadgeColors[user.role] || 'bg-gray-100 text-gray-600'}`}>{roleLabels[user.role] || user.role}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{user.status}</span>
              </div>
            </div>
          </div>
          <button onClick={isEditing ? cancelEditing : startEditing} className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors">
            <Edit3 size={16} />
            {isEditing ? 'Cancel Editing' : 'Edit Profile'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Profile Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input type="text" value={isEditing ? editData?.name || '' : user.name || ''} onChange={(e) => editData && setEditData({ ...editData, name: e.target.value })} disabled={!isEditing} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" value={isEditing ? editData?.email || '' : user.email || ''} onChange={(e) => editData && setEditData({ ...editData, email: e.target.value })} disabled={!isEditing} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input type="text" value={isEditing ? editData?.phone || '' : user.phone || ''} onChange={(e) => editData && setEditData({ ...editData, phone: e.target.value })} disabled={!isEditing} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 disabled:opacity-60" />
              </div>
              {(user.role === 'teacher' || user.role === 'course_creator') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Specialization</label>
                  <input type="text" value={isEditing ? editData?.specialization || '' : user.specialization || ''} onChange={(e) => editData && setEditData({ ...editData, specialization: e.target.value })} disabled={!isEditing} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 disabled:opacity-60" />
                </div>
              )}
            </div>
            {isEditing && (
              <div className="mt-4">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Changes
                </button>
              </div>
            )}
          </div>

          {/* Batch info for students */}
          {user.role === 'student' && user.batchNames && user.batchNames.length > 0 && (
            <div className="bg-white rounded-2xl p-6 card-shadow">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-[#1A1A1A]" />
                <h3 className="text-lg font-semibold text-[#1A1A1A]">Enrolled Batches</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {user.batchNames.map((name: string, i: number) => (
                  <span key={i} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-600">{name}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Quick Info</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Shield size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Role</p>
                  <p className="text-sm font-medium text-[#1A1A1A]">{roleLabels[user.role] || user.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="text-sm font-medium text-[#1A1A1A] capitalize">{user.status}</p>
                </div>
              </div>
              {user.createdAt && (
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Joined</p>
                    <p className="text-sm font-medium text-[#1A1A1A]">{new Date(user.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reset Password */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Password</h3>
            <button onClick={handleResetPassword} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-[#1A1A1A] hover:bg-gray-200 transition-colors">
              <KeyRound size={16} />
              Reset Password
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 card-shadow border border-red-100">
            <h3 className="text-sm font-semibold text-red-600 uppercase mb-3">Danger Zone</h3>
            <p className="text-xs text-gray-500 mb-4">
              {user.status === 'active' ? 'Deactivating this user will prevent them from logging in.' : 'Reactivating this user will restore their access.'}
            </p>
            <button onClick={() => setShowDeactivateDialog(true)} className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${user.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
              {user.status === 'active' ? 'Deactivate User' : 'Reactivate User'}
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 card-shadow border border-red-200">
            <h3 className="text-sm font-semibold text-red-600 uppercase mb-3">Delete User</h3>
            <p className="text-xs text-gray-500 mb-4">
              Permanently delete this user. This will cascade to their sessions, enrollments, and related data.
            </p>
            <button onClick={() => setShowDeleteDialog(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors">
              <Trash2 size={16} />
              Delete User
            </button>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{user.status === 'active' ? 'Deactivate User' : 'Reactivate User'}</AlertDialogTitle>
            <AlertDialogDescription>
              {user.status === 'active'
                ? `Are you sure you want to deactivate ${user.name}? They will no longer be able to log in.`
                : `Are you sure you want to reactivate ${user.name}? They will regain access to the platform.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={toggleStatus} className={user.status === 'active' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}>
              {user.status === 'active' ? 'Deactivate' : 'Reactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {user.name}? This will soft-delete their account and cascade to related data. This action cannot be easily reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
