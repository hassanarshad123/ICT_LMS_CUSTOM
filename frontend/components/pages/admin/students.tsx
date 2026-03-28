'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useMutation, useApi } from '@/hooks/use-api';
import { listUsers, createUser, updateUser, UserOut } from '@/lib/api/users';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { listBatches } from '@/lib/api/batches';
import { enrollStudent } from '@/lib/api/batches';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Plus, X, Search, Users, Loader2, Upload, Pencil } from 'lucide-react';
import CsvImportPanel from '@/components/shared/csv-import-panel';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { formatPhone } from '@/lib/utils/format-phone';

export default function AdminStudents() {
  const { name } = useAuth();
  const basePath = useBasePath();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', batchId: '' });
  const [editingStudent, setEditingStudent] = useState<UserOut | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: studentList, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listUsers({ ...params, role: 'student', search: debouncedSearch || undefined }),
    15,
    [debouncedSearch],
  );

  const { data: batchesData } = useApi(() => listBatches({ per_page: 100 }));
  const batches = batchesData?.data || [];

  const { execute: doCreate, loading: creating } = useMutation(createUser);
  const { execute: doEnroll } = useMutation(enrollStudent);
  const { execute: doUpdate } = useMutation(updateUser);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await doCreate({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: 'student',
      });
      // Enroll in batch if selected
      if (formData.batchId && result.id) {
        try { await doEnroll(formData.batchId, result.id); } catch {}
      }
      toast.success('Student created with default password');
      setFormData({ name: '', email: '', phone: '', batchId: '' });
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEdit = async () => {
    if (!editingStudent || !editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setEditSaving(true);
    try {
      await doUpdate(editingStudent.id, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
      });
      toast.success('Student updated');
      setEditingStudent(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update student');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Students" subtitle="Manage all enrolled students" />

      <div className="space-y-3 mb-6">
        {/* Row 1: Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or phone..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white" />
        </div>

        {/* Row 2: Actions (right-aligned) */}
        <div className="flex justify-end gap-2">
          <button onClick={() => { setShowImport(!showImport); setShowForm(false); }} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Upload size={16} />
            Import CSV
          </button>
          <button onClick={() => { setShowForm(!showForm); setShowImport(false); }} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors">
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'Add Student'}
          </button>
        </div>
      </div>

      {showImport && (
        <CsvImportPanel
          onSuccess={() => { refetch(); }}
          onClose={() => setShowImport(false)}
          batches={batches.map(b => ({ id: b.id, name: b.name }))}
        />
      )}

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-primary mb-4">New Student</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Student full name" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="student@email.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0300-1234567" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
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
            <div className="sm:col-span-2">
              <button type="submit" disabled={creating} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60">
                {creating && <Loader2 size={16} className="animate-spin" />}
                Add Student
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <PageLoading variant="table" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && studentList.length === 0 ? (
        <EmptyState icon={<Users size={28} className="text-gray-400" />} title="No students found" description={search ? 'Try a different search term.' : 'Add your first student or import a CSV to get started.'} action={!search ? { label: 'Import Students (CSV)', onClick: () => { setShowImport(true); } } : undefined} />
      ) : !loading && !error && (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          {/* Mobile card view */}
          <div className="md:hidden space-y-3 p-4">
            {studentList.map((student) => (
              <div key={student.id} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-primary">{student.name?.charAt(0) || '?'}</div>
                  <span className="text-sm font-medium text-primary flex-1">{student.name}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {student.status}
                  </span>
                  <button onClick={() => { setEditForm({ name: student.name, email: student.email, phone: student.phone || '' }); setEditingStudent(student); }} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" aria-label={`Edit student ${student.name}`}>
                    <Pencil size={14} />
                  </button>
                </div>
                <div className="text-sm text-gray-600 space-y-1 ml-11">
                  <p>{student.email} {student.phone ? `\u00B7 ${formatPhone(student.phone)}` : ''}</p>
                  {student.batchNames && student.batchNames.length > 0 && (
                    <p className="text-xs text-gray-500">{student.batchNames.join(', ')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Batch</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentList.map((student) => (
                  <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-primary">{student.name?.charAt(0) || '?'}</div>
                        <span className="text-sm font-medium text-primary">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{student.email}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{formatPhone(student.phone || '')}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600 max-w-[200px] truncate" title={student.batchNames?.join(', ') || '—'}>{student.batchNames?.join(', ') || '—'}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <button onClick={(e) => { e.stopPropagation(); setEditForm({ name: student.name, email: student.email, phone: student.phone || '' }); setEditingStudent(student); }} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" aria-label={`Edit student ${student.name}`}>
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-2 sm:mb-0">
              <span className="hidden sm:inline">Page {page} of {totalPages} ({total} students)</span>
              <span className="sm:hidden">{page}/{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
              <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        </div>
      )}
      <Dialog open={!!editingStudent} onOpenChange={(open) => { if (!open) { setEditingStudent(null); setEditSaving(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div>
              <label htmlFor="edit-student-name" className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input id="edit-student-name" type="text" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Student name" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label htmlFor="edit-student-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input id="edit-student-email" type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="student@email.com" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-student-phone" className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input id="edit-student-phone" type="text" value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="0300-1234567" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setEditingStudent(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
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
