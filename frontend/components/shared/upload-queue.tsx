'use client';

import { useUpload, UploadItem, UploadStatus } from '@/lib/upload-context';
import { formatFileSize } from '@/lib/utils/format';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  X,
  RotateCw,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  Ban,
  Pencil,
} from 'lucide-react';

const statusConfig: Record<
  UploadStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
  queued: {
    label: 'Queued',
    variant: 'secondary',
    icon: <Clock size={12} />,
  },
  uploading: {
    label: 'Uploading',
    variant: 'default',
    icon: <Loader2 size={12} className="animate-spin" />,
  },
  processing: {
    label: 'Processing',
    variant: 'outline',
    icon: <Loader2 size={12} className="animate-spin" />,
  },
  ready: {
    label: 'Ready',
    variant: 'default',
    icon: <CheckCircle2 size={12} />,
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
    icon: <AlertCircle size={12} />,
  },
  error: {
    label: 'Error',
    variant: 'destructive',
    icon: <AlertCircle size={12} />,
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'secondary',
    icon: <Ban size={12} />,
  },
};

function QueueItem({ item, onEdit }: { item: UploadItem; onEdit?: (lectureId: string) => void }) {
  const { cancelUpload, retryUpload, removeItem } = useUpload();
  const cfg = statusConfig[item.status];

  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {formatFileSize(item.file.size)} &middot; {item.courseName}
        </p>

        {item.status === 'uploading' && (
          <div className="mt-2">
            <Progress value={item.progress} className="h-1.5" />
            <p className="text-xs text-blue-600 mt-1">{item.progress}%</p>
          </div>
        )}

        {item.status === 'processing' && (
          <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" />
            Encoding video...
          </p>
        )}

        {item.error && (
          <p className="text-xs text-red-600 mt-1 truncate">{item.error}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Badge
          variant={cfg.variant}
          className={`text-[10px] gap-1 ${
            item.status === 'ready'
              ? 'bg-green-100 text-green-700 hover:bg-green-100'
              : item.status === 'processing'
                ? 'border-amber-300 text-amber-700'
                : ''
          }`}
        >
          {cfg.icon}
          {cfg.label}
        </Badge>

        {(item.status === 'error' || item.status === 'failed') && (
          <button
            onClick={() => retryUpload(item.id)}
            className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
            title="Retry"
          >
            <RotateCw size={14} />
          </button>
        )}

        {(item.status === 'queued' || item.status === 'uploading') && (
          <button
            onClick={() => cancelUpload(item.id)}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title="Cancel"
          >
            <X size={14} />
          </button>
        )}

        {item.status === 'ready' && item.lectureId && onEdit && (
          <button
            onClick={() => onEdit(item.lectureId!)}
            className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
            title="Edit title & description"
          >
            <Pencil size={14} />
          </button>
        )}

        {['ready', 'failed', 'cancelled', 'error'].includes(item.status) && (
          <button
            onClick={() => removeItem(item.id)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            title="Remove"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

interface UploadQueueProps {
  batchId?: string;
  courseId?: string;
  onEditLecture?: (lectureId: string) => void;
}

export default function UploadQueue({ batchId, courseId, onEditLecture }: UploadQueueProps) {
  const { items, clearCompleted } = useUpload();

  const filtered = items.filter((i) => {
    if (batchId && i.batchId !== batchId) return false;
    if (courseId && i.courseId !== courseId) return false;
    return true;
  });

  if (filtered.length === 0) return null;

  const hasCompleted = filtered.some((i) =>
    ['ready', 'failed', 'cancelled', 'error'].includes(i.status),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Upload Queue ({filtered.length})
        </h3>
        {hasCompleted && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCompleted}
            className="text-xs text-gray-500"
          >
            Clear completed
          </Button>
        )}
      </div>
      <ScrollArea className={filtered.length > 5 ? 'h-[360px]' : ''}>
        <div className="space-y-2">
          {filtered.map((item) => (
            <QueueItem key={item.id} item={item} onEdit={onEditLecture} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
