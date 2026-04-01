'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { pluralize } from '@/lib/utils/pluralize';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useMutation } from '@/hooks/use-api';
import { useApi } from '@/hooks/use-api';
import { listBatches, createBatch, deleteBatch, updateBatch, BatchOut } from '@/lib/api/batches';
import { listUsers } from '@/lib/api/users';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Plus, X, Layers, Loader2, Trash2, Pencil } from 'lucide-react';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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

export default function AdminBatches() {
  const router = useRouter();
  const { name } = useAuth();
  const basePath = useBasePath();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '', teacherId: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingBatch, setEditingBatch] = useState<BatchOut | null>(null);
  const [editForm, setEditForm] = useState({ name: '', startDate: '', endDate: '', teacherId: '' });
  const [editSaving, setEditSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: batchList, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listBatches({ ...params, search: search || undefined, status: statusFilter || undefined }),
    15,
    [search, statusFilter],
  );

  const { data: teachersData } = useApi(
    () => listUsers({ role: 'teacher', per_page: 100 }),
  );
  const teachers = teachersData?.data || [];

  const { execute: doCreate, loading: creating } = useMutation(createBatch);
  const { execute: doDelete } = useMutation(deleteBatch);
  const { execute: doUpdate } = useMutation(updateBatch);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
      toast.error('End date must be on or after start date');
      return;
    }
    try {
      await doCreate({
        name: formData.name,
        start_date: formData.startDate,
        end_date: formData.endDate,
        teacher_id: formData.teacherId || undefined,
      });
      toast.success('Batch created');
      setFormData({ name: '', startDate: '', endDate: '', teacherId: '' });
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (batchId: string) => {
    try {
      await doDelete(batchId);
      toast.success('Batch deleted');
      setDeleteConfirmId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteConfirmId(null);
    }
  };

  const handleEdit = async () => {
    if (!editingBatch || !editForm.name.trim()) {
      toast.error('Batch name is required');
      return;
    }
    setEditSaving(true);
    try {
      await doUpdate(editingBatch.id, {
        name: editForm.name,
        startDate: editForm.startDate || undefined,
        endDate: editForm.endDate || undefined,
        teacherId: editForm.teacherId || undefined,
      });
      toast.success('Batch updated');
      setEditingBatch(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update batch');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Batches" subtitle="Manage all course batches" />

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <input type="text" placeholder="Search batches..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-4 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['', 'active', 'upcoming', 'completed'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Batch'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-primary mb-4">New Batch</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Batch 5 - March 2025" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Teacher</label>
              <SearchableCombobox
                options={teachers.map((t) => ({ value: t.id, label: t.name }))}
                value={formData.teacherId}
                onChange={(v) => setFormData({ ...formData, teacherId: v })}
                placeholder="Select teacher (optional)"
                searchPlaceholder="Search teachers..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
              <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
              <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={creating} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60">
                {creating && <Loader2 size={16} className="animate-spin" />}
                Create Batch
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <PageLoading variant="table" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && batchList.length === 0 ? (
        <EmptyState icon={<Layers size={28} className="text-gray-400" />} title="No batches yet" description="Create your first batch to get started." action={{ label: 'Add Batch', onClick: () => setShowForm(true) }} />
      ) : !loading && !error && (
        <>
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            {/* Mobile card view */}
            <div className="md:hidden space-y-3 p-4">
              {batchList.map((batch) => (
                <div key={batch.id} onClick={() => router.push(`${basePath}/batches/${batch.id}`)} className="bg-white rounded-xl p-4 border border-gray-100 cursor-pointer active:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-primary">{batch.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        batch.status === 'active' ? 'bg-green-100 text-green-700' :
                        batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {batch.status}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); setEditForm({ name: batch.name, startDate: batch.startDate?.split('T')[0] || '', endDate: batch.endDate?.split('T')[0] || '', teacherId: batch.teacherId || '' }); setEditingBatch(batch); }} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" aria-label={`Edit batch ${batch.name}`}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(batch.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label={`Delete batch ${batch.name}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">
                    {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : '—'} to {batch.endDate ? new Date(batch.endDate).toLocaleDateString() : '—'}
                  </p>
                  <p className="text-xs text-gray-600">{batch.studentCount} {pluralize(batch.studentCount, 'student')}</p>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Batch Name</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Teacher</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Students</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Duration</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batchList.map((batch) => (
                    <tr key={batch.id} onClick={() => router.push(`${basePath}/batches/${batch.id}`)} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium text-primary">{batch.name}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{batch.teacherName || 'Unassigned'}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{batch.studentCount}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">
                        {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : '—'} to {batch.endDate ? new Date(batch.endDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          batch.status === 'active' ? 'bg-green-100 text-green-700' :
                          batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {batch.status}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <button onClick={(e) => { e.stopPropagation(); setEditForm({ name: batch.name, startDate: batch.startDate?.split('T')[0] || '', endDate: batch.endDate?.split('T')[0] || '', teacherId: batch.teacherId || '' }); setEditingBatch(batch); }} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" aria-label={`Edit batch ${batch.name}`}>
                          <Pencil size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(batch.id); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label={`Delete batch ${batch.name}`}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-2 sm:mb-0">
                <span className="hidden sm:inline">Page {page} of {totalPages} ({total} batches)</span>
                <span className="sm:hidden">{page}/{totalPages}</span>
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
              </div>
            </div>
          </div>
        </>
      )}
      <Dialog open={!!editingBatch} onOpenChange={(open) => { if (!open) { setEditingBatch(null); setEditSaving(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div>
              <label htmlFor="edit-batch-name" className="block text-sm font-medium text-gray-700 mb-1.5">Batch Name</label>
              <input id="edit-batch-name" type="text" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Batch name" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Teacher</label>
              <SearchableCombobox
                options={teachers.map((t) => ({ value: t.id, label: t.name }))}
                value={editForm.teacherId}
                onChange={(v) => setEditForm(f => ({ ...f, teacherId: v }))}
                placeholder="Select teacher (optional)"
                searchPlaceholder="Search teachers..."
              />
            </div>
            <div>
              <label htmlFor="edit-batch-start" className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
              <input id="edit-batch-start" type="date" value={editForm.startDate} onChange={(e) => setEditForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" />
            </div>
            <div>
              <label htmlFor="edit-batch-end" className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
              <input id="edit-batch-end" type="date" value={editForm.endDate} onChange={(e) => setEditForm(f => ({ ...f, endDate: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setEditingBatch(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
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
            <AlertDialogTitle>Delete Batch</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this batch? This will cascade to student enrollments, linked courses, lectures, materials, and zoom classes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
