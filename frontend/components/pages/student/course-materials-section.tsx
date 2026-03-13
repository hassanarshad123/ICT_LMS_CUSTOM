'use client';

import {
  FileText,
  Download,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { fileTypeConfig } from '@/lib/constants';
import type { MaterialOut } from '@/lib/api/materials';
import type { MaterialFileType } from '@/lib/types';

/* ─── Types ──────────────────────────────────────────────────────── */

export interface CourseMaterialsSectionProps {
  materials: MaterialOut[];
  materialsLoading: boolean;
  downloadingId: string | null;
  onDownload: (materialId: string) => void;
}

/* ─── Component ──────────────────────────────────────────────────── */

export function CourseMaterialsSection({
  materials,
  materialsLoading,
  downloadingId,
  onDownload,
}: CourseMaterialsSectionProps) {
  return (
    <div className="bg-white rounded-2xl card-shadow p-6 mt-8">
      <div className="flex items-center gap-3 mb-4">
        <Paperclip size={20} className="text-primary" />
        <h3 className="text-lg font-semibold text-primary">Course Materials</h3>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          {materials.length}
        </span>
      </div>
      {materialsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-24" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="text-center py-8">
          <FileText size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No materials uploaded for this course yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {materials.map((material) => {
            const config = fileTypeConfig[material.fileType as MaterialFileType] || fileTypeConfig.other;
            return (
              <div key={material.id} className="border border-gray-100 rounded-xl p-4 flex items-start gap-4">
                <div className={`w-12 h-12 ${config.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-xs font-bold ${config.textColor}`}>{config.label}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-primary truncate">{material.title}</h4>
                  {material.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{material.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    {material.fileSize && <span>{material.fileSize}</span>}
                    {material.uploadDate && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>{material.uploadDate}</span>
                      </>
                    )}
                    {material.uploadedByName && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>by {material.uploadedByName}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onDownload(material.id)}
                  disabled={downloadingId === material.id}
                  className="flex-shrink-0 p-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-60"
                >
                  {downloadingId === material.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
