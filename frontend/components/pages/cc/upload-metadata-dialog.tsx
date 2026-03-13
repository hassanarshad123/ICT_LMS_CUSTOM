'use client';

import { Video, X } from 'lucide-react';
import { formatFileSize } from '@/lib/utils/format';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export interface PendingFile {
  file: File;
  title: string;
  description: string;
}

export interface UploadMetadataDialogProps {
  open: boolean;
  pendingFiles: PendingFile[];
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onUpdateFile: (index: number, field: 'title' | 'description', value: string) => void;
  onRemoveFile: (index: number) => void;
}

export function UploadMetadataDialog({
  open,
  pendingFiles,
  onOpenChange,
  onConfirm,
  onUpdateFile,
  onRemoveFile,
}: UploadMetadataDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {pendingFiles.length === 1
              ? 'Video Details'
              : `Video Details (${pendingFiles.length} files)`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {pendingFiles.map((pf, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gray-200 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Video size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500 truncate">
                    {pf.file.name} &middot; {formatFileSize(pf.file.size)}
                  </span>
                </div>
                {pendingFiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveFile(idx)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={pf.title}
                  onChange={(e) => onUpdateFile(idx, 'title', e.target.value)}
                  placeholder="Enter video title"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Description <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={pf.description}
                  onChange={(e) => onUpdateFile(idx, 'description', e.target.value)}
                  placeholder="Brief description of this lecture"
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pendingFiles.some((pf) => !pf.title.trim())}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pendingFiles.length === 1 ? 'Upload' : `Upload ${pendingFiles.length} Videos`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
