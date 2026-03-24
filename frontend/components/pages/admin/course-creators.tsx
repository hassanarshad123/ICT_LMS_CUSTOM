'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useMutation } from '@/hooks/use-api';
import { listUsers, createUser, changeUserStatus, deleteUser } from '@/lib/api/users';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Plus, X, Trash2, PenTool, Loader2, Eye, EyeOff } from 'lucide-react';
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

export default function AdminCourseCreators() {
  const { name } = useAuth();
  const basePath = useBasePath();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: creatorList, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listUsers({ ...params, role: 'course-creator' }),
    15,
  );

  const { execute: doCreate, loading: creating } = useMutation(createUser);
  const { execute: doToggleStatus } = useMutation(changeUserStatus);
  const { execute: doDelete } = useMutation(deleteUser);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    try {
      await doCreate({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: 'course-creator',
        password: formData.password,
      });
      toast.success('Course creator created successfully');
      setFormData({ name: '', email: '', phone: '', password: '' });
      setShowPassword(false);
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await doToggleStatus(userId, newStatus);
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await doDelete(deleteConfirmId);
      toast.success('Course creator deleted');
      setDeleteConfirmId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteConfirmId(null);
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Course Creators" subtitle="Manage course creator accounts" />

      <div className="flex justify-end mb-6">
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Course Creator'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-primary mb-4">New Course Creator</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Full name" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="creator@ict.edu.pk" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0300-1234567" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Min 4 characters" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 pr-10" required minLength={4} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <button type="submit" disabled={creating} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60">
                {creating && <Loader2 size={16} className="animate-spin" />}
                Add Course Creator
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && creatorList.length === 0 ? (
        <EmptyState icon={<PenTool size={28} className="text-gray-400" />} title="No course creators yet" description="Add your first course creator to get started." action={{ label: 'Add Course Creator', onClick: () => setShowForm(true) }} />
      ) : !loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {creatorList.map((creator) => (
            <div key={creator.id} className="bg-white rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-lg font-semibold text-primary">{creator.name?.charAt(0) || '?'}</div>
                  <div>
                    <h4 className="font-semibold text-primary">{creator.name}</h4>
                    <p className="text-xs text-gray-500">Course Creator</p>
                  </div>
                </div>
                <button onClick={() => setDeleteConfirmId(creator.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete course creator">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p>{creator.email}</p>
                <p>{creator.phone || '—'}</p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${creator.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {creator.status ? creator.status.charAt(0).toUpperCase() + creator.status.slice(1) : ''}
                </span>
                <button onClick={() => toggleStatus(creator.id, creator.status)} className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${creator.status === 'active' ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                  {creator.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
          <span className="text-sm text-gray-500">
            <span className="hidden sm:inline">Page {page} of {totalPages}</span>
            <span className="sm:hidden">{page}/{totalPages}</span>
          </span>
          <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course Creator</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this course creator? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
