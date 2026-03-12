'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as tus from 'tus-js-client';
import { initVideoUpload, getLectureStatus, deleteLecture } from '@/lib/api/lectures';

export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'error'
  | 'cancelled';

export interface UploadItem {
  id: string;
  file: File;
  title: string;
  description?: string;
  batchId: string;
  batchName: string;
  courseId: string;
  courseName: string;
  lectureId?: string;
  status: UploadStatus;
  progress: number;
  error?: string;
}

export interface FileMetadata {
  file: File;
  title: string;
  description?: string;
}

interface UploadContextType {
  items: UploadItem[];
  isUploading: boolean;
  activeCount: number;
  overallProgress: number;
  addFiles: (
    files: FileMetadata[],
    batchId: string,
    batchName: string,
    courseId: string,
    courseName: string,
  ) => void;
  cancelUpload: (id: string) => void;
  retryUpload: (id: string) => void;
  removeItem: (id: string) => void;
  clearCompleted: () => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export function useUpload(): UploadContextType {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload must be used inside UploadProvider');
  return ctx;
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  const tusUploads = useRef<Record<string, tus.Upload>>({});
  const pollingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pollingStartTimes = useRef<Record<string, number>>({});
  const nextIdRef = useRef(1);
  const POLLING_TIMEOUT_MS = 60 * 60 * 1000;

  // Keep ref in sync for stale-closure-safe reads
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // --- beforeunload warning ---
  const hasActive = items.some((i) =>
    ['queued', 'uploading', 'processing'].includes(i.status),
  );
  useEffect(() => {
    if (!hasActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasActive]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      Object.values(tusUploads.current).forEach((u) => {
        try { u.abort(); } catch { /* best effort */ }
      });
      Object.values(pollingTimers.current).forEach(clearTimeout);
    };
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<UploadItem>) =>
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      ),
    [],
  );

  const startStatusPolling = useCallback(
    (queueId: string, lectureId: string) => {
      pollingStartTimes.current[queueId] = Date.now();

      const poll = async () => {
        const elapsed =
          Date.now() - (pollingStartTimes.current[queueId] || 0);
        if (elapsed > POLLING_TIMEOUT_MS) {
          delete pollingTimers.current[queueId];
          delete pollingStartTimes.current[queueId];
          updateItem(queueId, {
            status: 'error',
            error: 'Processing timed out after 1 hour.',
          });
          return;
        }

        try {
          const res = await getLectureStatus(lectureId);
          if (res.videoStatus === 'ready') {
            delete pollingTimers.current[queueId];
            delete pollingStartTimes.current[queueId];
            updateItem(queueId, { status: 'ready', progress: 100 });
            return;
          }
          if (res.videoStatus === 'failed') {
            delete pollingTimers.current[queueId];
            delete pollingStartTimes.current[queueId];
            updateItem(queueId, {
              status: 'failed',
              error: 'Encoding failed',
            });
            return;
          }
        } catch {
          // keep polling on network blips
        }

        const interval =
          elapsed < 2 * 60 * 1000
            ? 5000
            : elapsed < 10 * 60 * 1000
              ? 15000
              : 30000;
        pollingTimers.current[queueId] = setTimeout(poll, interval);
      };

      pollingTimers.current[queueId] = setTimeout(poll, 5000);
    },
    [updateItem],
  );

  const startUpload = useCallback(
    async (queueId: string) => {
      // Read from ref to avoid stale closure
      const item = itemsRef.current.find((i) => i.id === queueId);
      if (!item) return;

      updateItem(queueId, { status: 'uploading', progress: 0 });

      try {
        const res = await initVideoUpload({
          title: item.title,
          batch_id: item.batchId,
          course_id: item.courseId,
          file_size: item.file.size,
          ...(item.description ? { description: item.description } : {}),
        });

        const lectureId = res.lecture.id;
        updateItem(queueId, { lectureId });

        // Use chunkSize only — parallelUploads conflicts with chunkSize in tus-js-client
        const upload = new tus.Upload(item.file, {
          endpoint: res.tusEndpoint,
          chunkSize: 50 * 1024 * 1024,
          retryDelays: [0, 3000, 5000, 10000, 15000],
          storeFingerprintForResuming: true,
          removeFingerprintOnSuccess: true,
          headers: {
            AuthorizationSignature: res.authSignature,
            AuthorizationExpire: String(res.authExpire),
            VideoId: res.videoId,
            LibraryId: res.libraryId,
          },
          metadata: {
            filetype: item.file.type,
            title: item.title,
          },
          onProgress: (bytesSent, bytesTotal) => {
            const pct = Math.round((bytesSent / bytesTotal) * 100);
            updateItem(queueId, { progress: pct, status: 'uploading' });
          },
          onSuccess: () => {
            delete tusUploads.current[queueId];
            updateItem(queueId, { progress: 100, status: 'processing' });
            startStatusPolling(queueId, lectureId);
          },
          onError: (err) => {
            // Clear the stale TUS upload on error so retry re-initializes
            delete tusUploads.current[queueId];
            updateItem(queueId, {
              status: 'error',
              error: err.message,
            });
          },
        });

        tusUploads.current[queueId] = upload;
        upload.start();
      } catch (err: any) {
        updateItem(queueId, {
          status: 'error',
          error: err.message || 'Failed to initialize upload',
        });
      }
    },
    [updateItem, startStatusPolling],
  );

  // --- Start next queued item ---
  useEffect(() => {
    const uploading = items.find((i) => i.status === 'uploading');
    if (uploading) return;

    const next = items.find((i) => i.status === 'queued');
    if (!next) return;

    startUpload(next.id);
  }, [items, startUpload]);

  // --- Public API ---

  const addFiles = useCallback(
    (
      files: FileMetadata[],
      batchId: string,
      batchName: string,
      courseId: string,
      courseName: string,
    ) => {
      const MAX_SIZE = 10 * 1024 * 1024 * 1024;
      const newItems: UploadItem[] = [];

      for (const { file, title, description } of files) {
        if (!file.type.startsWith('video/')) continue;
        if (file.size > MAX_SIZE) continue;
        newItems.push({
          id: `uq-${nextIdRef.current++}`,
          file,
          title,
          description,
          batchId,
          batchName,
          courseId,
          courseName,
          status: 'queued',
          progress: 0,
        });
      }

      if (newItems.length > 0) {
        setItems((prev) => [...prev, ...newItems]);
      }
    },
    [],
  );

  const cancelUpload = useCallback(
    (id: string) => {
      // Read from ref to avoid stale closure
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;

      // Only allow cancelling queued/uploading items
      if (item.status !== 'queued' && item.status !== 'uploading') return;

      // Abort TUS upload
      const tusUpload = tusUploads.current[id];
      if (tusUpload) {
        try { tusUpload.abort(); } catch { /* best effort */ }
        delete tusUploads.current[id];
      }

      // Clear polling
      if (pollingTimers.current[id]) {
        clearTimeout(pollingTimers.current[id]);
        delete pollingTimers.current[id];
        delete pollingStartTimes.current[id];
      }

      // Delete lecture record if created
      if (item.lectureId) {
        deleteLecture(item.lectureId).catch(() => {});
      }

      updateItem(id, { status: 'cancelled' });
    },
    [updateItem],
  );

  const retryUpload = useCallback(
    (id: string) => {
      // Always re-queue for fresh credentials (TUS auth may have expired)
      delete tusUploads.current[id];
      updateItem(id, { status: 'queued', progress: 0, error: undefined, lectureId: undefined });
    },
    [updateItem],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    delete tusUploads.current[id];
    if (pollingTimers.current[id]) {
      clearTimeout(pollingTimers.current[id]);
      delete pollingTimers.current[id];
    }
  }, []);

  const clearCompleted = useCallback(() => {
    setItems((prev) =>
      prev.filter(
        (i) => !['ready', 'failed', 'cancelled', 'error'].includes(i.status),
      ),
    );
  }, []);

  const activeCount = items.filter((i) =>
    ['queued', 'uploading', 'processing'].includes(i.status),
  ).length;

  const overallProgress = (() => {
    const active = items.filter((i) =>
      ['queued', 'uploading', 'processing'].includes(i.status),
    );
    if (active.length === 0) return 0;
    return Math.round(
      active.reduce((sum, i) => sum + i.progress, 0) / active.length,
    );
  })();

  return (
    <UploadContext.Provider
      value={{
        items,
        isUploading: items.some((i) => i.status === 'uploading'),
        activeCount,
        overallProgress,
        addFiles,
        cancelUpload,
        retryUpload,
        removeItem,
        clearCompleted,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}
