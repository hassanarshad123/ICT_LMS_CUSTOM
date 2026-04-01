'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useMutation } from '@/hooks/use-api';
import { listUsers, createUser, changeUserStatus, updateUser, UserOut } from '@/lib/api/users';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Plus, X, GraduationCap, Loader2, Eye, EyeOff, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatPhone } from '@/lib/utils/format-phone';

export default function AdminTeachers() {
  const { name } = useAuth();
  const basePath = useBasePath();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', specialization: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<UserOut | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', specialization: '' });
  const [editSaving, setEditSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: teacherList, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listUsers({ ...params, role: 'teacher', search: search || undefined, status: statusFilter || undefined }),
    15,
    [search, statusFilter],
  );

  const { execute: doCreate, loading: creating } = useMutation(createUser);
  const { execute: doToggleStatus } = useMutation(changeUserStatus);
  const { execute: doUpdate } = useMutation(updateUser);

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
        role: 'teacher',
        specialization: formData.specialization,
        password: formData.password,
      });
      toast.success('Teacher created successfully');
      setFormData({ name: '', email: '', phone: '', specialization: '', password: '' });
      setShowPassword(false);
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await doToggleStatus(userId, newStatus);
      toast.success(`Teacher ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEdit = async () => {
    if (!editingTeacher || !editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setEditSaving(true);
    try {
      await doUpdate(editingTeacher.id, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        specialization: editForm.specialization,
      });
      toast.success('Teacher updated');
      setEditingTeacher(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update teacher');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Teachers" subtitle="Manage all teachers" />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input type="text" placeholder="Search teachers..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white" />
        <div className="flex gap-2">
          {['', 'active', 'inactive'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Teacher'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-primary mb-4">New Teacher</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Teacher full name" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="teacher@ict.edu.pk" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0300-1234567" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Specialization</label>
              <input type="text" value={formData.specialization} onChange={(e) => setFormData({ ...formData, specialization: e.target.value })} placeholder="e.g. Web Development" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
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
            <div className="md:col-span-2">
              <button type="submit" disabled={creating} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60">
                {creating && <Loader2 size={16} className="animate-spin" />}
                Add Teacher
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && teacherList.length === 0 ? (
        <EmptyState icon={<GraduationCap size={28} className="text-gray-400" />} title="No teachers yet" description="Add your first teacher to get started." action={{ label: 'Add Teacher', onClick: () => setShowForm(true) }} />
      ) : !loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teacherList.map((teacher) => (
            <div key={teacher.id} className="bg-white rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-lg font-semibold text-primary">{teacher.name?.charAt(0) || '?'}</div>
                <div>
                  <h4 className="font-semibold text-primary">{teacher.name}</h4>
                  <p className="text-xs text-gray-500">{teacher.specialization || 'No specialization'}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p>{teacher.email}</p>
                <p>{teacher.phone ? formatPhone(teacher.phone) : '—'}</p>
              </div>
              {teacher.batchNames && teacher.batchNames.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Assigned Batches</p>
                  <div className="flex flex-wrap gap-2">
                    {teacher.batchNames.map((name, i) => (
                      <span key={i} className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">{name}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${teacher.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {teacher.status}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditForm({ name: teacher.name, email: teacher.email, phone: teacher.phone || '', specialization: teacher.specialization || '' }); setEditingTeacher(teacher); }} className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors text-blue-600 hover:bg-blue-50" aria-label={`Edit teacher ${teacher.name}`}>
                    <Pencil size={14} className="inline mr-1" />Edit
                  </button>
                  <button
                    onClick={() => handleToggleStatus(teacher.id, teacher.status)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      teacher.status === 'active' ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {teacher.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && teacherList.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
          <span className="text-sm text-gray-500">
            <span className="hidden sm:inline">Page {page} of {totalPages}</span>
            <span className="sm:hidden">{page}/{totalPages}</span>
          </span>
          <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
        </div>
      )}
      <Dialog open={!!editingTeacher} onOpenChange={(open) => { if (!open) { setEditingTeacher(null); setEditSaving(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div>
              <label htmlFor="edit-teacher-name" className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input id="edit-teacher-name" type="text" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Teacher name" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label htmlFor="edit-teacher-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input id="edit-teacher-email" type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="teacher@email.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label htmlFor="edit-teacher-phone" className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input id="edit-teacher-phone" type="text" value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="0300-1234567" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" />
            </div>
            <div>
              <label htmlFor="edit-teacher-spec" className="block text-sm font-medium text-gray-700 mb-1.5">Specialization</label>
              <input id="edit-teacher-spec" type="text" value={editForm.specialization} onChange={(e) => setEditForm(f => ({ ...f, specialization: e.target.value }))} placeholder="e.g. Web Development" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setEditingTeacher(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
            <button onClick={handleEdit} disabled={editSaving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60">
              {editSaving && <Loader2 size={16} className="animate-spin" />}
              Save Changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
