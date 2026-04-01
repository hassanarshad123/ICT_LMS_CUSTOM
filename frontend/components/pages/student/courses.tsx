'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useBasePath } from '@/hooks/use-base-path';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { listCourses } from '@/lib/api/courses';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { statusColors } from '@/lib/constants';
import { BookOpen, ChevronRight, Search, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function StudentCourses() {
  const basePath = useBasePath();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: courses, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    ({ page: p, per_page: pp }) => listCourses({ page: p, per_page: pp, search: search || undefined, status: statusFilter || undefined }),
    12,
    [search, statusFilter],
  );

  const statuses = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <DashboardLayout>
      <DashboardHeader greeting="My Courses" subtitle="Browse and continue your enrolled courses" />

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white"
          />
        </div>
        <div className="flex gap-2">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                statusFilter === s.value
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && courses.length === 0 && (
        <EmptyState
          icon={<BookOpen size={28} className="text-gray-400" />}
          title="No courses found"
          description={search ? `No courses match "${search}". Try a different search.` : "Courses for your batch will appear here once they are published."}
        />
      )}

      {!loading && !error && courses.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Link key={course.id} href={`${basePath}/courses/${course.id}`}>
                <div className="bg-white rounded-2xl card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group overflow-hidden">
                  <div className="h-32 bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center relative overflow-hidden">
                    {course.coverImageUrl ? (
                      <img src={course.coverImageUrl} alt={course.title} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <BookOpen size={40} className="text-accent" />
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[course.status] || 'bg-gray-100 text-gray-600'}`}>
                        {course.status?.charAt(0).toUpperCase() + course.status?.slice(1)}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-primary mb-2">{course.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4">{course.description || 'No description'}</p>
                    <div className="flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
                      View Course <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * 12 + 1}–{Math.min(page * 12, total)} of {total} courses
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-gray-600 px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
