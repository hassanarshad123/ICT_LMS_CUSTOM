'use client';

import { useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';

export interface UploadDropZoneProps {
  canDrop: boolean;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFilesSelected: (files: FileList) => void;
}

export function UploadDropZone({
  canDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onFilesSelected,
}: UploadDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    if (canDrop) fileInputRef.current?.click();
  }, [canDrop]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFilesSelected(e.target.files);
        e.target.value = '';
      }
    },
    [onFilesSelected],
  );

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleClick}
      className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer mb-6 ${
        !canDrop
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
          : isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 bg-white hover:border-primary/50 hover:bg-gray-50'
      }`}
    >
      <Upload
        size={36}
        className={`mx-auto mb-3 ${isDragOver ? 'text-primary' : 'text-gray-400'}`}
      />
      {canDrop ? (
        <>
          <p className="text-sm font-medium text-gray-700">
            Drag & drop your videos here
          </p>
          <p className="text-xs text-gray-500 mt-1">
            or click to browse &middot; MP4, WebM, MOV &middot; up to 10 GB
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-500">
          Select a batch and course first
        </p>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
