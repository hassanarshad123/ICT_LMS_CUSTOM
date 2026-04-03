'use client';

import { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  PlayCircle,
  Video,
} from 'lucide-react';
import { VideoPlayer } from '@/components/shared/video-player';
import type { LectureOut } from '@/lib/api/lectures';
import type { ZoomClassOut } from '@/lib/api/zoom';

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
    <div className="w-[100px] h-[56px] sm:w-[120px] sm:h-[68px] rounded-lg overflow-hidden flex-shrink-0 relative bg-gray-100">
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

export interface CourseVideoPlayerProps {
  playlistTab: 'lectures' | 'recordings';
  onPlaylistTabChange: (tab: 'lectures' | 'recordings') => void;
  sortedLectures: LectureOut[];
  recordings: ZoomClassOut[];
  selectedLecture: string | null;
  selectedRecording: string | null;
  onSelectLecture: (id: string) => void;
  onSelectRecording: (id: string) => void;
  activeLecture: LectureOut | null;
  activeRecording: ZoomClassOut | null;
  nowPlaying: NowPlayingInfo | null;
  watermark: string;
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
  return (
    <>
      {/* Lecture / Recording Title Heading */}
      {nowPlaying && !(playlistTab === 'lectures' && activeLecture?.isLocked) && (
        <h2 className="text-xl sm:text-2xl font-bold text-primary mb-3">
          {nowPlaying.title}
        </h2>
      )}

      {/* Video Player + Playlist Side by Side */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 mb-4 sm:mb-8">
        {/* Left: Video Player */}
        <div className="flex-1 min-w-0">
          {playlistTab === 'lectures' && activeLecture ? (
            activeLecture.isLocked ? (
              <div className="aspect-video bg-gray-800 rounded-2xl flex items-center justify-center relative overflow-hidden">
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
          ) : (
            <div className="aspect-video bg-gray-800 rounded-2xl flex items-center justify-center relative overflow-hidden">
              {sortedLectures[0]?.thumbnailUrl && (
                <img
                  src={sortedLectures[0].thumbnailUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm"
                />
              )}
              <div className="text-center relative z-10">
                <PlayCircle size={64} className="text-accent mx-auto mb-3" />
                <p className="text-white text-sm">
                  {nowPlaying ? nowPlaying.title : 'Select a video to start watching'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Playlist with toggle */}
        <div className="w-full lg:w-80 lg:flex-shrink-0 max-h-[60vh] sm:max-h-none">
          <div className="bg-white rounded-2xl card-shadow overflow-hidden h-full flex flex-col">
            {/* Two big toggle buttons */}
            <div className="grid grid-cols-2 gap-0">
              <button
                onClick={() => onPlaylistTabChange('lectures')}
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
                onClick={() => onPlaylistTabChange('recordings')}
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
                          className={`w-full flex items-center gap-3 text-left transition-colors ${
                            hasThumbnail ? 'px-3 py-2.5' : 'px-4 py-3'
                          } ${
                            isLocked
                              ? 'opacity-50 cursor-not-allowed bg-gray-50'
                              : isActive
                                ? 'bg-primary/5 border-l-[3px] border-l-primary'
                                : 'hover:bg-gray-50 text-primary'
                          }`}
                        >
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
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                isLocked
                                  ? 'bg-gray-200 text-gray-400'
                                  : isActive
                                    ? 'bg-accent text-primary'
                                    : isCompleted
                                      ? 'bg-green-100 text-green-600'
                                      : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {isLocked ? <Lock size={12} /> : isCompleted ? <CheckCircle2 size={12} /> : index + 1}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${
                              isLocked ? 'text-gray-400'
                                : isActive ? 'text-primary font-semibold'
                                  : 'text-primary'
                            }`}>
                              {lecture.title}
                            </p>
                            <div className={`flex items-center gap-1 text-xs mt-0.5 ${
                              isActive ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              {!hasThumbnail && <Clock size={10} />}
                              {!hasThumbnail && (lecture.durationDisplay || `${lecture.duration || 0}s`)}
                              {hasThumbnail && isInProgress && lecture.watchPercentage != null && (
                                <span className="text-blue-500 font-medium">{lecture.watchPercentage}% watched</span>
                              )}
                              {!hasThumbnail && isInProgress && lecture.watchPercentage != null && (
                                <span className="ml-1 text-blue-500 font-medium">{lecture.watchPercentage}%</span>
                              )}
                            </div>
                          </div>
                          {!hasThumbnail && (
                            <>
                              {isLocked && <Lock size={14} className="text-gray-300 flex-shrink-0" />}
                              {!isLocked && isActive && <PlayCircle size={16} className="text-primary flex-shrink-0" />}
                              {!isLocked && !isActive && isCompleted && <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />}
                            </>
                          )}
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
                          onClick={() => onSelectRecording(recording.id)}
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
    </>
  );
}
