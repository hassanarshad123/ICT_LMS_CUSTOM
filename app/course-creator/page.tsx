'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { lectures, curriculum } from '@/lib/mock-data';
import { Video, BookOpen, Clock, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function CourseCreatorDashboard() {
  return (
    <DashboardLayout role="course-creator" userName="Course Creator">
      <DashboardHeader greeting="Good morning, Creator!" subtitle="Manage your course content" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link href="/course-creator/lectures">
          <div className="bg-white rounded-2xl p-8 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group">
            <div className="w-14 h-14 bg-[#C5D86D] rounded-2xl flex items-center justify-center mb-5">
              <Video size={28} className="text-[#1A1A1A]" />
            </div>
            <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">Recorded Lectures</h3>
            <p className="text-sm text-gray-500 mb-4">{lectures.length} lectures uploaded</p>
            <div className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A] group-hover:gap-3 transition-all">
              Manage Lectures <ChevronRight size={16} />
            </div>
          </div>
        </Link>

        <Link href="/course-creator/curriculum">
          <div className="bg-white rounded-2xl p-8 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group">
            <div className="w-14 h-14 bg-[#E8E8E8] rounded-2xl flex items-center justify-center mb-5">
              <BookOpen size={28} className="text-[#1A1A1A]" />
            </div>
            <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">Course Curriculum</h3>
            <p className="text-sm text-gray-500 mb-4">{curriculum.length} modules defined</p>
            <div className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A] group-hover:gap-3 transition-all">
              Manage Curriculum <ChevronRight size={16} />
            </div>
          </div>
        </Link>
      </div>

      <div className="bg-white rounded-2xl p-6 card-shadow">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Recent Lectures</h3>
        <div className="space-y-3">
          {lectures.slice(0, 5).map((lecture) => (
            <div key={lecture.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center">
                  <Video size={18} className="text-[#1A1A1A]" />
                </div>
                <div>
                  <p className="font-medium text-sm text-[#1A1A1A]">{lecture.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{lecture.description.slice(0, 60)}...</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock size={14} />
                {lecture.duration}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
