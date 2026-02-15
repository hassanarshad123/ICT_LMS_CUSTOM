'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { courses, lectures } from '@/lib/mock-data';
import { BookOpen, ChevronRight, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { statusColors } from '@/lib/constants';

export default function StudentCourses() {
  const user = useAuth();
  const studentBatchId = user.batchIds?.[0]!;
  const studentCourses = courses.filter((c) => c.batchIds.includes(studentBatchId));

  return (
    <DashboardLayout role="student" userName="Muhammad Imran">
      <DashboardHeader greeting="My Courses" subtitle="Browse and continue your enrolled courses" />

      {studentCourses.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">No courses available</h3>
          <p className="text-sm text-gray-500">Courses for your batch will appear here once they are published.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studentCourses.map((course) => (
            <Link key={course.id} href={`/student/courses/${course.id}`}>
              <div className="bg-white rounded-2xl card-shadow hover:card-shadow-hover transition-all duration-200 cursor-pointer group overflow-hidden">
                <div className="h-32 bg-gradient-to-br from-[#1A1A1A] to-[#333] flex items-center justify-center">
                  <BookOpen size={40} className="text-[#C5D86D]" />
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[course.status]}`}>
                      {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">{course.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4">{course.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <div className="flex items-center gap-1.5">
                      <PlayCircle size={14} />
                      {lectures.filter((l) => l.batchId === studentBatchId && l.courseId === course.id).length} lectures
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-[#1A1A1A] group-hover:gap-3 transition-all">
                    View Course <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
