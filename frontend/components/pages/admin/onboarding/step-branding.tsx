'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Palette } from 'lucide-react';
import { updateBranding, uploadLogo } from '@/lib/api/branding';
import { useMutation } from '@/hooks/use-api';

interface StepBrandingProps {
  onNext: () => void;
  onSkip: () => void;
}

export default function StepBranding({ onNext, onSkip }: StepBrandingProps) {
  const [instituteName, setInstituteName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1A1A1A');
  const [accentColor, setAccentColor] = useState('#C5D86D');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { execute: saveBranding, loading: savingBranding } = useMutation(
    (data: { instituteName?: string; primaryColor?: string; accentColor?: string }) =>
      updateBranding(data),
  );
  const { execute: doUploadLogo, loading: uploadingLogo } = useMutation(
    (file: File) => uploadLogo(file),
  );

  const saving = savingBranding || uploadingLogo;

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      if (logoFile) {
        await doUploadLogo(logoFile);
      }
      const updates: Record<string, string> = {};
      if (instituteName.trim()) updates.instituteName = instituteName.trim();
      if (primaryColor) updates.primaryColor = primaryColor;
      if (accentColor) updates.accentColor = accentColor;
      if (Object.keys(updates).length > 0) {
        await saveBranding(updates);
      }
      toast.success('Branding saved');
      onNext();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save branding');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
          <Palette size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-primary">Set Up Your Brand</h2>
          <p className="text-sm text-gray-500">Customize how your institute looks</p>
        </div>
      </div>

      {/* Institute Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Institute Name
        </label>
        <input
          type="text"
          value={instituteName}
          onChange={(e) => setInstituteName(e.target.value)}
          placeholder="e.g. ICT Academy"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        />
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Primary Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Accent Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {/* Logo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Logo
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-gray-300 transition-colors"
        >
          {logoPreview ? (
            <img
              src={logoPreview}
              alt="Logo preview"
              className="h-16 mx-auto object-contain"
            />
          ) : (
            <>
              <Upload size={24} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">Click to upload your logo</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onSkip}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Skip this step
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          Save & Continue
        </button>
      </div>
    </div>
  );
}
