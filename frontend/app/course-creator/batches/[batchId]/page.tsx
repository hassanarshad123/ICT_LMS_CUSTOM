'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import {
  batches,
  courses,
  lectures as initialLectures,
  batchMaterials as initialMaterials,
  zoomClasses,
} from '@/lib/mock-data';
import { Lecture, CourseMaterial, MaterialFileType } from '@/lib/types';
import { statusColors, fileTypeConfig } from '@/lib/constants';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Plus,
  Trash2,
  Video,
  Upload,
  Paperclip,
  Users,
  Layers,
} from 'lucide-react';
import Link from 'next/link';


export default function BatchContentPage() {
  const params = useParams();
  const batchId = params.batchId as string;

  const batch = batches.find((b) => b.id === batchId);

  const [lectureList, setLectureList] = useState<Lecture[]>(initialLectures);
  const [materialList, setMaterialList] = useState<CourseMaterial[]>(initialMaterials);

  // Per-course lecture form state
  const [showLectureForm, setShowLectureForm] = useState<string | null>(null);
  const [lectureForm, setLectureForm] = useState({ title: '', description: '', videoUrl: '', duration: '' });

  // Per-course material form state
  const [showMaterialForm, setShowMaterialForm] = useState<string | null>(null);
  const [materialForm, setMaterialForm] = useState({ title: '', description: '', fileName: '', fileType: 'pdf' as MaterialFileType });

  if (!batch) {
    return (
      <DashboardLayout role="course-creator" userName="Course Creator">
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Layers size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">Batch not found</h3>
          <p className="text-sm text-gray-500 mb-4">The batch you are looking for does not exist.</p>
          <Link href="/course-creator/batches" className="text-sm font-medium text-[#1A1A1A] hover:underline">
            Back to Batches
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const batchCourses = courses.filter((c) => c.batchIds.includes(batchId));
  const batchRecordings = zoomClasses.filter((z) => z.batchId === batchId && z.status === 'completed');

  const addLecture = (courseId: string) => {
    if (!lectureForm.title.trim()) return;
    const courseLectures = lectureList.filter((l) => l.batchId === batchId && l.courseId === courseId);
    const newLecture: Lecture = {
      id: `l${Date.now()}`,
      title: lectureForm.title.trim(),
      description: lectureForm.description.trim(),
      videoUrl: lectureForm.videoUrl.trim() || '#',
      duration: lectureForm.duration.trim() || '0 min',
      batchId,
      batchName: batch.name,
      uploadDate: new Date().toISOString().split('T')[0],
      order: courseLectures.length + 1,
      courseId,
    };
    setLectureList([...lectureList, newLecture]);
    setLectureForm({ title: '', description: '', videoUrl: '', duration: '' });
    setShowLectureForm(null);
  };

  const deleteLecture = (id: string) => {
    setLectureList(lectureList.filter((l) => l.id !== id));
  };

  const addMaterial = (courseId: string) => {
    if (!materialForm.title.trim() || !materialForm.fileName.trim()) return;
    const newMaterial: CourseMaterial = {
      id: `m${Date.now()}`,
      batchId,
      batchName: batch.name,
      courseId,
      title: materialForm.title.trim(),
      description: materialForm.description.trim() || undefined,
      fileName: materialForm.fileName.trim(),
      fileUrl: '#',
      fileType: materialForm.fileType,
      fileSize: '0 KB',
      uploadDate: new Date().toISOString().split('T')[0],
      uploadedBy: 'Course Creator',
      uploadedByRole: 'course-creator',
    };
    setMaterialList([...materialList, newMaterial]);
    setMaterialForm({ title: '', description: '', fileName: '', fileType: 'pdf' });
    setShowMaterialForm(null);
  };

  const deleteMaterial = (id: string) => {
    setMaterialList(materialList.filter((m) => m.id !== id));
  };

  return (
    <DashboardLayout role="course-creator" userName="Course Creator">
      {/* Dark Header Banner */}
      <div className="bg-[#1A1A1A] rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link
          href="/course-creator/batches"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Batches
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-white mb-2">{batch.name}</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[batch.status]}`}>
            {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Users size={14} />
            {batch.studentCount} students
          </div>
          <span className="text-xs text-gray-400">Teacher: {batch.teacherName}</span>
        </div>
        {batchCourses.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs text-gray-500">Courses:</span>
            {batchCourses.map((c) => (
              <span key={c.id} className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-300">
                {c.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content grouped by course */}
      {batchCourses.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <BookOpen size={28} className="text-gray-300 mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">No courses linked</h3>
          <p className="text-sm text-gray-500">Assign this batch to a course to start managing content.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {batchCourses.map((course) => {
            const courseLectures = lectureList
              .filter((l) => l.batchId === batchId && l.courseId === course.id)
              .sort((a, b) => a.order - b.order);
            const courseMaterialsFiltered = materialList.filter(
              (m) => m.batchId === batchId && m.courseId === course.id
            );

            return (
              <div key={course.id} className="space-y-6">
                {/* Course Header */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#C5D86D] bg-opacity-30 rounded-lg flex items-center justify-center">
                    <BookOpen size={16} className="text-[#1A1A1A]" />
                  </div>
                  <h2 className="text-lg font-bold text-[#1A1A1A]">{course.title}</h2>
                </div>

                {/* Lectures Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#1A1A1A] uppercase tracking-wide">Lectures</h3>
                    {showLectureForm !== course.id && (
                      <button
                        onClick={() => { setShowLectureForm(course.id); setLectureForm({ title: '', description: '', videoUrl: '', duration: '' }); }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
                      >
                        <Plus size={14} />
                        Add Lecture
                      </button>
                    )}
                  </div>

                  {showLectureForm === course.id && (
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
                          onClick={() => addLecture(course.id)}
                          className="px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
                        >
                          Add Lecture
                        </button>
                        <button
                          onClick={() => { setShowLectureForm(null); setLectureForm({ title: '', description: '', videoUrl: '', duration: '' }); }}
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
                              <span className="text-xs font-bold text-[#1A1A1A]">{lecture.order}</span>
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

                {/* Materials Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#1A1A1A] uppercase tracking-wide">Materials</h3>
                    {showMaterialForm !== course.id && (
                      <button
                        onClick={() => { setShowMaterialForm(course.id); setMaterialForm({ title: '', description: '', fileName: '', fileType: 'pdf' }); }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
                      >
                        <Plus size={14} />
                        Upload Material
                      </button>
                    )}
                  </div>

                  {showMaterialForm === course.id && (
                    <div className="bg-white rounded-2xl p-6 card-shadow mb-4">
                      <h4 className="text-sm font-semibold text-[#1A1A1A] mb-4">Upload New Material</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                          <input
                            type="text"
                            value={materialForm.title}
                            onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                            placeholder="Material title"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">File Type</label>
                          <select
                            value={materialForm.fileType}
                            onChange={(e) => setMaterialForm({ ...materialForm, fileType: e.target.value as MaterialFileType })}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent bg-white"
                          >
                            <option value="pdf">PDF</option>
                            <option value="excel">Excel</option>
                            <option value="word">Word</option>
                            <option value="pptx">PowerPoint</option>
                            <option value="image">Image</option>
                            <option value="archive">Archive</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                          <input
                            type="text"
                            value={materialForm.description}
                            onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                            placeholder="Brief description of the material"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">File</label>
                          <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center mb-2">
                            <Upload size={20} className="text-gray-400 mx-auto mb-1" />
                            <p className="text-xs text-gray-500">Click to browse or drag and drop</p>
                          </div>
                          <input
                            type="text"
                            value={materialForm.fileName}
                            onChange={(e) => setMaterialForm({ ...materialForm, fileName: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                            placeholder="filename.pdf"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => addMaterial(course.id)}
                          className="px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
                        >
                          Upload
                        </button>
                        <button
                          onClick={() => { setShowMaterialForm(null); setMaterialForm({ title: '', description: '', fileName: '', fileType: 'pdf' }); }}
                          className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {courseMaterialsFiltered.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 card-shadow text-center">
                      <Paperclip size={24} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No materials yet. Upload your first material.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {courseMaterialsFiltered.map((material) => {
                        const config = fileTypeConfig[material.fileType];
                        return (
                          <div key={material.id} className="flex items-center justify-between p-4 bg-white rounded-xl card-shadow">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 ${config.bgColor} rounded-xl flex items-center justify-center`}>
                                <span className={`text-xs font-bold ${config.textColor}`}>{config.label}</span>
                              </div>
                              <div>
                                <p className="font-medium text-sm text-[#1A1A1A]">{material.title}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                                  <span>{material.fileName}</span>
                                  <span className="text-gray-300">|</span>
                                  <span>{material.fileSize}</span>
                                  <span className="text-gray-300">|</span>
                                  <span>{material.uploadDate}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
                                {config.label}
                              </span>
                              <button
                                onClick={() => deleteMaterial(material.id)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Separator between courses */}
                <div className="border-t border-gray-200" />
              </div>
            );
          })}
        </div>
      )}

      {/* Zoom Recordings Section (batch-wide) */}
      <div className="mt-10">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Zoom Recordings</h3>
        {batchRecordings.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 card-shadow text-center">
            <Video size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No completed Zoom recordings for this batch yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batchRecordings.map((recording) => (
              <div key={recording.id} className="flex items-center justify-between p-4 bg-white rounded-xl card-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Video size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-[#1A1A1A]">{recording.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">by {recording.teacherName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{recording.date}</span>
                  <span>{recording.time}</span>
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} />
                    {recording.duration}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
