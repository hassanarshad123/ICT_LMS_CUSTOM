'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { courses as initialCourses, lectures, batches } from '@/lib/mock-data';
import { Course } from '@/lib/types';
import { BookOpen, Plus, PlayCircle, Layers } from 'lucide-react';
import Link from 'next/link';
import { statusColors } from '@/lib/constants';

export default function CourseCreatorCourses() {
  const [courseList, setCourseList] = useState<Course[]>(initialCourses);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!title.trim()) return;
    const newCourse: Course = {
      id: `cr${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      batchIds: [],
      status: 'upcoming',
    };
    setCourseList([...courseList, newCourse]);
    setTitle('');
    setDescription('');
    setShowForm(false);
  };

  return (
    <DashboardLayout role="course-creator" userName="Course Creator">
      <DashboardHeader greeting="Courses" subtitle="Create and manage your courses" />

      <div className="mb-6">
        {showForm ? (
          <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Course</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                  placeholder="Course title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent resize-none"
                  placeholder="Course description"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  className="px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
                >
                  Create Course
                </button>
                <button
                  onClick={() => { setShowForm(false); setTitle(''); setDescription(''); }}
                  className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
          >
            <Plus size={16} />
            Create Course
          </button>
        )}
      </div>

      {courseList.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">No courses yet</h3>
          <p className="text-sm text-gray-500">Create your first course to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courseList.map((course) => {
            const lectureCount = lectures.filter((l) => l.courseId === course.id).length;
            const batchCount = course.batchIds.length;
            return (
              <Link key={course.id} href={`/course-creator/courses/${course.id}`}>
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
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <PlayCircle size={14} />
                        {lectureCount} lectures
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Layers size={14} />
                        {batchCount} batches
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
