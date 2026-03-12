'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useUpload } from '@/lib/upload-context';
import type { FileMetadata } from '@/lib/upload-context';
import { useApi } from '@/hooks/use-api';
import { listBatches, listBatchCourses } from '@/lib/api/batches';
import { listLectures, LectureOut } from '@/lib/api/lectures';
import UploadQueue from '@/components/shared/upload-queue';
import LectureDrawer from '@/components/shared/lecture-drawer';
import { formatFileSize, titleFromFilename } from '@/lib/utils/format';
import { toast } from 'sonner';
import {
  Upload,
  Video,
  Clock,
  X,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface PendingFile {
  file: File;
  title: string;
  description: string;
}

export default function UploadVideos() {
  const { name } = useAuth();
  const { addFiles } = useUpload();

  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [drawerLectureId, setDrawerLectureId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: batchesData } = useApi(() => listBatches({ per_page: 100 }), []);
  const batches = batchesData?.data || [];

  const [courses, setCourses] = useState<any[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  // Load courses when batch changes
  useEffect(() => {
    if (!selectedBatchId) {
      setCourses([]);
      setSelectedCourseId('');
      return;
    }
    setCoursesLoading(true);
    setSelectedCourseId('');
    listBatchCourses(selectedBatchId)
      .then((data) => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]))
      .finally(() => setCoursesLoading(false));
  }, [selectedBatchId]);

  // Existing lectures for selected batch/course
  const [lectures, setLectures] = useState<LectureOut[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);

  useEffect(() => {
    if (!selectedBatchId || !selectedCourseId) {
      setLectures([]);
      return;
    }
    setLecturesLoading(true);
    listLectures({
      batch_id: selectedBatchId,
      course_id: selectedCourseId,
      per_page: 100,
    })
      .then((res) => setLectures(res.data || []))
      .catch(() => setLectures([]))
      .finally(() => setLecturesLoading(false));
  }, [selectedBatchId, selectedCourseId]);

  const refreshLectures = useCallback(() => {
    if (!selectedBatchId || !selectedCourseId) return;
    listLectures({
      batch_id: selectedBatchId,
      course_id: selectedCourseId,
      per_page: 100,
    })
      .then((res) => setLectures(res.data || []))
      .catch(() => {});
  }, [selectedBatchId, selectedCourseId]);

  const canDrop = selectedBatchId && selectedCourseId;

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (!selectedBatchId || !selectedCourseId) {
        toast.error('Select a batch and course first');
        return;
      }

      const videoFiles: PendingFile[] = [];
      const rejected: string[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.startsWith('video/')) {
          rejected.push(`${file.name} (not a video)`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024 * 1024) {
          rejected.push(`${file.name} (exceeds 10 GB)`);
          continue;
        }
        videoFiles.push({
          file,
          title: titleFromFilename(file.name),
          description: '',
        });
      }

      if (rejected.length > 0) {
        toast.error(`Rejected: ${rejected.join(', ')}`);
      }

      if (videoFiles.length > 0) {
        setPendingFiles(videoFiles);
        setShowMetadataDialog(true);
      }
    },
    [selectedBatchId, selectedCourseId],
  );

  const handleConfirmUpload = useCallback(() => {
    const valid = pendingFiles.filter((pf) => pf.title.trim().length > 0);
    if (valid.length === 0) {
      toast.error('Each video must have a title');
      return;
    }

    const fileMetadata: FileMetadata[] = valid.map((pf) => ({
      file: pf.file,
      title: pf.title.trim(),
      description: pf.description.trim() || undefined,
    }));

    addFiles(
      fileMetadata,
      selectedBatchId,
      selectedBatchName,
      selectedCourseId,
      selectedCourseName,
    );

    toast.success(`${valid.length} video(s) added to queue`);
    setShowMetadataDialog(false);
    setPendingFiles([]);
  }, [pendingFiles, addFiles, selectedBatchId, selectedBatchName, selectedCourseId, selectedCourseName]);

  const updatePendingFile = useCallback((index: number, field: 'title' | 'description', value: string) => {
    setPendingFiles((prev) =>
      prev.map((pf, i) => (i === index ? { ...pf, [field]: value } : pf)),
    );
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setShowMetadataDialog(false);
      return next;
    });
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (canDrop) setIsDragOver(true);
    },
    [canDrop],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only clear drag state when leaving the drop zone entirely (not entering a child)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!canDrop) return;
      handleFiles(e.dataTransfer.files);
    },
    [canDrop, handleFiles],
  );

  const statusBadge = (status?: string) => {
    if (status === 'ready')
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
          Ready
        </span>
      );
    if (status === 'processing' || status === 'pending')
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
          Processing
        </span>
      );
    if (status === 'failed')
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
          Failed
        </span>
      );
    return null;
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Upload Videos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Select a batch and course, then drag & drop your video files.
          </p>
        </div>

        {/* Destination Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Batch
            </label>
            <Select
              value={selectedBatchId}
              onValueChange={(val) => {
                setSelectedBatchId(val);
                const b = batches.find((b: any) => b.id === val);
                setSelectedBatchName(b?.name || '');
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a batch" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Course
            </label>
            <Select
              value={selectedCourseId}
              onValueChange={(val) => {
                setSelectedCourseId(val);
                const c = courses.find((c: any) => c.id === val);
                setSelectedCourseName(c?.title || '');
              }}
              disabled={!selectedBatchId || coursesLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    !selectedBatchId
                      ? 'Select a batch first'
                      : coursesLoading
                        ? 'Loading courses...'
                        : courses.length === 0
                          ? 'No courses linked'
                          : 'Select a course'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => canDrop && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer mb-6 ${
            !canDrop
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              : isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 bg-white hover:border-primary/50 hover:bg-gray-50'
          }`}
        >
          <Upload
            size={36}
            className={`mx-auto mb-3 ${isDragOver ? 'text-primary' : 'text-gray-400'}`}
          />
          {canDrop ? (
            <>
              <p className="text-sm font-medium text-gray-700">
                Drag & drop your videos here
              </p>
              <p className="text-xs text-gray-500 mt-1">
                or click to browse &middot; MP4, WebM, MOV &middot; up to 10 GB
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Select a batch and course first
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
        </div>

        {/* Upload Queue */}
        <div className="mb-8">
          <UploadQueue
            batchId={selectedBatchId || undefined}
            courseId={selectedCourseId || undefined}
            onEditLecture={(lectureId) => {
              setDrawerLectureId(lectureId);
              refreshLectures();
            }}
          />
        </div>

        {/* Existing Lectures */}
        {selectedBatchId && selectedCourseId && (
          <div>
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-4">
              Existing Lectures ({lectures.length})
            </h2>
            {lecturesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
              </div>
            ) : lectures.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
                <Video size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  No lectures yet. Upload your first video above.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...lectures]
                  .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                  .map((lecture) => (
                    <button
                      key={lecture.id}
                      onClick={() => setDrawerLectureId(lecture.id)}
                      className="w-full flex items-center gap-4 p-3 bg-white rounded-xl border border-gray-100 hover:border-primary/30 hover:shadow-sm transition-all text-left"
                    >
                      {/* Thumbnail */}
                      <div className="w-24 h-14 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {lecture.thumbnailUrl ? (
                          <img
                            src={lecture.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video size={18} className="text-gray-300" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {lecture.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                          {lecture.durationDisplay && (
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {lecture.durationDisplay}
                            </span>
                          )}
                          {lecture.fileSize && (
                            <span>{formatFileSize(lecture.fileSize)}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {statusBadge(lecture.videoStatus)}
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      <LectureDrawer
        lectureId={drawerLectureId}
        onClose={() => setDrawerLectureId(null)}
        onSaved={refreshLectures}
        onDeleted={refreshLectures}
      />

      {/* Video Metadata Dialog */}
      <Dialog
        open={showMetadataDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowMetadataDialog(false);
            setPendingFiles([]);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {pendingFiles.length === 1
                ? 'Video Details'
                : `Video Details (${pendingFiles.length} files)`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {pendingFiles.map((pf, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Video size={16} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-500 truncate">
                      {pf.file.name} &middot; {formatFileSize(pf.file.size)}
                    </span>
                  </div>
                  {pendingFiles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePendingFile(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pf.title}
                    onChange={(e) => updatePendingFile(idx, 'title', e.target.value)}
                    placeholder="Enter video title"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Description <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={pf.description}
                    onChange={(e) => updatePendingFile(idx, 'description', e.target.value)}
                    placeholder="Brief description of this lecture"
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => {
                setShowMetadataDialog(false);
                setPendingFiles([]);
              }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmUpload}
              disabled={pendingFiles.some((pf) => !pf.title.trim())}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pendingFiles.length === 1 ? 'Upload' : `Upload ${pendingFiles.length} Videos`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
