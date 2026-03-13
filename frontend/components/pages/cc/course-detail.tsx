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
import { listQuizzes, createQuiz, deleteQuiz } from '@/lib/api/quizzes';
import { PageLoading } from '@/components/shared/page-states';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import { CourseBatchesSection } from './course-batches-section';
import { CourseCurriculumSection } from './course-curriculum-section';
import { CourseQuizzesSection } from './course-quizzes-section';

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

  const { data: quizzesData, loading: quizzesLoading, refetch: refetchQuizzes } = useApi(
    () => listQuizzes({ course_id: courseId }),
    [courseId],
  );

  const { execute: doCreateModule, loading: creatingModule } = useMutation(createModule);
  const { execute: doUpdateModule } = useMutation(updateModule);
  const { execute: doDeleteModule } = useMutation(deleteModule);
  const { execute: doLinkCourse } = useMutation(linkCourse);
  const { execute: doUnlinkCourse } = useMutation(unlinkCourse);
  const { execute: doCreateQuiz, loading: creatingQuiz } = useMutation(createQuiz);
  const { execute: doDeleteQuiz } = useMutation(deleteQuiz);

  const [showBatchDropdown, setShowBatchDropdown] = useState(false);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: '', description: '', topics: '' });
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', topics: '' });
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [quizForm, setQuizForm] = useState({ title: '', description: '' });
  const [deleteQuizId, setDeleteQuizId] = useState<string | null>(null);

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
          <h3 className="text-lg font-semibold text-primary mb-2">Course not found</h3>
          <p className="text-sm text-gray-500 mb-4">{courseError || 'The course you are looking for does not exist.'}</p>
          <Link href={`${basePath}/courses`} className="text-sm font-medium text-primary hover:underline">
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

  const handleAddQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizForm.title.trim()) return;
    try {
      await doCreateQuiz({
        courseId,
        title: quizForm.title.trim(),
        description: quizForm.description.trim() || undefined,
      });
      toast.success('Quiz created');
      setQuizForm({ title: '', description: '' });
      setShowQuizForm(false);
      refetchQuizzes();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteQuiz = async (qId: string) => {
    try {
      await doDeleteQuiz(qId);
      toast.success('Quiz deleted');
      setDeleteQuizId(null);
      refetchQuizzes();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteQuizId(null);
    }
  };

  const quizzes = quizzesData?.data || [];

  return (
    <DashboardLayout>
      {/* Dark Header Banner */}
      <div className="bg-primary rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
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

      <CourseBatchesSection
        basePath={basePath}
        linkedBatches={linkedBatches}
        unlinkedBatches={unlinkedBatches}
        showBatchDropdown={showBatchDropdown}
        onToggleBatchDropdown={() => setShowBatchDropdown(!showBatchDropdown)}
        onLinkBatch={handleLinkBatch}
        onUnlinkBatch={handleUnlinkBatch}
      />

      <CourseCurriculumSection
        sortedModules={sortedModules}
        showModuleForm={showModuleForm}
        moduleForm={moduleForm}
        editingModuleId={editingModuleId}
        editForm={editForm}
        expandedModule={expandedModule}
        deleteModuleId={deleteModuleId}
        creatingModule={creatingModule}
        onSetShowModuleForm={setShowModuleForm}
        onSetModuleForm={setModuleForm}
        onSetEditingModuleId={setEditingModuleId}
        onSetEditForm={setEditForm}
        onSetExpandedModule={setExpandedModule}
        onSetDeleteModuleId={setDeleteModuleId}
        onAddModule={handleAddModule}
        onUpdateModule={handleUpdateModule}
        onDeleteModule={handleDeleteModule}
      />

      <CourseQuizzesSection
        basePath={basePath}
        courseId={courseId}
        quizzes={quizzes}
        quizzesLoading={quizzesLoading}
        showQuizForm={showQuizForm}
        quizForm={quizForm}
        deleteQuizId={deleteQuizId}
        creatingQuiz={creatingQuiz}
        onSetShowQuizForm={setShowQuizForm}
        onSetQuizForm={setQuizForm}
        onSetDeleteQuizId={setDeleteQuizId}
        onAddQuiz={handleAddQuiz}
        onDeleteQuiz={handleDeleteQuiz}
      />
    </DashboardLayout>
  );
}
