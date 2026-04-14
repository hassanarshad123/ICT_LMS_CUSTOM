'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useUpload } from '@/lib/upload-context';
import type { FileMetadata } from '@/lib/upload-context';
import { useApi } from '@/hooks/use-api';
import { listBatches, listBatchCourses } from '@/lib/api/batches';
import { listLectures, LectureOut } from '@/lib/api/lectures';
import UploadQueue from '@/components/shared/upload-queue';
import LectureDrawer from '@/components/shared/lecture-drawer';
import { titleFromFilename } from '@/lib/utils/format';
import { toast } from 'sonner';
import { SearchableCombobox, type ComboboxOption } from '@/components/ui/searchable-combobox';
import { UploadDropZone } from './upload-drop-zone';
import { UploadExistingLectures } from './upload-existing-lectures';
import { UploadMetadataDialog, type PendingFile } from './upload-metadata-dialog';

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

  const { data: batchesData } = useApi(() => listBatches({ per_page: 100 }), []);
  const batches = batchesData?.data || [];

  const [courses, setCourses] = useState<any[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  const batchOptions = useMemo<ComboboxOption[]>(
    () => batches.map((b: any) => ({ value: b.id, label: b.name })),
    [batches],
  );
  const courseOptions = useMemo<ComboboxOption[]>(
    () => courses.map((c: any) => ({ value: c.id, label: c.title })),
    [courses],
  );

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

  const handleMetadataOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setShowMetadataDialog(false);
      setPendingFiles([]);
    }
  }, []);

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
            <SearchableCombobox
              options={batchOptions}
              value={selectedBatchId}
              onChange={(val) => {
                setSelectedBatchId(val);
                const b = batches.find((b: any) => b.id === val);
                setSelectedBatchName(b?.name || '');
              }}
              placeholder="Select a batch"
              searchPlaceholder="Search batches..."
              emptyMessage="No batches found"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Course
            </label>
            <SearchableCombobox
              options={courseOptions}
              value={selectedCourseId}
              onChange={(val) => {
                setSelectedCourseId(val);
                const c = courses.find((c: any) => c.id === val);
                setSelectedCourseName(c?.title || '');
              }}
              disabled={!selectedBatchId || coursesLoading}
              placeholder={
                !selectedBatchId
                  ? 'Select a batch first'
                  : coursesLoading
                    ? 'Loading courses...'
                    : courses.length === 0
                      ? 'No courses linked'
                      : 'Select a course'
              }
              searchPlaceholder="Search courses..."
              emptyMessage="No courses found"
            />
          </div>
        </div>

        {/* Drop Zone */}
        <UploadDropZone
          canDrop={!!canDrop}
          isDragOver={isDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onFilesSelected={handleFiles}
        />

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
          <UploadExistingLectures
            lectures={lectures}
            lecturesLoading={lecturesLoading}
            onLectureClick={(lectureId) => setDrawerLectureId(lectureId)}
          />
        )}
      </div>

      <LectureDrawer
        lectureId={drawerLectureId}
        onClose={() => setDrawerLectureId(null)}
        onSaved={refreshLectures}
        onDeleted={refreshLectures}
      />

      {/* Video Metadata Dialog */}
      <UploadMetadataDialog
        open={showMetadataDialog}
        pendingFiles={pendingFiles}
        onOpenChange={handleMetadataOpenChange}
        onConfirm={handleConfirmUpload}
        onUpdateFile={updatePendingFile}
        onRemoveFile={removePendingFile}
      />
    </DashboardLayout>
  );
}
