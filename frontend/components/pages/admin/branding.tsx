'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  Palette, Upload, X, Check, Eye, Type, Image as ImageIcon,
  GraduationCap, Home, Users, Settings, LogOut, Loader2, RotateCcw
} from 'lucide-react';
import { useBranding } from '@/lib/branding-context';
import { updateBranding, uploadLogo, getPresetThemes, PresetThemes } from '@/lib/api/branding';
import { useMutation } from '@/hooks/use-api';
import { isValidHex, getContrastColor } from '@/lib/utils/color-convert';
import DashboardLayout from '@/components/layout/dashboard-layout';

interface FormState {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  instituteName: string;
  tagline: string;
  logoUrl: string | null;
  presetTheme: string | null;
}

const DEFAULT_THEMES: PresetThemes = {
  default:      { primary: '#1A1A1A', accent: '#C5D86D', background: '#F0F0F0' },
  ocean_blue:   { primary: '#0F2B46', accent: '#38BDF8', background: '#F0F4F8' },
  royal_purple: { primary: '#2D1B4E', accent: '#A78BFA', background: '#F5F0FF' },
  forest_green: { primary: '#1A2E1A', accent: '#4ADE80', background: '#F0F5F0' },
  warm_orange:  { primary: '#2D1A0E', accent: '#FB923C', background: '#FFF7F0' },
  classic_red:  { primary: '#2D1A1A', accent: '#F87171', background: '#FFF0F0' },
};

const THEME_LABELS: Record<string, string> = {
  default: 'Default',
  ocean_blue: 'Ocean Blue',
  royal_purple: 'Royal Purple',
  forest_green: 'Forest Green',
  warm_orange: 'Warm Orange',
  classic_red: 'Classic Red',
};

