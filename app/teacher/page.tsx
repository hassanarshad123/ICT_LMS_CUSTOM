'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { batches, students, zoomClasses } from '@/lib/mock-data';
import { Layers, Users, Calendar, Video, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const teacherBatches = batches.filter((b) => b.teacherId === 't1');
const teacherStudents = students.filter((s) => teacherBatches.some((b) => b.id === s.batchId));
const teacherClasses = zoomClasses.filter((z) => z.teacherName === 'Ahmed Khan');
const upcomingClasses = teacherClasses.filter((z) => z.status === 'upcoming');

export default function TeacherDashboard() {
  return (
    <DashboardLayout role="teacher" userName="Ahmed Khan">
      <DashboardHeader greeting="Good morning, Ahmed!" subtitle="Here is your teaching overview" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 card-shadow">
          <div className="w-10 h-10 bg-[#C5D86D] rounded-xl flex items-center justify-center mb-4">
            <Layers size={20} />
          </div>
          <p className="text-3xl font-bold text-[#1A1A1A]">{teacherBatches.length}</p>
          <p className="text-sm text-gray-500 mt-1">My Batches</p>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow">
          <div className="w-10 h-10 bg-[#E8E8E8] rounded-xl flex items-center justify-center mb-4">
            <Users size={20} />
          </div>
          <p className="text-3xl font-bold text-[#1A1A1A]">{teacherStudents.length}</p>
          <p className="text-sm text-gray-500 mt-1">Total Students</p>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow">
          <div className="w-10 h-10 bg-[#C5D86D] rounded-xl flex items-center justify-center mb-4">
            <Calendar size={20} />
          </div>
          <p className="text-3xl font-bold text-[#1A1A1A]">{upcomingClasses.length}</p>
          <p className="text-sm text-gray-500 mt-1">Upcoming Classes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Link href="/teacher/batches">
          <div className="bg-white rounded-2xl p-8 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group">
            <div className="w-14 h-14 bg-[#C5D86D] rounded-2xl flex items-center justify-center mb-5">
              <Layers size={28} className="text-[#1A1A1A]" />
            </div>
            <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">My Batches</h3>
            <p className="text-sm text-gray-500 mb-4">View your assigned batches and students</p>
            <div className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A] group-hover:gap-3 transition-all">
              View Batches <ChevronRight size={16} />
            </div>
          </div>
        </Link>

        <Link href="/teacher/schedule">
          <div className="bg-white rounded-2xl p-8 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group">
            <div className="w-14 h-14 bg-[#E8E8E8] rounded-2xl flex items-center justify-center mb-5">
              <Video size={28} className="text-[#1A1A1A]" />
            </div>
            <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">Schedule Class</h3>
            <p className="text-sm text-gray-500 mb-4">Schedule and manage Zoom classes</p>
            <div className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A] group-hover:gap-3 transition-all">
              Manage Classes <ChevronRight size={16} />
            </div>
          </div>
        </Link>
      </div>

      {upcomingClasses.length > 0 && (
        <div className="mt-8 bg-white rounded-2xl p-6 card-shadow">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Upcoming Classes</h3>
          <div className="space-y-3">
            {upcomingClasses.map((cls) => (
              <div key={cls.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center">
                    <Video size={18} className="text-[#1A1A1A]" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-[#1A1A1A]">{cls.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{cls.batchName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[#1A1A1A]">{cls.date}</p>
                  <p className="text-xs text-gray-500">{cls.time} - {cls.duration}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
