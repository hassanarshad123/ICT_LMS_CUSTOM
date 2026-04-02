'use client';

import { useState } from 'react';
import { Bug, Lightbulb, MessageCircle, MousePointerClick, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import StarRating from '@/components/shared/star-rating';
import type { FeedbackListItem, FeedbackItem, FeedbackType } from '@/lib/api/feedback';
import { getFeedbackDetail } from '@/lib/api/feedback';

const TYPE_CONFIG: Record<FeedbackType, { icon: typeof Bug; color: string; bg: string }> = {
  bug_report: { icon: Bug, color: 'text-red-500', bg: 'bg-red-50' },
  feature_request: { icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-50' },
  general_feedback: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-50' },
  ux_issue: { icon: MousePointerClick, color: 'text-purple-500', bg: 'bg-purple-50' },
};

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-purple-100 text-purple-700',
  planned: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
  declined: 'bg-gray-100 text-gray-600',
};

const TYPE_LABELS: Record<string, string> = {
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  general_feedback: 'General Feedback',
  ux_issue: 'UX Issue',
};

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FeedbackDetailCardProps {
  item: FeedbackListItem;
}

export default function FeedbackDetailCard({ item }: FeedbackDetailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<FeedbackItem | null>(null);
  const [loading, setLoading] = useState(false);

  const typeConfig = TYPE_CONFIG[item.feedbackType] || TYPE_CONFIG.general_feedback;
  const Icon = typeConfig.icon;

  const handleToggle = async () => {
    if (!expanded && !detail) {
      setLoading(true);
      try {
        const d = await getFeedbackDetail(item.id);
        setDetail(d);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  };

  return (
    <div className="bg-white rounded-2xl card-shadow overflow-hidden">
      {/* Summary row */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className={`w-9 h-9 rounded-xl ${typeConfig.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={18} className={typeConfig.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-primary truncate">{item.subject}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600'}`}>
              {formatStatus(item.status)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>{TYPE_LABELS[item.feedbackType] || item.feedbackType}</span>
            <span>{formatDate(item.createdAt)}</span>
            {item.attachmentCount > 0 && <span>{item.attachmentCount} attachment{item.attachmentCount > 1 ? 's' : ''}</span>}
            {item.responseCount > 0 && <span>{item.responseCount} response{item.responseCount > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {item.rating && <StarRating value={item.rating} readonly size={14} />}
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : detail ? (
            <>
              {/* Description */}
              <div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.description}</p>
              </div>

              {/* Screenshots */}
              {detail.attachments.length > 0 && (
                <div className="flex gap-2">
                  {detail.attachments.map((att) => (
                    <a key={att.id} href={att.viewUrl || '#'} target="_blank" rel="noopener noreferrer">
                      <img
                        src={att.viewUrl || ''}
                        alt={att.fileName}
                        className="w-32 h-24 rounded-xl object-cover border border-gray-200"
                      />
                    </a>
                  ))}
                </div>
              )}

              {/* SA responses (non-internal only — internal notes are filtered by backend for non-SA users, but double-check here) */}
              {detail.responses.filter((r) => !r.isInternal).length > 0 && (
                <div className="space-y-2">
                  {detail.responses.filter((r) => !r.isInternal).map((resp) => (
                    <div key={resp.id} className="bg-green-50 rounded-xl p-4">
                      <p className="text-xs font-medium text-green-700 mb-1">
                        Response from {resp.responderName || 'Support'} &middot; {formatDate(resp.createdAt)}
                      </p>
                      <p className="text-sm text-green-800 whitespace-pre-wrap">{resp.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Context info */}
              {detail.clientContext && (
                <div className="text-[10px] text-gray-400 space-y-0.5">
                  {(detail.clientContext.pageUrl || detail.clientContext.page_url) != null && (
                    <p>Page: {String(detail.clientContext.pageUrl || detail.clientContext.page_url)}</p>
                  )}
                  {(detail.clientContext.screenSize || detail.clientContext.screen_size) != null && (
                    <p>Screen: {String(detail.clientContext.screenSize || detail.clientContext.screen_size)}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">Could not load details</p>
          )}
        </div>
      )}
    </div>
  );
}
