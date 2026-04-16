'use client';

import { useRef } from 'react';
import { Upload, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

interface StepCustomizeProps {
  logoFile: File | null;
  logoPreview: string | null;
  tagline: string;
  onLogoChange: (file: File | null, preview: string | null) => void;
  onTaglineChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepCustomize({
  logoFile,
  logoPreview,
  tagline,
  onLogoChange,
  onTaglineChange,
  onNext,
  onBack,
}: StepCustomizeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (file: File) => {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error('Please upload a PNG, JPG, WebP, or SVG image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB. Please choose a smaller file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string | undefined;
      if (!result) {
        toast.error('Could not read the file. Please try another.');
        return;
      }
      onLogoChange(file, result);
    };
    reader.onerror = () => {
      toast.error('Could not read the file. It may be corrupted — please try another.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleLogoUpload(file);
  };

  return (
    <div className="space-y-5">
      <div>
        <button onClick={onBack} className="text-sm text-zen-purple hover:underline mb-3 inline-block">
          &larr; Back
        </button>
        <h2 className="text-xl font-semibold text-zen-dark">Make It Yours</h2>
        <p className="text-sm text-gray-500 mt-1">Add your logo and a tagline. Both are optional — you can update them later.</p>
      </div>

      {/* Logo Upload */}
      <div>
        <label className="block text-sm font-medium text-zen-dark mb-1.5">
          <span className="flex items-center gap-1.5"><ImageIcon size={14} /> Logo</span>
        </label>
        {logoPreview ? (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
              <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
            </div>
            <button
              onClick={() => onLogoChange(null, null)}
              className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
              Remove
            </button>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
          >
            <Upload size={20} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">Drop your logo here or click to upload</p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP — max 2MB</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.svg,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleLogoUpload(file);
          }}
        />
      </div>

      {/* Tagline */}
      <div>
        <label className="block text-sm font-medium text-zen-dark mb-1.5">Tagline</label>
        <input
          type="text"
          value={tagline}
          onChange={(e) => onTaglineChange(e.target.value)}
          placeholder="e.g. Empowering learners worldwide"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-zen-purple transition-colors bg-gray-50"
        />
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 bg-zen-dark text-white hover:bg-zen-darkest"
      >
        Continue
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
