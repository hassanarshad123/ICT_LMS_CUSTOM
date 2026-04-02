'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getUploadUrl } from '@/lib/api/feedback';

interface UploadedFile {
  objectKey: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  previewUrl: string;
}

interface ScreenshotUploadProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default function ScreenshotUpload({ files, onChange, maxFiles = 2 }: ScreenshotUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const remaining = maxFiles - files.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${maxFiles} screenshots allowed`);
      return;
    }

    const toUpload = Array.from(fileList).slice(0, remaining);
    const newFiles: UploadedFile[] = [];

    setUploading(true);
    for (const file of toUpload) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Only PNG, JPEG, and WebP images allowed`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: File must be under 5MB`);
        continue;
      }

      try {
        const { uploadUrl, objectKey } = await getUploadUrl(file.name, file.type, file.size);

        const uploadResp = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        if (!uploadResp.ok) throw new Error('Upload failed');

        newFiles.push({
          objectKey,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          previewUrl: URL.createObjectURL(file),
        });
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);

    if (newFiles.length > 0) {
      onChange([...files, ...newFiles]);
    }
  }, [files, maxFiles, onChange]);

  const handleRemove = (index: number) => {
    URL.revokeObjectURL(files[index].previewUrl);
    onChange(files.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      {/* Drop zone */}
      {files.length < maxFiles && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          {uploading ? (
            <Loader2 size={24} className="mx-auto text-gray-400 animate-spin" />
          ) : (
            <Upload size={24} className="mx-auto text-gray-400" />
          )}
          <p className="text-xs text-gray-500 mt-1">
            {uploading ? 'Uploading...' : 'Drag & drop or click (max 2, 5MB each)'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Thumbnails */}
      {files.length > 0 && (
        <div className="flex gap-2 mt-2">
          {files.map((file, i) => (
            <div key={file.objectKey} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
              <img src={file.previewUrl} alt={file.fileName} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { UploadedFile };
