'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { CustomDurationPicker, toAccessDuration, DurationValue } from './custom-duration-picker';
import { bulkSetStudentAccess } from '@/lib/api/batches';

export interface BulkAdjustAccessModalProps {
  batchId: string;
  selectedStudents: Array<{ id: string; name: string; currentEffectiveEnd: string | null }>;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkAdjustAccessModal({
  batchId,
  selectedStudents,
  open,
  onClose,
  onSuccess,
}: BulkAdjustAccessModalProps) {
  const [duration, setDuration] = useState<DurationValue>({ kind: 'days', value: 30 });
  const [submitting, setSubmitting] = useState(false);

  const candidate = useMemo(() => {
    if (duration.kind === 'days') {
      const d = new Date();
      d.setDate(d.getDate() + duration.value);
      return d.toISOString().slice(0, 10);
    }
    if (duration.kind === 'end-date') return duration.value || null;
    return null;
  }, [duration]);

  const shorteningCount = useMemo(() => {
    if (!candidate) return 0;
    return selectedStudents.filter(
      (s) => s.currentEffectiveEnd && s.currentEffectiveEnd > candidate,
    ).length;
  }, [candidate, selectedStudents]);

  if (!open) return null;

  async function handleSubmit() {
    if (!candidate || selectedStudents.length === 0) return;
    setSubmitting(true);
    try {
      const result = await bulkSetStudentAccess(batchId, {
        studentIds: selectedStudents.map((s) => s.id),
        ...toAccessDuration(duration),
      });
      toast.success(`Adjusted access for ${result.count} student(s)`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Bulk adjust failed');
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
            Adjust access for {selectedStudents.length} student(s)
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <CustomDurationPicker value={duration} onChange={setDuration} disableUntilBatchEnd />
          {shorteningCount > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
              You are shortening access for {shorteningCount} student(s). They will be notified.
            </div>
          )}
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
            disabled={submitting || !candidate}
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
