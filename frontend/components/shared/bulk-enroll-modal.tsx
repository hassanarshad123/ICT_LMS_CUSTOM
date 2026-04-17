'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { CustomDurationPicker, toAccessDuration, DurationValue } from './custom-duration-picker';
import { bulkEnrollStudents } from '@/lib/api/batches';

export interface BulkEnrollModalProps {
  batchId: string;
  selectedStudentIds: string[];
  open: boolean;
  onClose: () => void;
  onSuccess: (result: { count: number; errorCount: number }) => void;
}

export function BulkEnrollModal({
  batchId,
  selectedStudentIds,
  open,
  onClose,
  onSuccess,
}: BulkEnrollModalProps) {
  const [duration, setDuration] = useState<DurationValue>({ kind: 'until-batch-end' });
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    if (selectedStudentIds.length === 0) return;
    setSubmitting(true);
    try {
      const result = await bulkEnrollStudents(batchId, {
        studentIds: selectedStudentIds,
        ...toAccessDuration(duration),
      });
      toast.success(
        `Enrolled ${result.count} student(s)` +
          (result.errors.length ? `, ${result.errors.length} failed` : ''),
      );
      onSuccess({ count: result.count, errorCount: result.errors.length });
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Bulk enroll failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg card-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-primary">
            Bulk enroll {selectedStudentIds.length} student(s)
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 mb-4">
            Choose how long each student should have access:
          </p>
          <CustomDurationPicker value={duration} onChange={setDuration} />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={submitting || selectedStudentIds.length === 0}
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Enroll {selectedStudentIds.length}
          </button>
        </div>
      </div>
    </div>
  );
}
