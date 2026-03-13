'use client';

import { RefObject } from 'react';
import {
  Palette, Upload, Type, Image as ImageIcon, Loader2,
} from 'lucide-react';
import { PresetThemes } from '@/lib/api/branding';
import { ColorPicker } from './branding-color-picker';

export interface FormState {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  instituteName: string;
  tagline: string;
  logoUrl: string | null;
  presetTheme: string | null;
}

export interface BrandingFormProps {
  form: FormState;
  themes: PresetThemes;
  themeLabels: Record<string, string>;
  logoPreview: string | null;
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onUpdateField: (field: keyof FormState, value: string | null) => void;
  onSelectPreset: (key: string) => void;
  onLogoUpload: (file: File) => void;
  onRemoveLogo: () => void;
  onDrop: (e: React.DragEvent) => void;
}

export function BrandingForm({
  form,
  themes,
  themeLabels,
  logoPreview,
  uploading,
  fileInputRef,
  onUpdateField,
  onSelectPreset,
  onLogoUpload,
  onRemoveLogo,
  onDrop,
}: BrandingFormProps) {
  return (
    <>
      {/* Preset Themes */}
      <div className="bg-white rounded-2xl p-6 card-shadow">
        <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
          <Palette size={18} />
          Preset Themes
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(themes).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => onSelectPreset(key)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                form.presetTheme === key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-100 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: theme.primary }} />
                <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: theme.accent }} />
                <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: theme.background }} />
              </div>
              <p className="text-sm font-medium text-gray-800">{themeLabels[key] || key}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Colors */}
      <div className="bg-white rounded-2xl p-6 card-shadow">
        <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
          <Palette size={18} />
          Custom Colors
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ColorPicker
            label="Primary Color"
            description="Sidebar, buttons, headings"
            value={form.primaryColor}
            onChange={(v) => onUpdateField('primaryColor', v)}
          />
          <ColorPicker
            label="Accent Color"
            description="Highlights, badges, active states"
            value={form.accentColor}
            onChange={(v) => onUpdateField('accentColor', v)}
          />
          <ColorPicker
            label="Background Color"
            description="Page background"
            value={form.backgroundColor}
            onChange={(v) => onUpdateField('backgroundColor', v)}
          />
        </div>
      </div>

      {/* Logo Upload */}
      <div className="bg-white rounded-2xl p-6 card-shadow">
        <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
          <ImageIcon size={18} />
          Logo
        </h2>
        {logoPreview ? (
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl border border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
              <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Logo uploaded</p>
              <button
                onClick={onRemoveLogo}
                className="text-sm text-red-500 hover:text-red-700 font-medium mt-1"
              >
                Remove logo
              </button>
            </div>
          </div>
        ) : (
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
          >
            {uploading ? (
              <Loader2 size={24} className="mx-auto text-gray-400 animate-spin mb-2" />
            ) : (
              <Upload size={24} className="mx-auto text-gray-400 mb-2" />
            )}
            <p className="text-sm text-gray-600">
              {uploading ? 'Uploading...' : 'Drop logo here or click to upload'}
            </p>
            <p className="text-xs text-gray-400 mt-1">PNG, SVG, JPG, WebP — max 2MB</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.svg,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onLogoUpload(file);
          }}
        />
      </div>

      {/* Institute Identity */}
      <div className="bg-white rounded-2xl p-6 card-shadow">
        <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
          <Type size={18} />
          Institute Identity
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Institute Name</label>
            <input
              type="text"
              value={form.instituteName}
              onChange={(e) => onUpdateField('instituteName', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
              placeholder="e.g. ICT Institute"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tagline / Subtitle</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => onUpdateField('tagline', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
              placeholder="e.g. Learning Management System"
            />
          </div>
        </div>
      </div>
    </>
  );
}
