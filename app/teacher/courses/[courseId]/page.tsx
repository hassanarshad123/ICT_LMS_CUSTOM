'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { courses, lectures, curriculum } from '@/lib/mock-data';
import { ArrowLeft, BookOpen, Clock, PlayCircle, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  upcoming: 'bg-yellow-100 text-yellow-700',
};

export default function TeacherCourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const course = courses.find((c) => c.id === courseId);
  const courseLectures = lectures.filter((l) => l.courseId === courseId).sort((a, b) => a.order - b.order);

  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [selectedLecture, setSelectedLecture] = useState<string | null>(courseLectures[0]?.id ?? null);
  const activeLecture = courseLectures.find((l) => l.id === selectedLecture);

  if (!course) {
    return (
      <DashboardLayout role="teacher" userName="Ahmed Khan">
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">Course not found</h3>
          <p className="text-sm text-gray-500 mb-4">The course you are looking for does not exist.</p>
          <Link href="/teacher/courses" className="text-sm font-medium text-[#1A1A1A] hover:underline">
            Back to My Courses
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher" userName="Ahmed Khan">
      {/* Header Banner */}
      <div className="bg-[#1A1A1A] rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link href="/teacher/courses" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ArrowLeft size={16} />
          Back to My Courses
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-white mb-2">{course.title}</h1>
            <p className="text-sm text-gray-300 max-w-2xl mb-3">{course.description}</p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[course.status]}`}>
                {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <PlayCircle size={14} />
                {course.lectureCount} lectures
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock size={14} />
                {course.totalDuration}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Player + Playlist Side by Side */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6 sm:mb-8">
        {/* Left: Video Player */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#1A1A1A] rounded-2xl overflow-hidden">
            <div className="aspect-video bg-gray-800 flex items-center justify-center">
              <div className="text-center">
                <PlayCircle size={64} className="text-[#C5D86D] mx-auto mb-3" />
                <p className="text-white text-sm">
                  {activeLecture ? activeLecture.title : 'Select a lecture'}
                </p>
                <p className="text-gray-400 text-xs mt-1">Video will play here when connected to backend</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Lecture Playlist */}
        <div className="w-full lg:w-80 lg:flex-shrink-0">
          <div className="bg-white rounded-2xl card-shadow overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-[#1A1A1A] text-sm">Lectures</h3>
              <p className="text-xs text-gray-400 mt-0.5">{courseLectures.length} lectures</p>
            </div>
            <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100% - 56px)' }}>
              {courseLectures.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <PlayCircle size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No lectures uploaded yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {courseLectures.map((lecture, index) => {
                    const isActive = selectedLecture === lecture.id;
                    return (
                      <button
                        key={lecture.id}
                        onClick={() => setSelectedLecture(lecture.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isActive
                            ? 'bg-[#1A1A1A] text-white'
                            : 'hover:bg-gray-50 text-[#1A1A1A]'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                            isActive
                              ? 'bg-[#C5D86D] text-[#1A1A1A]'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-[#1A1A1A]'}`}>
                            {lecture.title}
                          </p>
                          <div className={`flex items-center gap-1 text-xs mt-0.5 ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>
                            <Clock size={10} />
                            {lecture.duration}
                          </div>
                        </div>
                        {isActive && <PlayCircle size={16} className="text-[#C5D86D] flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lecture Info */}
      {activeLecture && (
        <div className="bg-white rounded-2xl card-shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">{activeLecture.title}</h3>
          <p className="text-sm text-gray-600 mb-3">{activeLecture.description}</p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              {activeLecture.duration}
            </div>
            <span className="text-gray-300">|</span>
            <span>Uploaded {activeLecture.uploadDate}</span>
          </div>
        </div>
      )}

      {/* Curriculum Modules */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Curriculum</h3>
        <div className="space-y-3">
          {curriculum.filter((m) => m.courseId === courseId).map((mod) => {
            const isExpanded = expandedModule === mod.id;
            return (
              <div key={mod.id} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#C5D86D] bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[#1A1A1A]">{mod.order}</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-[#1A1A1A]">{mod.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{mod.description}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="ml-11 border-t border-gray-100 pt-3">
                      <ul className="space-y-2">
                        {mod.topics.map((topic, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#C5D86D]" />
                            {topic}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
