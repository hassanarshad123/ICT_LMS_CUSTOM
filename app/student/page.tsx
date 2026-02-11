'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { courses, lectures, jobs } from '@/lib/mock-data';
import { BookOpen, Briefcase, ChevronRight, Clock, PlayCircle } from 'lucide-react';
import Link from 'next/link';

const studentBatchId = 'b3';
const studentCourses = courses.filter((c) => c.batchIds.includes(studentBatchId));
const studentLectures = lectures.filter((l) => l.batchId === studentBatchId);

export default function StudentDashboard() {
  return (
    <DashboardLayout role="student" userName="Muhammad Imran">
      <DashboardHeader greeting="Welcome, Imran!" subtitle="Continue your learning journey" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link href="/student/courses">
          <div className="bg-white rounded-2xl p-5 sm:p-8 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group">
            <div className="w-14 h-14 bg-[#C5D86D] rounded-2xl flex items-center justify-center mb-5">
              <BookOpen size={28} className="text-[#1A1A1A]" />
            </div>
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">Courses</h3>
            <p className="text-sm text-gray-500 mb-4">{studentCourses.length} courses enrolled</p>
            <div className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A] group-hover:gap-3 transition-all">
              View All <ChevronRight size={16} />
            </div>
          </div>
        </Link>

        <Link href="/student/jobs">
          <div className="bg-white rounded-2xl p-5 sm:p-8 card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group">
            <div className="w-14 h-14 bg-[#E8E8E8] rounded-2xl flex items-center justify-center mb-5">
              <Briefcase size={28} className="text-[#1A1A1A]" />
            </div>
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">Job Opportunities</h3>
            <p className="text-sm text-gray-500 mb-4">{jobs.length} jobs available</p>
            <div className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A] group-hover:gap-3 transition-all">
              Browse Jobs <ChevronRight size={16} />
            </div>
          </div>
        </Link>
      </div>

      <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Recent Lectures</h3>
        <div className="space-y-3">
          {studentLectures.slice(0, 4).map((lecture) => (
            <Link key={lecture.id} href={`/student/courses/${lecture.courseId}`}>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center">
                    <PlayCircle size={18} className="text-[#1A1A1A]" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-[#1A1A1A]">{lecture.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{lecture.description.slice(0, 50)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock size={14} />
                  {lecture.duration}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
