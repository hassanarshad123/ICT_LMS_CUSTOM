'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useMutation } from '@/hooks/use-api';
import { listCourses, createCourse, deleteCourse } from '@/lib/api/courses';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { BookOpen, Plus, X, Layers, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function CourseCreatorCourses() {
  const { name } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const { data: courseList, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listCourses({ ...params }),
    15,
  );

  const { execute: doCreate, loading: creating } = useMutation(createCourse);
  const { execute: doDelete } = useMutation(deleteCourse);

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
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <DashboardLayout role="course-creator" userName={name || 'Course Creator'}>
      <DashboardHeader greeting="Courses" subtitle="Create and manage your courses" />

      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Create Course'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Course</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 resize-none"
                placeholder="Course description"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-60"
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
                <Link href={`/course-creator/courses/${course.id}`}>
                  <div className="h-32 bg-gradient-to-br from-[#1A1A1A] to-[#333] flex items-center justify-center">
                    <BookOpen size={40} className="text-[#C5D86D]" />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        course.status === 'active' ? 'bg-green-100 text-green-700' :
                        course.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {course.status?.charAt(0).toUpperCase() + course.status?.slice(1)}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">{course.title}</h3>
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
                  onClick={() => handleDelete(course.id)}
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
    </DashboardLayout>
  );
}
