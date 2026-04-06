'use client';

import { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  PlayCircle,
  Video,
  Calendar,
} from 'lucide-react';
import { VideoPlayer } from '@/components/shared/video-player';
import type { LectureOut } from '@/lib/api/lectures';
import type { RecordingItem } from '@/lib/api/zoom';
import { getRecordingSignedUrl } from '@/lib/api/zoom';

/* ─── Types ──────────────────────────────────────────────────────── */

interface NowPlayingInfo {
  title: string;
  subtitle: string;
  duration: string;
  date: string;
}

/* ─── Lecture Thumbnail ─────────────────────────────────────────── */

function LectureThumbnail({
  thumbnailUrl,
  index,
  isLocked,
  isCompleted,
  isActive,
  watchPercentage,
  durationDisplay,
}: {
  thumbnailUrl: string;
  index: number;
  isLocked: boolean;
  isCompleted: boolean;
  isActive: boolean;
  watchPercentage?: number;
  durationDisplay?: string;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="w-[120px] h-[68px] sm:w-[160px] sm:h-[90px] rounded-lg overflow-hidden flex-shrink-0 relative bg-gray-100">
      {!imgError ? (
        <img
          src={thumbnailUrl}
          alt=""
          className={`w-full h-full object-cover ${isLocked ? 'grayscale opacity-60' : ''}`}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <Video size={20} className="text-gray-300" />
        </div>
      )}

      {/* Sequence number — top left */}
      <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
        {index + 1}
      </span>

      {/* Duration — bottom right */}
      {durationDisplay && !isLocked && (
        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
          {durationDisplay}
        </span>
      )}

      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Lock size={18} className="text-white/80" />
        </div>
      )}

      {/* Completed badge — bottom right */}
      {isCompleted && !isActive && !isLocked && (
        <div className="absolute bottom-1 right-1 bg-green-500 text-white rounded-full p-0.5">
          <CheckCircle2 size={10} />
        </div>
      )}

      {/* Now playing indicator — bottom left */}
      {isActive && !isLocked && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent h-6 flex items-end px-1.5 pb-1">
          <span className="text-white text-[9px] font-semibold flex items-center gap-0.5">
            <PlayCircle size={9} /> Playing
          </span>
        </div>
      )}

      {/* Watch progress bar — bottom edge */}
      {watchPercentage != null && watchPercentage > 0 && !isCompleted && !isLocked && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/20">
          <div
            className="h-full bg-blue-500 rounded-r-full"
            style={{ width: `${Math.min(watchPercentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── No-thumbnail placeholder ─────────────────────────────────── */

function LecturePlaceholder({
  index,
  isLocked,
  isCompleted,
  isActive,
}: {
  index: number;
  isLocked: boolean;
  isCompleted: boolean;
  isActive: boolean;
}) {
  return (
    <div
      className={`w-[120px] h-[68px] sm:w-[160px] sm:h-[90px] rounded-lg flex-shrink-0 flex items-center justify-center ${
        isLocked
          ? 'bg-gray-200'
          : isActive
            ? 'bg-primary/10'
            : isCompleted
              ? 'bg-green-50'
              : 'bg-gray-100'
      }`}
    >
      {isLocked ? (
        <Lock size={24} className="text-gray-400" />
      ) : isCompleted ? (
        <CheckCircle2 size={24} className="text-green-500" />
      ) : isActive ? (
        <PlayCircle size={24} className="text-primary" />
      ) : (
        <span className="text-lg font-bold text-gray-400">{index + 1}</span>
      )}
    </div>
  );
}

export interface CourseVideoPlayerProps {
  playlistTab: 'lectures' | 'recordings';
  onPlaylistTabChange: (tab: 'lectures' | 'recordings') => void;
  sortedLectures: LectureOut[];
  recordings: RecordingItem[];
  selectedLecture: string | null;
  selectedRecording: string | null;
  onSelectLecture: (id: string) => void;
  onSelectRecording: (id: string) => void;
  activeLecture: LectureOut | null;
  activeRecording: RecordingItem | null;
  nowPlaying: NowPlayingInfo | null;
  watermark?: string;
}

/* ─── Component ──────────────────────────────────────────────────── */

export function CourseVideoPlayer({
  playlistTab,
  onPlaylistTabChange,
  sortedLectures,
  recordings,
  selectedLecture,
  selectedRecording,
  onSelectLecture,
  onSelectRecording,
  activeLecture,
  activeRecording,
  nowPlaying,
  watermark,
}: CourseVideoPlayerProps) {
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // Fetch signed URL when a recording is selected
  const prevRecIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (playlistTab !== 'recordings' || !activeRecording) {
      setRecordingUrl(null);
      return;
    }
    if (prevRecIdRef.current === activeRecording.id) return;
    prevRecIdRef.current = activeRecording.id;

    setRecordingLoading(true);
    setRecordingError(null);
    setRecordingUrl(null);
    getRecordingSignedUrl(activeRecording.id)
      .then((res) => setRecordingUrl(res.url))
      .catch((err) => setRecordingError(err.message || 'Could not load recording'))
      .finally(() => setRecordingLoading(false));
  }, [playlistTab, activeRecording]);

  return (
    <div className="mb-6 sm:mb-8">
      {/* ─── Video Player (full width) ──────────────────────────── */}
      <div className="rounded-xl sm:rounded-2xl overflow-hidden">
        {playlistTab === 'lectures' && activeLecture ? (
          activeLecture.isLocked ? (
            <div className="aspect-video bg-gray-800 flex items-center justify-center relative overflow-hidden">
              {activeLecture.thumbnailUrl && (
                <img
                  src={activeLecture.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm"
                />
              )}
              <div className="text-center px-6 relative z-10">
                <Lock size={48} className="text-gray-400 mx-auto mb-3" />
                <p className="text-white text-sm font-medium mb-1">This lecture is locked</p>
                <p className="text-gray-400 text-xs mb-4">
                  {(() => {
                    const idx = sortedLectures.findIndex(l => l.id === activeLecture.id);
                    const prev = idx > 0 ? sortedLectures[idx - 1] : null;
                    if (prev) {
                      const pct = prev.watchPercentage ?? 0;
                      return (
                        <>
                          Complete &ldquo;{prev.title}&rdquo; {pct > 0 ? `(${pct}% done)` : ''} to unlock this lecture.
                        </>
                      );
                    }
                    return 'Complete the previous lecture to unlock this one.';
                  })()}
                </p>
                {sortedLectures.length > 0 && (
                  <button
                    onClick={() => {
                      const idx = sortedLectures.findIndex(l => l.id === activeLecture.id);
                      if (idx > 0) onSelectLecture(sortedLectures[idx - 1].id);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Go to Previous Lecture
                  </button>
                )}
              </div>
            </div>
          ) : (
            <VideoPlayer
              key={activeLecture.id}
              lectureId={activeLecture.id}
              videoType={activeLecture.videoType}
              videoUrl={activeLecture.videoUrl}
              videoStatus={activeLecture.videoStatus}
              watermark={watermark}
            />
          )
        ) : activeRecording ? (
          <div className="aspect-video bg-black relative">
            {recordingLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {recordingError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white text-sm">{recordingError}</p>
              </div>
            )}
            {recordingUrl && !recordingLoading && (
              <iframe
                src={recordingUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            )}
          </div>
        ) : (
          <div className="aspect-video bg-gray-800 flex items-center justify-center">
            <div className="text-center">
              <Video size={48} className="text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Select a video to start watching</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Now Playing Info (below video, YouTube-style) ───────── */}
      {nowPlaying && !(playlistTab === 'lectures' && activeLecture?.isLocked) && (
        <div className="mt-4 px-1">
          <h2 className="text-lg sm:text-xl font-bold text-primary leading-snug">
            {nowPlaying.title}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-gray-500">
            {nowPlaying.duration && (
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {nowPlaying.duration}
              </span>
            )}
            {nowPlaying.date && (
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {nowPlaying.date}
              </span>
            )}
            {playlistTab === 'lectures' && activeLecture?.watchPercentage != null && activeLecture.watchPercentage > 0 && (
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                {activeLecture.watchPercentage}% watched
              </span>
            )}
          </div>
          {nowPlaying.subtitle && (
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{nowPlaying.subtitle}</p>
          )}
        </div>
      )}

      {/* ─── Playlist Tabs ──────────────────────────────────────── */}
      <div className="flex gap-2 mt-6 mb-4 px-1">
        <button
          onClick={() => onPlaylistTabChange('lectures')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            playlistTab === 'lectures'
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <BookOpen size={16} />
          Lectures ({sortedLectures.length})
        </button>
        <button
          onClick={() => onPlaylistTabChange('recordings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            playlistTab === 'recordings'
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Video size={16} />
          Recordings ({recordings.length})
        </button>
      </div>

      {/* ─── Lecture List (YouTube-style horizontal cards) ───────── */}
      {playlistTab === 'lectures' ? (
        sortedLectures.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No lectures uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sortedLectures.map((lecture, index) => {
              const isActive = (selectedLecture || sortedLectures[0]?.id) === lecture.id;
              const isLocked = lecture.isLocked === true;
              const isCompleted = lecture.progressStatus === 'completed';
              const isInProgress = lecture.progressStatus === 'in_progress';
              const hasThumbnail = !!lecture.thumbnailUrl;

              return (
                <button
                  key={lecture.id}
                  onClick={() => {
                    if (isLocked) return;
                    onSelectLecture(lecture.id);
                  }}
                  disabled={isLocked}
                  className={`w-full flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl text-left transition-colors ${
                    isLocked
                      ? 'opacity-50 cursor-not-allowed'
                      : isActive
                        ? 'bg-primary/5 border-l-[3px] border-l-primary'
                        : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Thumbnail or placeholder */}
                  {hasThumbnail ? (
                    <LectureThumbnail
                      thumbnailUrl={lecture.thumbnailUrl!}
                      index={index}
                      isLocked={isLocked}
                      isCompleted={isCompleted}
                      isActive={isActive}
                      watchPercentage={lecture.watchPercentage ?? undefined}
                      durationDisplay={lecture.durationDisplay || undefined}
                    />
                  ) : (
                    <LecturePlaceholder
                      index={index}
                      isLocked={isLocked}
                      isCompleted={isCompleted}
                      isActive={isActive}
                    />
                  )}

                  {/* Text content — titles wrap, never truncated */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className={`text-sm sm:text-base font-medium leading-snug ${
                      isLocked
                        ? 'text-gray-400'
                        : isActive
                          ? 'text-primary font-semibold'
                          : 'text-primary'
                    }`}>
                      {lecture.title}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-gray-400">
                      {/* Duration */}
                      {lecture.durationDisplay && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {lecture.durationDisplay}
                        </span>
                      )}

                      {/* Status */}
                      {isCompleted && (
                        <span className="flex items-center gap-1 text-green-600 font-medium">
                          <CheckCircle2 size={11} />
                          Completed
                        </span>
                      )}
                      {isInProgress && lecture.watchPercentage != null && (
                        <span className="text-blue-600 font-medium">
                          {lecture.watchPercentage}% watched
                        </span>
                      )}
                      {isLocked && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <Lock size={11} />
                          Locked
                        </span>
                      )}
                      {isActive && !isLocked && !isCompleted && (
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <PlayCircle size={11} />
                          Now Playing
                        </span>
                      )}
                    </div>

                    {/* Progress bar for in-progress lectures */}
                    {isInProgress && lecture.watchPercentage != null && lecture.watchPercentage > 0 && !isLocked && (
                      <div className="mt-2 w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(lecture.watchPercentage, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : (
        /* ─── Recordings List ─────────────────────────────────────── */
        recordings.length === 0 ? (
          <div className="text-center py-12">
            <Video size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No class recordings yet.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recordings.map((recording, index) => {
              const isActive = (selectedRecording || recordings[0]?.id) === recording.id;

              return (
                <button
                  key={recording.id}
                  onClick={() => onSelectRecording(recording.id)}
                  className={`w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl text-left transition-colors ${
                    isActive
                      ? 'bg-primary/5 border-l-[3px] border-l-primary'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Number badge */}
                  <div
                    className={`w-[48px] h-[48px] sm:w-[56px] sm:h-[56px] rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isActive ? (
                      <PlayCircle size={22} />
                    ) : (
                      <span className="text-sm font-bold">{index + 1}</span>
                    )}
                  </div>

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm sm:text-base font-medium leading-snug ${
                      isActive ? 'text-primary font-semibold' : 'text-primary'
                    }`}>
                      {recording.title || recording.classTitle}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-gray-400">
                      {recording.duration && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {recording.duration}min
                        </span>
                      )}
                      {recording.scheduledDate && (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {recording.scheduledDate}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
