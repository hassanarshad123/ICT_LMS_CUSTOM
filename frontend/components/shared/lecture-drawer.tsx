'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getLecture,
  updateLecture,
  deleteLecture,
  getSignedUrl,
  LectureOut,
} from '@/lib/api/lectures';
import { formatFileSize } from '@/lib/utils/format';
import { toast } from 'sonner';
import {
  Video,
  Save,
  Trash2,
  Calendar,
  HardDrive,
  Clock,
  Loader2,
} from 'lucide-react';

interface LectureDrawerProps {
  lectureId: string | null;
  onClose: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
}

export default function LectureDrawer({
  lectureId,
  onClose,
  onSaved,
  onDeleted,
}: LectureDrawerProps) {
  const [lecture, setLecture] = useState<LectureOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const fetchLecture = useCallback(async (id: string) => {
    // Clear stale state immediately when switching lectures
    setLecture(null);
    setEmbedUrl(null);
    setTitle('');
    setDescription('');
    setLoading(true);
    try {
      const data = await getLecture(id);
      setLecture(data);
      setTitle(data.title);
      setDescription(data.description || '');

      // Get signed URL for playback if ready
      if (data.videoStatus === 'ready' && data.videoType === 'upload') {
        try {
          const signed = await getSignedUrl(id);
          setEmbedUrl(signed.url);
        } catch {
          // CC might not have access yet; ignore
        }
      }
    } catch {
      toast.error('Failed to load lecture');
      onCloseRef.current();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (lectureId) {
      fetchLecture(lectureId);
    } else {
      setLecture(null);
      setEmbedUrl(null);
      setTitle('');
      setDescription('');
    }
  }, [lectureId, fetchLecture]);

  const handleSave = async () => {
    if (!lecture) return;
    setSaving(true);
    try {
      const updated = await updateLecture(lecture.id, {
        title: title.trim(),
        description: description.trim() || null,
      });
      setLecture(updated);
      toast.success('Lecture updated');
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!lecture) return;
    setDeleting(true);
    try {
      await deleteLecture(lecture.id);
      toast.success('Lecture deleted');
      setShowDeleteConfirm(false);
      onClose();
      onDeleted?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const statusBadge = (status?: string) => {
    if (status === 'ready')
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Ready</Badge>;
    if (status === 'processing' || status === 'pending')
      return <Badge variant="outline" className="border-amber-300 text-amber-700">Processing</Badge>;
    if (status === 'failed')
      return <Badge variant="destructive">Failed</Badge>;
    return <Badge variant="secondary">Unknown</Badge>;
  };

  return (
    <>
      <Sheet open={!!lectureId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Lecture Details</SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="w-full h-48 rounded-xl" />
              <Skeleton className="w-3/4 h-5" />
              <Skeleton className="w-full h-10" />
              <Skeleton className="w-full h-20" />
            </div>
          ) : lecture ? (
            <div className="space-y-5 mt-6">
              {/* Video / Thumbnail / Placeholder */}
              {embedUrl ? (
                <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="w-full aspect-video bg-gray-100 rounded-xl overflow-hidden">
                  {lecture.thumbnailUrl ? (
                    <img
                      src={lecture.thumbnailUrl}
                      alt={lecture.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video size={32} className="text-gray-300" />
                    </div>
                  )}
                </div>
              )}

              {/* Status */}
              <div className="flex items-center gap-2">
                {statusBadge(lecture.videoStatus)}
                {lecture.videoType === 'external' && (
                  <Badge variant="secondary">External</Badge>
                )}
              </div>

              {/* Editable Title */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Lecture title"
                />
              </div>

              {/* Editable Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Description
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Lecture description"
                  rows={3}
                />
              </div>

              {/* Meta info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {lecture.durationDisplay && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={14} className="text-gray-400" />
                    {lecture.durationDisplay}
                  </div>
                )}
                {lecture.fileSize && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <HardDrive size={14} className="text-gray-400" />
                    {formatFileSize(lecture.fileSize)}
                  </div>
                )}
                {lecture.createdAt && (
                  <div className="flex items-center gap-2 text-gray-600 col-span-2">
                    <Calendar size={14} className="text-gray-400" />
                    {new Date(lecture.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  className="flex-1"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : (
                    <Save size={16} className="mr-2" />
                  )}
                  Save
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => !open && setShowDeleteConfirm(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lecture</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{lecture?.title}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <Loader2 size={14} className="animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
