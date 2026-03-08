'use client';

import { useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useMutation } from '@/hooks/use-api';
import { useApi } from '@/hooks/use-api';
import { listBatches, createBatch, deleteBatch } from '@/lib/api/batches';
import { listUsers } from '@/lib/api/users';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Plus, X, Layers, Loader2, Trash2 } from 'lucide-react';
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
  const { name } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '', teacherId: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: batchList, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listBatches({ ...params }),
    15,
  );

  const { data: teachersData } = useApi(
    () => listUsers({ role: 'teacher', per_page: 100 }),
  );
  const teachers = teachersData?.data || [];

  const { execute: doCreate, loading: creating } = useMutation(createBatch);
  const { execute: doDelete } = useMutation(deleteBatch);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <DashboardLayout role="admin" userName={name || 'Admin'}>
      <DashboardHeader greeting="Batches" subtitle="Manage all course batches" />

      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Batch'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Batch</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Batch 5 - March 2025" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Teacher</label>
              <select value={formData.teacherId} onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50">
                <option value="">Select teacher (optional)</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
              <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
              <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={creating} className="flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-60">
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
            <div className="overflow-x-auto">
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
                    <tr key={batch.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium text-[#1A1A1A]">{batch.name}</td>
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
                        <button onClick={() => setDeleteConfirmId(batch.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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
                Page {page} of {totalPages} ({total} batches)
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
              </div>
            </div>
          </div>
        </>
      )}
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
