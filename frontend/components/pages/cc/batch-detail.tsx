'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi, useMutation } from '@/hooks/use-api';
import { getBatch, listBatchCourses, listBatchStudents, enrollStudent, removeStudent } from '@/lib/api/batches';
import { listUsers } from '@/lib/api/users';
import { listLectures, createLecture, deleteLecture, bulkReorderLectures, LectureOut } from '@/lib/api/lectures';
import { listMaterials, getUploadUrl, createMaterial, deleteMaterial } from '@/lib/api/materials';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import LectureDrawer from '@/components/shared/lecture-drawer';
import SortableLectureCard from '@/components/shared/sortable-lecture-card';
import { formatFileSize } from '@/lib/utils/format';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
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
  UserPlus,
  Layers,
  Loader2,
  FileText,
  Link as LinkIcon,
} from 'lucide-react';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function BatchContentPage() {
  const params = useParams();
  const batchId = params.batchId as string;
  const { name } = useAuth();
  const basePath = useBasePath();

  const { data: batch, loading: batchLoading, error: batchError, refetch: refetchBatch } = useApi(
    () => getBatch(batchId),
    [batchId],
  );
  const { data: batchCourses, loading: coursesLoading, refetch: refetchCourses } = useApi(
    () => listBatchCourses(batchId),
    [batchId],
  );

  // Per-course lecture and material data
  const [courseLectures, setCourseLectures] = useState<Record<string, LectureOut[]>>({});
  const [courseMaterials, setCourseMaterials] = useState<Record<string, any[]>>({});
  const [loadingContent, setLoadingContent] = useState<Record<string, boolean>>({});
  const loadingContentRef = useRef<Record<string, boolean>>({});

  // External URL form state (inline — video upload moved to Upload Videos page)
  const [showLectureForm, setShowLectureForm] = useState<string | null>(null);
  const [lectureForm, setLectureForm] = useState({ title: '', description: '', videoUrl: '', duration: '' });

  // Lecture drawer
  const [drawerLectureId, setDrawerLectureId] = useState<string | null>(null);

  // Per-course material form state
  const [showMaterialForm, setShowMaterialForm] = useState<string | null>(null);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Student management
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [removeStudentConfirm, setRemoveStudentConfirm] = useState<string | null>(null);

  const { data: students, loading: studentsLoading, refetch: refetchStudents } = useApi(
    () => listBatchStudents(batchId),
    [batchId],
  );

  const { data: allStudentsData } = useApi(
    () => listUsers({ role: 'student', per_page: 100 }),
  );

  const { execute: doEnroll, loading: enrolling } = useMutation(
    (studentId: string) => enrollStudent(batchId, studentId),
  );

  const { execute: doRemoveStudent } = useMutation(
    (studentId: string) => removeStudent(batchId, studentId),
  );

  const enrolledIds = useMemo(() => {
    if (!students || !Array.isArray(students)) return new Set<string>();
    return new Set(students.map((s: any) => s.id));
  }, [students]);

  const availableStudents = useMemo(() => {
    const all = allStudentsData?.data || [];
    return all.filter((s) => !enrolledIds.has(s.id));
  }, [allStudentsData, enrolledIds]);

  const handleEnrollStudent = async () => {
    if (!selectedStudentId) return;
    try {
      await doEnroll(selectedStudentId);
      toast.success('Student enrolled');
      setSelectedStudentId('');
      refetchStudents();
      refetchBatch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    try {
      await doRemoveStudent(studentId);
      toast.success('Student removed');
      setRemoveStudentConfirm(null);
      refetchStudents();
      refetchBatch();
    } catch (err: any) {
      toast.error(err.message);
      setRemoveStudentConfirm(null);
    }
  };

  const { execute: doCreateLecture, loading: creatingLecture } = useMutation(createLecture);
  const { execute: doDeleteMaterial } = useMutation(deleteMaterial);
  const [deleteMaterialConfirm, setDeleteMaterialConfirm] = useState<{ id: string; courseId: string } | null>(null);

  const courses: any[] = Array.isArray(batchCourses) ? batchCourses : [];

  const loadCourseContent = useCallback(async (courseId: string) => {
    if (loadingContentRef.current[courseId]) return;
    loadingContentRef.current = { ...loadingContentRef.current, [courseId]: true };
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
      loadingContentRef.current = { ...loadingContentRef.current, [courseId]: false };
      setLoadingContent((prev) => ({ ...prev, [courseId]: false }));
    }
  }, [batchId]);

  // Load content for all courses once they're available
  useEffect(() => {
    courses.forEach((c) => {
      loadCourseContent(c.id);
    });
  }, [courses.length, loadCourseContent]);

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

  const handleDragEnd = async (event: DragEndEvent, courseId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const lectures = courseLectures[courseId] || [];
    const oldIndex = lectures.findIndex((l) => l.id === active.id);
    const newIndex = lectures.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(lectures, oldIndex, newIndex);
    // Optimistic update
    setCourseLectures((prev) => ({ ...prev, [courseId]: reordered }));

    // Persist to backend
    const items = reordered.map((l, i) => ({ id: l.id, sequenceOrder: i + 1 }));
    try {
      await bulkReorderLectures(items);
    } catch {
      // Revert on failure
      setCourseLectures((prev) => ({ ...prev, [courseId]: lectures }));
      toast.error('Failed to save new order');
    }
  };

  const handleUploadMaterial = async (courseId: string) => {
    if (!materialFile || !materialTitle.trim()) {
      toast.error('Please provide a title and select a file');
      return;
    }
    try {
      const { uploadUrl, objectKey } = await getUploadUrl({
        file_name: materialFile.name,
        content_type: materialFile.type || 'application/octet-stream',
        batch_id: batchId,
        course_id: courseId,
      });

      await fetch(uploadUrl, {
        method: 'PUT',
        body: materialFile,
        headers: { 'Content-Type': materialFile.type || 'application/octet-stream' },
      });

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
      setDeleteMaterialConfirm(null);
      loadCourseContent(courseId);
    } catch (err: any) {
      toast.error(err.message);
      setDeleteMaterialConfirm(null);
    }
  };

  const loading = batchLoading || coursesLoading;

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading variant="detail" />
      </DashboardLayout>
    );
  }

  if (batchError || !batch) {
    return (
      <DashboardLayout>
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Layers size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Batch not found</h3>
          <p className="text-sm text-gray-500 mb-4">{batchError || 'The batch you are looking for does not exist.'}</p>
          <Link href={`${basePath}/batches`} className="text-sm font-medium text-primary hover:underline">
            Back to Batches
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Dark Header Banner */}
      <div className="bg-primary rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link
          href={`${basePath}/batches`}
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

      {/* Student Management */}
      <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
        <h3 className="text-lg font-semibold text-primary mb-4">Enroll Student</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
          >
            <option value="">Select a student...</option>
            {availableStudents.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
            ))}
          </select>
          <button
            onClick={handleEnrollStudent}
            disabled={!selectedStudentId || enrolling}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enrolling ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Enroll Student
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl card-shadow overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-primary">Enrolled Students ({Array.isArray(students) ? students.length : 0})</h3>
        </div>
        {studentsLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 size={16} className="animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">Loading students...</span>
          </div>
        ) : !Array.isArray(students) || students.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Users size={28} className="text-gray-400" />}
              title="No students enrolled"
              description="Use the dropdown above to enroll students in this batch."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Enrolled Date</th>
                  <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student: any) => (
                  <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium text-primary">{student.name}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{student.email}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{student.phone || '—'}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">
                      {student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString() : student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <button
                        onClick={() => setRemoveStudentConfirm(student.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Content grouped by course */}
      {courses.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <BookOpen size={28} className="text-gray-300 mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-primary mb-2">No courses linked</h3>
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
                  <div className="w-8 h-8 bg-accent bg-opacity-30 rounded-lg flex items-center justify-center">
                    <BookOpen size={16} className="text-primary" />
                  </div>
                  <h2 className="text-lg font-bold text-primary">{course.title}</h2>
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
                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Lectures</h3>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`${basePath}/upload`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
                          >
                            <Upload size={14} />
                            Upload Videos
                          </Link>
                          {showLectureForm !== course.id && (
                            <button
                              onClick={() => {
                                setShowLectureForm(course.id);
                                setLectureForm({ title: '', description: '', videoUrl: '', duration: '' });
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                            >
                              <LinkIcon size={14} />
                              Add External URL
                            </button>
                          )}
                        </div>
                      </div>

                      {/* External URL form (inline) */}
                      {showLectureForm === course.id && (
                        <div className="bg-white rounded-2xl p-6 card-shadow mb-4">
                          <h4 className="text-sm font-semibold text-primary mb-4">Add External Video</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                              <input
                                type="text"
                                value={lectureForm.title}
                                onChange={(e) => setLectureForm({ ...lectureForm, title: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                                placeholder="Lecture title"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Duration (minutes)</label>
                              <input
                                type="number"
                                value={lectureForm.duration}
                                onChange={(e) => setLectureForm({ ...lectureForm, duration: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                                placeholder="e.g. 45"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Video URL</label>
                              <input
                                type="text"
                                value={lectureForm.videoUrl}
                                onChange={(e) => setLectureForm({ ...lectureForm, videoUrl: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                                placeholder="https://youtube.com/watch?v=..."
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                              <input
                                type="text"
                                value={lectureForm.description}
                                onChange={(e) => setLectureForm({ ...lectureForm, description: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                                placeholder="Lecture description"
                              />
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleAddLecture(course.id)}
                              disabled={creatingLecture}
                              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-60"
                            >
                              {creatingLecture && <Loader2 size={16} className="animate-spin" />}
                              Add Lecture
                            </button>
                            <button
                              onClick={() => {
                                setShowLectureForm(null);
                                setLectureForm({ title: '', description: '', videoUrl: '', duration: '' });
                              }}
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
                          <p className="text-sm text-gray-500">No lectures yet. Upload videos or add an external URL.</p>
                        </div>
                      ) : (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event) => handleDragEnd(event, course.id)}
                        >
                          <SortableContext
                            items={lectures.map((l) => l.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-2">
                              {[...lectures]
                                .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                                .map((lecture) => (
                                  <SortableLectureCard
                                    key={lecture.id}
                                    lecture={lecture}
                                    onClick={() => setDrawerLectureId(lecture.id)}
                                  />
                                ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}
                    </div>

                    {/* Materials Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Materials</h3>
                        {showMaterialForm !== course.id && (
                          <button
                            onClick={() => { setShowMaterialForm(course.id); setMaterialFile(null); setMaterialTitle(''); setMaterialDescription(''); }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
                          >
                            <Plus size={14} />
                            Upload Material
                          </button>
                        )}
                      </div>

                      {showMaterialForm === course.id && (
                        <div className="bg-white rounded-2xl p-6 card-shadow mb-4">
                          <h4 className="text-sm font-semibold text-primary mb-4">Upload New Material</h4>
                          <div className="space-y-4 mb-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                              <input
                                type="text"
                                value={materialTitle}
                                onChange={(e) => setMaterialTitle(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                                placeholder="Material title"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                              <input
                                type="text"
                                value={materialDescription}
                                onChange={(e) => setMaterialDescription(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
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
                              className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
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
                                  <p className="font-medium text-sm text-primary">{material.title}</p>
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
                                onClick={() => setDeleteMaterialConfirm({ id: material.id, courseId: course.id })}
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
      <LectureDrawer
        lectureId={drawerLectureId}
        onClose={() => setDrawerLectureId(null)}
        onSaved={() => {
          // Refresh lectures for all courses
          courses.forEach((c: any) => loadCourseContent(c.id));
        }}
        onDeleted={() => {
          courses.forEach((c: any) => loadCourseContent(c.id));
        }}
      />

      <AlertDialog open={!!deleteMaterialConfirm} onOpenChange={(open) => !open && setDeleteMaterialConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Material</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this material? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMaterialConfirm && handleDeleteMaterial(deleteMaterialConfirm.id, deleteMaterialConfirm.courseId)} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeStudentConfirm} onOpenChange={(open) => !open && setRemoveStudentConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to remove this student from the batch? They will lose access to all batch courses and materials.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeStudentConfirm && handleRemoveStudent(removeStudentConfirm)} className="bg-red-600 hover:bg-red-700 text-white">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
