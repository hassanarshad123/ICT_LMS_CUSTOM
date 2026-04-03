'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi } from '@/hooks/use-api';
import { getCourse } from '@/lib/api/courses';
import { listModules } from '@/lib/api/curriculum';
import { listLectures } from '@/lib/api/lectures';
import { listMaterials, getDownloadUrl } from '@/lib/api/materials';
import { listClasses } from '@/lib/api/zoom';
import { listQuizzes, listMyAttempts } from '@/lib/api/quizzes';
import { getBatch } from '@/lib/api/batches';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { AccessExpiredBanner } from '@/components/shared/access-expired-banner';
import { statusColors } from '@/lib/constants';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Video,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { CourseVideoPlayer } from './course-video-player';

import { CourseMaterialsSection } from './course-materials-section';
import { CourseQuizzesSection } from './course-quizzes-section';

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const { name, email, id: studentId, batchIds } = useAuth();
  const basePath = useBasePath();

  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [playlistTab, setPlaylistTab] = useState<'lectures' | 'recordings'>('lectures');
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Fetch course details
  const { data: course, loading: courseLoading, error: courseError, refetch: refetchCourse } = useApi(
    () => getCourse(courseId),
    [courseId],
  );

  // Find the batch that links this course to the student
  // (intersection of student's batches and course's batches)
  const studentBatchId = useMemo(() => {
    if (!course?.batchIds?.length || !batchIds?.length) return batchIds?.[0];
    return batchIds.find((b) => course.batchIds.includes(b)) || batchIds[0];
  }, [course, batchIds]);

  // Fetch batch details for access status
  const { data: batchInfo } = useApi(
    () => studentBatchId ? getBatch(studentBatchId) : Promise.resolve(null),
    [studentBatchId],
  );
  const accessExpired = batchInfo?.accessExpired === true;

  // Fetch curriculum modules
  const { data: modules, loading: modulesLoading } = useApi(
    () => listModules(courseId),
    [courseId],
  );

  // Fetch lectures for this course in the matching batch
  const { data: lecturesData, loading: lecturesLoading } = useApi(
    () => studentBatchId
      ? listLectures({ batch_id: studentBatchId, course_id: courseId })
      : Promise.resolve({ data: [], total: 0, page: 1, perPage: 50, totalPages: 0 }),
    [courseId, studentBatchId],
  );

  // Fetch materials for this course in the matching batch
  const { data: materialsData, loading: materialsLoading } = useApi(
    () => studentBatchId
      ? listMaterials({ batch_id: studentBatchId, course_id: courseId })
      : Promise.resolve({ data: [], total: 0, page: 1, perPage: 50, totalPages: 0 }),
    [courseId, studentBatchId],
  );

  // Fetch completed zoom class recordings
  const { data: recordingsData, loading: recordingsLoading } = useApi(
    () => studentBatchId
      ? listClasses({ batch_id: studentBatchId, status: 'completed' })
      : Promise.resolve({ data: [], total: 0, page: 1, perPage: 50, totalPages: 0 }),
    [studentBatchId],
  );

  // Fetch quizzes for this course
  const { data: quizzesData, loading: quizzesLoading } = useApi(
    () => listQuizzes({ course_id: courseId }),
    [courseId],
  );

  // Fetch my quiz attempts
  const { data: myAttemptsData, loading: myAttemptsLoading } = useApi(
    () => listMyAttempts({ course_id: courseId }),
    [courseId],
  );

  const lectures = lecturesData?.data || [];
  const materials = materialsData?.data || [];
  const recordings = recordingsData?.data || [];
  const publishedQuizzes = (quizzesData?.data || []).filter((q) => q.isPublished);
  const myAttempts = myAttemptsData?.data || [];

  // Auto-resume: select last in-progress lecture, or first unlocked lecture
  const autoResumedRef = useRef(false);
  useEffect(() => {
    if (autoResumedRef.current || lectures.length === 0) return;
    autoResumedRef.current = true;
    const sorted = [...lectures].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    // Find last in-progress lecture (highest sequence order with in_progress status)
    const inProgress = sorted
      .filter((l) => l.progressStatus === 'in_progress' && !l.isLocked)
      .sort((a, b) => b.sequenceOrder - a.sequenceOrder);
    if (inProgress.length > 0) {
      setSelectedLecture(inProgress[0].id);
      return;
    }
    // Fallback: first unlocked lecture that isn't completed
    const firstUnlocked = sorted.find((l) => !l.isLocked && l.progressStatus !== 'completed');
    if (firstUnlocked) {
      setSelectedLecture(firstUnlocked.id);
      return;
    }
    // All completed or all locked: select first lecture
    if (sorted[0]) setSelectedLecture(sorted[0].id);
  }, [lectures.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeLecture = lectures.find((l) => l.id === selectedLecture) || null;
  const activeRecording = recordings.find((r) => r.id === selectedRecording) || recordings[0] || null;

  const nowPlaying = playlistTab === 'lectures'
    ? (activeLecture ? { title: activeLecture.title, subtitle: activeLecture.description || '', duration: activeLecture.durationDisplay || `${activeLecture.duration || 0}s`, date: `Uploaded ${activeLecture.uploadDate || ''}` } : null)
    : (activeRecording ? { title: activeRecording.title, subtitle: `by ${activeRecording.teacherName || 'Teacher'}`, duration: activeRecording.durationDisplay || `${activeRecording.duration}min`, date: activeRecording.scheduledDate } : null);

  const loading = courseLoading;

  const handleDownload = async (materialId: string) => {
    setDownloadingId(materialId);
    try {
      const { downloadUrl } = await getDownloadUrl(materialId);
      window.open(downloadUrl, '_blank');
    } catch (err: any) {
      toast.error(err.message || 'Failed to get download link');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading variant="detail" />
      </DashboardLayout>
    );
  }

  if (courseError) {
    return (
      <DashboardLayout>
        <PageError message={courseError} onRetry={refetchCourse} />
      </DashboardLayout>
    );
  }

  if (!course) {
    return (
      <DashboardLayout>
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Course not found</h3>
          <p className="text-sm text-gray-500 mb-4">The course you are looking for does not exist.</p>
          <Link href={`${basePath}/courses`} className="text-sm font-medium text-primary hover:underline">
            Back to Courses
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  if (!studentBatchId) {
    return (
      <DashboardLayout>
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-yellow-500" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Not enrolled</h3>
          <p className="text-sm text-gray-500 mb-4">You are not enrolled in a batch for this course. Contact your administrator.</p>
          <Link href={`${basePath}/courses`} className="text-sm font-medium text-primary hover:underline">
            Back to Courses
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const sortedModules = [...(Array.isArray(modules) ? modules : [])].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const sortedLectures = [...(Array.isArray(lectures) ? lectures : [])].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  return (
    <DashboardLayout>
      {/* Access Expired Banner */}
      {accessExpired && (
        <AccessExpiredBanner effectiveEndDate={batchInfo?.effectiveEndDate} className="mb-6" />
      )}

      {/* Header Banner */}
      <div className="bg-primary rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 relative overflow-hidden">
        {course.coverImageUrl && (
          <>
            <img src={course.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60" />
          </>
        )}
        <div className="relative z-10">
        <Link href={`${basePath}/courses`} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ArrowLeft size={16} />
          Back to Courses
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-white mb-2">{course.title}</h1>
            <p className="text-sm text-gray-300 max-w-2xl mb-3">{course.description}</p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[course.status] || 'bg-gray-100 text-gray-600'}`}>
                {course.status?.charAt(0).toUpperCase() + course.status?.slice(1)}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <PlayCircle size={14} />
                {sortedLectures.length} lectures
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Video size={14} />
                {recordings.length} recordings
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Progress Overview */}
      {sortedLectures.length > 0 && (
        <div className="bg-white rounded-2xl card-shadow p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-500" />
              <span className="text-sm font-medium text-primary">Course Progress</span>
            </div>
            <span className="text-sm text-gray-500">
              {sortedLectures.filter(l => l.progressStatus === 'completed').length} of {sortedLectures.length} lectures completed
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${sortedLectures.length > 0 ? Math.round((sortedLectures.filter(l => l.progressStatus === 'completed').length / sortedLectures.length) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Video Player + Playlist + Now Playing Info */}
      {accessExpired && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <Lock size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Your access to this course has expired. Video playback and downloads are disabled.
            Contact your administrator for access extension.
          </p>
        </div>
      )}
      {!accessExpired && <CourseVideoPlayer
        playlistTab={playlistTab}
        onPlaylistTabChange={setPlaylistTab}
        sortedLectures={sortedLectures}
        recordings={recordings}
        selectedLecture={selectedLecture}
        selectedRecording={selectedRecording}
        onSelectLecture={setSelectedLecture}
        onSelectRecording={setSelectedRecording}
        activeLecture={activeLecture}
        activeRecording={activeRecording}
        nowPlaying={nowPlaying}
        watermark={studentId}
      />}

      {/* Curriculum Modules */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">Curriculum</h3>
        {modulesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-16" />
            ))}
          </div>
        ) : sortedModules.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No curriculum modules yet.</p>
        ) : (
          <div className="space-y-3">
            {sortedModules.map((mod) => {
              const isExpanded = expandedModule === mod.id;
              return (
                <div key={mod.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-accent bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{mod.sequenceOrder}</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-primary">{mod.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{mod.description}</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </button>
                  {isExpanded && mod.topics && mod.topics.length > 0 && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="ml-11 border-t border-gray-100 pt-3">
                        <ul className="space-y-2">
                          {mod.topics.map((topic, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
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
        )}
      </div>

      {/* Course Materials */}
      <CourseMaterialsSection
        materials={materials}
        materialsLoading={materialsLoading}
        downloadingId={downloadingId}
        onDownload={accessExpired ? () => toast.error('Your access has expired. Downloads are disabled.') : handleDownload}
      />

      {/* Quizzes */}
      <CourseQuizzesSection
        publishedQuizzes={publishedQuizzes}
        myAttempts={myAttempts}
        quizzesLoading={quizzesLoading}
        myAttemptsLoading={myAttemptsLoading}
        courseId={courseId}
        basePath={basePath}
        accessExpired={accessExpired}
      />
    </DashboardLayout>
  );
}
