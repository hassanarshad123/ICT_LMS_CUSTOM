'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { zoomClasses } from '@/lib/mock-data';
import { Video, ExternalLink, Clock, Calendar } from 'lucide-react';

export default function StudentZoom() {
  const user = useAuth();
  const studentBatchId = user.batchId!;
  const studentClasses = zoomClasses.filter((z) => z.batchId === studentBatchId);
  const upcoming = studentClasses.filter((z) => z.status === 'upcoming');
  const completed = studentClasses.filter((z) => z.status === 'completed');

  return (
    <DashboardLayout role="student" userName="Muhammad Imran">
      <DashboardHeader greeting="Zoom Classes" subtitle="Your live class schedule" />

      {upcoming.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Upcoming Classes</h3>
          <div className="space-y-4">
            {upcoming.map((cls) => (
              <div key={cls.id} className="bg-white rounded-2xl p-4 sm:p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#C5D86D] rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Video size={24} className="text-[#1A1A1A]" />
                    </div>
                    <div>
                      <h4 className="text-base sm:text-lg font-semibold text-[#1A1A1A]">{cls.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">Teacher: {cls.teacherName}</p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Calendar size={14} />
                          {cls.date}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Clock size={14} />
                          {cls.time}
                        </div>
                        <span className="text-sm text-gray-500">{cls.duration}</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={cls.zoomLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-center"
                  >
                    <ExternalLink size={14} />
                    Join Class
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcoming.length === 0 && (
        <div className="bg-white rounded-2xl p-12 card-shadow text-center mb-8">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Video size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">No upcoming classes</h3>
          <p className="text-sm text-gray-500">Your teacher will schedule the next class soon.</p>
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
                    <p className="text-xs text-gray-500 mt-0.5">Teacher: {cls.teacherName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">{cls.date}</p>
                  <p className="text-xs text-gray-500">{cls.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
