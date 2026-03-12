'use client';

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

  const statusIcon = () => {
    if (lecture.videoStatus === 'ready')
      return <CheckCircle2 size={14} className="text-green-500" />;
    if (lecture.videoStatus === 'processing' || lecture.videoStatus === 'pending')
      return <Loader2 size={14} className="animate-spin text-amber-500" />;
    if (lecture.videoStatus === 'failed')
      return <XCircle size={14} className="text-red-500" />;
    return null;
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
        className="w-20 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
        onClick={onClick}
      >
        {lecture.thumbnailUrl ? (
          <img
            src={lecture.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video size={14} className="text-gray-300" />
          </div>
        )}
      </div>

      {/* Info */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={onClick}
      >
        <p className="text-sm font-medium text-primary truncate">{lecture.title}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
          {lecture.durationDisplay && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {lecture.durationDisplay}
            </span>
          )}
          {lecture.fileSize && <span>{formatFileSize(lecture.fileSize)}</span>}
        </div>
      </div>

      {/* Status */}
      <div className="flex-shrink-0">{statusIcon()}</div>
    </div>
  );
}
