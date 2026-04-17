'use client';

import { useState } from 'react';
import { setStudentAccess, getExtensionHistory, ExtensionHistoryItem } from '@/lib/api/batches';
import { toast } from 'sonner';
import { Calendar, Clock, History, Loader2, X } from 'lucide-react';

interface AdjustAccessModalProps {
  batchId: string;
  batchEndDate: string;
  studentId: string;
  studentName: string;
  currentEffectiveEndDate?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdjustAccessModal({
  batchId,
  batchEndDate,
  studentId,
  studentName,
  currentEffectiveEndDate,
  onClose,
  onSuccess,
}: AdjustAccessModalProps) {
  const [tab, setTab] = useState<'date' | 'duration' | 'history'>('date');
  const [endDate, setEndDate] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<ExtensionHistoryItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await getExtensionHistory(batchId, studentId);
      setHistory(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load extension history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleTabChange = (t: 'date' | 'duration' | 'history') => {
    setTab(t);
    if (t === 'history' && history === null) {
      loadHistory();
    }
  };

  // Compute the candidate new end date for shortening warning
  const candidate: string | null = (() => {
    if (tab === 'date') {
      return endDate || null;
    }
    if (tab === 'duration') {
      const days = parseInt(durationDays, 10);
      if (!days || days < 1) return null;
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    }
    return null;
  })();

  const isShortening =
    candidate !== null &&
    currentEffectiveEndDate !== undefined &&
    candidate < currentEffectiveEndDate;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const data: { accessEndDate?: string; accessDays?: number; reason?: string } = {};
      if (tab === 'date') {
        if (!endDate) { toast.error('Please select an end date'); setSubmitting(false); return; }
        data.accessEndDate = endDate;
      } else {
        const days = parseInt(durationDays, 10);
        if (!days || days < 1 || days > 3650) { toast.error('Enter days between 1 and 3650'); setSubmitting(false); return; }
        data.accessDays = days;
      }
      if (reason.trim()) data.reason = reason.trim();

      const result = await setStudentAccess(batchId, studentId, data);
      toast.success(`Access updated to ${new Date(result.newEndDate).toLocaleDateString()}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update access');
    } finally {
      setSubmitting(false);
    }
  };

  // Preview the resulting date for duration mode
  const previewDate = (() => {
    if (tab !== 'duration' || !durationDays) return null;
    const days = parseInt(durationDays, 10);
    if (!days || days < 1) return null;
    const base = new Date();
    base.setDate(base.getDate() + days);
    return base.toLocaleDateString();
  })();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg card-shadow" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-primary">Update Access</h3>
            <p className="text-sm text-gray-500 mt-0.5">{studentName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Current status */}
        <div className="px-6 py-3 bg-gray-50 text-sm text-gray-600 flex items-center justify-between">
          <span>Batch ends: <strong>{new Date(batchEndDate).toLocaleDateString()}</strong></span>
          {currentEffectiveEndDate && currentEffectiveEndDate !== batchEndDate && (
            <span>Current access: <strong className="text-blue-600">{new Date(currentEffectiveEndDate).toLocaleDateString()}</strong></span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {[
            { key: 'date' as const, label: 'Specific Date', icon: Calendar },
            { key: 'duration' as const, label: 'Duration', icon: Clock },
            { key: 'history' as const, label: 'History', icon: History },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
                tab === key ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-5">
          {tab === 'date' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New end date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>
              {isShortening && (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                  You are shortening access from {currentEffectiveEndDate} to {candidate}. The student will be notified.
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Missed classes due to illness"
                  maxLength={500}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {tab === 'duration' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days from today</label>
                <input
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  min={1}
                  max={3650}
                  placeholder="30"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
                {previewDate && (
                  <p className="mt-2 text-sm text-gray-500">New end date: <strong className="text-primary">{previewDate}</strong></p>
                )}
              </div>
              {isShortening && (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                  You are shortening access from {currentEffectiveEndDate} to {candidate}. The student will be notified.
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Schedule change"
                  maxLength={500}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="max-h-64 overflow-y-auto">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              ) : !history?.length ? (
                <p className="text-sm text-gray-500 text-center py-8">No history yet</p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-primary">
                          {item.previousEndDate ? new Date(item.previousEndDate).toLocaleDateString() : 'Original'} &rarr; {new Date(item.newEndDate).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        By {item.extendedByName}
                        {item.durationDays && ` (${item.durationDays > 0 ? '+' : ''}${item.durationDays} days)`}
                      </p>
                      {item.reason && <p className="text-xs text-gray-400 mt-1 italic">{item.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {tab !== 'history' && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
