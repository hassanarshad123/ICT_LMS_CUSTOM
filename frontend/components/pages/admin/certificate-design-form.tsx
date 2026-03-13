'use client';

import { RefObject } from 'react';
import {
  Palette, Upload, GraduationCap, Settings, Check, Loader2,
  Award, PenTool, FileText,
} from 'lucide-react';
import { ColorPicker } from './branding-color-picker';

export interface CertFormState {
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

export interface CertificateDesignFormProps {
  certForm: CertFormState;
  certHasChanges: boolean;
  savingCert: boolean;
  sig1InputRef: RefObject<HTMLInputElement>;
  sig2InputRef: RefObject<HTMLInputElement>;
  certLogoInputRef: RefObject<HTMLInputElement>;
  onUpdateCertField: (field: keyof CertFormState, value: string | null) => void;
  onSaveCertDesign: () => void;
  onSigUpload: (file: File, position: 1 | 2) => void;
  onCertLogoUpload: (file: File) => void;
}

export function CertificateDesignForm({
  certForm,
  certHasChanges,
  savingCert,
  sig1InputRef,
  sig2InputRef,
  certLogoInputRef,
  onUpdateCertField,
  onSaveCertDesign,
  onSigUpload,
  onCertLogoUpload,
}: CertificateDesignFormProps) {
  return (
    <>
      {/* Section Header */}
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
            onChange={(v) => onUpdateCertField('primaryColor', v)}
          />
          <ColorPicker
            label="Accent Color"
            description="Decorative lines, highlights"
            value={certForm.accentColor}
            onChange={(v) => onUpdateCertField('accentColor', v)}
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
              onChange={(e) => onUpdateCertField('instituteName', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
              placeholder="e.g. ICT INSTITUTE"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Website URL</label>
            <input
              type="text"
              value={certForm.websiteUrl}
              onChange={(e) => onUpdateCertField('websiteUrl', e.target.value)}
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
                  onClick={() => onUpdateCertField('logoUrl', null)}
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
                if (file) onCertLogoUpload(file);
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
              onChange={(e) => onUpdateCertField('title', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
              placeholder="e.g. CERTIFICATE OF COMPLETION"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Body Line 1</label>
            <input
              type="text"
              value={certForm.bodyLine1}
              onChange={(e) => onUpdateCertField('bodyLine1', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
              placeholder="e.g. This is to certify that"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Body Line 2</label>
            <input
              type="text"
              value={certForm.bodyLine2}
              onChange={(e) => onUpdateCertField('bodyLine2', e.target.value)}
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
                onChange={(e) => onUpdateCertField('sig1Label', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                placeholder="e.g. Director"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Signer Name</label>
              <input
                type="text"
                value={certForm.sig1Name}
                onChange={(e) => onUpdateCertField('sig1Name', e.target.value)}
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
                    onClick={() => { onUpdateCertField('sig1Image', null); }}
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
                  if (file) onSigUpload(file, 1);
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
                onChange={(e) => onUpdateCertField('sig2Label', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                placeholder="e.g. Course Instructor"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Signer Name</label>
              <input
                type="text"
                value={certForm.sig2Name}
                onChange={(e) => onUpdateCertField('sig2Name', e.target.value)}
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
                    onClick={() => { onUpdateCertField('sig2Image', null); }}
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
                  if (file) onSigUpload(file, 2);
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
                onChange={(e) => onUpdateCertField('idPrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
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
                  onClick={() => onUpdateCertField('borderStyle', key)}
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
        onClick={onSaveCertDesign}
        disabled={savingCert || !certHasChanges}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/80 transition-colors disabled:opacity-50"
      >
        {savingCert ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        Save Certificate Design
      </button>
    </>
  );
}

/* ---- Border Preview Mini ---- */

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
