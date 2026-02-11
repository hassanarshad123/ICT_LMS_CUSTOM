'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import {
  courses as initialCourses,
  batches as initialBatches,
  lectures as initialLectures,
  curriculum as initialCurriculum,
  students as initialStudents,
} from '@/lib/mock-data';
import { Course, Batch, Lecture, CurriculumModule, Student } from '@/lib/types';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  PlayCircle,
  Layers,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  Trash2,
  Video,
} from 'lucide-react';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  upcoming: 'bg-yellow-100 text-yellow-700',
};

export default function CourseCreatorCourseDetail() {
  const params = useParams();
  const courseId = params.courseId as string;

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [lectureList, setLectureList] = useState<Lecture[]>(initialLectures);
  const [curriculumList, setCurriculumList] = useState<CurriculumModule[]>(initialCurriculum);
  const [studentList, setStudentList] = useState<Student[]>(initialStudents);

  const course = courses.find((c) => c.id === courseId);

  const [activeTab, setActiveTab] = useState<'batches' | 'content'>('batches');
  const [showBatchDropdown, setShowBatchDropdown] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  // Add student form state per batch
  const [studentForm, setStudentForm] = useState<Record<string, { name: string; email: string; phone: string }>>({});

  // Add lecture form
  const [showLectureForm, setShowLectureForm] = useState(false);
  const [lectureForm, setLectureForm] = useState({ title: '', description: '', videoUrl: '', duration: '' });

  // Add module form
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: '', description: '', topics: '' });

  if (!course) {
    return (
      <DashboardLayout role="course-creator" userName="Course Creator">
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">Course not found</h3>
          <p className="text-sm text-gray-500 mb-4">The course you are looking for does not exist.</p>
          <Link href="/course-creator/courses" className="text-sm font-medium text-[#1A1A1A] hover:underline">
            Back to Courses
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const courseBatches = initialBatches.filter((b) => course.batchIds.includes(b.id));
  const unassignedBatches = initialBatches.filter((b) => !course.batchIds.includes(b.id));
  const courseLectures = lectureList.filter((l) => l.courseId === courseId).sort((a, b) => a.order - b.order);
  const courseModules = curriculumList.filter((m) => m.courseId === courseId).sort((a, b) => a.order - b.order);

  const addBatch = (batchId: string) => {
    setCourses(courses.map((c) =>
      c.id === courseId ? { ...c, batchIds: [...c.batchIds, batchId] } : c
    ));
    setShowBatchDropdown(false);
  };

  const removeBatch = (batchId: string) => {
    setCourses(courses.map((c) =>
      c.id === courseId ? { ...c, batchIds: c.batchIds.filter((id) => id !== batchId) } : c
    ));
  };

  const addStudent = (batchId: string) => {
    const form = studentForm[batchId];
    if (!form?.name.trim() || !form?.email.trim()) return;
    const batch = initialBatches.find((b) => b.id === batchId);
    const newStudent: Student = {
      id: `s${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      batchId,
      batchName: batch?.name ?? '',
      joinDate: new Date().toISOString().split('T')[0],
      status: 'active',
    };
    setStudentList([...studentList, newStudent]);
    setStudentForm({ ...studentForm, [batchId]: { name: '', email: '', phone: '' } });
  };

  const addLecture = () => {
    if (!lectureForm.title.trim()) return;
    const newLecture: Lecture = {
      id: `l${Date.now()}`,
      title: lectureForm.title.trim(),
      description: lectureForm.description.trim(),
      videoUrl: lectureForm.videoUrl.trim() || '#',
      duration: lectureForm.duration.trim() || '0 min',
      batchId: course.batchIds[0] ?? '',
      batchName: '',
      uploadDate: new Date().toISOString().split('T')[0],
      order: courseLectures.length + 1,
      courseId,
    };
    setLectureList([...lectureList, newLecture]);
    setLectureForm({ title: '', description: '', videoUrl: '', duration: '' });
    setShowLectureForm(false);
  };

  const deleteLecture = (id: string) => {
    setLectureList(lectureList.filter((l) => l.id !== id));
  };

  const addModule = () => {
    if (!moduleForm.title.trim()) return;
    const newModule: CurriculumModule = {
      id: `c${Date.now()}`,
      courseId,
      title: moduleForm.title.trim(),
      description: moduleForm.description.trim(),
      order: courseModules.length + 1,
      topics: moduleForm.topics.split(',').map((t) => t.trim()).filter(Boolean),
    };
    setCurriculumList([...curriculumList, newModule]);
    setModuleForm({ title: '', description: '', topics: '' });
    setShowModuleForm(false);
  };

  const deleteModule = (id: string) => {
    setCurriculumList(curriculumList.filter((m) => m.id !== id));
  };

  return (
    <DashboardLayout role="course-creator" userName="Course Creator">
      {/* Dark Header Banner */}
      <div className="bg-[#1A1A1A] rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link
          href="/course-creator/courses"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Courses
        </Link>
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
            <Layers size={14} />
            {courseBatches.length} batches
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock size={14} />
            {course.totalDuration}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-white rounded-xl p-1 card-shadow mb-6 w-fit">
        <button
          onClick={() => setActiveTab('batches')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'batches' ? 'bg-[#1A1A1A] text-white' : 'text-gray-500 hover:text-[#1A1A1A]'
          }`}
        >
          Batches
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'content' ? 'bg-[#1A1A1A] text-white' : 'text-gray-500 hover:text-[#1A1A1A]'
          }`}
        >
          Content
        </button>
      </div>

      {/* Batches Tab */}
      {activeTab === 'batches' && (
        <div>
          {/* Add Batch Button + Dropdown */}
          <div className="relative mb-6">
            <button
              onClick={() => setShowBatchDropdown(!showBatchDropdown)}
              disabled={unassignedBatches.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Add Batch
            </button>
            {showBatchDropdown && unassignedBatches.length > 0 && (
              <div className="absolute top-12 left-0 bg-white rounded-xl card-shadow border border-gray-100 py-2 z-10 min-w-[280px]">
                {unassignedBatches.map((batch) => (
                  <button
                    key={batch.id}
                    onClick={() => addBatch(batch.id)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1A]">{batch.name}</p>
                      <p className="text-xs text-gray-400">{batch.studentCount} students</p>
                    </div>
                    <Plus size={14} className="text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Batch List */}
          {courseBatches.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 card-shadow text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Layers size={28} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">No batches assigned</h3>
              <p className="text-sm text-gray-500">Click &quot;Add Batch&quot; to assign a batch to this course.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {courseBatches.map((batch) => {
                const isExpanded = expandedBatch === batch.id;
                const batchStudents = studentList.filter((s) => s.batchId === batch.id);
                const form = studentForm[batch.id] || { name: '', email: '', phone: '' };
                return (
                  <div key={batch.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
                    <div className="flex items-center justify-between p-5">
                      <button
                        onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}
                        className="flex items-center gap-4 flex-1 text-left"
                      >
                        <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center">
                          <Layers size={18} className="text-[#1A1A1A]" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-[#1A1A1A]">{batch.name}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[batch.status]}`}>
                              {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                            </span>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Users size={12} />
                              {batchStudents.length} students
                            </span>
                            <span className="text-xs text-gray-400">
                              {batch.startDate} - {batch.endDate}
                            </span>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </button>
                      <button
                        onClick={() => removeBatch(batch.id)}
                        className="ml-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove batch from course"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 px-5 py-4">
                        {/* Students list */}
                        {batchStudents.length > 0 ? (
                          <div className="space-y-2 mb-4">
                            {batchStudents.map((student) => (
                              <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-xs font-bold text-white">
                                    {student.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-[#1A1A1A]">{student.name}</p>
                                    <p className="text-xs text-gray-400">{student.email}</p>
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {student.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 mb-4">No students in this batch yet.</p>
                        )}

                        {/* Add Student Inline Form */}
                        <div className="bg-gray-50 rounded-xl p-4">
                          <h5 className="text-sm font-medium text-[#1A1A1A] mb-3">Add Student</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <input
                              type="text"
                              value={form.name}
                              onChange={(e) => setStudentForm({ ...studentForm, [batch.id]: { ...form, name: e.target.value } })}
                              placeholder="Name"
                              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                            />
                            <input
                              type="email"
                              value={form.email}
                              onChange={(e) => setStudentForm({ ...studentForm, [batch.id]: { ...form, email: e.target.value } })}
                              placeholder="Email"
                              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                            />
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={form.phone}
                                onChange={(e) => setStudentForm({ ...studentForm, [batch.id]: { ...form, phone: e.target.value } })}
                                placeholder="Phone"
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                              />
                              <button
                                onClick={() => addStudent(batch.id)}
                                className="px-4 py-2 bg-[#1A1A1A] text-white text-sm font-medium rounded-lg hover:bg-[#333] transition-colors"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="space-y-8">
          {/* Lectures Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1A1A1A]">Lectures</h3>
              {!showLectureForm && (
                <button
                  onClick={() => setShowLectureForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
                >
                  <Plus size={14} />
                  Add Lecture
                </button>
              )}
            </div>

            {showLectureForm && (
              <div className="bg-white rounded-2xl p-6 card-shadow mb-4">
                <h4 className="text-sm font-semibold text-[#1A1A1A] mb-4">New Lecture</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                    <input
                      type="text"
                      value={lectureForm.title}
                      onChange={(e) => setLectureForm({ ...lectureForm, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                      placeholder="Lecture title"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                    <input
                      type="text"
                      value={lectureForm.duration}
                      onChange={(e) => setLectureForm({ ...lectureForm, duration: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                      placeholder="e.g. 45 min"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <input
                      type="text"
                      value={lectureForm.description}
                      onChange={(e) => setLectureForm({ ...lectureForm, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                      placeholder="Lecture description"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Video URL</label>
                    <input
                      type="text"
                      value={lectureForm.videoUrl}
                      onChange={(e) => setLectureForm({ ...lectureForm, videoUrl: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={addLecture}
                    className="px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
                  >
                    Add Lecture
                  </button>
                  <button
                    onClick={() => { setShowLectureForm(false); setLectureForm({ title: '', description: '', videoUrl: '', duration: '' }); }}
                    className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {courseLectures.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 card-shadow text-center">
                <Video size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No lectures yet. Add your first lecture.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {courseLectures.map((lecture) => (
                  <div key={lecture.id} className="flex items-center justify-between p-4 bg-white rounded-xl card-shadow">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center">
                        <Video size={18} className="text-[#1A1A1A]" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-[#1A1A1A]">{lecture.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{lecture.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock size={12} />
                        {lecture.duration}
                      </div>
                      <button
                        onClick={() => deleteLecture(lecture.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Curriculum Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1A1A1A]">Curriculum</h3>
              {!showModuleForm && (
                <button
                  onClick={() => setShowModuleForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
                >
                  <Plus size={14} />
                  Add Module
                </button>
              )}
            </div>

            {showModuleForm && (
              <div className="bg-white rounded-2xl p-6 card-shadow mb-4">
                <h4 className="text-sm font-semibold text-[#1A1A1A] mb-4">New Module</h4>
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                    <input
                      type="text"
                      value={moduleForm.title}
                      onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                      placeholder="Module title"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <input
                      type="text"
                      value={moduleForm.description}
                      onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                      placeholder="Module description"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Topics (comma separated)</label>
                    <input
                      type="text"
                      value={moduleForm.topics}
                      onChange={(e) => setModuleForm({ ...moduleForm, topics: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                      placeholder="Topic 1, Topic 2, Topic 3"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={addModule}
                    className="px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
                  >
                    Add Module
                  </button>
                  <button
                    onClick={() => { setShowModuleForm(false); setModuleForm({ title: '', description: '', topics: '' }); }}
                    className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {courseModules.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 card-shadow text-center">
                <BookOpen size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No curriculum modules yet. Add your first module.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {courseModules.map((mod) => (
                  <div key={mod.id} className="bg-white rounded-xl card-shadow overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#C5D86D] bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-[#1A1A1A]">{mod.order}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-[#1A1A1A]">{mod.title}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{mod.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteModule(mod.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {mod.topics.length > 0 && (
                      <div className="px-4 pb-4">
                        <div className="ml-11 border-t border-gray-100 pt-3">
                          <ul className="space-y-1.5">
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
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
