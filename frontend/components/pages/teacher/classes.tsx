'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi } from '@/hooks/use-api';
import { listClasses } from '@/lib/api/zoom';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { Video, ExternalLink, Clock, Calendar, PlayCircle } from 'lucide-react';

export default function TeacherZoom() {
  const { name, id } = useAuth();
  const basePath = useBasePath();

  const { data: classesData, loading, error, refetch } = useApi(
    () => listClasses({ teacher_id: id, per_page: 100 }),
    [id],
  );

  const classes = classesData?.data || [];
  const upcoming = classes.filter((z) => z.status === 'upcoming' || z.status === 'scheduled' || z.status === 'live');
  const completed = classes.filter((z) => z.status === 'completed');

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Zoom Classes" subtitle="Your scheduled classes" />

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && (
        <>
          {upcoming.length > 0 ? (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Upcoming Classes</h3>
              <div className="space-y-4">
                {upcoming.map((cls) => (
                  <div key={cls.id} className="bg-white rounded-2xl p-4 sm:p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 ${cls.status === 'live' ? 'bg-red-100' : 'bg-[#C5D86D]'} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                          <Video size={24} className={cls.status === 'live' ? 'text-red-600' : 'text-[#1A1A1A]'} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base sm:text-lg font-semibold text-[#1A1A1A]">{cls.title}</h4>
                            {cls.status === 'live' && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded-full">LIVE</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{cls.batchName}</p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3">
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                              <Calendar size={14} />
                              {cls.scheduledDate}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                              <Clock size={14} />
                              {cls.scheduledTime}
                            </div>
                            <span className="text-sm text-gray-500">
                              {cls.durationDisplay || `${cls.duration} min`}
                            </span>
                          </div>
                        </div>
                      </div>
                      {cls.zoomStartUrl && (
                        <a
                          href={cls.zoomStartUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-center"
                        >
                          <PlayCircle size={14} />
                          Start Class
                        </a>
                      )}
                      {!cls.zoomStartUrl && cls.zoomMeetingUrl && (
                        <a
                          href={cls.zoomMeetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-center"
                        >
                          <ExternalLink size={14} />
                          Join Class
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-8">
              <EmptyState
                icon={<Video size={28} className="text-gray-400" />}
                title="No upcoming classes"
                description="Your course creator will schedule the next class soon."
              />
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Past Classes</h3>
              <div className="space-y-3">
                {completed.map((cls) => (
                  <div key={cls.id} className="bg-white rounded-2xl p-5 card-shadow flex items-center justify-between opacity-70">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                        <Video size={18} className="text-gray-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-[#1A1A1A]">{cls.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{cls.batchName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{cls.scheduledDate}</p>
                      <p className="text-xs text-gray-500">{cls.scheduledTime}</p>
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
