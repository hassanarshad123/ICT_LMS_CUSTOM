'use client';

import type { LectureOut } from '@/lib/api/lectures';
import { formatFileSize } from '@/lib/utils/format';
import { Video, Clock } from 'lucide-react';

export interface UploadExistingLecturesProps {
  lectures: LectureOut[];
  lecturesLoading: boolean;
  onLectureClick: (lectureId: string) => void;
}

function StatusBadge({ status }: { status?: string }) {
  if (status === 'ready') {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
        Ready
      </span>
    );
  }
  if (status === 'processing' || status === 'pending') {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
        Processing
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
        Failed
      </span>
    );
  }
  return null;
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
          {[...lectures]
            .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
            .map((lecture) => (
              <button
                key={lecture.id}
                onClick={() => onLectureClick(lecture.id)}
                className="w-full flex items-center gap-4 p-3 bg-white rounded-xl border border-gray-100 hover:border-primary/30 hover:shadow-sm transition-all text-left"
              >
                {/* Thumbnail */}
                <div className="w-24 h-14 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {lecture.thumbnailUrl ? (
                    <img
                      src={lecture.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video size={18} className="text-gray-300" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {lecture.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                    {lecture.durationDisplay && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {lecture.durationDisplay}
                      </span>
                    )}
                    {lecture.fileSize && (
                      <span>{formatFileSize(lecture.fileSize)}</span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <StatusBadge status={lecture.videoStatus} />
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
