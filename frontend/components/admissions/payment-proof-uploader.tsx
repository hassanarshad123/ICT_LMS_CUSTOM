'use client';

import { useState, useCallback } from 'react';
import { Upload, X, Check, Loader2, FileText } from 'lucide-react';
import { getPaymentProofUploadUrl } from '@/lib/api/admissions';
import { toast } from 'sonner';

interface PaymentProofValue {
  objectKey: string;
  viewUrl: string;
  fileName: string;
  fileType: string;
}

interface PaymentProofUploaderProps {
  /** Client-generated UUID used only as the S3 object-key namespace. */
  feePlanId: string;
  value: PaymentProofValue | null;
  onChange: (v: PaymentProofValue | null) => void;
  disabled?: boolean;
}

export default function PaymentProofUploader({
  feePlanId,
  value,
  onChange,
  disabled,
}: PaymentProofUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File must be under 10 MB');
        return;
      }
      const allowedPrefixes = ['image/'];
      const allowedExact = ['application/pdf'];
      const ct = file.type || 'application/octet-stream';
      if (
        !allowedPrefixes.some((p) => ct.startsWith(p)) &&
        !allowedExact.includes(ct)
      ) {
        toast.error('Only images or PDF files are supported');
        return;
      }
      setUploading(true);
      try {
        // 1) Ask LMS for a presigned PUT URL
        const { uploadUrl, objectKey, viewUrl } = await getPaymentProofUploadUrl({
          fileName: file.name,
          contentType: ct,
          feePlanId,
        });
        // 2) PUT the bytes directly to S3 (raw fetch, not apiClient)
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': ct },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`S3 upload failed: ${putRes.status}`);
        }
        onChange({ objectKey, viewUrl, fileName: file.name, fileType: ct });
        toast.success('Payment proof uploaded');
      } catch (e: any) {
        toast.error(e?.message ?? 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [feePlanId, onChange],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    // Reset so picking the same file twice fires change
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || uploading) return;
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  if (value) {
    const isImage = value.fileType.startsWith('image/');
    return (
      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex items-start gap-3">
        <div className="w-20 h-20 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden flex-none">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.viewUrl} alt="Payment proof" className="w-full h-full object-cover" />
          ) : (
            <FileText className="h-8 w-8 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary truncate">{value.fileName}</p>
          <p className="text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1">
            <Check className="h-3 w-3 text-emerald-600" /> Uploaded
          </p>
          <a
            href={value.viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline mt-1 inline-block"
          >
            View
          </a>
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
      className={`block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
        ${
          disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
            : 'border-gray-300 bg-white hover:border-primary hover:bg-gray-50'
        }`}
    >
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={onInputChange}
        disabled={disabled || uploading}
        className="hidden"
      />
      {uploading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <Upload className="h-6 w-6" />
          <p className="text-sm font-medium">Click or drag a payment screenshot here</p>
          <p className="text-xs">JPG/PNG/PDF, up to 10 MB</p>
        </div>
      )}
    </label>
  );
}
