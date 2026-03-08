'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useApi, useMutation } from '@/hooks/use-api';
import { getBatch, listBatchCourses } from '@/lib/api/batches';
import { listLectures, createLecture, deleteLecture } from '@/lib/api/lectures';
import { listMaterials, getUploadUrl, createMaterial, deleteMaterial } from '@/lib/api/materials';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { toast } from 'sonner';
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
  Loader2,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

export default function BatchContentPage() {
  const params = useParams();
  const batchId = params.batchId as string;
  const { name } = useAuth();

  const { data: batch, loading: batchLoading, error: batchError, refetch: refetchBatch } = useApi(
    () => getBatch(batchId),
    [batchId],
  );
  const { data: batchCourses, loading: coursesLoading, refetch: refetchCourses } = useApi(
    () => listBatchCourses(batchId),
    [batchId],
  );

  // Per-course lecture and material data
  const [courseLectures, setCourseLectures] = useState<Record<string, any[]>>({});
  const [courseMaterials, setCourseMaterials] = useState<Record<string, any[]>>({});
  const [loadingContent, setLoadingContent] = useState<Record<string, boolean>>({});

  // Per-course lecture form state
  const [showLectureForm, setShowLectureForm] = useState<string | null>(null);
  const [lectureForm, setLectureForm] = useState({ title: '', description: '', videoUrl: '', duration: '' });

  // Per-course material form state
  const [showMaterialForm, setShowMaterialForm] = useState<string | null>(null);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');

  const { execute: doCreateLecture, loading: creatingLecture } = useMutation(createLecture);
  const { execute: doDeleteLecture } = useMutation(deleteLecture);
  const { execute: doDeleteMaterial } = useMutation(deleteMaterial);

  const courses: any[] = Array.isArray(batchCourses) ? batchCourses : [];

  const loadCourseContent = useCallback(async (courseId: string) => {
    if (loadingContent[courseId]) return;
    setLoadingContent((prev) => ({ ...prev, [courseId]: true }));
    try {
      const [lecRes, matRes] = await Promise.all([
        listLectures({ batch_id: batchId, course_id: courseId }),
        listMaterials({ batch_id: batchId, course_id: courseId }),
      ]);
      setCourseLectures((prev) => ({ ...prev, [courseId]: lecRes.data || [] }));
      setCourseMaterials((prev) => ({ ...prev, [courseId]: matRes.data || [] }));
    } catch {
      // Silently fail, show empty
    } finally {
      setLoadingContent((prev) => ({ ...prev, [courseId]: false }));
    }
  }, [batchId]);

  // Load content for all courses once they're available
  useEffect(() => {
    if (courses.length > 0) {
      courses.forEach((c) => {
        if (!courseLectures[c.id] && !loadingContent[c.id]) {
          loadCourseContent(c.id);
        }
      });
    }
  }, [courses.length]);

  const handleAddLecture = async (courseId: string) => {
    if (!lectureForm.title.trim()) return;
    try {
      await doCreateLecture({
        title: lectureForm.title.trim(),
        batch_id: batchId,
        course_id: courseId,
        video_type: lectureForm.videoUrl ? 'external' : 'none',
        video_url: lectureForm.videoUrl.trim() || undefined,
        duration: lectureForm.duration ? parseInt(lectureForm.duration, 10) : undefined,
        description: lectureForm.description.trim() || undefined,
      });
      toast.success('Lecture added');
      setLectureForm({ title: '', description: '', videoUrl: '', duration: '' });
      setShowLectureForm(null);
      loadCourseContent(courseId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteLecture = async (lectureId: string, courseId: string) => {
    try {
      await doDeleteLecture(lectureId);
      toast.success('Lecture deleted');
      loadCourseContent(courseId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUploadMaterial = async (courseId: string) => {
    if (!materialFile || !materialTitle.trim()) {
      toast.error('Please provide a title and select a file');
      return;
    }
    try {
      // Step 1: Get presigned upload URL
      const { uploadUrl, objectKey } = await getUploadUrl({
        file_name: materialFile.name,
        content_type: materialFile.type || 'application/octet-stream',
        batch_id: batchId,
        course_id: courseId,
      });

      // Step 2: Upload file to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: materialFile,
        headers: { 'Content-Type': materialFile.type || 'application/octet-stream' },
      });

      // Step 3: Register material in backend
      const ext = materialFile.name.split('.').pop()?.toLowerCase() || 'other';
      await createMaterial({
        object_key: objectKey,
        title: materialTitle.trim(),
        file_name: materialFile.name,
        file_type: ext,
        batch_id: batchId,
        description: materialDescription.trim() || undefined,
        file_size_bytes: materialFile.size,
        course_id: courseId,
      });

      toast.success('Material uploaded');
      setMaterialFile(null);
      setMaterialTitle('');
      setMaterialDescription('');
      setShowMaterialForm(null);
      loadCourseContent(courseId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteMaterial = async (materialId: string, courseId: string) => {
    try {
      await doDeleteMaterial(materialId);
      toast.success('Material deleted');
      loadCourseContent(courseId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const loading = batchLoading || coursesLoading;

  if (loading) {
    return (
      <DashboardLayout role="course-creator" userName={name || 'Course Creator'}>
        <PageLoading variant="detail" />
      </DashboardLayout>
    );
  }

  if (batchError || !batch) {
    return (
      <DashboardLayout role="course-creator" userName={name || 'Course Creator'}>
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Layers size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">Batch not found</h3>
          <p className="text-sm text-gray-500 mb-4">{batchError || 'The batch you are looking for does not exist.'}</p>
          <Link href="/course-creator/batches" className="text-sm font-medium text-[#1A1A1A] hover:underline">
            Back to Batches
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="course-creator" userName={name || 'Course Creator'}>
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
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            batch.status === 'active' ? 'bg-green-100 text-green-700' :
            batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {batch.status}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Users size={14} />
            {batch.studentCount} students
          </div>
          <span className="text-xs text-gray-400">Teacher: {batch.teacherName || 'Unassigned'}</span>
        </div>
        {courses.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs text-gray-500">Courses:</span>
            {courses.map((c: any) => (
              <span key={c.id} className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-300">
                {c.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content grouped by course */}
      {courses.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <BookOpen size={28} className="text-gray-300 mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">No courses linked</h3>
          <p className="text-sm text-gray-500">Assign this batch to a course to start managing content.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {courses.map((course: any) => {
            const lectures = courseLectures[course.id] || [];
            const materials = courseMaterials[course.id] || [];
            const isContentLoading = loadingContent[course.id];

            return (
              <div key={course.id} className="space-y-6">
                {/* Course Header */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#C5D86D] bg-opacity-30 rounded-lg flex items-center justify-center">
                    <BookOpen size={16} className="text-[#1A1A1A]" />
                  </div>
                  <h2 className="text-lg font-bold text-[#1A1A1A]">{course.title}</h2>
                </div>

                {isContentLoading ? (
                  <div className="flex items-center gap-2 py-8 justify-center">
                    <Loader2 size={16} className="animate-spin text-gray-400" />
                    <span className="text-sm text-gray-500">Loading content...</span>
                  </div>
                ) : (
                  <>
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
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                                placeholder="Lecture title"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Duration (minutes)</label>
                              <input
                                type="number"
                                value={lectureForm.duration}
                                onChange={(e) => setLectureForm({ ...lectureForm, duration: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                                placeholder="e.g. 45"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                              <input
                                type="text"
                                value={lectureForm.description}
                                onChange={(e) => setLectureForm({ ...lectureForm, description: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                                placeholder="Lecture description"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Video URL</label>
                              <input
                                type="text"
                                value={lectureForm.videoUrl}
                                onChange={(e) => setLectureForm({ ...lectureForm, videoUrl: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                                placeholder="https://..."
                              />
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleAddLecture(course.id)}
                              disabled={creatingLecture}
                              className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors disabled:opacity-60"
                            >
                              {creatingLecture && <Loader2 size={16} className="animate-spin" />}
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

                      {lectures.length === 0 ? (
                        <div className="bg-white rounded-2xl p-8 card-shadow text-center">
                          <Video size={24} className="text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">No lectures yet. Add your first lecture.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {lectures.sort((a: any, b: any) => a.sequenceOrder - b.sequenceOrder).map((lecture: any) => (
                            <div key={lecture.id} className="flex items-center justify-between p-4 bg-white rounded-xl card-shadow">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center">
                                  <span className="text-xs font-bold text-[#1A1A1A]">{lecture.sequenceOrder}</span>
                                </div>
                                <div>
                                  <p className="font-medium text-sm text-[#1A1A1A]">{lecture.title}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">{lecture.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {lecture.durationDisplay && (
                                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <Clock size={12} />
                                    {lecture.durationDisplay}
                                  </div>
                                )}
                                <button
                                  onClick={() => handleDeleteLecture(lecture.id, course.id)}
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
                            onClick={() => { setShowMaterialForm(course.id); setMaterialFile(null); setMaterialTitle(''); setMaterialDescription(''); }}
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
                          <div className="space-y-4 mb-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                              <input
                                type="text"
                                value={materialTitle}
                                onChange={(e) => setMaterialTitle(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                                placeholder="Material title"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                              <input
                                type="text"
                                value={materialDescription}
                                onChange={(e) => setMaterialDescription(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                                placeholder="Brief description"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">File</label>
                              <label className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer block hover:border-gray-300 transition-colors">
                                <Upload size={20} className="text-gray-400 mx-auto mb-1" />
                                <p className="text-xs text-gray-500">
                                  {materialFile ? materialFile.name : 'Click to browse or drag and drop'}
                                </p>
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) {
                                      setMaterialFile(f);
                                      if (!materialTitle) setMaterialTitle(f.name.replace(/\.[^.]+$/, ''));
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleUploadMaterial(course.id)}
                              className="px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
                            >
                              Upload
                            </button>
                            <button
                              onClick={() => { setShowMaterialForm(null); setMaterialFile(null); setMaterialTitle(''); setMaterialDescription(''); }}
                              className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {materials.length === 0 ? (
                        <div className="bg-white rounded-2xl p-8 card-shadow text-center">
                          <Paperclip size={24} className="text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">No materials yet. Upload your first material.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {materials.map((material: any) => (
                            <div key={material.id} className="flex items-center justify-between p-4 bg-white rounded-xl card-shadow">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                                  <FileText size={18} className="text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm text-[#1A1A1A]">{material.title}</p>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                                    <span>{material.fileName}</span>
                                    {material.fileSize && (
                                      <>
                                        <span className="text-gray-300">|</span>
                                        <span>{material.fileSize}</span>
                                      </>
                                    )}
                                    {material.uploadDate && (
                                      <>
                                        <span className="text-gray-300">|</span>
                                        <span>{new Date(material.uploadDate).toLocaleDateString()}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteMaterial(material.id, course.id)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Separator between courses */}
                <div className="border-t border-gray-200" />
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
