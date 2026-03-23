'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi } from '@/hooks/use-api';
import { getDashboard } from '@/lib/api/admin';
import { PageLoading } from '@/components/shared/page-states';
import { PageError } from '@/components/shared/page-states';
import WelcomeBanner from '@/components/shared/welcome-banner';
import { Layers, Users, GraduationCap, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const { name } = useAuth();
  const basePath = useBasePath();
  const { data, loading, error, refetch } = useApi(getDashboard);

  return (
    <DashboardLayout>
      <DashboardHeader greeting={`Good morning, ${name || 'Admin'}!`} subtitle="Here is your institute overview" />

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {data && (
        <>
          {data.totalBatches === 0 &&
            data.totalStudents === 0 &&
            data.totalTeachers === 0 &&
            data.activeBatches === 0 &&
            <WelcomeBanner />}

          <div id="tour-stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {[
              { label: 'Total Batches', value: data.totalBatches, icon: <Layers size={22} />, color: 'bg-accent', href: `${basePath}/batches` },
              { label: 'Total Students', value: data.totalStudents, icon: <Users size={22} />, color: 'bg-secondary', href: `${basePath}/students` },
              { label: 'Total Teachers', value: data.totalTeachers, icon: <GraduationCap size={22} />, color: 'bg-accent', href: `${basePath}/teachers` },
              { label: 'Active Batches', value: data.activeBatches, icon: <TrendingUp size={22} />, color: 'bg-secondary', href: `${basePath}/batches` },
            ].map((stat) => (
              <Link key={stat.label} href={stat.href}>
                <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer">
                  <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-3 sm:mb-4`}>
                    {stat.icon}
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-primary">{stat.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 card-shadow">
              <h3 className="text-lg font-semibold text-primary mb-4">Recent Batches</h3>
              <div className="space-y-3">
                {(data.recentBatches || []).length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No batches yet</p>
                ) : (
                  data.recentBatches.slice(0, 4).map((batch: any) => (
                    <div key={batch.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                      <div>
                        <p className="font-medium text-sm text-primary">{batch.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Teacher: {batch.teacherName || 'Unassigned'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{batch.studentCount} students</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          batch.status === 'active' ? 'bg-green-100 text-green-700' :
                          batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {batch.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 card-shadow">
              <h3 className="text-lg font-semibold text-primary mb-4">Recent Students</h3>
              <div className="space-y-3">
                {(data.recentStudents || []).length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No students yet</p>
                ) : (
                  data.recentStudents.slice(0, 5).map((student: any) => (
                    <div key={student.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-primary">
                          {student.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-primary">{student.name}</p>
                          <p className="text-xs text-gray-500">{(student.batchNames || []).join(', ') || 'No batch'}</p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {student.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
