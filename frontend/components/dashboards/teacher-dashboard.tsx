'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi } from '@/hooks/use-api';
import { listBatches } from '@/lib/api/batches';
import { listClasses } from '@/lib/api/zoom';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { Layers, Users, Calendar, Video, ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';

export default function TeacherDashboard() {
  const { name, id } = useAuth();
  const basePath = useBasePath();

  const { data: batchesData, loading: batchesLoading, error: batchesError, refetch } = useApi(
    () => listBatches({ teacher_id: id, per_page: 100 }),
    [id],
  );
  const { data: classesData, loading: classesLoading } = useApi(
    () => listClasses({ teacher_id: id, per_page: 100 }),
    [id],
  );

  const loading = batchesLoading || classesLoading;

  const teacherBatches = batchesData?.data || [];
  const allClasses = classesData?.data || [];
  const upcomingClasses = allClasses.filter((c) => c.status === 'upcoming' || c.status === 'scheduled');
  const totalStudents = teacherBatches.reduce((sum, b) => sum + (b.studentCount || 0), 0);

  return (
    <DashboardLayout>
      <DashboardHeader greeting={`Good morning, ${name || 'Teacher'}!`} subtitle="Here is your teaching overview" />

      {loading && <PageLoading variant="cards" />}
      {batchesError && <PageError message={batchesError} onRetry={refetch} />}

      {!loading && !batchesError && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 card-shadow">
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center mb-4">
                <Layers size={20} />
              </div>
              <p className="text-3xl font-bold text-primary">{teacherBatches.length}</p>
              <p className="text-sm text-gray-500 mt-1">My Batches</p>
            </div>
            <div className="bg-white rounded-2xl p-6 card-shadow">
              <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center mb-4">
                <Users size={20} />
              </div>
              <p className="text-3xl font-bold text-primary">{totalStudents}</p>
              <p className="text-sm text-gray-500 mt-1">Total Students</p>
            </div>
            <div className="bg-white rounded-2xl p-6 card-shadow">
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center mb-4">
                <Calendar size={20} />
              </div>
              <p className="text-3xl font-bold text-primary">{upcomingClasses.length}</p>
              <p className="text-sm text-gray-500 mt-1">Upcoming Classes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Link href={`${basePath}/batches`}>
              <div className="bg-white rounded-2xl p-5 sm:p-8 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group">
                <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center mb-5">
                  <Layers size={28} className="text-primary" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-primary mb-2">My Batches</h3>
                <p className="text-sm text-gray-500 mb-4">View your assigned batches and students</p>
                <div className="flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
                  View Batches <ChevronRight size={16} />
                </div>
              </div>
            </Link>

            <Link href={`${basePath}/classes`}>
              <div className="bg-white rounded-2xl p-5 sm:p-8 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group">
                <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center mb-5">
                  <Video size={28} className="text-primary" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-primary mb-2">Zoom Classes</h3>
                <p className="text-sm text-gray-500 mb-4">View and join your scheduled classes</p>
                <div className="flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
                  View Classes <ChevronRight size={16} />
                </div>
              </div>
            </Link>
          </div>

          {upcomingClasses.length > 0 && (
            <div className="mt-8 bg-white rounded-2xl p-6 card-shadow">
              <h3 className="text-lg font-semibold text-primary mb-4">Upcoming Classes</h3>
              <div className="space-y-3">
                {upcomingClasses.slice(0, 5).map((cls) => (
                  <div key={cls.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-accent bg-opacity-30 rounded-xl flex items-center justify-center">
                        <Video size={18} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-primary">{cls.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{cls.batchName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-primary">{cls.scheduledDate}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                        <Clock size={10} />
                        {cls.scheduledTime} - {cls.durationDisplay || `${cls.duration} min`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
