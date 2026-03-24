'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useMutation, useApi } from '@/hooks/use-api';
import { listUsers, createUser, deleteUser, updateUser, UserOut } from '@/lib/api/users';
import { listBatches } from '@/lib/api/batches';
import { enrollStudent } from '@/lib/api/batches';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Plus, X, Search, Trash2, GraduationCap, BookOpen, PenTool, Loader2, Eye, EyeOff, Pencil } from 'lucide-react';

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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { roleBadgeColors, roleLabels } from '@/lib/constants';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';

interface UsersListViewProps {
  basePath?: string;
}

export default function UsersListView({ basePath: basePathProp }: UsersListViewProps) {
  const router = useRouter();
  const auth = useAuth();
  const { id: userId } = auth;
  const basePath = basePathProp || `/${userId}/users`;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<'student' | 'teacher' | 'course-creator' | ''>('');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', batchId: '', specialization: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserOut | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', specialization: '' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: userList, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listUsers({
      ...params,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: debouncedSearch || undefined,
      batch_id: batchFilter !== 'all' ? batchFilter : undefined,
    }),
    15,
    [debouncedSearch, roleFilter, statusFilter, batchFilter],
  );

  const { data: batchesData } = useApi(() => listBatches({ per_page: 100 }));
  const batches = batchesData?.data || [];

  const { execute: doCreate, loading: creating } = useMutation(createUser);
  const { execute: doDeleteUser } = useMutation(deleteUser);
  const { execute: doEnroll } = useMutation(enrollStudent);
  const { execute: doUpdate } = useMutation(updateUser);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    if (selectedRole !== 'student' && formData.password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    try {
      const result = await doCreate({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: selectedRole,
        ...(selectedRole === 'teacher' ? { specialization: formData.specialization } : {}),
        ...(selectedRole !== 'student' ? { password: formData.password } : {}),
      });
      if (selectedRole === 'student' && formData.batchId && result.id) {
        try { await doEnroll(formData.batchId, result.id); } catch {}
      }
      if (selectedRole === 'student') {
        toast.success('Student created with default password');
      } else {
        toast.success(`${roleLabels[selectedRole]} created successfully`);
      }
      setFormData({ name: '', email: '', phone: '', batchId: '', specialization: '', password: '' });
      setShowPassword(false);
      setSelectedRole('');
      setFormStep(1);
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSoftDelete = async (userId: string) => {
    try {
      await doDeleteUser(userId);
      toast.success('User deleted');
      setDeleteConfirmId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteConfirmId(null);
    }
  };

  const handleEdit = async () => {
    if (!editingUser || !editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setEditSaving(true);
    try {
      await doUpdate(editingUser.id, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        ...(editingUser.role === 'teacher' || editingUser.role === 'course-creator'
          ? { specialization: editForm.specialization }
          : {}),
      });
      toast.success('User updated');
      setEditingUser(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user');
    } finally {
      setEditSaving(false);
    }
  };

  const roleOptions = [
    { value: 'all', label: 'All' },
    { value: 'student', label: 'Student' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'course-creator', label: 'Course Creator' },
  ];

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Users" subtitle="Manage all users across the platform" />

      <div className="space-y-3 mb-6">
        {/* Row 1: Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white" />
        </div>

        {/* Row 2: Filters + Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Role pill tabs */}
            <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-0.5">
              {roleOptions.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRoleFilter(r.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    roleFilter === r.value
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Status dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-primary min-w-[130px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Batch dropdown — always visible */}
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              disabled={roleFilter !== 'all' && roleFilter !== 'student'}
              className={`px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-primary min-w-[130px] ${
                roleFilter !== 'all' && roleFilter !== 'student' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <option value="all">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <button onClick={() => { setShowForm(!showForm); setFormStep(1); setSelectedRole(''); }} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors">
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'Add User'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          {formStep === 1 ? (
            <>
              <h3 className="text-lg font-semibold text-primary mb-4">Select Role</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { role: 'student' as const, icon: <GraduationCap size={24} />, label: 'Student', desc: 'Enroll in batches and courses' },
                  { role: 'teacher' as const, icon: <BookOpen size={24} />, label: 'Teacher', desc: 'Teach batches and schedule classes' },
                  { role: 'course-creator' as const, icon: <PenTool size={24} />, label: 'Course Creator', desc: 'Create courses and manage content' },
                ].map((opt) => (
                  <button key={opt.role} onClick={() => { setSelectedRole(opt.role); setFormStep(2); }} className="p-6 rounded-xl border-2 border-gray-200 hover:border-primary transition-colors text-left group">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-accent group-hover:bg-opacity-30 transition-colors">{opt.icon}</div>
                    <h4 className="font-semibold text-sm text-primary mb-1">{opt.label}</h4>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setFormStep(1)} className="text-sm text-gray-500 hover:text-primary">&larr; Back</button>
                <h3 className="text-lg font-semibold text-primary">New {roleLabels[selectedRole]}</h3>
              </div>
              <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Full name" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="user@email.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0300-1234567" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
                </div>
                {selectedRole === 'student' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to Batch</label>
                    <SearchableCombobox
                      options={batches.map((b) => ({ value: b.id, label: b.name }))}
                      value={formData.batchId}
                      onChange={(v) => setFormData({ ...formData, batchId: v })}
                      placeholder="Select batch (optional)"
                      searchPlaceholder="Search batches..."
                      emptyMessage="No batches found"
                    />
                  </div>
                )}
                {selectedRole === 'teacher' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Specialization</label>
                    <input type="text" value={formData.specialization} onChange={(e) => setFormData({ ...formData, specialization: e.target.value })} placeholder="e.g. Web Development" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
                  </div>
                )}
                {selectedRole !== 'student' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Min 4 characters" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 pr-10" required minLength={4} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <button type="submit" disabled={creating} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60">
                    {creating && <Loader2 size={16} className="animate-spin" />}
                    Add {roleLabels[selectedRole]}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {loading && <PageLoading variant="table" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          {/* Mobile card view */}
          <div className="md:hidden space-y-3 p-4">
            {userList.map((user) => (
              <div
                key={user.id}
                onClick={() => router.push(`${basePath}/${user.id}`)}
                className="bg-white rounded-xl p-4 border border-gray-100 cursor-pointer active:bg-gray-50"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-primary">{user.name?.charAt(0) || '?'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-primary truncate">{user.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${roleBadgeColors[user.role] || 'bg-gray-100 text-gray-600'}`}>
                        {roleLabels[user.role] || user.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setEditForm({ name: user.name, email: user.email, phone: user.phone || '', specialization: user.specialization || '' }); setEditingUser(user); }} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" aria-label={`Edit user ${user.name}`}>
                    <Pencil size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(user.id); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label={`Delete user ${user.name}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {user.status}
                  </span>
                </div>
              </div>
            ))}
            {userList.length === 0 && (
              <p className="px-2 py-12 text-center text-sm text-gray-500">No users found matching your filters.</p>
            )}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {userList.map((user) => (
                  <tr key={user.id} onClick={() => router.push(`${basePath}/${user.id}`)} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-primary">{user.name?.charAt(0) || '?'}</div>
                        <span className="text-sm font-medium text-primary">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{user.email}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleBadgeColors[user.role] || 'bg-gray-100 text-gray-600'}`}>
                        {roleLabels[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setEditForm({ name: user.name, email: user.email, phone: user.phone || '', specialization: user.specialization || '' }); setEditingUser(user); }} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" aria-label={`Edit user ${user.name}`}>
                          <Pencil size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(user.id); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label={`Delete user ${user.name}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {userList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">No users found matching your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-2 sm:mb-0">
              <span className="hidden sm:inline">Page {page} of {totalPages} ({total} users)</span>
              <span className="sm:hidden">{page}/{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
              <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) { setEditingUser(null); setEditSaving(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div>
              <label htmlFor="edit-user-name" className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input id="edit-user-name" type="text" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label htmlFor="edit-user-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input id="edit-user-email" type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="user@email.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label htmlFor="edit-user-phone" className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input id="edit-user-phone" type="text" value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="0300-1234567" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" />
            </div>
            {editingUser && (editingUser.role === 'teacher' || editingUser.role === 'course-creator') && (
              <div>
                <label htmlFor="edit-user-spec" className="block text-sm font-medium text-gray-700 mb-1.5">Specialization</label>
                <input id="edit-user-spec" type="text" value={editForm.specialization} onChange={(e) => setEditForm(f => ({ ...f, specialization: e.target.value }))} placeholder="e.g. Web Development" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" />
              </div>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
            <button onClick={handleEdit} disabled={editSaving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60">
              {editSaving && <Loader2 size={16} className="animate-spin" />}
              Save Changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this user? This will soft-delete their account and cascade to related data. This action cannot be easily reversed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleSoftDelete(deleteConfirmId)} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
