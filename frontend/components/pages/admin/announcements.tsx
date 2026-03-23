'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useApi, useMutation } from '@/hooks/use-api';
import { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/lib/api/announcements';
import { listBatches } from '@/lib/api/batches';
import { listCourses } from '@/lib/api/courses';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import {
  Plus,
  X,
  Megaphone,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Globe,
  Layers,
  BookOpen,
  Calendar,
  User,
} from 'lucide-react';
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
import { SearchableCombobox } from '@/components/ui/searchable-combobox';

const SCOPE_OPTIONS = [
  { value: 'institute', label: 'Institute-wide', icon: Globe, color: 'bg-blue-100 text-blue-700' },
  { value: 'batch', label: 'Batch', icon: Layers, color: 'bg-purple-100 text-purple-700' },
  { value: 'course', label: 'Course', icon: BookOpen, color: 'bg-green-100 text-green-700' },
];

const EMPTY_FORM = {
  title: '',
  content: '',
  scope: 'institute',
  batchId: '',
  courseId: '',
  expiresAt: '',
};

export default function AdminAnnouncements() {
  const { name } = useAuth();
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: announcements, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listAnnouncements({
      ...params,
      scope: scopeFilter !== 'all' ? scopeFilter : undefined,
    }),
    15,
    [scopeFilter],
  );

  const { data: batchesData } = useApi(() => listBatches({ per_page: 100 }));
  const { data: coursesData } = useApi(() => listCourses({ per_page: 100 }));

  const batches = batchesData?.data || [];
  const courses = coursesData?.data || [];

  const { execute: doCreate, loading: creating } = useMutation(createAnnouncement);
  const { execute: doUpdate, loading: updating } = useMutation(
    (args: { id: string; data: Record<string, any> }) => updateAnnouncement(args.id, args.data),
  );
  const { execute: doDelete } = useMutation(deleteAnnouncement);

  const openCreateForm = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (ann: any) => {
    setEditingId(ann.id);
    setFormData({
      title: ann.title,
      content: ann.content,
      scope: ann.scope,
      batchId: ann.batchId || '',
      courseId: ann.courseId || '',
      expiresAt: ann.expiresAt ? ann.expiresAt.slice(0, 16) : '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    if (formData.scope === 'batch' && !formData.batchId) {
      toast.error('Please select a batch');
      return;
    }
    if (formData.scope === 'course' && !formData.courseId) {
      toast.error('Please select a course');
      return;
    }

    try {
      if (editingId) {
        await doUpdate({
          id: editingId,
          data: {
            title: formData.title.trim(),
            content: formData.content.trim(),
            expires_at: formData.expiresAt || undefined,
          },
        });
        toast.success('Announcement updated');
      } else {
        await doCreate({
          title: formData.title.trim(),
          content: formData.content.trim(),
          scope: formData.scope,
          batch_id: formData.scope === 'batch' ? formData.batchId : undefined,
          course_id: formData.scope === 'course' ? formData.courseId : undefined,
          expires_at: formData.expiresAt || undefined,
        });
        toast.success('Announcement posted');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await doDelete(id);
      toast.success('Announcement deleted');
      setDeleteConfirmId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteConfirmId(null);
    }
  };

  if (loading && !announcements) {
    return <DashboardLayout><PageLoading /></DashboardLayout>;
  }

  if (error) {
    return <DashboardLayout><PageError message={error} onRetry={refetch} /></DashboardLayout>;
  }

  const items = announcements || [];

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Announcements" subtitle="Manage announcements for your institute" />

      {/* Scope filter tabs + create button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {[{ value: 'all', label: 'All' }, ...SCOPE_OPTIONS].map((s) => (
            <button
              key={s.value}
              onClick={() => { setScopeFilter(s.value); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                scopeFilter === s.value
                  ? 'bg-primary text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
        >
          <Plus size={16} />
          New Announcement
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-primary">
              {editingId ? 'Edit Announcement' : 'New Announcement'}
            </h3>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setFormData(EMPTY_FORM); }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                placeholder="Announcement title"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Content</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
                placeholder="Write your announcement..."
              />
            </div>

            {!editingId && (
              <>
                {/* Scope selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Scope</label>
                  <div className="flex gap-2">
                    {SCOPE_OPTIONS.map((s) => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, scope: s.value, batchId: '', courseId: '' })}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                            formData.scope === s.value
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          <Icon size={14} />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Batch selector */}
                {formData.scope === 'batch' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Batch</label>
                    <SearchableCombobox
                      options={batches.map((b: any) => ({ value: b.id, label: b.name }))}
                      value={formData.batchId}
                      onChange={(v) => setFormData({ ...formData, batchId: v })}
                      placeholder="Select a batch..."
                      searchPlaceholder="Search batches..."
                      emptyMessage="No batches found"
                    />
                  </div>
                )}

                {/* Course selector */}
                {formData.scope === 'course' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
                    <SearchableCombobox
                      options={courses.map((c: any) => ({ value: c.id, label: c.title }))}
                      value={formData.courseId}
                      onChange={(v) => setFormData({ ...formData, courseId: v })}
                      placeholder="Select a course..."
                      searchPlaceholder="Search courses..."
                      emptyMessage="No courses found"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expires at (optional)</label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={creating || updating}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-60"
              >
                {(creating || updating) && <Loader2 size={16} className="animate-spin" />}
                {editingId ? 'Update' : 'Post Announcement'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setFormData(EMPTY_FORM); }}
                className="px-6 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements list */}
      {items.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={28} className="text-gray-400" />}
          title="No announcements"
          description="Create your first announcement to share updates with your institute."
        />
      ) : (
        <div className="space-y-4">
          {items.map((ann: any) => {
            const scopeInfo = SCOPE_OPTIONS.find((s) => s.value === ann.scope);
            const isExpired = ann.expiresAt && new Date(ann.expiresAt) < new Date();
            return (
              <div
                key={ann.id}
                className={`bg-white rounded-2xl p-5 card-shadow ${isExpired ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-sm font-semibold text-primary">{ann.title}</h3>
                      {scopeInfo && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${scopeInfo.color}`}>
                          {scopeInfo.label}
                        </span>
                      )}
                      {isExpired && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Expired
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{ann.content}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      {ann.postedByName && (
                        <div className="flex items-center gap-1">
                          <User size={12} />
                          {ann.postedByName}
                        </div>
                      )}
                      {ann.createdAt && (
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(ann.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </div>
                      )}
                      {ann.expiresAt && (
                        <span>
                          Expires: {new Date(ann.expiresAt).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditForm(ann)}
                      className="p-2 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(ann.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * 15 + 1}-{Math.min(page * 15, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this announcement? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
