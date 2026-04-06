'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi } from '@/hooks/use-api';
import { listClasses } from '@/lib/api/zoom';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { Video, ExternalLink, Clock, Calendar, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { trackClassJoin } from '@/lib/analytics';

function formatRelativeTime(dateStr: string, timeStr: string, duration?: number): string {
  try {
    const classTime = new Date(`${dateStr}T${timeStr}+05:00`);
    const now = new Date();
    const endTime = classTime.getTime() + ((duration || 60) * 60000);
    // Class has ended
    if (now.getTime() > endTime) return 'Ended';
    const diff = classTime.getTime() - now.getTime();
    // Class is live (started but not ended)
    if (diff <= 0) return 'Live now';
    // Class is upcoming
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours >= 24) return `in ${Math.floor(hours / 24)}d ${hours % 24}h`;
    return hours > 0 ? `Starts in ${hours}h ${mins}m` : `Starts in ${mins}m`;
  } catch {
    return '';
  }
}

function formatFriendlyDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00+05:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function StudentZoom() {
  const { name } = useAuth();
  const basePath = useBasePath();

  const { data: classesData, loading, error, refetch } = useApi(
    () => listClasses(),
  );

  const classes = classesData?.data || [];
  const upcoming = classes.filter((z) => {
    if (z.status === 'completed') return false;
    if (z.status !== 'upcoming' && z.status !== 'scheduled' && z.status !== 'live') return false;
    // Client-side end time check
    if (z.scheduledDate && z.scheduledTime) {
      const endTime = new Date(`${z.scheduledDate}T${z.scheduledTime}+05:00`).getTime() + ((z.duration || 60) * 60000);
      if (Date.now() > endTime) return false;
    }
    return true;
  });
  const completed = classes.filter((z) => z.status === 'completed');

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Zoom Classes" subtitle="Your live class schedule" />

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && (
        <>
          {/* Upcoming Classes */}
          {upcoming.length > 0 ? (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-primary mb-4">Upcoming Classes</h3>
              <div className="space-y-4">
                {upcoming.map((cls) => (
                  <div key={cls.id} className="bg-white rounded-2xl p-4 sm:p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-accent rounded-2xl flex items-center justify-center flex-shrink-0">
                          <Video size={24} className="text-primary" />
                        </div>
                        <div>
                          <h4 className="text-base sm:text-lg font-semibold text-primary">{cls.title}</h4>
                          {cls.teacherName && (
                            <p className="text-sm text-gray-500 mt-1">Teacher: {cls.teacherName}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3">
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                              <Calendar size={14} />
                              {formatFriendlyDate(cls.scheduledDate)}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                              <Clock size={14} />
                              {cls.scheduledTime}
                            </div>
                            <span className="text-sm text-gray-500">
                              {cls.durationDisplay || `${cls.duration} min`}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-primary mt-2">
                            {formatRelativeTime(cls.scheduledDate, cls.scheduledTime, cls.duration)}
                          </p>
                        </div>
                      </div>
                      {cls.zoomMeetingUrl ? (
                        <a
                          href={cls.zoomMeetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackClassJoin(cls.id)}
                          className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-center"
                        >
                          <ExternalLink size={14} />
                          Join Class
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Join link will be available soon</span>
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
                description="Your teacher will schedule the next class soon."
              />
            </div>
          )}

          {/* Past Classes */}
          {completed.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-primary mb-4">Past Classes</h3>
              <div className="space-y-3">
                {completed.map((cls) => (
                  <div key={cls.id} className="bg-white rounded-2xl p-5 card-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                          <Video size={18} className="text-gray-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-primary">{cls.title}</h4>
                          {cls.teacherName && (
                            <p className="text-xs text-gray-500 mt-0.5">Teacher: {cls.teacherName}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">{formatFriendlyDate(cls.scheduledDate)}</p>
                          <p className="text-xs text-gray-500">{cls.scheduledTime}</p>
                        </div>
                        <Link href={`${basePath}/recordings`} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors">
                          <PlayCircle size={12} />
                          Recordings
                        </Link>
                      </div>
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
