'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { courses, lectures, curriculum, zoomClasses } from '@/lib/mock-data';
import { ArrowLeft, BookOpen, Clock, PlayCircle, ChevronDown, ChevronUp, Video } from 'lucide-react';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  upcoming: 'bg-yellow-100 text-yellow-700',
};

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const course = courses.find((c) => c.id === courseId);
  const courseLectures = lectures.filter((l) => l.courseId === courseId).sort((a, b) => a.order - b.order);
  const courseRecordings = zoomClasses.filter(
    (z) => z.status === 'completed' && course?.batchIds.includes(z.batchId)
  );

  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [playlistTab, setPlaylistTab] = useState<'lectures' | 'recordings'>('lectures');
  const [selectedLecture, setSelectedLecture] = useState<string | null>(courseLectures[0]?.id ?? null);
  const [selectedRecording, setSelectedRecording] = useState<string | null>(courseRecordings[0]?.id ?? null);

  const activeLecture = courseLectures.find((l) => l.id === selectedLecture);
  const activeRecording = courseRecordings.find((z) => z.id === selectedRecording);

  // What's currently playing
  const nowPlaying = playlistTab === 'lectures'
    ? (activeLecture ? { title: activeLecture.title, subtitle: activeLecture.description, duration: activeLecture.duration, date: `Uploaded ${activeLecture.uploadDate}` } : null)
    : (activeRecording ? { title: activeRecording.title, subtitle: `by ${activeRecording.teacherName}`, duration: activeRecording.duration, date: activeRecording.date } : null);

  if (!course) {
    return (
      <DashboardLayout role="student" userName="Muhammad Imran">
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">Course not found</h3>
          <p className="text-sm text-gray-500 mb-4">The course you are looking for does not exist.</p>
          <Link href="/student/courses" className="text-sm font-medium text-[#1A1A1A] hover:underline">
            Back to Courses
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student" userName="Muhammad Imran">
      {/* Header Banner */}
      <div className="bg-[#1A1A1A] rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link href="/student/courses" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ArrowLeft size={16} />
          Back to Courses
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
                {courseLectures.length} lectures
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Video size={14} />
                {courseRecordings.length} recordings
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
                  {nowPlaying ? nowPlaying.title : 'Select a video'}
                </p>
                <p className="text-gray-400 text-xs mt-1">Video will play here when connected to backend</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Playlist with toggle */}
        <div className="w-full lg:w-80 lg:flex-shrink-0">
          <div className="bg-white rounded-2xl card-shadow overflow-hidden h-full flex flex-col">
            {/* Two big toggle buttons */}
            <div className="grid grid-cols-2 gap-0">
              <button
                onClick={() => setPlaylistTab('lectures')}
                className={`flex flex-col items-center justify-center py-4 transition-colors ${
                  playlistTab === 'lectures'
                    ? 'bg-[#1A1A1A] text-white'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <BookOpen size={20} className={playlistTab === 'lectures' ? 'text-[#C5D86D]' : ''} />
                <span className="text-xs font-bold mt-1.5">Lectures</span>
                <span className={`text-[10px] mt-0.5 ${playlistTab === 'lectures' ? 'text-gray-300' : 'text-gray-400'}`}>
                  {courseLectures.length} videos
                </span>
              </button>
              <button
                onClick={() => setPlaylistTab('recordings')}
                className={`flex flex-col items-center justify-center py-4 transition-colors ${
                  playlistTab === 'recordings'
                    ? 'bg-[#1A1A1A] text-white'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Video size={20} className={playlistTab === 'recordings' ? 'text-[#C5D86D]' : ''} />
                <span className="text-xs font-bold mt-1.5">Class Recordings</span>
                <span className={`text-[10px] mt-0.5 ${playlistTab === 'recordings' ? 'text-gray-300' : 'text-gray-400'}`}>
                  {courseRecordings.length} videos
                </span>
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {playlistTab === 'lectures' ? (
                courseLectures.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <BookOpen size={24} className="text-gray-300 mx-auto mb-2" />
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
                )
              ) : (
                courseRecordings.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <Video size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">No class recordings yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {courseRecordings.map((recording, index) => {
                      const isActive = selectedRecording === recording.id;
                      return (
                        <button
                          key={recording.id}
                          onClick={() => setSelectedRecording(recording.id)}
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
                              {recording.title}
                            </p>
                            <div className={`flex items-center gap-1 text-xs mt-0.5 ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>
                              <Clock size={10} />
                              {recording.duration} &middot; {recording.date}
                            </div>
                          </div>
                          {isActive && <PlayCircle size={16} className="text-[#C5D86D] flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Card below video */}
      {nowPlaying && (
        <div className="bg-white rounded-2xl card-shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">{nowPlaying.title}</h3>
          <p className="text-sm text-gray-600 mb-3">{nowPlaying.subtitle}</p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              {nowPlaying.duration}
            </div>
            <span className="text-gray-300">|</span>
            <span>{nowPlaying.date}</span>
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
