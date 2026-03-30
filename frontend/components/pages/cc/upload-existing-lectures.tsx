'use client';

import { useState } from 'react';
import type { LectureOut } from '@/lib/api/lectures';
import { formatFileSize } from '@/lib/utils/format';
import { Video, CheckCircle2, Loader2, XCircle } from 'lucide-react';

export interface UploadExistingLecturesProps {
  lectures: LectureOut[];
  lecturesLoading: boolean;
  onLectureClick: (lectureId: string) => void;
}

function LectureThumbnailCard({ lecture }: { lecture: LectureOut }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="w-40 h-[90px] bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
      {lecture.thumbnailUrl && !imgError ? (
        <img
          src={lecture.thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Video size={24} className="text-gray-300" />
        </div>
      )}

      {/* Duration pill — bottom right */}
      {lecture.durationDisplay && (
        <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
          {lecture.durationDisplay}
        </span>
      )}

      {/* Status overlay — top right */}
      {lecture.videoStatus === 'ready' && (
        <span className="absolute top-1.5 right-1.5 bg-green-500 rounded-full p-0.5">
          <CheckCircle2 size={10} className="text-white" />
        </span>
      )}
      {(lecture.videoStatus === 'processing' || lecture.videoStatus === 'pending') && (
        <span className="absolute top-1.5 right-1.5 bg-amber-500 rounded-full p-1">
          <Loader2 size={10} className="animate-spin text-white" />
        </span>
      )}
      {lecture.videoStatus === 'failed' && (
        <span className="absolute top-1.5 right-1.5 bg-red-500 rounded-full p-0.5">
          <XCircle size={10} className="text-white" />
        </span>
      )}
    </div>
  );
}

export function UploadExistingLectures({
  lectures,
  lecturesLoading,
  onLectureClick,
}: UploadExistingLecturesProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-4">
        Existing Lectures ({lectures.length})
      </h2>
      {lecturesLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
        </div>
      ) : lectures.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
          <Video size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            No lectures yet. Upload your first video above.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...(lectures || [])]
            .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
            .map((lecture) => (
              <button
                key={lecture.id}
                onClick={() => onLectureClick(lecture.id)}
                className="w-full flex items-center gap-4 p-3 bg-white rounded-xl border border-gray-100 hover:border-primary/30 hover:shadow-sm transition-all text-left"
              >
                <LectureThumbnailCard lecture={lecture} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {lecture.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    {lecture.fileSize && (
                      <span>{formatFileSize(lecture.fileSize)}</span>
                    )}
                  </div>
                  {lecture.videoType === 'external' && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                      External
                    </span>
                  )}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
