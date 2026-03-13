'use client';

import { ErrorLogItem } from '@/lib/api/monitoring';
import {
  CheckCircle2,
  Monitor,
  Smartphone,
  X,
  XCircle,
} from 'lucide-react';

export interface MonitoringErrorDetailProps {
  error: ErrorLogItem;
  onClose: () => void;
  onResolve: (id: string, resolved: boolean) => void;
}

const levelColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  error: 'bg-orange-100 text-orange-700',
  warning: 'bg-yellow-100 text-yellow-700',
};

const sourceIcons: Record<string, React.ReactNode> = {
  backend: <Monitor size={14} />,
  frontend: <Smartphone size={14} />,
};

export function MonitoringErrorDetail({
  error: selectedError,
  onClose,
  onResolve,
}: MonitoringErrorDetailProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${levelColors[selectedError.level] || 'bg-gray-100 text-gray-700'}`}>
              {selectedError.level}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              {sourceIcons[selectedError.source]}
              {selectedError.source}
            </span>
            {selectedError.resolved && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-xs font-medium">
                <CheckCircle2 size={12} />
                Resolved
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)] space-y-4">
          {/* Message */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Message</label>
            <p className="text-sm text-primary mt-1 font-medium">{selectedError.message}</p>
          </div>

          {/* Context grid */}
          <div className="grid grid-cols-2 gap-4">
            {selectedError.requestMethod && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Request</label>
                <p className="text-sm font-mono mt-1">{selectedError.requestMethod} {selectedError.requestPath}</p>
              </div>
            )}
            {selectedError.statusCode && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Status Code</label>
                <p className="text-sm font-mono mt-1 text-red-600">{selectedError.statusCode}</p>
              </div>
            )}
            {selectedError.requestId && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Request ID</label>
                <p className="text-sm font-mono mt-1">{selectedError.requestId}</p>
              </div>
            )}
            {selectedError.userEmail && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">User</label>
                <p className="text-sm mt-1">{selectedError.userEmail}</p>
              </div>
            )}
            {selectedError.ipAddress && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">IP Address</label>
                <p className="text-sm font-mono mt-1">{selectedError.ipAddress}</p>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Time</label>
              <p className="text-sm mt-1">{selectedError.createdAt ? new Date(selectedError.createdAt).toLocaleString() : '-'}</p>
            </div>
          </div>

          {/* User Agent */}
          {selectedError.userAgent && (
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">User Agent</label>
              <p className="text-xs text-gray-500 mt-1 break-all">{selectedError.userAgent}</p>
            </div>
          )}

          {/* Traceback */}
          {selectedError.traceback && (
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Traceback</label>
              <pre className="mt-2 p-4 bg-primary text-green-400 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {selectedError.traceback}
              </pre>
            </div>
          )}

          {/* Extra */}
          {selectedError.extra && Object.keys(selectedError.extra).length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Extra Context</label>
              <pre className="mt-2 p-4 bg-gray-50 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                {JSON.stringify(selectedError.extra, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
          {selectedError.resolved ? (
            <button
              onClick={() => { onResolve(selectedError.id, false); onClose(); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-700 rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors"
            >
              <XCircle size={16} />
              Reopen
            </button>
          ) : (
            <button
              onClick={() => { onResolve(selectedError.id, true); onClose(); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <CheckCircle2 size={16} />
              Mark Resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
