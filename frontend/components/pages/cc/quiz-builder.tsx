'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  getQuiz,
  updateQuiz,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from '@/lib/api/quizzes';
import type { QuizQuestion } from '@/lib/api/quizzes';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Plus, FileText, BarChart3, Loader2 } from 'lucide-react';
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

import { QuizSettingsHeader } from './quiz-settings-header';
import type { SettingsFormState } from './quiz-settings-header';
import { QuizQuestionForm, EMPTY_QUESTION_FORM, DEFAULT_OPTIONS } from './quiz-question-form';
import type { QuestionFormState } from './quiz-question-form';
import { QuizQuestionCard } from './quiz-question-card';

interface QuizBuilderProps {
  quizId: string;
  courseId: string;
}

export default function QuizBuilder({ quizId, courseId }: QuizBuilderProps) {
  const basePath = useBasePath();

  const {
    data: quiz,
    loading,
    error,
    refetch,
  } = useApi(() => getQuiz(quizId), [quizId]);

  const { execute: doUpdateQuiz, loading: updatingQuiz } = useMutation(updateQuiz);
  const { execute: doCreateQuestion, loading: creatingQuestion } = useMutation(createQuestion);
  const { execute: doUpdateQuestion } = useMutation(updateQuestion);
  const { execute: doDeleteQuestion } = useMutation(deleteQuestion);

  // Settings edit state
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>({
    title: '',
    description: '',
    timeLimitMinutes: '' as string | number,
    passPercentage: 50,
    maxAttempts: 1,
  });

  // Question form state
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionForm, setQuestionForm] = useState<QuestionFormState>({ ...EMPTY_QUESTION_FORM });

  // Edit question state
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionForm, setEditQuestionForm] = useState<QuestionFormState>({ ...EMPTY_QUESTION_FORM });

  // Delete confirmation
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading variant="detail" />
      </DashboardLayout>
    );
  }

  if (error || !quiz) {
    return (
      <DashboardLayout>
        <PageError message={error || 'Quiz not found'} onRetry={refetch} />
      </DashboardLayout>
    );
  }

  const sortedQuestions = [...(quiz.questions || [])].sort(
    (a, b) => a.sequenceOrder - b.sequenceOrder,
  );
  const totalPoints = sortedQuestions.reduce((sum, q) => sum + q.points, 0);

  /* ─── Settings Handlers ──────────────────────────────────────── */

  const handleEditSettings = () => {
    setSettingsForm({
      title: quiz.title,
      description: quiz.description || '',
      timeLimitMinutes: quiz.timeLimitMinutes ?? '',
      passPercentage: quiz.passPercentage,
      maxAttempts: quiz.maxAttempts,
    });
    setEditingSettings(true);
  };

  const handleSaveSettings = async () => {
    try {
      await doUpdateQuiz(quizId, {
        title: settingsForm.title.trim(),
        description: settingsForm.description.trim() || undefined,
        timeLimitMinutes: settingsForm.timeLimitMinutes === '' ? null : Number(settingsForm.timeLimitMinutes),
        passPercentage: Number(settingsForm.passPercentage),
        maxAttempts: Number(settingsForm.maxAttempts),
      });
      toast.success('Quiz settings updated');
      setEditingSettings(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTogglePublish = async () => {
    try {
      await doUpdateQuiz(quizId, { isPublished: !quiz.isPublished });
      toast.success(quiz.isPublished ? 'Quiz unpublished' : 'Quiz published');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  /* ─── Question Handlers ──────────────────────────────────────── */

  const resetQuestionForm = () => {
    setQuestionForm({ ...EMPTY_QUESTION_FORM });
    setShowQuestionForm(false);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionForm.questionText.trim()) return;

    try {
      const data: Parameters<typeof doCreateQuestion>[0] = {
        quizId,
        questionType: questionForm.questionType,
        questionText: questionForm.questionText.trim(),
        points: questionForm.points,
        explanation: questionForm.explanation.trim() || undefined,
      };

      if (questionForm.questionType === 'mcq') {
        data.options = questionForm.options;
        data.correctAnswer = questionForm.correctAnswer;
      } else if (questionForm.questionType === 'true_false') {
        data.options = { A: 'True', B: 'False' };
        data.correctAnswer = questionForm.correctAnswer;
      } else {
        data.correctAnswer = questionForm.correctAnswer || undefined;
      }

      await doCreateQuestion(data);
      toast.success('Question added');
      resetQuestionForm();
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStartEditQuestion = (q: QuizQuestion) => {
    setEditingQuestionId(q.id);
    setEditQuestionForm({
      questionType: q.questionType,
      questionText: q.questionText,
      options: q.options ? { ...DEFAULT_OPTIONS, ...q.options } : { ...DEFAULT_OPTIONS },
      correctAnswer: q.correctAnswer || '',
      points: q.points,
      explanation: q.explanation || '',
    });
  };

  const handleSaveEditQuestion = async (questionId: string) => {
    try {
      const data: Parameters<typeof doUpdateQuestion>[1] = {
        questionText: editQuestionForm.questionText.trim(),
        points: editQuestionForm.points,
        explanation: editQuestionForm.explanation.trim() || undefined,
      };

      if (editQuestionForm.questionType === 'mcq') {
        data.options = editQuestionForm.options;
        data.correctAnswer = editQuestionForm.correctAnswer;
      } else if (editQuestionForm.questionType === 'true_false') {
        data.options = { A: 'True', B: 'False' };
        data.correctAnswer = editQuestionForm.correctAnswer;
      } else {
        data.correctAnswer = editQuestionForm.correctAnswer || undefined;
      }

      await doUpdateQuestion(questionId, data);
      toast.success('Question updated');
      setEditingQuestionId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await doDeleteQuestion(questionId);
      toast.success('Question deleted');
      setDeleteQuestionId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteQuestionId(null);
    }
  };

  return (
    <DashboardLayout>
      {/* Dark Header Banner */}
      <QuizSettingsHeader
        quiz={quiz}
        basePath={basePath}
        courseId={courseId}
        editingSettings={editingSettings}
        settingsForm={settingsForm}
        updatingQuiz={updatingQuiz}
        sortedQuestionsCount={sortedQuestions.length}
        totalPoints={totalPoints}
        onEditSettings={handleEditSettings}
        onCancelEditSettings={() => setEditingSettings(false)}
        onSaveSettings={handleSaveSettings}
        onTogglePublish={handleTogglePublish}
        onSettingsFormChange={setSettingsForm}
      />

      {/* Actions Row */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary">Questions</h3>
        <div className="flex items-center gap-2">
          <Link
            href={`${basePath}/courses/${courseId}/quizzes/${quizId}/results`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            <BarChart3 size={14} />
            View Results
          </Link>
          {!showQuestionForm && (
            <button
              onClick={() => setShowQuestionForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
            >
              <Plus size={14} />
              Add Question
            </button>
          )}
        </div>
      </div>

      {/* Add Question Form */}
      {showQuestionForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-4">
          <h4 className="text-sm font-semibold text-primary mb-4">New Question</h4>
          <QuizQuestionForm
            form={questionForm}
            onFormChange={setQuestionForm}
            onSubmit={handleAddQuestion}
            onCancel={resetQuestionForm}
            isNew={true}
            loading={creatingQuestion}
            submitLabel="Add Question"
          />
        </div>
      )}

      {/* Question List */}
      {sortedQuestions.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 card-shadow text-center">
          <FileText size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No questions yet. Add your first question.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedQuestions.map((q, index) => (
            <QuizQuestionCard
              key={q.id}
              question={q}
              index={index}
              isEditing={editingQuestionId === q.id}
              editForm={editQuestionForm}
              onEditFormChange={setEditQuestionForm}
              onStartEdit={() => handleStartEditQuestion(q)}
              onSaveEdit={() => handleSaveEditQuestion(q.id)}
              onCancelEdit={() => setEditingQuestionId(null)}
              onDelete={() => setDeleteQuestionId(q.id)}
            />
          ))}
        </div>
      )}

      {/* Delete Question Confirmation */}
      <AlertDialog open={!!deleteQuestionId} onOpenChange={(open) => !open && setDeleteQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteQuestionId && handleDeleteQuestion(deleteQuestionId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
