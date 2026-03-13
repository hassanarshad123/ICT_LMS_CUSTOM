'use client';

import type { BatchOut } from '@/lib/api/batches';
import { EmptyState } from '@/components/shared/page-states';
import {
  Layers,
  Plus,
  X,
  Users,
  FolderOpen,
} from 'lucide-react';
import Link from 'next/link';

export interface CourseBatchesSectionProps {
  basePath: string;
  linkedBatches: BatchOut[];
  unlinkedBatches: BatchOut[];
  showBatchDropdown: boolean;
  onToggleBatchDropdown: () => void;
  onLinkBatch: (batchId: string) => void;
  onUnlinkBatch: (batchId: string) => void;
}

export function CourseBatchesSection({
  basePath,
  linkedBatches,
  unlinkedBatches,
  showBatchDropdown,
  onToggleBatchDropdown,
  onLinkBatch,
  onUnlinkBatch,
}: CourseBatchesSectionProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary">Linked Batches</h3>
        <div className="relative">
          <button
            onClick={onToggleBatchDropdown}
            disabled={unlinkedBatches.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            Add Batch
          </button>
          {showBatchDropdown && unlinkedBatches.length > 0 && (
            <div className="absolute top-12 right-0 bg-white rounded-xl card-shadow border border-gray-100 py-2 z-10 min-w-[280px]">
              {unlinkedBatches.map((batch) => (
                <button
                  key={batch.id}
                  onClick={() => onLinkBatch(batch.id)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-primary">{batch.name}</p>
                    <p className="text-xs text-gray-400">{batch.studentCount} students</p>
                  </div>
                  <Plus size={14} className="text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {linkedBatches.length === 0 ? (
        <EmptyState
          icon={<Layers size={28} className="text-gray-400" />}
          title="No batches linked"
          description='Click "Add Batch" to link a batch to this course.'
        />
      ) : (
        <div className="space-y-4">
          {linkedBatches.map((batch) => (
            <div key={batch.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 bg-accent bg-opacity-30 rounded-xl flex items-center justify-center">
                    <Layers size={18} className="text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-primary">{batch.name}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        batch.status === 'active' ? 'bg-green-100 text-green-700' :
                        batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {batch.status}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Users size={12} />
                        {batch.studentCount} students
                      </span>
                      <span className="text-xs text-gray-400">{batch.teacherName || 'Unassigned'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Link
                    href={`${basePath}/batches/${batch.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/80 transition-colors"
                  >
                    <FolderOpen size={12} />
                    Manage Content
                  </Link>
                  <button
                    onClick={() => onUnlinkBatch(batch.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Unlink batch from course"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
