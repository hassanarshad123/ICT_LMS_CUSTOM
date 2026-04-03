'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { listRecordings, getRecordingSignedUrl, RecordingItem } from '@/lib/api/zoom';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { PlayCircle, Calendar, Clock, User, Layers, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function RecordingsPage() {
  const { data: recordings, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    ({ page: p, per_page: pp }) => listRecordings({ page: p, per_page: pp }),
    20,
  );
  const [selectedRecording, setSelectedRecording] = useState<RecordingItem | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const openPlayer = async (rec: RecordingItem) => {
    setSelectedRecording(rec);
    setPlayerLoading(true);
    setPlayerError(null);
    setEmbedUrl(null);
    try {
      const res = await getRecordingSignedUrl(rec.id);
      setEmbedUrl(res.url);
    } catch (err: any) {
      setPlayerError(err.message || 'Could not load recording');
    } finally {
      setPlayerLoading(false);
    }
  };

  const closePlayer = () => {
    setSelectedRecording(null);
    setEmbedUrl(null);
    setPlayerError(null);
  };

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Class Recordings" subtitle="Watch recorded Zoom classes" />

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && recordings.length === 0 && (
        <EmptyState
          icon={<PlayCircle size={28} className="text-gray-400" />}
          title="No recordings yet"
          description="Recordings will appear here once your Zoom classes are completed and processed."
        />
      )}

      {!loading && !error && recordings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recordings.map((rec) => (
            <button
              key={rec.id}
              onClick={() => openPlayer(rec)}
              className="bg-white rounded-2xl card-shadow hover:card-shadow-hover transition-all duration-200 overflow-hidden text-left group"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gray-900 relative overflow-hidden">
                {rec.thumbnailUrl ? (
                  <img
                    src={rec.thumbnailUrl}
                    alt={rec.classTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PlayCircle size={48} className="text-gray-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <PlayCircle size={28} className="text-primary ml-0.5" />
                  </div>
                </div>
                {rec.duration && (
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                    {formatDuration(rec.duration)}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h4 className="font-semibold text-sm text-primary truncate">{rec.classTitle}</h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                  {rec.teacherName && (
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {rec.teacherName}
                    </span>
                  )}
                  {rec.batchName && (
                    <span className="flex items-center gap-1">
                      <Layers size={12} />
                      {rec.batchName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {rec.scheduledDate}
                  </span>
                  {rec.scheduledTime && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {rec.scheduledTime}
                    </span>
                  )}
                  {rec.fileSize && (
                    <span>{formatFileSize(rec.fileSize)}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      {selectedRecording && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closePlayer}>
          <div
            className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-primary">{selectedRecording.classTitle}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedRecording.teacherName} &middot; {selectedRecording.scheduledDate}
                </p>
              </div>
              <button
                onClick={closePlayer}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Player */}
            <div className="aspect-video bg-black">
              {playerLoading && (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 size={48} className="text-accent animate-spin" />
                </div>
              )}
              {playerError && (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-white text-sm">{playerError}</p>
                </div>
              )}
              {embedUrl && !playerLoading && (
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between mt-8">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total} recordings
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-gray-600 px-2">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
