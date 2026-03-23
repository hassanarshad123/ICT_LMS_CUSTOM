'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi } from '@/hooks/use-api';
import { listCourses } from '@/lib/api/courses';
import { listClasses } from '@/lib/api/zoom';
import { listJobs } from '@/lib/api/jobs';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { BookOpen, Briefcase, ChevronRight, Video, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';

export default function StudentDashboard() {
  const { name } = useAuth();
  const basePath = useBasePath();

  const { data: coursesData, loading: coursesLoading, error: coursesError, refetch: refetchCourses } = useApi(
    () => listCourses(),
  );
  const { data: classesData, loading: classesLoading, error: classesError, refetch: refetchClasses } = useApi(
    () => listClasses(),
  );
  const { data: jobsData, loading: jobsLoading, error: jobsError, refetch: refetchJobs } = useApi(
    () => listJobs(),
  );

  const loading = coursesLoading || classesLoading || jobsLoading;
  const error = coursesError || classesError || jobsError;

  const courses = coursesData?.data || [];
  const classes = classesData?.data || [];
  const jobs = jobsData?.data || [];

  const upcomingClasses = classes.filter((c) => c.status === 'upcoming' || c.status === 'scheduled');

  return (
    <DashboardLayout>
      <DashboardHeader
        greeting={`Welcome, ${name || 'Student'}!`}
        subtitle="Continue your learning journey"
      />

      {loading && <PageLoading variant="cards" />}
      {error && !loading && (
        <PageError
          message={error}
          onRetry={() => { refetchCourses(); refetchClasses(); refetchJobs(); }}
        />
      )}

      {!loading && !error && (
        <>
          {/* KPI Cards */}
          <div id="tour-stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Link href={`${basePath}/courses`}>
              <div className="bg-white rounded-2xl p-5 sm:p-6 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group">
                <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center mb-4">
                  <BookOpen size={24} className="text-primary" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-primary">{courses.length}</p>
                <p className="text-sm text-gray-500 mt-1">Courses Enrolled</p>
              </div>
            </Link>

            <Link href={`${basePath}/classes`}>
              <div className="bg-white rounded-2xl p-5 sm:p-6 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group">
                <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center mb-4">
                  <Video size={24} className="text-primary" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-primary">{upcomingClasses.length}</p>
                <p className="text-sm text-gray-500 mt-1">Upcoming Classes</p>
              </div>
            </Link>

            <Link href={`${basePath}/jobs`}>
              <div className="bg-white rounded-2xl p-5 sm:p-6 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group">
                <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center mb-4">
                  <Briefcase size={24} className="text-primary" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-primary">{jobsData?.total ?? 0}</p>
                <p className="text-sm text-gray-500 mt-1">Job Postings</p>
              </div>
            </Link>
          </div>

          {/* Two Column: Recent Courses + Upcoming Classes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Courses */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-primary">Recent Courses</h3>
                <Link href={`${basePath}/courses`} className="text-sm font-medium text-gray-500 hover:text-primary flex items-center gap-1 transition-colors">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              {courses.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No courses yet</p>
              ) : (
                <div className="space-y-3">
                  {courses.slice(0, 4).map((course) => (
                    <Link key={course.id} href={`${basePath}/courses/${course.id}`}>
                      <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-accent bg-opacity-30 rounded-xl flex items-center justify-center">
                            <BookOpen size={18} className="text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-primary">{course.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {course.status?.charAt(0).toUpperCase() + course.status?.slice(1)}
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Zoom Classes */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-primary">Upcoming Classes</h3>
                <Link href={`${basePath}/classes`} className="text-sm font-medium text-gray-500 hover:text-primary flex items-center gap-1 transition-colors">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              {upcomingClasses.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No upcoming classes</p>
              ) : (
                <div className="space-y-3">
                  {upcomingClasses.slice(0, 4).map((cls) => (
                    <div key={cls.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-accent bg-opacity-30 rounded-xl flex items-center justify-center">
                          <Video size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-primary">{cls.title}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Calendar size={10} />
                              {cls.scheduledDate}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock size={10} />
                              {cls.scheduledTime}
                            </span>
                          </div>
                        </div>
                      </div>
                      {cls.zoomMeetingUrl && (
                        <a
                          href={cls.zoomMeetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/80 transition-colors"
                        >
                          Join
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
