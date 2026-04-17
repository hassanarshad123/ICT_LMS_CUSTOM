'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi, useMutation } from '@/hooks/use-api';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { getBatch, listBatchCourses, listBatchStudents, enrollStudent, updateBatch, toggleEnrollmentActive } from '@/lib/api/batches';
import { listUsers } from '@/lib/api/users';
import { listLectures, createLecture, deleteLecture, bulkReorderLectures, LectureOut } from '@/lib/api/lectures';
import { listMaterials, getUploadUrl, createMaterial, deleteMaterial } from '@/lib/api/materials';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import LectureDrawer from '@/components/shared/lecture-drawer';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  ArrowLeft,
  BookOpen,
  Users,
  Layers,
  Pencil,
  X,
  Loader2 as Loader2Icon,
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
import { BatchStudentSection } from './batch-student-section';
import { BatchCourseContent } from './batch-course-content';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';

export default function BatchContentPage() {
  const params = useParams();
  const batchId = params.batchId as string;
  const { name } = useAuth();
  const basePath = useBasePath();

  const { data: batch, loading: batchLoading, error: batchError, refetch: refetchBatch } = useApi(
    () => getBatch(batchId),
    [batchId],
  );
  const { data: batchCourses, loading: coursesLoading, refetch: refetchCourses } = useApi(
    () => listBatchCourses(batchId),
    [batchId],
  );

  // Teachers for edit modal
  const { data: teachersData } = useApi(() => listUsers({ role: 'teacher', per_page: 100 }));
  const teachers = teachersData?.data || [];

  // Batch edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', start_date: '', end_date: '', teacher_id: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Per-course lecture and material data
  const [courseLectures, setCourseLectures] = useState<Record<string, LectureOut[]>>({});
  const [courseMaterials, setCourseMaterials] = useState<Record<string, any[]>>({});
  const [loadingContent, setLoadingContent] = useState<Record<string, boolean>>({});
  const loadingContentRef = useRef<Record<string, boolean>>({});

  // External URL form state (inline — video upload moved to Upload Videos page)
  const [showLectureForm, setShowLectureForm] = useState<string | null>(null);
  const [lectureForm, setLectureForm] = useState({ title: '', description: '', videoUrl: '', duration: '' });

  // Lecture drawer
  const [drawerLectureId, setDrawerLectureId] = useState<string | null>(null);

  // Per-course material form state
  const [showMaterialForm, setShowMaterialForm] = useState<string | null>(null);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');

  // DnD sensors — activation constraint prevents accidental drags from clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Guard to prevent race conditions during rapid drags
  const reorderingRef = useRef(false);

  // Student management
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedStudentSearch(studentSearch), 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  const {
    data: students,
    total: studentsTotal,
    page: studentsPage,
    totalPages: studentsTotalPages,
    loading: studentsLoading,
    setPage: setStudentsPage,
    refetch: refetchStudents,
  } = usePaginatedApi(
    (params) => listBatchStudents(batchId, { ...params, search: debouncedStudentSearch || undefined }),
    20,
    [batchId, debouncedStudentSearch],
  );

  // Enroll-dropdown search — server-driven so >100-student institutes work
  const [enrollSearch, setEnrollSearch] = useState('');
  const [debouncedEnrollSearch, setDebouncedEnrollSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedEnrollSearch(enrollSearch), 300);
    return () => clearTimeout(t);
  }, [enrollSearch]);

  const { data: allStudentsData, loading: searchingEnrollStudents } = useApi(
    () =>
      debouncedEnrollSearch.length >= 2
        ? listUsers({ role: 'student', search: debouncedEnrollSearch, per_page: 100 })
        : Promise.resolve({ data: [], total: 0, page: 1, perPage: 100, totalPages: 0 }),
    [debouncedEnrollSearch],
  );

  const { execute: doEnroll, loading: enrolling } = useMutation(
    (studentId: string) => enrollStudent(batchId, studentId),
  );

  const handleToggleActive = async (studentId: string, isActive: boolean) => {
    try {
      await toggleEnrollmentActive(batchId, studentId, isActive);
      toast.success(isActive ? 'Enrollment activated' : 'Enrollment deactivated');
      refetchStudents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const enrolledIds = useMemo(() => {
    if (!students || !Array.isArray(students)) return new Set<string>();
    return new Set(students.map((s: any) => s.id));
  }, [students]);

  const availableStudents = useMemo(() => {
    const all = allStudentsData?.data || [];
    return all.filter((s) => !enrolledIds.has(s.id));
  }, [allStudentsData, enrolledIds]);

  const handleEnrollStudent = async () => {
    if (!selectedStudentId) return;
    try {
      await doEnroll(selectedStudentId);
      toast.success('Student enrolled');
      setSelectedStudentId('');
      refetchStudents();
      refetchBatch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };


  const { execute: doCreateLecture, loading: creatingLecture } = useMutation(createLecture);
  const { execute: doDeleteMaterial } = useMutation(deleteMaterial);
  const [deleteMaterialConfirm, setDeleteMaterialConfirm] = useState<{ id: string; courseId: string } | null>(null);

  const courses: any[] = Array.isArray(batchCourses) ? batchCourses : [];

  const loadCourseContent = useCallback(async (courseId: string) => {
    if (loadingContentRef.current[courseId]) return;
    loadingContentRef.current = { ...loadingContentRef.current, [courseId]: true };
    setLoadingContent((prev) => ({ ...prev, [courseId]: true }));
    try {
      const [lecRes, matRes] = await Promise.all([
        listLectures({ batch_id: batchId, course_id: courseId }),
        listMaterials({ batch_id: batchId, course_id: courseId }),
      ]);
      setCourseLectures((prev) => ({ ...prev, [courseId]: lecRes.data || [] }));
      setCourseMaterials((prev) => ({ ...prev, [courseId]: matRes.data || [] }));
    } catch {
      // Silently fail, show empty
    } finally {
      loadingContentRef.current = { ...loadingContentRef.current, [courseId]: false };
      setLoadingContent((prev) => ({ ...prev, [courseId]: false }));
    }
  }, [batchId]);

  // Load content for all courses once they're available
  useEffect(() => {
    courses.forEach((c) => {
      loadCourseContent(c.id);
    });
  }, [courses.length, loadCourseContent]);

  const handleAddLecture = async (courseId: string) => {
    if (!lectureForm.title.trim()) return;
    try {
      await doCreateLecture({
        title: lectureForm.title.trim(),
        batch_id: batchId,
        course_id: courseId,
        video_type: lectureForm.videoUrl ? 'external' : 'none',
        video_url: lectureForm.videoUrl.trim() || undefined,
        duration: lectureForm.duration ? parseInt(lectureForm.duration, 10) : undefined,
        description: lectureForm.description.trim() || undefined,
      });
      toast.success('Lecture added');
      setLectureForm({ title: '', description: '', videoUrl: '', duration: '' });
      setShowLectureForm(null);
      loadCourseContent(courseId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDragEnd = async (event: DragEndEvent, courseId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (reorderingRef.current) return; // Prevent rapid concurrent reorders

    // Sort by sequenceOrder first so indices match what user sees
    const sorted = [...(courseLectures[courseId] || [])].sort(
      (a, b) => a.sequenceOrder - b.sequenceOrder,
    );
    const oldIndex = sorted.findIndex((l) => l.id === active.id);
    const newIndex = sorted.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sorted, oldIndex, newIndex);
    // Update sequenceOrder on each object so .sort() renders correctly
    const withUpdatedOrder = reordered.map((l, i) => ({
      ...l,
      sequenceOrder: i + 1,
    }));

    // Optimistic update with corrected sequenceOrder values
    const previousLectures = courseLectures[courseId] || [];
    setCourseLectures((prev) => ({ ...prev, [courseId]: withUpdatedOrder }));

    // Persist to backend
    reorderingRef.current = true;
    const items = withUpdatedOrder.map((l) => ({ id: l.id, sequenceOrder: l.sequenceOrder }));
    try {
      await bulkReorderLectures(items);
      toast.success('Order saved');
    } catch {
      // Revert on failure
      setCourseLectures((prev) => ({ ...prev, [courseId]: previousLectures }));
      toast.error('Failed to save new order');
    } finally {
      reorderingRef.current = false;
    }
  };

  const handleUploadMaterial = async (courseId: string) => {
    if (!materialFile || !materialTitle.trim()) {
      toast.error('Please provide a title and select a file');
      return;
    }
    try {
      const { uploadUrl, objectKey } = await getUploadUrl({
        file_name: materialFile.name,
        content_type: materialFile.type || 'application/octet-stream',
        batch_id: batchId,
        course_id: courseId,
      });

      await fetch(uploadUrl, {
        method: 'PUT',
        body: materialFile,
        headers: { 'Content-Type': materialFile.type || 'application/octet-stream' },
      });

      const ext = materialFile.name.split('.').pop()?.toLowerCase() || 'other';
      await createMaterial({
        object_key: objectKey,
        title: materialTitle.trim(),
        file_name: materialFile.name,
        file_type: ext,
        batch_id: batchId,
        description: materialDescription.trim() || undefined,
        file_size_bytes: materialFile.size,
        course_id: courseId,
      });

      toast.success('Material uploaded');
      setMaterialFile(null);
      setMaterialTitle('');
      setMaterialDescription('');
      setShowMaterialForm(null);
      loadCourseContent(courseId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteMaterial = async (materialId: string, courseId: string) => {
    try {
      await doDeleteMaterial(materialId);
      toast.success('Material deleted');
      setDeleteMaterialConfirm(null);
      loadCourseContent(courseId);
    } catch (err: any) {
      toast.error(err.message);
      setDeleteMaterialConfirm(null);
    }
  };

  const handleShowLectureForm = (courseId: string) => {
    setShowLectureForm(courseId);
    setLectureForm({ title: '', description: '', videoUrl: '', duration: '' });
  };

  const handleHideLectureForm = () => {
    setShowLectureForm(null);
    setLectureForm({ title: '', description: '', videoUrl: '', duration: '' });
  };

  const handleShowMaterialForm = (courseId: string) => {
    setShowMaterialForm(courseId);
    setMaterialFile(null);
    setMaterialTitle('');
    setMaterialDescription('');
  };

  const handleHideMaterialForm = () => {
    setShowMaterialForm(null);
    setMaterialFile(null);
    setMaterialTitle('');
    setMaterialDescription('');
  };

  const loading = batchLoading || coursesLoading;

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading variant="detail" />
      </DashboardLayout>
    );
  }

  if (batchError || !batch) {
    return (
      <DashboardLayout>
        <div className="bg-white rounded-2xl p-12 card-shadow text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Layers size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Batch not found</h3>
          <p className="text-sm text-gray-500 mb-4">{batchError || 'The batch you are looking for does not exist.'}</p>
          <Link href={`${basePath}/batches`} className="text-sm font-medium text-primary hover:underline">
            Back to Batches
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Dark Header Banner */}
      <div className="bg-primary rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link
          href={`${basePath}/batches`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Batches
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-lg sm:text-2xl font-bold text-white">{batch.name}</h1>
          <button
            onClick={() => {
              setEditForm({
                name: batch.name,
                start_date: batch.startDate?.split('T')[0] || '',
                end_date: batch.endDate?.split('T')[0] || '',
                teacher_id: batch.teacherId || '',
              });
              setShowEditModal(true);
            }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="Edit Batch"
          >
            <Pencil size={14} className="text-gray-300" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            batch.status === 'active' ? 'bg-green-100 text-green-700' :
            batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {batch.status}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Users size={14} />
            {batch.studentCount} students
          </div>
          <span className="text-xs text-gray-400">Teacher: {batch.teacherName || 'Unassigned'}</span>
        </div>
        {courses.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs text-gray-500">Courses:</span>
            {courses.map((c: any) => (
              <span key={c.id} className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-300">
                {c.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Edit Batch Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-primary">Edit Batch</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Batch Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
                  <input type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">End Date</label>
                  <input type="date" value={editForm.end_date} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Teacher</label>
                <SearchableCombobox
                  options={teachers.map((t: any) => ({ value: t.id, label: t.name }))}
                  value={editForm.teacher_id}
                  onChange={(v) => setEditForm(f => ({ ...f, teacher_id: v }))}
                  placeholder="Unassigned"
                  searchPlaceholder="Search teachers..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={async () => {
                    if (!editForm.name.trim()) { toast.error('Batch name is required'); return; }
                    setEditSaving(true);
                    try {
                      await updateBatch(batchId, {
                        name: editForm.name,
                        start_date: editForm.start_date,
                        end_date: editForm.end_date,
                        teacher_id: editForm.teacher_id || null,
                      });
                      refetchBatch();
                      setShowEditModal(false);
                      toast.success('Batch updated');
                    } catch (err: any) { toast.error(err.message || 'Failed to update'); }
                    finally { setEditSaving(false); }
                  }}
                  disabled={editSaving}
                  className="flex-1 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editSaving ? <Loader2Icon size={14} className="animate-spin" /> : null}
                  Save Changes
                </button>
                <button onClick={() => setShowEditModal(false)} className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Gating Settings */}
      <div className="bg-white rounded-2xl card-shadow p-4 sm:p-6 mb-6 sm:mb-8">
        <h3 className="text-sm font-semibold text-primary mb-3">Progress Gating</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">Require sequential video completion</p>
            <p className="text-xs text-gray-400 mt-0.5">Students must complete each lecture before accessing the next</p>
          </div>
          <button
            onClick={async () => {
              const newValue = !batch.enableLectureGating;
              try {
                await updateBatch(batchId, { enable_lecture_gating: newValue });
                refetchBatch();
                toast.success(newValue ? 'Progress gating enabled' : 'Progress gating disabled');
              } catch { toast.error('Failed to update setting'); }
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${batch.enableLectureGating ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${batch.enableLectureGating ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        {batch.enableLectureGating && (
          <div className="mt-4 flex items-center gap-3">
            <label className="text-xs text-gray-500">Completion threshold:</label>
            <input
              type="number"
              min={0}
              max={100}
              value={batch.lectureGatingThreshold}
              onChange={async (e) => {
                const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                try {
                  await updateBatch(batchId, { lecture_gating_threshold: val });
                  refetchBatch();
                } catch { toast.error('Failed to update threshold'); }
              }}
              className="w-16 px-2 py-1 text-sm border border-gray-200 rounded-lg text-center focus:outline-none focus:border-gray-400"
            />
            <span className="text-xs text-gray-400">%</span>
          </div>
        )}
      </div>

      {/* Student Management */}
      <BatchStudentSection
        selectedStudentId={selectedStudentId}
        onSelectedStudentIdChange={setSelectedStudentId}
        availableStudents={availableStudents}
        enrolling={enrolling}
        onEnrollStudent={handleEnrollStudent}
        students={students}
        studentsLoading={studentsLoading}
        onToggleActive={handleToggleActive}
        batchId={batchId}
        batchName={batch?.name}
        batchEndDate={batch?.endDate}
        onImportComplete={() => { refetchStudents(); refetchBatch(); }}
        studentsTotal={studentsTotal}
        studentsPage={studentsPage}
        studentsTotalPages={studentsTotalPages}
        onSetStudentsPage={setStudentsPage}
        studentSearch={studentSearch}
        onStudentSearchChange={setStudentSearch}
        enrollSearch={enrollSearch}
        onEnrollSearchChange={setEnrollSearch}
        enrollSearchDebounced={debouncedEnrollSearch}
        searchingEnrollStudents={searchingEnrollStudents}
      />

      {/* Content grouped by course */}
      <BatchCourseContent
        courses={courses}
        courseLectures={courseLectures}
        courseMaterials={courseMaterials}
        loadingContent={loadingContent}
        basePath={basePath}
        sensors={sensors}
        onDragEnd={handleDragEnd}
        onLectureClick={setDrawerLectureId}
        showLectureForm={showLectureForm}
        lectureForm={lectureForm}
        creatingLecture={creatingLecture}
        onShowLectureForm={handleShowLectureForm}
        onHideLectureForm={handleHideLectureForm}
        onLectureFormChange={setLectureForm}
        onAddLecture={handleAddLecture}
        showMaterialForm={showMaterialForm}
        materialFile={materialFile}
        materialTitle={materialTitle}
        materialDescription={materialDescription}
        onShowMaterialForm={handleShowMaterialForm}
        onHideMaterialForm={handleHideMaterialForm}
        onMaterialFileChange={setMaterialFile}
        onMaterialTitleChange={setMaterialTitle}
        onMaterialDescriptionChange={setMaterialDescription}
        onUploadMaterial={handleUploadMaterial}
        onDeleteMaterialConfirm={(materialId, courseId) => setDeleteMaterialConfirm({ id: materialId, courseId })}
      />

      <LectureDrawer
        lectureId={drawerLectureId}
        onClose={() => setDrawerLectureId(null)}
        onSaved={() => {
          // Refresh lectures for all courses
          courses.forEach((c: any) => loadCourseContent(c.id));
        }}
        onDeleted={() => {
          courses.forEach((c: any) => loadCourseContent(c.id));
        }}
      />

      <AlertDialog open={!!deleteMaterialConfirm} onOpenChange={(open) => !open && setDeleteMaterialConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Material</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this material? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMaterialConfirm && handleDeleteMaterial(deleteMaterialConfirm.id, deleteMaterialConfirm.courseId)} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
}
