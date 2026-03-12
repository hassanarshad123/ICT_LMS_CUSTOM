'use client';

import { useState } from 'react';
import { useUpload } from '@/lib/upload-context';
import { Progress } from '@/components/ui/progress';
import { formatFileSize } from '@/lib/utils/format';
import {
  Upload,
  ChevronUp,
  ChevronDown,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export default function UploadIndicator() {
  const { items, activeCount, overallProgress, cancelUpload, removeItem } =
    useUpload();
  const [expanded, setExpanded] = useState(false);

  if (activeCount === 0 && items.length === 0) return null;

  const activeItems = items.filter((i) =>
    ['queued', 'uploading', 'processing'].includes(i.status),
  );

  // Show indicator only when there are active items or recently completed
  if (items.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-100 transition-colors"
      >
        <Upload size={14} className="text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-700 truncate">
            {activeCount > 0
              ? `${activeCount} uploading`
              : `${items.length} completed`}
          </p>
          {activeCount > 0 && (
            <Progress value={overallProgress} className="h-1 mt-1" />
          )}
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="border-t border-gray-200 max-h-48 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 px-3 py-2 text-xs border-b border-gray-100 last:border-0"
            >
              {/* Status icon */}
              {item.status === 'uploading' && (
                <Loader2 size={12} className="animate-spin text-blue-500 flex-shrink-0" />
              )}
              {item.status === 'processing' && (
                <Loader2 size={12} className="animate-spin text-amber-500 flex-shrink-0" />
              )}
              {item.status === 'ready' && (
                <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
              )}
              {(item.status === 'error' || item.status === 'failed') && (
                <AlertCircle size={12} className="text-red-500 flex-shrink-0" />
              )}
              {item.status === 'queued' && (
                <div className="w-3 h-3 rounded-full bg-gray-300 flex-shrink-0" />
              )}
              {item.status === 'cancelled' && (
                <X size={12} className="text-gray-400 flex-shrink-0" />
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-gray-700 truncate">{item.title}</p>
                {item.status === 'uploading' && (
                  <Progress value={item.progress} className="h-0.5 mt-0.5" />
                )}
              </div>

              {/* Action */}
              {(item.status === 'queued' || item.status === 'uploading') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelUpload(item.id);
                  }}
                  className="p-0.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <X size={10} />
                </button>
              )}
              {['ready', 'failed', 'cancelled', 'error'].includes(item.status) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                  className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
