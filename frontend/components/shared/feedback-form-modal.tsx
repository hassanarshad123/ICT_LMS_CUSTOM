'use client';

import { useState, useEffect } from 'react';
import { Bug, Lightbulb, MessageCircle, MousePointerClick, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { submitFeedback, type FeedbackType } from '@/lib/api/feedback';
import StarRating from './star-rating';
import ScreenshotUpload, { type UploadedFile } from './screenshot-upload';
import { useMutation } from '@/hooks/use-api';

interface ErrorContext {
  message?: string;
  stack?: string;
}

interface FeedbackFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorContext?: ErrorContext | null;
}

const TYPES: { key: FeedbackType; label: string; icon: typeof Bug; color: string }[] = [
  { key: 'bug_report', label: 'Bug Report', icon: Bug, color: 'text-red-500' },
  { key: 'feature_request', label: 'Feature Request', icon: Lightbulb, color: 'text-amber-500' },
  { key: 'general_feedback', label: 'General Feedback', icon: MessageCircle, color: 'text-blue-500' },
  { key: 'ux_issue', label: 'UX Issue', icon: MousePointerClick, color: 'text-purple-500' },
];

const EMPTY_FORM = {
  type: '' as FeedbackType | '',
  subject: '',
  description: '',
  rating: 0,
  isAnonymous: false,
};

export default function FeedbackFormModal({ open, onOpenChange, errorContext }: FeedbackFormModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const { execute, loading } = useMutation(submitFeedback);

  // Reset form when closed
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setFiles([]);
    }
  }, [open]);

  // Pre-fill from error context
  useEffect(() => {
    if (open && errorContext) {
      setForm((prev) => ({
        ...prev,
        type: 'bug_report',
        subject: (errorContext.message || '').slice(0, 200),
        description: errorContext.stack || errorContext.message || '',
      }));
    }
  }, [open, errorContext]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.type) { toast.error('Please select a feedback type'); return; }
    if (!form.subject.trim()) { toast.error('Please enter a title'); return; }
    if (!form.description.trim()) { toast.error('Please enter a description'); return; }
    if (!form.rating) { toast.error('Please select a rating'); return; }

    const clientContext = {
      page_url: window.location.href,
      browser: navigator.userAgent,
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
    };

    try {
      await execute({
        feedbackType: form.type,
        subject: form.subject.trim(),
        description: form.description.trim(),
        rating: form.rating,
        isAnonymous: form.isAnonymous,
        clientContext,
        attachmentKeys: files.map((f) => f.objectKey),
        attachmentNames: files.map((f) => f.fileName),
        attachmentContentTypes: files.map((f) => f.contentType),
        attachmentSizes: files.map((f) => f.fileSize),
      });
      toast.success('Feedback submitted! Thank you.');
      onOpenChange(false);
    } catch {
      toast.error('Failed to submit feedback. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-primary">Send Feedback</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Type selector */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, type: key })}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    form.type === key
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon size={16} className={form.type === key ? 'text-primary' : color} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Title</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              maxLength={200}
              placeholder="Brief summary of your feedback"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-primary focus:ring-0 focus:outline-none transition-colors"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{form.subject.length}/200</p>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={2000}
              rows={4}
              placeholder="Tell us more about your feedback..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-primary focus:ring-0 focus:outline-none transition-colors resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{form.description.length}/2000</p>
          </div>

          {/* Rating */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Overall Satisfaction</label>
            <StarRating value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} size={28} />
          </div>

          {/* Screenshots */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Screenshots (optional)</label>
            <ScreenshotUpload files={files} onChange={setFiles} />
          </div>

          {/* Anonymous toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isAnonymous}
              onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-600">Submit anonymously</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Submit Feedback
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
