'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi, useMutation } from '@/hooks/use-api';
import { getCourse } from '@/lib/api/courses';
import { listModules, createModule, updateModule, deleteModule } from '@/lib/api/curriculum';
import { listBatches, linkCourse, unlinkCourse } from '@/lib/api/batches';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  Layers,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  Trash2,
  FolderOpen,
  Edit3,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
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

export default function CourseCreatorCourseDetail() {
  const params = useParams();
  const courseId = params.courseId as string;
  const { name } = useAuth();
  const basePath = useBasePath();

  const { data: course, loading: courseLoading, error: courseError, refetch: refetchCourse } = useApi(
    () => getCourse(courseId),
    [courseId],
  );
  const { data: modules, loading: modulesLoading, refetch: refetchModules } = useApi(
    () => listModules(courseId),
    [courseId],
  );
  const { data: batchesData, loading: batchesLoading, refetch: refetchBatches } = useApi(
    () => listBatches({ per_page: 100 }),
  );

  const { execute: doCreateModule, loading: creatingModule } = useMutation(createModule);
  const { execute: doUpdateModule } = useMutation(updateModule);
  const { execute: doDeleteModule } = useMutation(deleteModule);
  const { execute: doLinkCourse } = useMutation(linkCourse);
  const { execute: doUnlinkCourse } = useMutation(unlinkCourse);

  const [showBatchDropdown, setShowBatchDropdown] = useState(false);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: '', description: '', topics: '' });
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', topics: '' });
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);

  const loading = courseLoading || modulesLoading || batchesLoading;

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
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">Course not found</h3>
          <p className="text-sm text-gray-500 mb-4">{courseError || 'The course you are looking for does not exist.'}</p>
          <Link href={`${basePath}/courses`} className="text-sm font-medium text-[#1A1A1A] hover:underline">
            Back to Courses
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const allBatches = batchesData?.data || [];
  const linkedBatchIds = course.batchIds || [];
  const linkedBatches = allBatches.filter((b) => linkedBatchIds.includes(b.id));
  const unlinkedBatches = allBatches.filter((b) => !linkedBatchIds.includes(b.id));
  const sortedModules = [...(modules || [])].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleForm.title.trim()) return;
    try {
      await doCreateModule({
        course_id: courseId,
        title: moduleForm.title.trim(),
        description: moduleForm.description.trim() || undefined,
        topics: moduleForm.topics.split(',').map((t) => t.trim()).filter(Boolean),
      });
      toast.success('Module added');
      setModuleForm({ title: '', description: '', topics: '' });
      setShowModuleForm(false);
      refetchModules();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateModule = async (moduleId: string) => {
    try {
      await doUpdateModule(moduleId, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        topics: editForm.topics.split(',').map((t) => t.trim()).filter(Boolean),
      });
      toast.success('Module updated');
      setEditingModuleId(null);
      refetchModules();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    try {
      await doDeleteModule(moduleId);
      toast.success('Module deleted');
      setDeleteModuleId(null);
      refetchModules();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteModuleId(null);
    }
  };

  const handleLinkBatch = async (batchId: string) => {
    try {
      await doLinkCourse(batchId, courseId);
      toast.success('Batch linked');
      setShowBatchDropdown(false);
      refetchCourse();
      refetchBatches();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUnlinkBatch = async (batchId: string) => {
    try {
      await doUnlinkCourse(batchId, courseId);
      toast.success('Batch unlinked');
      refetchCourse();
      refetchBatches();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <DashboardLayout>
      {/* Dark Header Banner */}
      <div className="bg-[#1A1A1A] rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link
          href={`${basePath}/courses`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Courses
        </Link>
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
            {linkedBatches.length} batches
          </div>
        </div>
      </div>

      {/* Linked Batches Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#1A1A1A]">Linked Batches</h3>
          <div className="relative">
            <button
              onClick={() => setShowBatchDropdown(!showBatchDropdown)}
              disabled={unlinkedBatches.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Add Batch
            </button>
            {showBatchDropdown && unlinkedBatches.length > 0 && (
              <div className="absolute top-12 right-0 bg-white rounded-xl card-shadow border border-gray-100 py-2 z-10 min-w-[280px]">
                {unlinkedBatches.map((batch) => (
                  <button
                    key={batch.id}
                    onClick={() => handleLinkBatch(batch.id)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1A]">{batch.name}</p>
                      <p className="text-xs text-gray-400">{batch.studentCount} students</p>
                    </div>
                    <Plus size={14} className="text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {linkedBatches.length === 0 ? (
          <EmptyState
            icon={<Layers size={28} className="text-gray-400" />}
            title="No batches linked"
            description='Click "Add Batch" to link a batch to this course.'
          />
        ) : (
          <div className="space-y-4">
            {linkedBatches.map((batch) => (
              <div key={batch.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center">
                      <Layers size={18} className="text-[#1A1A1A]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-[#1A1A1A]">{batch.name}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          batch.status === 'active' ? 'bg-green-100 text-green-700' :
                          batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {batch.status}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Users size={12} />
                          {batch.studentCount} students
                        </span>
                        <span className="text-xs text-gray-400">{batch.teacherName || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Link
                      href={`${basePath}/batches/${batch.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1A] text-white text-xs font-medium rounded-lg hover:bg-[#333] transition-colors"
                    >
                      <FolderOpen size={12} />
                      Manage Content
                    </Link>
                    <button
                      onClick={() => handleUnlinkBatch(batch.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Unlink batch from course"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Curriculum Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#1A1A1A]">Curriculum</h3>
          {!showModuleForm && (
            <button
              onClick={() => setShowModuleForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
            >
              <Plus size={14} />
              Add Module
            </button>
          )}
        </div>

        {showModuleForm && (
          <div className="bg-white rounded-2xl p-6 card-shadow mb-4">
            <h4 className="text-sm font-semibold text-[#1A1A1A] mb-4">New Module</h4>
            <form onSubmit={handleAddModule} className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                <input
                  type="text"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                  placeholder="Module title"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                  placeholder="Module description"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Topics (comma separated)</label>
                <input
                  type="text"
                  value={moduleForm.topics}
                  onChange={(e) => setModuleForm({ ...moduleForm, topics: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                  placeholder="Topic 1, Topic 2, Topic 3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creatingModule}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors disabled:opacity-60"
                >
                  {creatingModule && <Loader2 size={16} className="animate-spin" />}
                  Add Module
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModuleForm(false); setModuleForm({ title: '', description: '', topics: '' }); }}
                  className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {sortedModules.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 card-shadow text-center">
            <BookOpen size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No curriculum modules yet. Add your first module.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedModules.map((mod) => {
              const isEditing = editingModuleId === mod.id;
              const isExpanded = expandedModule === mod.id;
              return (
                <div key={mod.id} className="bg-white rounded-xl card-shadow overflow-hidden">
                  {isEditing ? (
                    <div className="p-4">
                      <div className="space-y-3 mb-3">
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A]"
                          placeholder="Module title"
                        />
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A]"
                          placeholder="Description"
                        />
                        <input
                          type="text"
                          value={editForm.topics}
                          onChange={(e) => setEditForm({ ...editForm, topics: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A]"
                          placeholder="Topic 1, Topic 2"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateModule(mod.id)}
                          className="px-4 py-2 bg-[#1A1A1A] text-white text-sm font-medium rounded-xl hover:bg-[#333] transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingModuleId(null)}
                          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-4">
                        <button
                          onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                          className="flex items-center gap-3 flex-1 text-left"
                        >
                          <div className="w-8 h-8 bg-[#C5D86D] bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-[#1A1A1A]">{mod.sequenceOrder}</span>
                          </div>
                          <div>
                            <h4 className="font-medium text-sm text-[#1A1A1A]">{mod.title}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">{mod.description}</p>
                          </div>
                          {(mod.topics || []).length > 0 && (
                            isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />
                          )}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingModuleId(mod.id);
                              setEditForm({
                                title: mod.title,
                                description: mod.description || '',
                                topics: (mod.topics || []).join(', '),
                              });
                            }}
                            className="p-2 text-gray-400 hover:text-[#1A1A1A] hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteModuleId(mod.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {isExpanded && (mod.topics || []).length > 0 && (
                        <div className="px-4 pb-4">
                          <div className="ml-11 border-t border-gray-100 pt-3">
                            <ul className="space-y-1.5">
                              {mod.topics!.map((topic, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#C5D86D]" />
                                  {topic}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <AlertDialog open={!!deleteModuleId} onOpenChange={(open) => !open && setDeleteModuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Module</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this curriculum module? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteModuleId && handleDeleteModule(deleteModuleId)} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
