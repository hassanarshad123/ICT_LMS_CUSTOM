'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi } from '@/hooks/use-api';
import { getCourse } from '@/lib/api/courses';
import { listModules } from '@/lib/api/curriculum';
import { listMaterials, getUploadUrl, createMaterial, deleteMaterial } from '@/lib/api/materials';
import { listBatches } from '@/lib/api/batches';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Paperclip,
  Plus,
  Upload,
  Layers,
  Trash2,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { getDownloadUrl } from '@/lib/api/materials';
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

export default function TeacherCourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const { name, id } = useAuth();
  const basePath = useBasePath();

  const { data: course, loading: courseLoading, error: courseError } = useApi(
    () => getCourse(courseId),
    [courseId],
  );
  const { data: modules, loading: modulesLoading } = useApi(
    () => listModules(courseId),
    [courseId],
  );
  // Get teacher's batches to find the right batch for material operations
  const { data: batchesData } = useApi(
    () => listBatches({ teacher_id: id, per_page: 100 }),
    [id],
  );

  const teacherBatches = batchesData?.data || [];
  // Find the first batch linked to this course that belongs to this teacher
  const teacherBatchForCourse = teacherBatches.find(
    (b) => course?.batchIds?.includes(b.id),
  );
  const batchIdForMaterials = teacherBatchForCourse?.id;

  const { data: materialsData, loading: materialsLoading, refetch: refetchMaterials } = useApi(
    () => batchIdForMaterials
      ? listMaterials({ batch_id: batchIdForMaterials, course_id: courseId })
      : Promise.resolve({ data: [], total: 0, page: 1, perPage: 15, totalPages: 1 }),
    [batchIdForMaterials, courseId],
  );

  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [deleteMaterialConfirm, setDeleteMaterialConfirm] = useState<string | null>(null);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const loading = courseLoading || modulesLoading;

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading variant="detail" />
      </DashboardLayout>
    );
  }

  if (courseError || !course) {
    return (
      <DashboardLayout>
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Course not found</h3>
          <p className="text-sm text-gray-500 mb-4">{courseError || 'The course you are looking for does not exist.'}</p>
          <Link href={`${basePath}/courses`} className="text-sm font-medium text-primary hover:underline">
            Back to My Courses
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const sortedModules = [...(modules || [])].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const materials = materialsData?.data || [];

  const handleUploadMaterial = async () => {
    if (!materialFile || !materialTitle.trim() || !batchIdForMaterials) {
      toast.error(!batchIdForMaterials ? 'No batch linked to upload materials' : 'Please provide a title and select a file');
      return;
    }
    setUploading(true);
    try {
      // Step 1: Get presigned upload URL
      const { uploadUrl, objectKey } = await getUploadUrl({
        file_name: materialFile.name,
        content_type: materialFile.type || 'application/octet-stream',
        batch_id: batchIdForMaterials,
        course_id: courseId,
      });

      // Step 2: Upload file to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: materialFile,
        headers: { 'Content-Type': materialFile.type || 'application/octet-stream' },
      });

      // Step 3: Register material in backend
      const ext = materialFile.name.split('.').pop()?.toLowerCase() || 'other';
      await createMaterial({
        object_key: objectKey,
        title: materialTitle.trim(),
        file_name: materialFile.name,
        file_type: ext,
        batch_id: batchIdForMaterials,
        description: materialDescription.trim() || undefined,
        file_size_bytes: materialFile.size,
        course_id: courseId,
      });

      toast.success('Material uploaded');
      setMaterialFile(null);
      setMaterialTitle('');
      setMaterialDescription('');
      setShowMaterialForm(false);
      refetchMaterials();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    try {
      await deleteMaterial(materialId);
      toast.success('Material deleted');
      refetchMaterials();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDownload = async (materialId: string) => {
    try {
      const { downloadUrl } = await getDownloadUrl(materialId);
      window.open(downloadUrl, '_blank');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <DashboardLayout>
      {/* Header Banner */}
      <div className="bg-primary rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link href={`${basePath}/courses`} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ArrowLeft size={16} />
          Back to My Courses
        </Link>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-white mb-2">{course.title}</h1>
          <p className="text-sm text-gray-300 max-w-2xl mb-3">{course.description}</p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              course.status === 'active' ? 'bg-green-100 text-green-700' :
              course.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {course.status?.charAt(0).toUpperCase() + course.status?.slice(1)}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Layers size={14} />
              {(course.batchIds || []).length} batch(es)
            </div>
          </div>
        </div>
      </div>

      {/* Curriculum Modules */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">Curriculum</h3>
        {sortedModules.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No curriculum modules for this course.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedModules.map((mod) => {
              const isExpanded = expandedModule === mod.id;
              return (
                <div key={mod.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-accent bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{mod.sequenceOrder}</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-primary">{mod.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{mod.description}</p>
                      </div>
                    </div>
                    {(mod.topics || []).length > 0 && (
                      isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />
                    )}
                  </button>
                  {isExpanded && (mod.topics || []).length > 0 && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="ml-11 border-t border-gray-100 pt-3">
                        <ul className="space-y-2">
                          {mod.topics!.map((topic, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                              {topic}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Course Materials */}
      <div className="bg-white rounded-2xl card-shadow p-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Paperclip size={20} className="text-primary" />
            <h3 className="text-lg font-semibold text-primary">Course Materials</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {materials.length}
            </span>
          </div>
          {!showMaterialForm && batchIdForMaterials && (
            <button
              onClick={() => setShowMaterialForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
            >
              <Plus size={14} />
              Upload Material
            </button>
          )}
        </div>

        {showMaterialForm && (
          <div className="bg-gray-50 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-semibold text-primary mb-4">Upload New Material</h4>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                <input
                  type="text"
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white"
                  placeholder="Material title"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={materialDescription}
                  onChange={(e) => setMaterialDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white"
                  placeholder="Brief description of the material"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">File</label>
                <label className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer block hover:border-gray-300 transition-colors bg-white">
                  <Upload size={20} className="text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">
                    {materialFile ? materialFile.name : 'Click to browse or drag and drop'}
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setMaterialFile(f);
                        if (!materialTitle) setMaterialTitle(f.name.replace(/\.[^.]+$/, ''));
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleUploadMaterial}
                disabled={uploading}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-60"
              >
                {uploading && <Loader2 size={16} className="animate-spin" />}
                Upload
              </button>
              <button
                onClick={() => { setShowMaterialForm(false); setMaterialFile(null); setMaterialTitle(''); setMaterialDescription(''); }}
                className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {materialsLoading ? (
          <div className="animate-pulse bg-gray-200 rounded-xl h-24" />
        ) : materials.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No materials uploaded for this course yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {materials.map((material: any) => (
              <div key={material.id} className="border border-gray-100 rounded-xl p-4 flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-primary truncate">{material.title}</h4>
                  {material.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{material.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    {material.fileSize && <span>{material.fileSize}</span>}
                    {material.uploadDate && (
                      <>
                        {material.fileSize && <span className="text-gray-300">|</span>}
                        <span>{new Date(material.uploadDate).toLocaleDateString()}</span>
                      </>
                    )}
                    {material.uploadedByName && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>by {material.uploadedByName}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(material.id)}
                    className="p-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteMaterialConfirm(material.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Delete Material Confirmation */}
      <AlertDialog open={!!deleteMaterialConfirm} onOpenChange={() => setDeleteMaterialConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Material</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this material? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteMaterialConfirm) handleDeleteMaterial(deleteMaterialConfirm);
                setDeleteMaterialConfirm(null);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