export default function BrandingPage() {
  const branding = useBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [themes, setThemes] = useState<PresetThemes>(DEFAULT_THEMES);

  const [form, setForm] = useState<FormState>({
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor,
    backgroundColor: branding.backgroundColor,
    instituteName: branding.instituteName,
    tagline: branding.tagline,
    logoUrl: branding.logoUrl,
    presetTheme: branding.presetTheme,
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(branding.logoUrl);
  const [uploading, setUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync form when branding context loads
  useEffect(() => {
    if (!branding.loading) {
      setForm({
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
        backgroundColor: branding.backgroundColor,
        instituteName: branding.instituteName,
        tagline: branding.tagline,
        logoUrl: branding.logoUrl,
        presetTheme: branding.presetTheme,
      });
      setLogoPreview(branding.logoUrl);
    }
  }, [branding.loading]);

  // Load preset themes from API
  useEffect(() => {
    getPresetThemes().then(setThemes).catch(() => {});
  }, []);

  // Track changes
  useEffect(() => {
    const changed =
      form.primaryColor !== branding.primaryColor ||
      form.accentColor !== branding.accentColor ||
      form.backgroundColor !== branding.backgroundColor ||
      form.instituteName !== branding.instituteName ||
      form.tagline !== branding.tagline ||
      form.logoUrl !== branding.logoUrl ||
      form.presetTheme !== branding.presetTheme;
    setHasChanges(changed);
  }, [form, branding]);

  const { execute: saveBranding, loading: saving } = useMutation(async () => {
    await updateBranding({
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      backgroundColor: form.backgroundColor,
      instituteName: form.instituteName,
      tagline: form.tagline,
      logoUrl: form.logoUrl,
      presetTheme: form.presetTheme,
    });
    await branding.refetch();
    toast.success('Branding saved successfully');
  });

  const updateField = (field: keyof FormState, value: string | null) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const selectPreset = (key: string) => {
    const theme = themes[key];
    if (!theme) return;
    setForm(prev => ({
      ...prev,
      primaryColor: theme.primary,
      accentColor: theme.accent,
      backgroundColor: theme.background,
      presetTheme: key,
    }));
  };

  const handleLogoUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }

    const allowed = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PNG, SVG, JPG, WebP files are allowed');
      return;
    }

    setUploading(true);
    try {
      const { logoUrl: dataUrl } = await uploadLogo(file);
      updateField('logoUrl', dataUrl);
      setLogoPreview(dataUrl);
      toast.success('Logo uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Logo upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    updateField('logoUrl', null);
    setLogoPreview(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleLogoUpload(file);
  };

  const resetToDefaults = () => {
    const defaultTheme = themes.default || DEFAULT_THEMES.default;
    setForm({
      primaryColor: defaultTheme.primary,
      accentColor: defaultTheme.accent,
      backgroundColor: defaultTheme.background,
      instituteName: 'ICT Institute',
      tagline: 'Learning Management System',
      logoUrl: null,
      presetTheme: 'default',
    });
    setLogoPreview(null);
  };

  return (
    <DashboardLayout>
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Branding</h1>
          <p className="text-gray-500 text-sm mt-1">Customize the look and feel of your LMS</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button
            onClick={saveBranding}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/80 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — settings */}
        <div className="lg:col-span-2 space-y-6">
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
                  onClick={() => selectPreset(key)}
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
                  <p className="text-sm font-medium text-gray-800">{THEME_LABELS[key] || key}</p>
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
                onChange={(v) => updateField('primaryColor', v)}
              />
              <ColorPicker
                label="Accent Color"
                description="Highlights, badges, active states"
                value={form.accentColor}
                onChange={(v) => updateField('accentColor', v)}
              />
              <ColorPicker
                label="Background Color"
                description="Page background"
                value={form.backgroundColor}
                onChange={(v) => updateField('backgroundColor', v)}
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
                    onClick={removeLogo}
                    className="text-sm text-red-500 hover:text-red-700 font-medium mt-1"
                  >
                    Remove logo
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
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
                if (file) handleLogoUpload(file);
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
                  onChange={(e) => updateField('instituteName', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
                  placeholder="e.g. ICT Institute"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tagline / Subtitle</label>
                <input
                  type="text"
                  value={form.tagline}
                  onChange={(e) => updateField('tagline', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
                  placeholder="e.g. Learning Management System"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right column — Live Preview */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 card-shadow sticky top-6">
            <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <Eye size={18} />
              Live Preview
            </h2>

            {/* Mini Login Preview */}
            <div className="mb-6">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Login Page</p>
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <div className="p-4 text-center" style={{ backgroundColor: form.backgroundColor }}>
                  <div
                    className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
                    style={{ backgroundColor: form.primaryColor }}
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <GraduationCap size={16} color={getContrastColor(form.primaryColor)} />
                    )}
                  </div>
                  <p className="text-xs font-semibold" style={{ color: form.primaryColor }}>
                    {form.instituteName}
                  </p>
                  <p className="text-[10px] text-gray-500">{form.tagline}</p>
                </div>
                <div className="p-3 bg-white">
                  <div className="h-6 bg-gray-100 rounded mb-2" />
                  <div className="h-6 bg-gray-100 rounded mb-2" />
                  <div
                    className="h-7 rounded flex items-center justify-center"
                    style={{ backgroundColor: form.primaryColor }}
                  >
                    <span className="text-[10px] font-medium" style={{ color: getContrastColor(form.primaryColor) }}>
                      Login
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mini Sidebar Preview */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Sidebar</p>
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <div className="w-full bg-white p-3">
                  {/* Brand header */}
                  <div className="flex items-center gap-2 pb-2 mb-2 border-b border-gray-100">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: form.primaryColor }}
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="" className="w-4 h-4 object-contain" />
                      ) : (
                        <GraduationCap size={12} color={getContrastColor(form.primaryColor)} />
                      )}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: form.primaryColor }}>
                      {form.instituteName}
                    </span>
                  </div>
                  {/* Nav items */}
                  {['Dashboard', 'Users', 'Courses'].map((label, i) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] mb-0.5"
                      style={
                        i === 0
                          ? { backgroundColor: form.primaryColor, color: getContrastColor(form.primaryColor) }
                          : { color: '#6B7280' }
                      }
                    >
                      {i === 0 ? <Home size={10} /> : i === 1 ? <Users size={10} /> : <Settings size={10} />}
                      {label}
                    </div>
                  ))}
                  {/* User */}
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                      style={{ backgroundColor: form.accentColor, color: form.primaryColor }}
                    >
                      A
                    </div>
                    <span className="text-[10px] font-medium" style={{ color: form.primaryColor }}>
                      Admin
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Color swatches */}
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg border border-gray-200" style={{ backgroundColor: form.primaryColor }} title="Primary" />
                <div className="w-8 h-8 rounded-lg border border-gray-200" style={{ backgroundColor: form.accentColor }} title="Accent" />
                <div className="w-8 h-8 rounded-lg border border-gray-200" style={{ backgroundColor: form.backgroundColor }} title="Background" />
              </div>
              <span className="text-[10px] text-gray-400">
                {form.presetTheme ? THEME_LABELS[form.presetTheme] || form.presetTheme : 'Custom'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}

/* ─── Color Picker Sub-component ─── */

function ColorPicker({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const handleTextChange = (v: string) => {
    setText(v);
    if (isValidHex(v)) {
      onChange(v.toUpperCase());
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <p className="text-xs text-gray-400 mb-2">{description}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="#1A1A1A"
          maxLength={7}
          className={`flex-1 px-3 py-2 rounded-lg border text-sm font-mono ${
            isValidHex(text) ? 'border-gray-200' : 'border-red-300'
          } focus:outline-none focus:border-primary transition-colors`}
        />
      </div>
    </div>
  );
}
