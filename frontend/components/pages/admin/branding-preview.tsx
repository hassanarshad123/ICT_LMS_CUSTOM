'use client';

import {
  Eye, GraduationCap, Home, Users, Settings, Award,
} from 'lucide-react';
import { getContrastColor } from '@/lib/utils/color-convert';
import { type FormState } from './branding-form';
import { type CertFormState } from './certificate-design-form';

export interface BrandingPreviewProps {
  form: FormState;
  logoPreview: string | null;
  themeLabels: Record<string, string>;
  certForm: CertFormState;
}

export function BrandingPreview({ form, logoPreview, themeLabels, certForm }: BrandingPreviewProps) {
  return (
    <>
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
            {form.presetTheme ? themeLabels[form.presetTheme] || form.presetTheme : 'Custom'}
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
    </>
  );
}

/* ---- Certificate Preview ---- */

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
