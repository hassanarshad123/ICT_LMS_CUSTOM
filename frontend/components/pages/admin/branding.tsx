'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import { useBranding } from '@/lib/branding-context';
import {
  updateBranding, uploadLogo, getPresetThemes, PresetThemes,
  getCertificateDesign, updateCertificateDesign, uploadSignature,
} from '@/lib/api/branding';
import { useMutation } from '@/hooks/use-api';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { BrandingForm, type FormState } from './branding-form';
import { CertificateDesignForm, type CertFormState } from './certificate-design-form';
import { BrandingPreview } from './branding-preview';

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
  const fileInputRef = useRef<HTMLInputElement>(null!);
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
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);

  // Certificate design state
  const [certForm, setCertForm] = useState<CertFormState>(CERT_DEFAULTS);
  const [certLoaded, setCertLoaded] = useState<CertFormState>(CERT_DEFAULTS);
  const [certHasChanges, setCertHasChanges] = useState(false);
  const sig1InputRef = useRef<HTMLInputElement>(null!);
  const sig2InputRef = useRef<HTMLInputElement>(null!);
  const certLogoInputRef = useRef<HTMLInputElement>(null!);

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
      form.presetTheme !== branding.presetTheme ||
      pendingLogoFile !== null;
    setHasChanges(changed);
  }, [form, branding, pendingLogoFile]);

  const { execute: saveBranding, loading: saving } = useMutation(async () => {
    const payload: Record<string, string | null> = {};
    if (form.primaryColor !== branding.primaryColor) payload.primaryColor = form.primaryColor;
    if (form.accentColor !== branding.accentColor) payload.accentColor = form.accentColor;
    if (form.backgroundColor !== branding.backgroundColor) payload.backgroundColor = form.backgroundColor;
    if (form.instituteName !== branding.instituteName) payload.instituteName = form.instituteName;
    if (form.tagline !== branding.tagline) payload.tagline = form.tagline;
    if (form.presetTheme !== branding.presetTheme) payload.presetTheme = form.presetTheme;
    // Send logoUrl=null if logo was removed
    if (form.logoUrl === null && branding.logoUrl !== null) payload.logoUrl = null;

    const hasPayload = Object.keys(payload).length > 0;

    if (!hasPayload && !pendingLogoFile) {
      toast.info('No changes to save');
      return;
    }

    // Upload pending logo file first
    if (pendingLogoFile) {
      await uploadLogo(pendingLogoFile);
      setPendingLogoFile(null);
    }

    if (hasPayload) {
      await updateBranding(payload);
    }

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

  const handleLogoUpload = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }

    const allowed = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PNG, SVG, JPG, WebP files are allowed');
      return;
    }

    // Read locally for preview — actual upload happens on Save
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateField('logoUrl', dataUrl);
      setLogoPreview(dataUrl);
      setPendingLogoFile(file);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    updateField('logoUrl', null);
    setLogoPreview(null);
    setPendingLogoFile(null);
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
          <BrandingForm
            form={form}
            themes={themes}
            themeLabels={THEME_LABELS}
            logoPreview={logoPreview}
            uploading={uploading}
            fileInputRef={fileInputRef}
            onUpdateField={updateField}
            onSelectPreset={selectPreset}
            onLogoUpload={handleLogoUpload}
            onRemoveLogo={removeLogo}
            onDrop={handleDrop}
          />

          <CertificateDesignForm
            certForm={certForm}
            certHasChanges={certHasChanges}
            savingCert={savingCert}
            sig1InputRef={sig1InputRef}
            sig2InputRef={sig2InputRef}
            certLogoInputRef={certLogoInputRef}
            onUpdateCertField={updateCertField}
            onSaveCertDesign={saveCertDesign}
            onSigUpload={handleSigUpload}
            onCertLogoUpload={handleCertLogoUpload}
          />
        </div>

        {/* Right column — Live Preview */}
        <div className="lg:col-span-1">
          <BrandingPreview
            form={form}
            logoPreview={logoPreview}
            themeLabels={THEME_LABELS}
            certForm={certForm}
          />
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
