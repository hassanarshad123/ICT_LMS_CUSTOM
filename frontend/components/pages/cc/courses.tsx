'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useMutation } from '@/hooks/use-api';
import { listCourses, createCourse, updateCourse, deleteCourse } from '@/lib/api/courses';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { BookOpen, Plus, X, Layers, Trash2, Loader2 } from 'lucide-react';
import { StyledSelect } from '@/components/ui/styled-select';
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

export default function CourseCreatorCourses() {
  const { name } = useAuth();
  const basePath = useBasePath();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const { data: courseList, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listCourses({ ...params }),
    15,
  );

  const { execute: doCreate, loading: creating } = useMutation(createCourse);
  const { execute: doUpdate } = useMutation(updateCourse);
  const { execute: doDelete } = useMutation(deleteCourse);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await doCreate({ title: title.trim(), description: description.trim() || undefined });
      toast.success('Course created');
      setTitle('');
      setDescription('');
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (courseId: string) => {
    try {
      await doDelete(courseId);
      toast.success('Course deleted');
      setDeleteConfirmId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteConfirmId(null);
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Courses" subtitle="Create and manage your courses" />

      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Create Course'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-primary mb-4">New Course</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                placeholder="Course title"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
                placeholder="Course description"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60"
            >
              {creating && <Loader2 size={16} className="animate-spin" />}
              Create Course
            </button>
          </form>
        </div>
      )}

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && courseList.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} className="text-gray-400" />}
          title="No courses yet"
          description="Create your first course to get started."
          action={{ label: 'Create Course', onClick: () => setShowForm(true) }}
        />
      ) : !loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courseList.map((course) => (
              <div key={course.id} className="bg-white rounded-2xl card-shadow hover:card-shadow-hover transition-all duration-200 overflow-hidden group relative">
                <Link href={`${basePath}/courses/${course.id}`}>
                  <div className="h-32 bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                    <BookOpen size={40} className="text-accent" />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <StyledSelect
                          options={[
                            { value: 'active', label: 'Active' },
                            { value: 'upcoming', label: 'Upcoming' },
                            { value: 'completed', label: 'Completed' },
                          ]}
                          value={course.status || 'active'}
                          onChange={async (value) => {
                            try {
                              await doUpdate(course.id, { status: value });
                              toast.success('Status updated');
                              refetch();
                            } catch (err: any) {
                              toast.error(err.message);
                            }
                          }}
                          className="w-auto min-w-[120px]"
                        />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-primary mb-2">{course.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4">{course.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Layers size={14} />
                        {(course.batchIds || []).length} batches
                      </div>
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => setDeleteConfirmId(course.id)}
                  className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete course"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6">
              <p className="text-sm text-gray-500 mb-2 sm:mb-0">
                Page {page} of {totalPages} ({total} courses)
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
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this course? This will cascade to curriculum modules, batch links, and lectures.</AlertDialogDescription>
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
