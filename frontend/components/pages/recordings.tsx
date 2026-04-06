'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { listRecordings, getRecordingSignedUrl, updateRecording, deleteRecording, deleteRecordingPermanent, restoreRecording, RecordingItem } from '@/lib/api/zoom';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { PlayCircle, Calendar, Clock, User, Layers, X, Loader2, ChevronLeft, ChevronRight, Edit3, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'course-creator';

  const [showDeleted, setShowDeleted] = useState(false);

  const { data: recordings, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    ({ page: p, per_page: pp }) => listRecordings({ page: p, per_page: pp, include_deleted: showDeleted }),
    20,
    [showDeleted],
  );

  const [selectedRecording, setSelectedRecording] = useState<RecordingItem | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const expiresAtRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit state
  const [editingRecording, setEditingRecording] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const REFRESH_BUFFER = 5 * 60; // Refresh 5 minutes before expiry

  const fetchAndSetUrl = useCallback(async (recordingId: string) => {
    // Clear any existing timer to prevent stacking
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    const res = await getRecordingSignedUrl(recordingId);
    setEmbedUrl(res.url);
    expiresAtRef.current = res.expiresAt || null;
    // Schedule next refresh
    if (res.expiresAt) {
      const msUntilRefresh = (res.expiresAt - Math.floor(Date.now() / 1000) - REFRESH_BUFFER) * 1000;
      if (msUntilRefresh > 0) {
        refreshTimerRef.current = setTimeout(() => {
          fetchAndSetUrl(recordingId).catch(() => {});
        }, msUntilRefresh);
      }
    }
  }, []);

  const openPlayer = async (rec: RecordingItem) => {
    setSelectedRecording(rec);
    setPlayerLoading(true);
    setPlayerError(null);
    setEmbedUrl(null);
    try {
      await fetchAndSetUrl(rec.id);
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
    expiresAtRef.current = null;
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  // Refresh token when tab becomes visible again (handles laptop sleep/resume)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!selectedRecording || !expiresAtRef.current) return;
      const secondsLeft = expiresAtRef.current - Math.floor(Date.now() / 1000);
      if (secondsLeft < REFRESH_BUFFER) {
        fetchAndSetUrl(selectedRecording.id).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [selectedRecording, fetchAndSetUrl]);

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // Edit handlers
  const handleEditOpen = (rec: any) => {
    setEditingRecording(rec);
    setEditTitle(rec.title || rec.classTitle);
    setEditDescription(rec.description || '');
  };

  const handleEditSave = async () => {
    if (!editingRecording) return;
    setEditSaving(true);
    try {
      await updateRecording(editingRecording.id, { title: editTitle, description: editDescription });
      toast.success('Recording updated');
      setEditingRecording(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  const handleSoftDelete = async (id: string) => {
    try {
      await deleteRecording(id);
      toast.success('Recording deleted');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      await deleteRecordingPermanent(id);
      toast.success('Recording permanently deleted');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreRecording(id);
      toast.success('Recording restored');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore');
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Class Recordings" subtitle="Watch recorded Zoom classes" />

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && (
        <>
          {/* Show deleted toggle — admin/course-creator only */}
          {(role === 'admin' || role === 'course-creator') && (
            <label className="flex items-center gap-2 text-sm text-gray-600 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="rounded border-gray-300"
              />
              Show deleted recordings
            </label>
          )}

          {recordings.length === 0 && (
            <EmptyState
              icon={<PlayCircle size={28} className="text-gray-400" />}
              title="No recordings yet"
              description="Recordings will appear here once your Zoom classes are completed and processed."
            />
          )}

          {recordings.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recordings.map((rec) => (
                <button
                  key={rec.id}
                  onClick={() => {
                    if (rec.deletedAt) return;
                    if (rec.status === 'ready' || isAdmin) openPlayer(rec);
                  }}
                  disabled={(rec.status !== 'ready' && !isAdmin) || !!rec.deletedAt}
                  className="group relative bg-white rounded-2xl card-shadow hover:card-shadow-hover transition-all duration-200 overflow-hidden text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Deleted overlay */}
                  {rec.deletedAt && (
                    <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center gap-2 z-10">
                      <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded">Deleted</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestore(rec.id); }}
                        className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100"
                      >
                        Restore
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePermanentDelete(rec.id); }}
                        className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                      >
                        Delete Forever
                      </button>
                    </div>
                  )}

                  {/* Edit/Delete buttons (hover reveal) */}
                  {isAdmin && !rec.deletedAt && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditOpen(rec); }}
                        className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-50"
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingId(rec.id); }}
                        className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                  {/* Thumbnail */}
                  <div className="aspect-video bg-gray-900 relative overflow-hidden">
                    {rec.thumbnailUrl ? (
                      <img
                        src={rec.thumbnailUrl}
                        alt={rec.title || rec.classTitle}
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
                    {isAdmin && rec.status === 'processing' && (
                      <span className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded font-medium">Processing</span>
                    )}
                    {isAdmin && rec.status === 'failed' && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded font-medium">Failed</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h4 className="font-semibold text-sm text-primary truncate">{rec.title || rec.classTitle}</h4>
                    {rec.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{rec.description}</p>
                    )}
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
        </>
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
                <h3 className="font-semibold text-primary">{selectedRecording.title || selectedRecording.classTitle}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedRecording.teacherName} &middot; {selectedRecording.scheduledDate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={closePlayer}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
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

      {/* Edit Recording Modal */}
      {editingRecording && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingRecording(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-primary mb-4">Edit Recording</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingRecording(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="px-4 py-2 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50"
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeletingId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-primary mb-2">Delete Recording?</h3>
            <p className="text-sm text-gray-600 mb-6">This will hide the recording from students. You can restore it later or delete permanently.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => { handleSoftDelete(deletingId); setDeletingId(null); }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700"
              >
                Delete
              </button>
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
