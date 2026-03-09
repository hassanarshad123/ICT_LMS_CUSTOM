'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  Palette, Upload, X, Check, Eye, Type, Image as ImageIcon,
  GraduationCap, Home, Users, Settings, LogOut, Loader2, RotateCcw,
  Award, PenTool, FileText
} from 'lucide-react';
import { useBranding } from '@/lib/branding-context';
import {
  updateBranding, uploadLogo, getPresetThemes, PresetThemes,
  getCertificateDesign, updateCertificateDesign, uploadSignature,
  CertificateDesign,
} from '@/lib/api/branding';
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

interface CertFormState {
  primaryColor: string;
  accentColor: string;
  instituteName: string;
  websiteUrl: string;
  logoUrl: string | null;
  title: string;
  bodyLine1: string;
  bodyLine2: string;
  sig1Label: string;
  sig1Name: string;
  sig1Image: string | null;
  sig2Label: string;
  sig2Name: string;
  sig2Image: string | null;
  idPrefix: string;
  borderStyle: string;
}

const CERT_DEFAULTS: CertFormState = {
  primaryColor: '#1A1A1A',
  accentColor: '#C5D86D',
  instituteName: 'ICT INSTITUTE',
  websiteUrl: 'https://ict.net.pk',
  logoUrl: null,
  title: 'CERTIFICATE OF COMPLETION',
  bodyLine1: 'This is to certify that',
  bodyLine2: 'has successfully completed the course',
  sig1Label: 'Director',
  sig1Name: '',
  sig1Image: null,
  sig2Label: 'Course Instructor',
  sig2Name: '',
  sig2Image: null,
  idPrefix: 'ICT',
  borderStyle: 'classic',
};

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

  // Certificate design state
  const [certForm, setCertForm] = useState<CertFormState>(CERT_DEFAULTS);
  const [certLoaded, setCertLoaded] = useState<CertFormState>(CERT_DEFAULTS);
  const [certHasChanges, setCertHasChanges] = useState(false);
  const sig1InputRef = useRef<HTMLInputElement>(null);
  const sig2InputRef = useRef<HTMLInputElement>(null);
  const certLogoInputRef = useRef<HTMLInputElement>(null);

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
    // Only send changed fields (logo is saved separately via uploadLogo)
    const payload: Record<string, string | null> = {};
    if (form.primaryColor !== branding.primaryColor) payload.primaryColor = form.primaryColor;
    if (form.accentColor !== branding.accentColor) payload.accentColor = form.accentColor;
    if (form.backgroundColor !== branding.backgroundColor) payload.backgroundColor = form.backgroundColor;
    if (form.instituteName !== branding.instituteName) payload.instituteName = form.instituteName;
    if (form.tagline !== branding.tagline) payload.tagline = form.tagline;
    if (form.presetTheme !== branding.presetTheme) payload.presetTheme = form.presetTheme;
    // Only send logoUrl if it was removed (set to null), not the full data URL
    if (form.logoUrl === null && branding.logoUrl !== null) payload.logoUrl = null;

    if (Object.keys(payload).length === 0) {
      toast.info('No changes to save');
      return;
    }

    await updateBranding(payload);
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

  // ── Certificate Design ────────────────────────────────────────────

  // Load certificate design on mount
  useEffect(() => {
    getCertificateDesign().then((data) => {
      const mapped: CertFormState = {
        primaryColor: data.primaryColor,
        accentColor: data.accentColor,
        instituteName: data.instituteName,
        websiteUrl: data.websiteUrl,
        logoUrl: data.logoUrl,
        title: data.title,
        bodyLine1: data.bodyLine1,
        bodyLine2: data.bodyLine2,
        sig1Label: data.sig1Label,
        sig1Name: data.sig1Name,
        sig1Image: data.sig1Image,
        sig2Label: data.sig2Label,
        sig2Name: data.sig2Name,
        sig2Image: data.sig2Image,
        idPrefix: data.idPrefix,
        borderStyle: data.borderStyle,
      };
      setCertForm(mapped);
      setCertLoaded(mapped);
    }).catch(() => {});
  }, []);

  // Track cert changes
  useEffect(() => {
    setCertHasChanges(JSON.stringify(certForm) !== JSON.stringify(certLoaded));
  }, [certForm, certLoaded]);

  const updateCertField = (field: keyof CertFormState, value: string | null) => {
    setCertForm(prev => ({ ...prev, [field]: value }));
  };

  const { execute: saveCertDesign, loading: savingCert } = useMutation(async () => {
    const payload: Record<string, string | null> = {};
    for (const key of Object.keys(certForm) as (keyof CertFormState)[]) {
      if (certForm[key] !== certLoaded[key]) {
        payload[key] = certForm[key];
      }
    }
    if (Object.keys(payload).length === 0) {
      toast.info('No certificate design changes to save');
      return;
    }
    await updateCertificateDesign(payload);
    setCertLoaded({ ...certForm });
    toast.success('Certificate design saved');
  });

  const handleSigUpload = async (file: File, position: 1 | 2) => {
    if (file.size > 1 * 1024 * 1024) {
      toast.error('Signature image must be under 1MB');
      return;
    }
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PNG, JPG, WebP files are allowed');
      return;
    }
    try {
      const { imageUrl } = await uploadSignature(file, position);
      const field = position === 1 ? 'sig1Image' : 'sig2Image';
      updateCertField(field, imageUrl);
      setCertLoaded(prev => ({ ...prev, [field]: imageUrl }));
      toast.success(`Signature ${position} uploaded`);
    } catch (err: any) {
      toast.error(err.message || 'Signature upload failed');
    }
  };

  const handleCertLogoUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }
    // Read as data URL for preview + save
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateCertField('logoUrl', dataUrl);
    };
    reader.readAsDataURL(file);
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

          {/* ── Certificate Design Section ─── */}
          <div className="pt-4 border-t border-gray-200">
            <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <Award size={20} />
              Certificate Design
            </h2>
            <p className="text-sm text-gray-500 mb-4">Customize the PDF certificate issued to students. These settings are independent from your site branding.</p>
          </div>

          {/* Certificate Colors */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h2 className="text-base font-semibold text-primary mb-1 flex items-center gap-2">
              <Palette size={18} />
              Certificate Colors
            </h2>
            <p className="text-xs text-gray-400 mb-4">These colors only affect the certificate PDF, not your site theme</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ColorPicker
                label="Primary Color"
                description="Text, borders, headings"
                value={certForm.primaryColor}
                onChange={(v) => updateCertField('primaryColor', v)}
              />
              <ColorPicker
                label="Accent Color"
                description="Decorative lines, highlights"
                value={certForm.accentColor}
                onChange={(v) => updateCertField('accentColor', v)}
              />
            </div>
          </div>

          {/* Certificate Header */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <GraduationCap size={18} />
              Certificate Header
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Institute Name (on certificate)</label>
                <input
                  type="text"
                  value={certForm.instituteName}
                  onChange={(e) => updateCertField('instituteName', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
                  placeholder="e.g. ICT INSTITUTE"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Website URL</label>
                <input
                  type="text"
                  value={certForm.websiteUrl}
                  onChange={(e) => updateCertField('websiteUrl', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
                  placeholder="e.g. https://ict.net.pk"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Certificate Logo</label>
                {certForm.logoUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl border border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
                      <img src={certForm.logoUrl} alt="Cert logo" className="max-w-full max-h-full object-contain" />
                    </div>
                    <button
                      onClick={() => updateCertField('logoUrl', null)}
                      className="text-sm text-red-500 hover:text-red-700 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => certLogoInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                  >
                    <Upload size={20} className="mx-auto text-gray-400 mb-1" />
                    <p className="text-sm text-gray-600">Click to upload certificate logo</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP — max 2MB</p>
                  </div>
                )}
                <input
                  ref={certLogoInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCertLogoUpload(file);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Certificate Text */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <FileText size={18} />
              Certificate Text
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
                <input
                  type="text"
                  value={certForm.title}
                  onChange={(e) => updateCertField('title', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
                  placeholder="e.g. CERTIFICATE OF COMPLETION"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Body Line 1</label>
                <input
                  type="text"
                  value={certForm.bodyLine1}
                  onChange={(e) => updateCertField('bodyLine1', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
                  placeholder="e.g. This is to certify that"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Body Line 2</label>
                <input
                  type="text"
                  value={certForm.bodyLine2}
                  onChange={(e) => updateCertField('bodyLine2', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
                  placeholder="e.g. has successfully completed the course"
                />
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <PenTool size={18} />
              Signatures
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Signature 1 */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-800">Signature 1 (Left)</p>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Role Label</label>
                  <input
                    type="text"
                    value={certForm.sig1Label}
                    onChange={(e) => updateCertField('sig1Label', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                    placeholder="e.g. Director"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Signer Name</label>
                  <input
                    type="text"
                    value={certForm.sig1Name}
                    onChange={(e) => updateCertField('sig1Name', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                    placeholder="e.g. Dr. Ahmed Khan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Signature Image</label>
                  {certForm.sig1Image ? (
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-24 border border-gray-200 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                        <img src={certForm.sig1Image} alt="Sig 1" className="max-h-full max-w-full object-contain" />
                      </div>
                      <button
                        onClick={() => { updateCertField('sig1Image', null); }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => sig1InputRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-200 rounded-lg p-3 text-center text-xs text-gray-500 hover:border-gray-400 transition-colors"
                    >
                      Upload signature (PNG, max 1MB)
                    </button>
                  )}
                  <input
                    ref={sig1InputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSigUpload(file, 1);
                    }}
                  />
                </div>
              </div>

              {/* Signature 2 */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-800">Signature 2 (Right)</p>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Role Label</label>
                  <input
                    type="text"
                    value={certForm.sig2Label}
                    onChange={(e) => updateCertField('sig2Label', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                    placeholder="e.g. Course Instructor"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Signer Name</label>
                  <input
                    type="text"
                    value={certForm.sig2Name}
                    onChange={(e) => updateCertField('sig2Name', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                    placeholder="e.g. Prof. Sarah Ali"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Signature Image</label>
                  {certForm.sig2Image ? (
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-24 border border-gray-200 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                        <img src={certForm.sig2Image} alt="Sig 2" className="max-h-full max-w-full object-contain" />
                      </div>
                      <button
                        onClick={() => { updateCertField('sig2Image', null); }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => sig2InputRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-200 rounded-lg p-3 text-center text-xs text-gray-500 hover:border-gray-400 transition-colors"
                    >
                      Upload signature (PNG, max 1MB)
                    </button>
                  )}
                  <input
                    ref={sig2InputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSigUpload(file, 2);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Certificate ID & Border */}
          <div className="bg-white rounded-2xl p-6 card-shadow">
            <h2 className="text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <Settings size={18} />
              Certificate ID & Border
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ID Prefix</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={certForm.idPrefix}
                    onChange={(e) => updateCertField('idPrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                    className="w-32 px-4 py-3 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-primary transition-colors bg-gray-50 uppercase"
                    placeholder="ICT"
                    maxLength={10}
                  />
                  <span className="text-sm text-gray-400 font-mono">{certForm.idPrefix || 'ICT'}-2026-00001</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Border Style</label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: 'classic', label: 'Classic', desc: 'Double border' },
                    { key: 'modern', label: 'Modern', desc: 'Rounded single' },
                    { key: 'ornate', label: 'Ornate', desc: 'Corner accents' },
                  ] as const).map(({ key, label, desc }) => (
                    <button
                      key={key}
                      onClick={() => updateCertField('borderStyle', key)}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        certForm.borderStyle === key
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-100 hover:border-gray-300'
                      }`}
                    >
                      <div className="mb-2">
                        <BorderPreviewMini style={key} primaryColor={certForm.primaryColor} accentColor={certForm.accentColor} />
                      </div>
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Save Certificate Design */}
          <button
            onClick={saveCertDesign}
            disabled={savingCert || !certHasChanges}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/80 transition-colors disabled:opacity-50"
          >
            {savingCert ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Save Certificate Design
          </button>
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

          {/* Certificate Preview */}
          <div className="bg-white rounded-2xl p-6 card-shadow sticky top-[420px]">
            <h2 className="text-base font-semibold text-primary mb-3 flex items-center gap-2">
              <Award size={18} />
              Certificate Preview
            </h2>
            <p className="text-[10px] text-gray-400 mb-3">(Preview is approximate)</p>
            <CertificatePreview design={certForm} />
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


/* ─── Border Preview Mini ─── */

function BorderPreviewMini({ style, primaryColor, accentColor }: { style: string; primaryColor: string; accentColor: string }) {
  const w = 60;
  const h = 42;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="mx-auto">
      {style === 'classic' && (
        <>
          <rect x={2} y={2} width={w - 4} height={h - 4} fill="none" stroke={primaryColor} strokeWidth={2} />
          <rect x={4} y={4} width={w - 8} height={h - 8} fill="none" stroke={primaryColor} strokeWidth={0.5} />
        </>
      )}
      {style === 'modern' && (
        <rect x={2} y={2} width={w - 4} height={h - 4} fill="none" stroke={primaryColor} strokeWidth={2.5} rx={4} />
      )}
      {style === 'ornate' && (
        <>
          <rect x={2} y={2} width={w - 4} height={h - 4} fill="none" stroke={primaryColor} strokeWidth={2} />
          <rect x={4} y={4} width={w - 8} height={h - 8} fill="none" stroke={primaryColor} strokeWidth={0.5} />
          {/* Corner accents */}
          <line x1={3} y1={3} x2={12} y2={3} stroke={accentColor} strokeWidth={1.5} />
          <line x1={3} y1={3} x2={3} y2={12} stroke={accentColor} strokeWidth={1.5} />
          <line x1={w - 3} y1={3} x2={w - 12} y2={3} stroke={accentColor} strokeWidth={1.5} />
          <line x1={w - 3} y1={3} x2={w - 3} y2={12} stroke={accentColor} strokeWidth={1.5} />
          <line x1={3} y1={h - 3} x2={12} y2={h - 3} stroke={accentColor} strokeWidth={1.5} />
          <line x1={3} y1={h - 3} x2={3} y2={h - 12} stroke={accentColor} strokeWidth={1.5} />
          <line x1={w - 3} y1={h - 3} x2={w - 12} y2={h - 3} stroke={accentColor} strokeWidth={1.5} />
          <line x1={w - 3} y1={h - 3} x2={w - 3} y2={h - 12} stroke={accentColor} strokeWidth={1.5} />
        </>
      )}
    </svg>
  );
}


/* ─── Certificate Preview ─── */

function CertificatePreview({ design }: { design: CertFormState }) {
  return (
    <div
      className="w-full bg-white border border-gray-200 rounded-lg overflow-hidden"
      style={{ aspectRatio: '297 / 210' }}
    >
      <div className="relative w-full h-full p-[6%]">
        {/* Border */}
        {design.borderStyle === 'classic' && (
          <>
            <div className="absolute inset-[3%] border-2 rounded-none" style={{ borderColor: design.primaryColor }} />
            <div className="absolute inset-[5%] border rounded-none" style={{ borderColor: design.primaryColor, borderWidth: '0.5px' }} />
          </>
        )}
        {design.borderStyle === 'modern' && (
          <div className="absolute inset-[3%] border-[2.5px] rounded-lg" style={{ borderColor: design.primaryColor }} />
        )}
        {design.borderStyle === 'ornate' && (
          <>
            <div className="absolute inset-[3%] border-2" style={{ borderColor: design.primaryColor }} />
            <div className="absolute inset-[5%] border" style={{ borderColor: design.primaryColor, borderWidth: '0.5px' }} />
            {/* Corner accents */}
            {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => (
              <div
                key={corner}
                className="absolute w-[10%] h-[14%]"
                style={{
                  ...(corner.includes('top') ? { top: '3.5%' } : { bottom: '3.5%' }),
                  ...(corner.includes('left') ? { left: '3.5%' } : { right: '3.5%' }),
                  borderColor: design.accentColor,
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  ...(corner === 'top-left' ? { borderRight: 'none', borderBottom: 'none' } : {}),
                  ...(corner === 'top-right' ? { borderLeft: 'none', borderBottom: 'none' } : {}),
                  ...(corner === 'bottom-left' ? { borderRight: 'none', borderTop: 'none' } : {}),
                  ...(corner === 'bottom-right' ? { borderLeft: 'none', borderTop: 'none' } : {}),
                }}
              />
            ))}
          </>
        )}

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center h-full justify-between py-[4%]">
          {/* Header */}
          <div className="text-center">
            {design.logoUrl && (
              <img src={design.logoUrl} alt="" className="h-[16px] mx-auto mb-1 object-contain" />
            )}
            <p className="text-[7px] font-bold tracking-wide" style={{ color: design.primaryColor }}>
              {design.instituteName}
            </p>
            <p className="text-[4px] text-gray-400">{design.websiteUrl}</p>
          </div>

          {/* Title + accent line */}
          <div className="text-center -mt-1">
            <p className="text-[10px] font-bold tracking-wider" style={{ color: design.primaryColor }}>
              {design.title}
            </p>
            <div className="w-16 h-[1.5px] mx-auto mt-1" style={{ backgroundColor: design.accentColor }} />
          </div>

          {/* Body */}
          <div className="text-center -mt-1">
            <p className="text-[5px] text-gray-500">{design.bodyLine1}</p>
            <p className="text-[9px] font-bold mt-0.5" style={{ color: design.primaryColor }}>John Doe</p>
            <div className="w-12 h-[1px] mx-auto mt-0.5" style={{ backgroundColor: design.accentColor }} />
            <p className="text-[5px] text-gray-500 mt-0.5">{design.bodyLine2}</p>
            <p className="text-[7px] font-semibold mt-0.5" style={{ color: design.primaryColor }}>Introduction to Programming</p>
          </div>

          {/* Signatures */}
          <div className="w-full flex justify-between px-[10%] -mt-1">
            {[
              { img: design.sig1Image, name: design.sig1Name, label: design.sig1Label },
              { img: design.sig2Image, name: design.sig2Name, label: design.sig2Label },
            ].map((sig, i) => (
              <div key={i} className="text-center w-[35%]">
                {sig.img && (
                  <img src={sig.img} alt="" className="h-[12px] mx-auto mb-0.5 object-contain" />
                )}
                <div className="w-full h-[0.5px] bg-gray-300" />
                {sig.name && <p className="text-[4px] text-gray-500 mt-0.5">{sig.name}</p>}
                <p className="text-[5px] font-medium" style={{ color: design.primaryColor }}>{sig.label}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="text-[3.5px] text-gray-400">
            Certificate ID: {design.idPrefix || 'ICT'}-2026-00001
          </p>
        </div>
      </div>
    </div>
  );
}
