'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useApi, useMutation } from '@/hooks/use-api';
import { listBatches, createBatch, deleteBatch, listBatchStudents } from '@/lib/api/batches';
import { listUsers } from '@/lib/api/users';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Plus, X, Users, ChevronDown, ChevronUp, Trash2, FolderOpen, Loader2, Layers } from 'lucide-react';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import Link from 'next/link';
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

export default function CourseCreatorBatches() {
  const { name } = useAuth();
  const basePath = useBasePath();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '', teacherId: '' });
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [batchStudents, setBatchStudents] = useState<Record<string, any[]>>({});
  const [loadingStudents, setLoadingStudents] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const { data: batchList, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listBatches({ ...params, search: search || undefined }),
    15,
    [search],
  );

  const { data: teachersData } = useApi(
    () => listUsers({ role: 'teacher', per_page: 100 }),
  );
  const teachers = teachersData?.data || [];

  const { execute: doCreate, loading: creating } = useMutation(createBatch);
  const { execute: doDelete } = useMutation(deleteBatch);

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

  const toggleExpand = async (batchId: string) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
      return;
    }
    setExpandedBatch(batchId);
    if (!batchStudents[batchId]) {
      setLoadingStudents(batchId);
      try {
        const students = await listBatchStudents(batchId);
        setBatchStudents((prev) => ({ ...prev, [batchId]: Array.isArray(students) ? students : [] }));
      } catch {
        setBatchStudents((prev) => ({ ...prev, [batchId]: [] }));
      } finally {
        setLoadingStudents(null);
      }
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Batches" subtitle="Create and manage student batches" />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input type="text" placeholder="Search batches..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white" />
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Create Batch'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-primary mb-4">New Batch</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Batch 5 - March 2025"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                required
              />
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
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60"
              >
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
        <EmptyState
          icon={<Layers size={28} className="text-gray-400" />}
          title="No batches yet"
          description="Create your first batch to get started."
          action={{ label: 'Create Batch', onClick: () => setShowForm(true) }}
        />
      ) : !loading && !error && (
        <>
          <div className="space-y-4">
            {batchList.map((batch) => {
              const isExpanded = expandedBatch === batch.id;
              const students = batchStudents[batch.id] || [];
              const isLoadingStudents = loadingStudents === batch.id;

              return (
                <div key={batch.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
                  <div className="flex items-center justify-between p-5">
                    <button
                      onClick={() => toggleExpand(batch.id)}
                      className="flex items-center gap-4 flex-1 text-left"
                    >
                      <div className="w-10 h-10 bg-accent bg-opacity-30 rounded-xl flex items-center justify-center">
                        <Users size={18} className="text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-primary">{batch.name}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            batch.status === 'active' ? 'bg-green-100 text-green-700' :
                            batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {batch.status}
                          </span>
                          <span className="text-xs text-gray-400">{batch.teacherName || 'Unassigned'}</span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Users size={12} />
                            {batch.studentCount} students
                          </span>
                          <span className="text-xs text-gray-400">
                            {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : '—'} — {batch.endDate ? new Date(batch.endDate).toLocaleDateString() : '—'}
                          </span>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </button>
                    <div className="flex items-center gap-2 ml-4">
                      <Link
                        href={`${basePath}/batches/${batch.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/80 transition-colors"
                      >
                        <FolderOpen size={14} />
                        Manage Content
                      </Link>
                      <button
                        onClick={() => setDeleteConfirmId(batch.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete batch"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4">
                      {isLoadingStudents ? (
                        <div className="flex items-center gap-2 py-4 justify-center">
                          <Loader2 size={16} className="animate-spin text-gray-400" />
                          <span className="text-sm text-gray-500">Loading students...</span>
                        </div>
                      ) : students.length > 0 ? (
                        <div className="space-y-2">
                          {students.map((student: any) => (
                            <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-primary">
                                  {student.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-primary">{student.name}</p>
                                  <p className="text-xs text-gray-400">{student.email}</p>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {student.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 py-2 text-center">No students in this batch yet.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 mt-4">
              <p className="text-sm text-gray-500 mb-2 sm:mb-0">
                Page {page} of {totalPages} ({total} batches)
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
              </div>
            </div>
          )}
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
