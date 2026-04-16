'use client';

import { useState, useRef, useEffect } from 'react';
import { Palette, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { isValidHex } from '@/lib/utils/color-convert';

const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

const PRESET_THEMES: Record<string, { primary: string; accent: string; background: string; label: string }> = {
  midnight: { primary: '#1A1A2E', accent: '#E94560', background: '#F5F5F5', label: 'Midnight' },
  ocean: { primary: '#0A2647', accent: '#2C74B3', background: '#F0F7FF', label: 'Ocean' },
  forest: { primary: '#1B4332', accent: '#52B788', background: '#F0FFF4', label: 'Forest' },
  sunset: { primary: '#6B2737', accent: '#F4845F', background: '#FFF5F2', label: 'Sunset' },
  royal: { primary: '#2D1B69', accent: '#7B68EE', background: '#F5F3FF', label: 'Royal' },
  earth: { primary: '#3D2B1F', accent: '#C5A55A', background: '#FFFBF0', label: 'Earth' },
};

interface StepBrandingProps {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  tagline: string;
  logoFile: File | null;
  logoPreview: string | null;
  onPrimaryChange: (v: string) => void;
  onAccentChange: (v: string) => void;
  onBackgroundChange: (v: string) => void;
  onTaglineChange: (v: string) => void;
  onLogoChange: (file: File | null, preview: string | null) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function StepBranding({
  primaryColor,
  accentColor,
  backgroundColor,
  tagline,
  logoFile,
  logoPreview,
  onPrimaryChange,
  onAccentChange,
  onBackgroundChange,
  onTaglineChange,
  onLogoChange,
  onSubmit,
  submitting,
}: StepBrandingProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const handlePresetSelect = (key: string) => {
    const theme = PRESET_THEMES[key];
    setSelectedPreset(key);
    onPrimaryChange(theme.primary);
    onAccentChange(theme.accent);
    onBackgroundChange(theme.background);
  };

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
    <div className="space-y-6">
      {/* Preset Themes */}
      <div>
        <h3 className="text-sm font-medium text-zen-dark mb-3 flex items-center gap-2">
          <Palette size={16} />
          Quick Start — Pick a theme
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {Object.entries(PRESET_THEMES).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => handlePresetSelect(key)}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                selectedPreset === key
                  ? 'border-zen-purple bg-zen-purple/5'
                  : 'border-gray-100 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: theme.primary }} />
                <div className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: theme.accent }} />
                <div className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: theme.background }} />
              </div>
              <p className="text-xs font-medium text-gray-700">{theme.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Colors */}
      <div>
        <h3 className="text-sm font-medium text-zen-dark mb-3">Or customize</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ColorField label="Primary" value={primaryColor} onChange={(v) => { onPrimaryChange(v); setSelectedPreset(null); }} />
          <ColorField label="Accent" value={accentColor} onChange={(v) => { onAccentChange(v); setSelectedPreset(null); }} />
          <ColorField label="Background" value={backgroundColor} onChange={(v) => { onBackgroundChange(v); setSelectedPreset(null); }} />
        </div>
      </div>

      {/* Logo Upload */}
      <div>
        <h3 className="text-sm font-medium text-zen-dark mb-3 flex items-center gap-2">
          <ImageIcon size={16} />
          Logo (optional)
        </h3>
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
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
          >
            <Upload size={20} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">Drop logo here or click to upload</p>
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
        <label className="block text-sm font-medium text-zen-dark mb-1.5">Tagline (optional)</label>
        <input
          type="text"
          value={tagline}
          onChange={(e) => onTaglineChange(e.target.value)}
          placeholder="e.g. Empowering learners worldwide"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-zen-purple transition-colors bg-gray-50"
        />
      </div>

      {/* Live Preview */}
      <div>
        <h3 className="text-sm font-medium text-zen-dark mb-3">Preview</h3>
        <div
          className="rounded-xl border border-gray-200 overflow-hidden"
          style={{ backgroundColor }}
        >
          {/* Mock sidebar */}
          <div className="flex">
            <div className="w-14 sm:w-20 min-h-[160px] flex flex-col items-center py-4 gap-3" style={{ backgroundColor: primaryColor }}>
              {logoPreview ? (
                <img src={logoPreview} alt="" className="w-8 h-8 rounded-lg object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-white/20" />
              )}
              <div className="w-6 h-1 rounded bg-white/40" />
              <div className="w-6 h-1 rounded bg-white/20" />
              <div className="w-6 h-1 rounded bg-white/20" />
            </div>
            {/* Mock content */}
            <div className="flex-1 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-16 rounded" style={{ backgroundColor: primaryColor, opacity: 0.7 }} />
                <div className="ml-auto h-6 w-16 rounded-full text-white text-[9px] flex items-center justify-center font-medium" style={{ backgroundColor: accentColor }}>
                  Badge
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-lg p-2 border border-gray-100">
                    <div className="h-1.5 w-10 rounded bg-gray-200 mb-1" />
                    <div className="h-1 w-8 rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 bg-zen-dark text-white hover:bg-zen-darkest disabled:opacity-50"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
        {submitting ? 'Creating your LMS...' : 'Create My LMS'}
      </button>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const handleTextChange = (v: string) => {
    setText(v);
    if (isValidHex(v)) onChange(v.toUpperCase());
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          maxLength={7}
          className={`flex-1 px-2 py-1.5 rounded-lg border text-xs font-mono ${
            isValidHex(text) ? 'border-gray-200' : 'border-red-300'
          } focus:outline-none focus:border-zen-purple transition-colors`}
        />
      </div>
    </div>
  );
}
