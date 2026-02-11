'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { courses, lectures, batches } from '@/lib/mock-data';
import { BookOpen, Video, Layers, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function CourseCreatorDashboard() {
  return (
    <DashboardLayout role="course-creator" userName="Course Creator">
      <DashboardHeader greeting="Good morning, Creator!" subtitle="Manage your course content" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow">
          <div className="w-12 h-12 bg-[#C5D86D] rounded-2xl flex items-center justify-center mb-4">
            <BookOpen size={24} className="text-[#1A1A1A]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#1A1A1A]">{courses.length}</p>
          <p className="text-sm text-gray-500 mt-1">Total Courses</p>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow">
          <div className="w-12 h-12 bg-[#E8E8E8] rounded-2xl flex items-center justify-center mb-4">
            <Layers size={24} className="text-[#1A1A1A]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#1A1A1A]">{batches.length}</p>
          <p className="text-sm text-gray-500 mt-1">Total Batches</p>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow">
          <div className="w-12 h-12 bg-[#C5D86D] bg-opacity-40 rounded-2xl flex items-center justify-center mb-4">
            <Video size={24} className="text-[#1A1A1A]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#1A1A1A]">{lectures.length}</p>
          <p className="text-sm text-gray-500 mt-1">Total Lectures</p>
        </div>
      </div>

      {/* Your Courses List */}
      <div className="bg-white rounded-2xl p-6 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#1A1A1A]">Your Courses</h3>
          <Link href="/course-creator/courses" className="text-sm font-medium text-gray-500 hover:text-[#1A1A1A] transition-colors">
            View All
          </Link>
        </div>
        <div className="space-y-3">
          {courses.map((course) => {
            const lectureCount = lectures.filter((l) => l.courseId === course.id).length;
            return (
              <Link key={course.id} href={`/course-creator/courses/${course.id}`}>
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center">
                      <BookOpen size={18} className="text-[#1A1A1A]" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-[#1A1A1A]">{course.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{lectureCount} lectures &middot; {course.batchIds.length} batches</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 group-hover:text-[#1A1A1A] transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
