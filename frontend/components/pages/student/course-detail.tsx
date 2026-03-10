'use client';

import { useState, useMemo } from 'react';
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
import type { Quiz, QuizAttempt } from '@/lib/api/quizzes';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { statusColors, fileTypeConfig } from '@/lib/constants';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Video,
  FileText,
  Download,
  Paperclip,
  Loader2,
  HelpCircle,
  Target,
  RotateCcw,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import type { MaterialFileType } from '@/lib/types';
import { VideoPlayer } from '@/components/shared/video-player';

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

  // Auto-select first lecture/recording when data loads
  const activeLecture = lectures.find((l) => l.id === selectedLecture) || lectures[0] || null;
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

  const sortedModules = (modules || []).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const sortedLectures = lectures.sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  return (
    <DashboardLayout>
      {/* Header Banner */}
      <div className="bg-primary rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
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

      {/* Video Player + Playlist Side by Side */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6 sm:mb-8">
        {/* Left: Video Player */}
        <div className="flex-1 min-w-0">
          {playlistTab === 'lectures' && activeLecture ? (
            <VideoPlayer
              key={activeLecture.id}
              lectureId={activeLecture.id}
              videoType={activeLecture.videoType}
              videoUrl={activeLecture.videoUrl}
              videoStatus={activeLecture.videoStatus}
              watermark={email || studentId}
            />
          ) : (
            <div className="aspect-video bg-gray-800 rounded-2xl flex items-center justify-center">
              <div className="text-center">
                <PlayCircle size={64} className="text-accent mx-auto mb-3" />
                <p className="text-white text-sm">
                  {nowPlaying ? nowPlaying.title : 'Select a video'}
                </p>
              </div>
            </div>
          )}
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
                    ? 'bg-primary text-white'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <BookOpen size={20} className={playlistTab === 'lectures' ? 'text-accent' : ''} />
                <span className="text-xs font-bold mt-1.5">Lectures</span>
                <span className={`text-[10px] mt-0.5 ${playlistTab === 'lectures' ? 'text-gray-300' : 'text-gray-400'}`}>
                  {sortedLectures.length} videos
                </span>
              </button>
              <button
                onClick={() => setPlaylistTab('recordings')}
                className={`flex flex-col items-center justify-center py-4 transition-colors ${
                  playlistTab === 'recordings'
                    ? 'bg-primary text-white'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Video size={20} className={playlistTab === 'recordings' ? 'text-accent' : ''} />
                <span className="text-xs font-bold mt-1.5">Class Recordings</span>
                <span className={`text-[10px] mt-0.5 ${playlistTab === 'recordings' ? 'text-gray-300' : 'text-gray-400'}`}>
                  {recordings.length} videos
                </span>
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {playlistTab === 'lectures' ? (
                sortedLectures.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <BookOpen size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">No lectures uploaded yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {sortedLectures.map((lecture, index) => {
                      const isActive = (selectedLecture || sortedLectures[0]?.id) === lecture.id;
                      return (
                        <button
                          key={lecture.id}
                          onClick={() => setSelectedLecture(lecture.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            isActive
                              ? 'bg-primary text-white'
                              : 'hover:bg-gray-50 text-primary'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                              isActive
                                ? 'bg-accent text-primary'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-primary'}`}>
                              {lecture.title}
                            </p>
                            <div className={`flex items-center gap-1 text-xs mt-0.5 ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>
                              <Clock size={10} />
                              {lecture.durationDisplay || `${lecture.duration || 0}s`}
                            </div>
                          </div>
                          {isActive && <PlayCircle size={16} className="text-accent flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                recordings.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <Video size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">No class recordings yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {recordings.map((recording, index) => {
                      const isActive = (selectedRecording || recordings[0]?.id) === recording.id;
                      return (
                        <button
                          key={recording.id}
                          onClick={() => setSelectedRecording(recording.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            isActive
                              ? 'bg-primary text-white'
                              : 'hover:bg-gray-50 text-primary'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                              isActive
                                ? 'bg-accent text-primary'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-primary'}`}>
                              {recording.title}
                            </p>
                            <div className={`flex items-center gap-1 text-xs mt-0.5 ${isActive ? 'text-gray-300' : 'text-gray-400'}`}>
                              <Clock size={10} />
                              {recording.durationDisplay || `${recording.duration}min`} &middot; {recording.scheduledDate}
                            </div>
                          </div>
                          {isActive && <PlayCircle size={16} className="text-accent flex-shrink-0" />}
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
          <h3 className="text-lg font-semibold text-primary mb-2">{nowPlaying.title}</h3>
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
      <div className="bg-white rounded-2xl card-shadow p-6 mt-8">
        <div className="flex items-center gap-3 mb-4">
          <Paperclip size={20} className="text-primary" />
          <h3 className="text-lg font-semibold text-primary">Course Materials</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {materials.length}
          </span>
        </div>
        {materialsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-24" />
            ))}
          </div>
        ) : materials.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No materials uploaded for this course yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {materials.map((material) => {
              const config = fileTypeConfig[material.fileType as MaterialFileType] || fileTypeConfig.other;
              return (
                <div key={material.id} className="border border-gray-100 rounded-xl p-4 flex items-start gap-4">
                  <div className={`w-12 h-12 ${config.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <span className={`text-xs font-bold ${config.textColor}`}>{config.label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-primary truncate">{material.title}</h4>
                    {material.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{material.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      {material.fileSize && <span>{material.fileSize}</span>}
                      {material.uploadDate && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span>{material.uploadDate}</span>
                        </>
                      )}
                      {material.uploadedByName && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span>by {material.uploadedByName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(material.id)}
                    disabled={downloadingId === material.id}
                    className="flex-shrink-0 p-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-60"
                  >
                    {downloadingId === material.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quizzes Section */}
      <div className="bg-white rounded-2xl card-shadow p-6 mt-8">
        <div className="flex items-center gap-3 mb-4">
          <HelpCircle size={20} className="text-primary" />
          <h3 className="text-lg font-semibold text-primary">Quizzes</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {publishedQuizzes.length}
          </span>
        </div>
        {quizzesLoading || myAttemptsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-20" />
            ))}
          </div>
        ) : publishedQuizzes.length === 0 ? (
          <div className="text-center py-8">
            <HelpCircle size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No quizzes available for this course yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {publishedQuizzes.map((quiz) => {
              const quizAttempts = myAttempts.filter((a) => a.quizId === quiz.id && a.status !== 'in_progress');
              const lastAttempt = quizAttempts.length > 0 ? quizAttempts[0] : null;
              const attemptsRemaining = quiz.maxAttempts - quizAttempts.length;
              const canAttempt = attemptsRemaining > 0;

              return (
                <div key={quiz.id} className="border border-gray-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent bg-opacity-30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <HelpCircle size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-primary truncate">{quiz.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{quiz.questionCount} question{quiz.questionCount !== 1 ? 's' : ''}</span>
                      {quiz.timeLimitMinutes && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="flex items-center gap-1"><Clock size={10} />{quiz.timeLimitMinutes} min</span>
                        </>
                      )}
                      <span className="text-gray-300">|</span>
                      <span>Pass: {quiz.passPercentage}%</span>
                    </div>
                    {/* Attempt status */}
                    <div className="mt-1.5">
                      {lastAttempt ? (
                        <div className="flex items-center gap-2">
                          {lastAttempt.passed ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                              <CheckCircle size={12} />
                              Passed ({lastAttempt.percentage != null ? Math.round(lastAttempt.percentage) : 0}%)
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                              <XCircle size={12} />
                              {lastAttempt.percentage != null ? `${Math.round(lastAttempt.percentage)}%` : 'Not passed'}
                            </span>
                          )}
                          {lastAttempt.status === 'submitted' && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                              Pending Review
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            ({quizAttempts.length}/{quiz.maxAttempts} attempts)
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Not attempted</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {canAttempt ? (
                      <Link
                        href={`${basePath}/courses/${courseId}/quizzes/${quiz.id}/take`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/80 transition-colors"
                      >
                        {lastAttempt ? 'Retry' : 'Take Quiz'}
                        <ArrowRight size={12} />
                      </Link>
                    ) : lastAttempt ? (
                      <Link
                        href={`${basePath}/courses/${courseId}/quizzes/${quiz.id}/take`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        View Results
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
