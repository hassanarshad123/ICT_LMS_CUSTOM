'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LectureOut } from '@/lib/api/lectures';
import { formatFileSize } from '@/lib/utils/format';
import { GripVertical, Video, Clock, CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface SortableLectureCardProps {
  lecture: LectureOut;
  onClick: () => void;
}

export default function SortableLectureCard({
  lecture,
  onClick,
}: SortableLectureCardProps) {
  const [imgError, setImgError] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lecture.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white rounded-xl card-shadow hover:shadow-md transition-shadow"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 touch-none"
        tabIndex={-1}
      >
        <GripVertical size={16} />
      </button>

      {/* Thumbnail */}
      <div
        className="w-40 h-[90px] bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer relative"
        onClick={onClick}
      >
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

      {/* Info */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={onClick}
      >
        <p className="text-sm font-medium text-primary truncate">{lecture.title}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          {lecture.fileSize && (
            <span className="flex items-center gap-1">
              {formatFileSize(lecture.fileSize)}
            </span>
          )}
        </div>
        {lecture.videoType === 'external' && (
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
            External
          </span>
        )}
      </div>
    </div>
  );
}
