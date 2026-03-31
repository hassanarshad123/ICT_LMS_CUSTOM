'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi } from '@/hooks/use-api';
import { listCourses } from '@/lib/api/courses';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { statusColors } from '@/lib/constants';
import { BookOpen, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function StudentCourses() {
  const { name } = useAuth();
  const basePath = useBasePath();

  const { data: coursesData, loading, error, refetch } = useApi(
    () => listCourses(),
  );

  const courses = coursesData?.data || [];

  return (
    <DashboardLayout>
      <DashboardHeader greeting="My Courses" subtitle="Browse and continue your enrolled courses" />

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && courses.length === 0 && (
        <EmptyState
          icon={<BookOpen size={28} className="text-gray-400" />}
          title="No courses available"
          description="Courses for your batch will appear here once they are published."
        />
      )}

      {!loading && !error && courses.length > 0 && (
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
      )}
    </DashboardLayout>
  );
}
