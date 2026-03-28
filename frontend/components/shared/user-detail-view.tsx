'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useApi, useMutation } from '@/hooks/use-api';
import { getUser, updateUser, changeUserStatus, resetPassword, deleteUser } from '@/lib/api/users';
import { listBatches, enrollStudent, removeStudent, toggleEnrollmentActive } from '@/lib/api/batches';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { ArrowLeft, Edit3, Save, BookOpen, Video, Briefcase, Users, Calendar, Shield, Loader2, KeyRound, Trash2, Eye, EyeOff } from 'lucide-react';
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
import { SearchableCombobox } from '@/components/ui/searchable-combobox';

interface UserDetailViewProps {
  backHref?: string;
}

export default function UserDetailView({ backHref: backHrefProp }: UserDetailViewProps) {
  const params = useParams();
  const userId = (params.id || params.userId) as string;
  const auth = useAuth();
  const router = useRouter();
  const backHref = backHrefProp || `/${auth.id}/users`;

  const { data: userData, loading, error, refetch } = useApi(() => getUser(userId), [userId]);

  const [editData, setEditData] = useState<Record<string, any> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const { execute: doUpdate, loading: saving } = useMutation(updateUser);
  const { execute: doChangeStatus } = useMutation(changeUserStatus);
  const { execute: doResetPassword } = useMutation(resetPassword);
  const { execute: doDelete } = useMutation(deleteUser);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [enrollBatchId, setEnrollBatchId] = useState('');
  const { data: batchesData } = useApi(() => listBatches({ per_page: 100 }));
  const allBatches = batchesData?.data || [];

  // Initialize edit data when user data loads
  if (userData && !editData) {
    setEditData({ ...userData });
  }

  const user = isEditing ? editData : userData;

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading variant="detail" />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <PageError message={error} onRetry={refetch} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">User not found</h3>
          <p className="text-sm text-gray-500 mb-4">The user you are looking for does not exist.</p>
          <Link href={backHref} className="text-sm font-medium text-primary hover:underline">Back to Users</Link>
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
    if (resetNewPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    setResettingPassword(true);
    try {
      await doResetPassword(userId, resetNewPassword);
      toast.success('Password reset successfully');
      setShowResetPasswordDialog(false);
      setResetNewPassword('');
      setShowResetPassword(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResettingPassword(false);
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
    <DashboardLayout>
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors mb-6">
        <ArrowLeft size={16} />
        Back to Users
      </Link>

      <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-xl font-bold text-primary">{user.name?.charAt(0) || '?'}</div>
            <div>
              <h1 className="text-xl font-bold text-primary">{user.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleBadgeColors[user.role] || 'bg-gray-100 text-gray-600'}`}>{roleLabels[user.role] || user.role}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{user.status}</span>
              </div>
            </div>
          </div>
          <button onClick={isEditing ? cancelEditing : startEditing} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors">
            <Edit3 size={16} />
            {isEditing ? 'Cancel Editing' : 'Edit Profile'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h3 className="text-lg font-semibold text-primary mb-4">Profile Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input type="text" value={isEditing ? editData?.name || '' : user.name || ''} onChange={(e) => editData && setEditData({ ...editData, name: e.target.value })} disabled={!isEditing} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" value={isEditing ? editData?.email || '' : user.email || ''} onChange={(e) => editData && setEditData({ ...editData, email: e.target.value })} disabled={!isEditing} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input type="text" value={isEditing ? editData?.phone || '' : user.phone || ''} onChange={(e) => editData && setEditData({ ...editData, phone: e.target.value })} disabled={!isEditing} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 disabled:opacity-60" />
              </div>
              {(user.role === 'teacher' || user.role === 'course_creator') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Specialization</label>
                  <input type="text" value={isEditing ? editData?.specialization || '' : user.specialization || ''} onChange={(e) => editData && setEditData({ ...editData, specialization: e.target.value })} disabled={!isEditing} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 disabled:opacity-60" />
                </div>
              )}
            </div>
            {isEditing && (
              <div className="mt-4">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Changes
                </button>
              </div>
            )}
          </div>

          {/* Batch management for students */}
          {user.role === 'student' && (
            <div className="bg-white rounded-2xl p-6 card-shadow">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-primary" />
                <h3 className="text-lg font-semibold text-primary">Enrolled Batches</h3>
              </div>
              {user.batchIds && user.batchIds.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {user.batchIds.map((bid: string, i: number) => {
                    const isActive = user.batchActiveStatuses?.[i] ?? true;
                    return (
                      <div key={bid} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">{user.batchNames?.[i] || bid}</span>
                          {!isActive && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700">Inactive</span>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await toggleEnrollmentActive(bid, userId, !isActive);
                              refetch();
                              toast.success(isActive ? 'Enrollment deactivated' : 'Enrollment activated');
                            } catch (err: any) { toast.error(err.message || 'Failed to update'); }
                          }}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                          title={isActive ? 'Deactivate enrollment' : 'Activate enrollment'}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-4">Not enrolled in any batch</p>
              )}
              <div className="flex gap-2">
                <SearchableCombobox
                  options={allBatches
                    .filter((b: any) => !user.batchIds?.includes(b.id))
                    .map((b: any) => ({ value: b.id, label: b.name }))}
                  value={enrollBatchId}
                  onChange={setEnrollBatchId}
                  placeholder="Select batch to enroll..."
                  searchPlaceholder="Search batches..."
                  emptyMessage="No batches available"
                  className="flex-1"
                />
                <button
                  onClick={async () => {
                    if (!enrollBatchId) return;
                    try {
                      await enrollStudent(enrollBatchId, userId);
                      setEnrollBatchId('');
                      refetch();
                      toast.success('Enrolled in batch');
                    } catch (err: any) { toast.error(err.message || 'Failed to enroll'); }
                  }}
                  disabled={!enrollBatchId}
                  className="px-4 py-2 bg-primary text-white text-sm rounded-xl hover:bg-primary/80 disabled:opacity-50"
                >
                  Enroll
                </button>
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
                  <p className="text-sm font-medium text-primary">{roleLabels[user.role] || user.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="text-sm font-medium text-primary capitalize">{user.status}</p>
                </div>
              </div>
              {user.createdAt && (
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Joined</p>
                    <p className="text-sm font-medium text-primary">{new Date(user.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reset Password */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Password</h3>
            <button onClick={() => { setResetNewPassword(''); setShowResetPassword(false); setShowResetPasswordDialog(true); }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-primary hover:bg-gray-200 transition-colors">
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

      <AlertDialog open={showResetPasswordDialog} onOpenChange={(open) => { if (!open) { setShowResetPasswordDialog(false); setResetNewPassword(''); setShowResetPassword(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new password for {user.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showResetPassword ? 'text' : 'password'}
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="Min 4 characters"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 pr-10"
                minLength={4}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPassword}
              disabled={resettingPassword || resetNewPassword.length < 4}
              className="bg-primary hover:bg-primary/80 text-white disabled:opacity-60"
            >
              {resettingPassword ? <Loader2 size={16} className="animate-spin mr-1" /> : null}
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
