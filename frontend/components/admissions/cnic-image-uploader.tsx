'use client';

import { useState, useCallback } from 'react';
import { Upload, X, Check, Loader2 } from 'lucide-react';
import { uploadCnicImage } from '@/lib/api/admissions';
import { toast } from 'sonner';

export interface CnicImageValue {
  objectKey: string;
  viewUrl: string;
  fileName: string;
  fileType: string;
}

interface CnicImageUploaderProps {
  label: string;
  value: CnicImageValue | null;
  onChange: (v: CnicImageValue | null) => void;
  disabled?: boolean;
}

export default function CnicImageUploader({
  label,
  value,
  onChange,
  disabled,
}: CnicImageUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File must be under 10 MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Only image files are supported');
        return;
      }
      setUploading(true);
      try {
        const { objectKey, viewUrl } = await uploadCnicImage({ file });
        onChange({ objectKey, viewUrl, fileName: file.name, fileType: file.type });
      } catch (e: any) {
        toast.error(e?.message ?? 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  if (value) {
    return (
      <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 flex items-start gap-3">
        <div className="w-16 h-16 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden flex-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.viewUrl} alt={label} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary truncate">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1">
            <Check className="h-3 w-3 text-emerald-600" /> Uploaded
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
          aria-label="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <label
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
        ${disabled ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                   : 'border-gray-300 bg-white hover:border-primary hover:bg-gray-50'}`}
    >
      <input
        type="file"
        accept="image/*"
        onChange={onInputChange}
        disabled={disabled || uploading}
        className="hidden"
      />
      {uploading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 text-gray-500">
          <Upload className="h-5 w-5" />
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs">JPG/PNG, up to 10 MB</p>
        </div>
      )}
    </label>
  );
}
