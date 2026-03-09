'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi } from '@/hooks/use-api';
import { listCourses } from '@/lib/api/courses';
import { listBatches } from '@/lib/api/batches';
import { listJobs } from '@/lib/api/jobs';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { BookOpen, Layers, Briefcase, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function CourseCreatorDashboard() {
  const { name } = useAuth();
  const basePath = useBasePath();

  const { data: coursesData, loading: coursesLoading, error: coursesError, refetch: refetchCourses } = useApi(
    () => listCourses({ per_page: 5 }),
  );
  const { data: batchesData, loading: batchesLoading } = useApi(
    () => listBatches({ per_page: 1 }),
  );
  const { data: jobsData, loading: jobsLoading } = useApi(
    () => listJobs({ per_page: 1 }),
  );

  const loading = coursesLoading || batchesLoading || jobsLoading;
  const error = coursesError;

  return (
    <DashboardLayout>
      <DashboardHeader greeting={`Good morning, ${name || 'Creator'}!`} subtitle="Manage your course content" />

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetchCourses} />}

      {!loading && !error && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Link href={`${basePath}/courses`}>
              <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer">
                <div className="w-12 h-12 bg-[#C5D86D] rounded-2xl flex items-center justify-center mb-4">
                  <BookOpen size={24} className="text-[#1A1A1A]" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-[#1A1A1A]">{coursesData?.total ?? 0}</p>
                <p className="text-sm text-gray-500 mt-1">Total Courses</p>
              </div>
            </Link>
            <Link href={`${basePath}/batches`}>
              <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer">
                <div className="w-12 h-12 bg-[#E8E8E8] rounded-2xl flex items-center justify-center mb-4">
                  <Layers size={24} className="text-[#1A1A1A]" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-[#1A1A1A]">{batchesData?.total ?? 0}</p>
                <p className="text-sm text-gray-500 mt-1">Total Batches</p>
              </div>
            </Link>
            <Link href={`${basePath}/jobs`}>
              <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer">
                <div className="w-12 h-12 bg-[#C5D86D] bg-opacity-40 rounded-2xl flex items-center justify-center mb-4">
                  <Briefcase size={24} className="text-[#1A1A1A]" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-[#1A1A1A]">{jobsData?.total ?? 0}</p>
                <p className="text-sm text-gray-500 mt-1">Total Jobs</p>
              </div>
            </Link>
          </div>

          {/* Recent Courses List */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1A1A1A]">Recent Courses</h3>
              <Link href={`${basePath}/courses`} className="text-sm font-medium text-gray-500 hover:text-[#1A1A1A] transition-colors">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {(coursesData?.data || []).length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No courses yet</p>
              ) : (
                coursesData!.data.map((course) => (
                  <Link key={course.id} href={`${basePath}/courses/${course.id}`}>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center">
                          <BookOpen size={18} className="text-[#1A1A1A]" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-[#1A1A1A]">{course.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {(course.batchIds || []).length} batches
                            <span className="mx-1">&middot;</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              course.status === 'active' ? 'bg-green-100 text-green-700' :
                              course.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {course.status}
                            </span>
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 group-hover:text-[#1A1A1A] transition-colors" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
