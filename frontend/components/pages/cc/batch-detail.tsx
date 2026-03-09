'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import * as tus from 'tus-js-client';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi, useMutation } from '@/hooks/use-api';
import { getBatch, listBatchCourses, listBatchStudents, enrollStudent, removeStudent } from '@/lib/api/batches';
import { listUsers } from '@/lib/api/users';
import { listLectures, createLecture, deleteLecture, initVideoUpload, getLectureStatus } from '@/lib/api/lectures';
import { listMaterials, getUploadUrl, createMaterial, deleteMaterial } from '@/lib/api/materials';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
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
  UserPlus,
  Layers,
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  Film,
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

type UploadMode = 'upload' | 'external';

interface UploadProgress {
  lectureId: string;
  progress: number;
  status: 'uploading' | 'processing' | 'ready' | 'failed' | 'error';
  error?: string;
}

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
  const [courseLectures, setCourseLectures] = useState<Record<string, any[]>>({});
  const [courseMaterials, setCourseMaterials] = useState<Record<string, any[]>>({});
  const [loadingContent, setLoadingContent] = useState<Record<string, boolean>>({});

  // Per-course lecture form state
  const [showLectureForm, setShowLectureForm] = useState<string | null>(null);
  const [lectureForm, setLectureForm] = useState({ title: '', description: '', videoUrl: '', duration: '' });
  const [uploadMode, setUploadMode] = useState<UploadMode>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const pollingRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Per-course material form state
  const [showMaterialForm, setShowMaterialForm] = useState<string | null>(null);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');

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
  const { execute: doDeleteLecture } = useMutation(deleteLecture);
  const { execute: doDeleteMaterial } = useMutation(deleteMaterial);
  const [deleteLectureConfirm, setDeleteLectureConfirm] = useState<{ id: string; courseId: string } | null>(null);
  const [deleteMaterialConfirm, setDeleteMaterialConfirm] = useState<{ id: string; courseId: string } | null>(null);
  const [submittingUpload, setSubmittingUpload] = useState(false);

  const courses: any[] = Array.isArray(batchCourses) ? batchCourses : [];

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingRefs.current).forEach(clearTimeout);
    };
  }, []);

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

  const pollingStartTimes = useRef<Record<string, number>>({});
  const POLLING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  const startStatusPolling = useCallback((lectureId: string, courseId: string) => {
    // Clear existing poll for this lecture
    if (pollingRefs.current[lectureId]) {
      clearTimeout(pollingRefs.current[lectureId]);
    }
    pollingStartTimes.current[lectureId] = Date.now();

    const poll = async () => {
      const elapsed = Date.now() - (pollingStartTimes.current[lectureId] || 0);
      if (elapsed > POLLING_TIMEOUT_MS) {
        delete pollingRefs.current[lectureId];
        delete pollingStartTimes.current[lectureId];
        setUploadProgress((prev) => ({
          ...prev,
          [lectureId]: {
            ...prev[lectureId],
            status: 'error',
            error: 'Processing is taking longer than expected. Please check back later.',
          },
        }));
        toast.error('Video processing timed out. It may still complete — check back later.');
        return;
      }

      try {
        const res = await getLectureStatus(lectureId);
        if (res.videoStatus === 'ready') {
          delete pollingRefs.current[lectureId];
          delete pollingStartTimes.current[lectureId];
          setUploadProgress((prev) => ({
            ...prev,
            [lectureId]: { ...prev[lectureId], status: 'ready', progress: 100 },
          }));
          toast.success('Video is ready!');
          loadCourseContent(courseId);
          return;
        } else if (res.videoStatus === 'failed') {
          delete pollingRefs.current[lectureId];
          delete pollingStartTimes.current[lectureId];
          setUploadProgress((prev) => ({
            ...prev,
            [lectureId]: { ...prev[lectureId], status: 'failed', error: 'Encoding failed' },
          }));
          toast.error('Video processing failed');
          return;
        } else {
          setUploadProgress((prev) => ({
            ...prev,
            [lectureId]: { ...prev[lectureId], status: 'processing' },
          }));
        }
      } catch {
        // Keep polling on network errors
      }

      // Adaptive interval: 5s for first 2 min, then 15s
      const interval = elapsed < 2 * 60 * 1000 ? 5000 : 15000;
      pollingRefs.current[lectureId] = setTimeout(poll, interval);
    };

    // Start first poll after 5s
    pollingRefs.current[lectureId] = setTimeout(poll, 5000);
  }, [loadCourseContent]);

  const handleAddLecture = async (courseId: string) => {
    if (!lectureForm.title.trim()) return;

    if (uploadMode === 'upload' && videoFile) {
      // File size validation (10 GB max)
      const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024;
      if (videoFile.size > MAX_FILE_SIZE) {
        toast.error('File is too large. Maximum file size is 10 GB.');
        return;
      }
      // TUS direct upload flow
      setSubmittingUpload(true);
      try {
        const res = await initVideoUpload({
          title: lectureForm.title.trim(),
          batch_id: batchId,
          course_id: courseId,
          description: lectureForm.description.trim() || undefined,
          duration: lectureForm.duration ? parseInt(lectureForm.duration, 10) : undefined,
        });

        const lectureId = res.lecture.id;

        // Add to lecture list immediately
        setCourseLectures((prev) => ({
          ...prev,
          [courseId]: [...(prev[courseId] || []), res.lecture],
        }));

        // Track upload progress
        setUploadProgress((prev) => ({
          ...prev,
          [lectureId]: { lectureId, progress: 0, status: 'uploading' },
        }));

        // Start TUS upload directly to Bunny
        const upload = new tus.Upload(videoFile, {
          endpoint: res.tusEndpoint,
          chunkSize: 50 * 1024 * 1024, // 50 MB chunks (default was 5 MB)
          parallelUploads: 5, // 5 concurrent chunks
          retryDelays: [0, 3000, 5000, 10000, 15000],
          headers: {
            AuthorizationSignature: res.authSignature,
            AuthorizationExpire: String(res.authExpire),
            VideoId: res.videoId,
            LibraryId: res.libraryId,
          },
          metadata: {
            filetype: videoFile.type,
            title: lectureForm.title.trim(),
          },
          onProgress: (bytesSent, bytesTotal) => {
            const pct = Math.round((bytesSent / bytesTotal) * 100);
            setUploadProgress((prev) => ({
              ...prev,
              [lectureId]: { ...prev[lectureId], progress: pct, status: 'uploading' },
            }));
          },
          onSuccess: () => {
            setUploadProgress((prev) => ({
              ...prev,
              [lectureId]: { ...prev[lectureId], progress: 100, status: 'processing' },
            }));
            toast.success('Upload complete! Processing video...');
            startStatusPolling(lectureId, courseId);
          },
          onError: (err) => {
            setUploadProgress((prev) => ({
              ...prev,
              [lectureId]: { ...prev[lectureId], status: 'error', error: err.message },
            }));
            toast.error(`Upload failed: ${err.message}`);
          },
        });
        upload.start();

        // Reset form
        setLectureForm({ title: '', description: '', videoUrl: '', duration: '' });
        setVideoFile(null);
        setShowLectureForm(null);
      } catch (err: any) {
        toast.error(err.message || 'Failed to initialize upload');
      } finally {
        setSubmittingUpload(false);
      }
    } else {
      // External URL flow (existing)
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
    }
  };

  const handleDeleteLecture = async (lectureId: string, courseId: string) => {
    try {
      await doDeleteLecture(lectureId);
      toast.success('Lecture deleted');
      setDeleteLectureConfirm(null);
      // Stop polling if active
      if (pollingRefs.current[lectureId]) {
        clearTimeout(pollingRefs.current[lectureId]);
        delete pollingRefs.current[lectureId];
      }
      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[lectureId];
        return next;
      });
      loadCourseContent(courseId);
    } catch (err: any) {
      toast.error(err.message);
      setDeleteLectureConfirm(null);
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">Batch not found</h3>
          <p className="text-sm text-gray-500 mb-4">{batchError || 'The batch you are looking for does not exist.'}</p>
          <Link href={`${basePath}/batches`} className="text-sm font-medium text-[#1A1A1A] hover:underline">
            Back to Batches
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Dark Header Banner */}
      <div className="bg-[#1A1A1A] rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
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
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Enroll Student</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
          >
            <option value="">Select a student...</option>
            {availableStudents.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
            ))}
          </select>
          <button
            onClick={handleEnrollStudent}
            disabled={!selectedStudentId || enrolling}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enrolling ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Enroll Student
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl card-shadow overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[#1A1A1A]">Enrolled Students ({Array.isArray(students) ? students.length : 0})</h3>
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
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium text-[#1A1A1A]">{student.name}</td>
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
                            onClick={() => {
                              setShowLectureForm(course.id);
                              setLectureForm({ title: '', description: '', videoUrl: '', duration: '' });
                              setVideoFile(null);
                              setUploadMode('upload');
                            }}
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
                          </div>

                          {/* Upload Mode Tabs */}
                          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4">
                            <button
                              onClick={() => setUploadMode('upload')}
                              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                                uploadMode === 'upload'
                                  ? 'bg-[#1A1A1A] text-white'
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              <Film size={14} />
                              Upload Video
                            </button>
                            <button
                              onClick={() => setUploadMode('external')}
                              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                                uploadMode === 'external'
                                  ? 'bg-[#1A1A1A] text-white'
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              <LinkIcon size={14} />
                              External URL
                            </button>
                          </div>

                          {uploadMode === 'upload' ? (
                            <div className="mb-4">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Video File</label>
                              <label className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer block hover:border-gray-300 transition-colors">
                                <Upload size={24} className="text-gray-400 mx-auto mb-2" />
                                {videoFile ? (
                                  <div>
                                    <p className="text-sm font-medium text-[#1A1A1A]">{videoFile.name}</p>
                                    <p className="text-xs text-gray-400 mt-1">{formatFileSize(videoFile.size)}</p>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-sm text-gray-600">Click to select a video file</p>
                                    <p className="text-xs text-gray-400 mt-1">MP4, WebM, MOV — up to 10 GB</p>
                                  </div>
                                )}
                                <input
                                  type="file"
                                  accept="video/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) setVideoFile(f);
                                  }}
                                />
                              </label>
                            </div>
                          ) : (
                            <div className="mb-4">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Video URL</label>
                              <input
                                type="text"
                                value={lectureForm.videoUrl}
                                onChange={(e) => setLectureForm({ ...lectureForm, videoUrl: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                                placeholder="https://youtube.com/watch?v=..."
                              />
                            </div>
                          )}

                          <div className="flex gap-3">
                            <button
                              onClick={() => handleAddLecture(course.id)}
                              disabled={creatingLecture || submittingUpload || (uploadMode === 'upload' && !videoFile)}
                              className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors disabled:opacity-60"
                            >
                              {(creatingLecture || submittingUpload) && <Loader2 size={16} className="animate-spin" />}
                              {uploadMode === 'upload' ? 'Upload & Add' : 'Add Lecture'}
                            </button>
                            <button
                              onClick={() => {
                                setShowLectureForm(null);
                                setLectureForm({ title: '', description: '', videoUrl: '', duration: '' });
                                setVideoFile(null);
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
                          <p className="text-sm text-gray-500">No lectures yet. Add your first lecture.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {lectures.sort((a: any, b: any) => a.sequenceOrder - b.sequenceOrder).map((lecture: any) => {
                            const up = uploadProgress[lecture.id];
                            return (
                              <div key={lecture.id} className="flex items-center justify-between p-4 bg-white rounded-xl card-shadow">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                  <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-bold text-[#1A1A1A]">{lecture.sequenceOrder}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-[#1A1A1A]">{lecture.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">{lecture.description}</p>
                                    {/* Upload/processing status */}
                                    {up && up.status === 'uploading' && (
                                      <div className="mt-2">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Loader2 size={12} className="animate-spin text-blue-500" />
                                          <span className="text-xs text-blue-600 font-medium">Uploading... {up.progress}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                          <div
                                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                            style={{ width: `${up.progress}%` }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    {((up && up.status === 'processing') || (!up && lecture.videoStatus === 'processing') || (!up && lecture.videoStatus === 'pending' && lecture.videoType === 'upload')) && (
                                      <div className="flex items-center gap-2 mt-1.5">
                                        <Loader2 size={12} className="animate-spin text-amber-500" />
                                        <span className="text-xs text-amber-600 font-medium">Processing video...</span>
                                      </div>
                                    )}
                                    {up && up.status === 'ready' && (
                                      <div className="flex items-center gap-1.5 mt-1.5">
                                        <CheckCircle2 size={12} className="text-green-500" />
                                        <span className="text-xs text-green-600 font-medium">Ready</span>
                                      </div>
                                    )}
                                    {((up && (up.status === 'failed' || up.status === 'error')) || (!up && lecture.videoStatus === 'failed')) && (
                                      <div className="flex items-center gap-1.5 mt-1.5">
                                        <XCircle size={12} className="text-red-500" />
                                        <span className="text-xs text-red-600 font-medium">
                                          {up?.error || 'Processing failed'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  {lecture.videoType === 'upload' && lecture.videoStatus === 'ready' && (
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-2 h-2 rounded-full bg-green-400" />
                                    </div>
                                  )}
                                  {lecture.durationDisplay && (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                      <Clock size={12} />
                                      {lecture.durationDisplay}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => setDeleteLectureConfirm({ id: lecture.id, courseId: course.id })}
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
      <AlertDialog open={!!deleteLectureConfirm} onOpenChange={(open) => !open && setDeleteLectureConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lecture</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this lecture? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteLectureConfirm && handleDeleteLecture(deleteLectureConfirm.id, deleteLectureConfirm.courseId)} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
