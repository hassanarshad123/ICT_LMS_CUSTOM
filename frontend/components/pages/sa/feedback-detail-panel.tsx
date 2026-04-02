'use client';

import { useState, useEffect } from 'react';
import { Bug, Lightbulb, MessageCircle, MousePointerClick, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StarRating from '@/components/shared/star-rating';
import { updateFeedbackStatus, addFeedbackResponse, type FeedbackItem, type FeedbackType } from '@/lib/api/feedback';
import { useMutation } from '@/hooks/use-api';

const TYPE_CONFIG: Record<FeedbackType, { icon: typeof Bug; label: string; color: string }> = {
  bug_report: { icon: Bug, label: 'Bug Report', color: 'text-red-500' },
  feature_request: { icon: Lightbulb, label: 'Feature Request', color: 'text-amber-500' },
  general_feedback: { icon: MessageCircle, label: 'General Feedback', color: 'text-blue-500' },
  ux_issue: { icon: MousePointerClick, label: 'UX Issue', color: 'text-purple-500' },
};

const STATUS_OPTIONS = ['submitted', 'under_review', 'planned', 'in_progress', 'done', 'declined'];

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-purple-100 text-purple-700',
  planned: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
  declined: 'bg-gray-100 text-gray-600',
};

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FeedbackDetailPanelProps {
  feedback: FeedbackItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export default function FeedbackDetailPanel({ feedback, open, onOpenChange, onUpdated }: FeedbackDetailPanelProps) {
  const [responseText, setResponseText] = useState('');
  const [noteText, setNoteText] = useState('');
  const { execute: execStatus, loading: statusLoading } = useMutation(
    (args: { id: string; status: string }) => updateFeedbackStatus(args.id, args.status),
  );
  const { execute: execResponse, loading: respLoading } = useMutation(
    (args: { id: string; message: string; isInternal: boolean }) => addFeedbackResponse(args.id, args.message, args.isInternal),
  );

  // Clear text fields when switching to a different feedback item
  useEffect(() => {
    setResponseText('');
    setNoteText('');
  }, [feedback?.id]);

  if (!feedback) return null;

  const typeConfig = TYPE_CONFIG[feedback.feedbackType] || TYPE_CONFIG.general_feedback;
  const Icon = typeConfig.icon;

  const handleStatusChange = async (newStatus: string) => {
    try {
      await execStatus({ id: feedback.id, status: newStatus });
      toast.success('Status updated');
      onUpdated();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleSendResponse = async () => {
    if (!responseText.trim()) return;
    try {
      await execResponse({ id: feedback.id, message: responseText.trim(), isInternal: false });
      toast.success('Response sent to user');
      setResponseText('');
      onUpdated();
    } catch {
      toast.error('Failed to send response');
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    try {
      await execResponse({ id: feedback.id, message: noteText.trim(), isInternal: true });
      toast.success('Internal note saved');
      setNoteText('');
      onUpdated();
    } catch {
      toast.error('Failed to save note');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Icon size={20} className={typeConfig.color} />
            {feedback.subject}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[feedback.status]}`}>
              {formatStatus(feedback.status)}
            </span>
            <span className="text-xs text-zinc-500">{typeConfig.label}</span>
            {feedback.rating && <StarRating value={feedback.rating} readonly size={14} />}
            <span className="text-xs text-zinc-400">{formatDate(feedback.createdAt)}</span>
          </div>

          {/* Description */}
          <div className="bg-zinc-50 rounded-xl p-4">
            <p className="text-sm text-zinc-700 whitespace-pre-wrap">{feedback.description}</p>
          </div>

          {/* Screenshots */}
          {feedback.attachments.length > 0 && (
            <div className="flex gap-2">
              {feedback.attachments.map((att) => (
                <a key={att.id} href={att.viewUrl || '#'} target="_blank" rel="noopener noreferrer">
                  <img src={att.viewUrl || ''} alt={att.fileName} className="w-40 h-28 rounded-xl object-cover border border-zinc-200" />
                </a>
              ))}
            </div>
          )}

          {/* User info */}
          {!feedback.isAnonymous && feedback.userName && (
            <div className="bg-zinc-50 rounded-xl p-3">
              <p className="text-xs text-zinc-500">Submitted by</p>
              <p className="text-sm font-medium text-zinc-900">{feedback.userName} {feedback.userEmail && `(${feedback.userEmail})`}</p>
              <p className="text-xs text-zinc-400">{feedback.userRole?.replace(/_/g, ' ')} &middot; {feedback.instituteName || 'Unknown institute'}</p>
            </div>
          )}
          {feedback.isAnonymous && (
            <div className="bg-zinc-50 rounded-xl p-3">
              <p className="text-xs text-zinc-500">Anonymous submission</p>
              {feedback.instituteName && <p className="text-xs text-zinc-400">Institute: {feedback.instituteName}</p>}
            </div>
          )}

          {/* Client context */}
          {feedback.clientContext && (
            <div className="bg-zinc-50 rounded-xl p-3">
              <p className="text-xs font-medium text-zinc-500 mb-1">Context</p>
              <div className="text-xs text-zinc-400 space-y-0.5">
                {(feedback.clientContext.pageUrl || feedback.clientContext.page_url) != null && (
                  <p>Page: {String(feedback.clientContext.pageUrl || feedback.clientContext.page_url)}</p>
                )}
                {(feedback.clientContext.screenSize || feedback.clientContext.screen_size) != null && (
                  <p>Screen: {String(feedback.clientContext.screenSize || feedback.clientContext.screen_size)}</p>
                )}
                {(feedback.clientContext.browser) != null && (
                  <p className="truncate">Browser: {String(feedback.clientContext.browser).slice(0, 100)}</p>
                )}
              </div>
            </div>
          )}

          {/* Status updater */}
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Update Status</label>
            <select
              value={feedback.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={statusLoading}
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:border-primary focus:ring-0 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
            </select>
          </div>

          {/* Internal notes */}
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Internal Note (SA only)</label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              placeholder="Add an internal note..."
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:border-primary focus:ring-0 focus:outline-none resize-none"
            />
            <button
              onClick={handleSaveNote}
              disabled={respLoading || !noteText.trim()}
              className="mt-1.5 px-4 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 disabled:opacity-40 transition-colors"
            >
              Save Note
            </button>
          </div>

          {/* User-visible response */}
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">Send Response (visible to user)</label>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={2}
              placeholder="Write a response to the user..."
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:border-primary focus:ring-0 focus:outline-none resize-none"
            />
            <button
              onClick={handleSendResponse}
              disabled={respLoading || !responseText.trim()}
              className="mt-1.5 px-4 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {respLoading ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
              Send Response
            </button>
          </div>

          {/* Response history */}
          {feedback.responses.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-2">Response History</p>
              <div className="space-y-2">
                {feedback.responses.map((resp) => (
                  <div
                    key={resp.id}
                    className={`rounded-xl p-3 ${resp.isInternal ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}
                  >
                    <p className="text-[10px] font-medium mb-0.5" style={{ color: resp.isInternal ? '#92400e' : '#15803d' }}>
                      {resp.isInternal ? 'Internal Note' : 'User-Visible Response'} &middot; {resp.responderName || 'SA'} &middot; {formatDate(resp.createdAt)}
                    </p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: resp.isInternal ? '#78350f' : '#166534' }}>{resp.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
