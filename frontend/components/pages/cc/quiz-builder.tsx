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
import type { QuizQuestion, QuizWithQuestions } from '@/lib/api/quizzes';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
  Clock,
  Target,
  RotateCcw,
  FileText,
  BarChart3,
  Loader2,
  HelpCircle,
  CheckCircle,
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

interface QuizBuilderProps {
  quizId: string;
  courseId: string;
}

type QuestionType = 'mcq' | 'true_false' | 'short_answer';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple Choice',
  true_false: 'True / False',
  short_answer: 'Short Answer',
};

const DEFAULT_OPTIONS: Record<string, string> = {
  A: '',
  B: '',
  C: '',
  D: '',
};

interface QuestionFormState {
  questionType: QuestionType;
  questionText: string;
  options: Record<string, string>;
  correctAnswer: string;
  points: number;
  explanation: string;
}

const EMPTY_QUESTION_FORM: QuestionFormState = {
  questionType: 'mcq',
  questionText: '',
  options: { ...DEFAULT_OPTIONS },
  correctAnswer: '',
  points: 1,
  explanation: '',
};

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
  const [settingsForm, setSettingsForm] = useState({
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

  /* ─── Question Form Renderer ─────────────────────────────────── */

  const renderQuestionFormFields = (
    form: QuestionFormState,
    setForm: (f: QuestionFormState) => void,
    isNew: boolean,
  ) => (
    <div className="space-y-4">
      {/* Question type selector (only for new) */}
      {isNew && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Question Type</label>
          <div className="flex gap-2">
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm({ ...form, questionType: type, correctAnswer: '', options: { ...DEFAULT_OPTIONS } })}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  form.questionType === type
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {QUESTION_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Question text */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Question</label>
        <textarea
          value={form.questionText}
          onChange={(e) => setForm({ ...form, questionText: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
          rows={3}
          placeholder="Enter your question..."
          required
        />
      </div>

      {/* MCQ options */}
      {form.questionType === 'mcq' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Options</label>
          <div className="space-y-2">
            {['A', 'B', 'C', 'D'].map((key) => (
              <div key={key} className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={isNew ? 'correct-new' : `correct-edit-${form.questionText}`}
                    checked={form.correctAnswer === key}
                    onChange={() => setForm({ ...form, correctAnswer: key })}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-bold text-primary w-5">{key}</span>
                </label>
                <input
                  type="text"
                  value={form.options[key] || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      options: { ...form.options, [key]: e.target.value },
                    })
                  }
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                  placeholder={`Option ${key}`}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Select the radio button next to the correct answer.</p>
        </div>
      )}

      {/* True / False */}
      {form.questionType === 'true_false' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Correct Answer</label>
          <div className="flex gap-3">
            {['True', 'False'].map((val) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={isNew ? 'tf-new' : `tf-edit-${form.questionText}`}
                  checked={form.correctAnswer === val}
                  onChange={() => setForm({ ...form, correctAnswer: val })}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm text-primary">{val}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Short answer reference */}
      {form.questionType === 'short_answer' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Model Answer (for grading reference)</label>
          <textarea
            value={form.correctAnswer}
            onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
            rows={2}
            placeholder="Enter the model answer..."
          />
        </div>
      )}

      {/* Points */}
      <div className="flex gap-4">
        <div className="w-32">
          <label className="block text-xs font-medium text-gray-600 mb-1">Points</label>
          <input
            type="number"
            min={1}
            value={form.points}
            onChange={(e) => setForm({ ...form, points: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
          />
        </div>
      </div>

      {/* Explanation */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Explanation (shown after submission)</label>
        <textarea
          value={form.explanation}
          onChange={(e) => setForm({ ...form, explanation: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
          rows={2}
          placeholder="Explain the correct answer..."
        />
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      {/* Dark Header Banner */}
      <div className="bg-primary rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link
          href={`${basePath}/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Course
        </Link>

        {editingSettings ? (
          <div className="space-y-3">
            <input
              type="text"
              value={settingsForm.title}
              onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
              className="w-full px-4 py-3 rounded-xl text-sm bg-white/10 text-white border border-white/20 focus:outline-none focus:border-white/50 placeholder-gray-400"
              placeholder="Quiz title"
            />
            <input
              type="text"
              value={settingsForm.description}
              onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
              className="w-full px-4 py-2 rounded-xl text-sm bg-white/10 text-white border border-white/20 focus:outline-none focus:border-white/50 placeholder-gray-400"
              placeholder="Quiz description"
            />
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Time Limit (min)</label>
                <input
                  type="number"
                  min={0}
                  value={settingsForm.timeLimitMinutes}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      timeLimitMinutes: e.target.value === '' ? '' : parseInt(e.target.value),
                    })
                  }
                  className="w-24 px-3 py-2 rounded-lg text-sm bg-white/10 text-white border border-white/20 focus:outline-none focus:border-white/50"
                  placeholder="None"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">Pass %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settingsForm.passPercentage}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, passPercentage: parseInt(e.target.value) || 0 })
                  }
                  className="w-20 px-3 py-2 rounded-lg text-sm bg-white/10 text-white border border-white/20 focus:outline-none focus:border-white/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">Max Attempts</label>
                <input
                  type="number"
                  min={1}
                  value={settingsForm.maxAttempts}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, maxAttempts: parseInt(e.target.value) || 1 })
                  }
                  className="w-20 px-3 py-2 rounded-lg text-sm bg-white/10 text-white border border-white/20 focus:outline-none focus:border-white/50"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveSettings}
                disabled={updatingQuiz}
                className="flex items-center gap-2 px-4 py-2 bg-white text-primary text-sm font-medium rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-60"
              >
                {updatingQuiz ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
              <button
                onClick={() => setEditingSettings(false)}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-white mb-2">{quiz.title}</h1>
                {quiz.description && (
                  <p className="text-sm text-gray-300 max-w-2xl mb-3">{quiz.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleEditSettings}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="Edit settings"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={handleTogglePublish}
                  disabled={updatingQuiz}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    quiz.isPublished
                      ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                      : 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30'
                  }`}
                >
                  {quiz.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                  {quiz.isPublished ? 'Published' : 'Draft'}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <HelpCircle size={14} />
                {sortedQuestions.length} questions
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Target size={14} />
                {totalPoints} points
              </div>
              {quiz.timeLimitMinutes && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock size={14} />
                  {quiz.timeLimitMinutes} min
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <CheckCircle size={14} />
                Pass: {quiz.passPercentage}%
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <RotateCcw size={14} />
                {quiz.maxAttempts} attempt{quiz.maxAttempts !== 1 ? 's' : ''}
              </div>
            </div>
          </>
        )}
      </div>

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
          <form onSubmit={handleAddQuestion}>
            {renderQuestionFormFields(questionForm, setQuestionForm, true)}
            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                disabled={creatingQuestion}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-60"
              >
                {creatingQuestion && <Loader2 size={16} className="animate-spin" />}
                Add Question
              </button>
              <button
                type="button"
                onClick={resetQuestionForm}
                className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
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
          {sortedQuestions.map((q, index) => {
            const isEditing = editingQuestionId === q.id;
            return (
              <div key={q.id} className="bg-white rounded-xl card-shadow overflow-hidden">
                {isEditing ? (
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {QUESTION_TYPE_LABELS[q.questionType]}
                      </span>
                    </div>
                    {renderQuestionFormFields(editQuestionForm, setEditQuestionForm, false)}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleSaveEditQuestion(q.id)}
                        className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingQuestionId(null)}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-8 h-8 bg-accent bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              {QUESTION_TYPE_LABELS[q.questionType]}
                            </span>
                            <span className="text-xs text-gray-400">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                          </div>
                          <p className="text-sm text-primary font-medium">{q.questionText}</p>

                          {/* Show options for MCQ */}
                          {q.questionType === 'mcq' && q.options && (
                            <div className="mt-2 space-y-1">
                              {Object.entries(q.options).map(([key, val]) => (
                                <div
                                  key={key}
                                  className={`flex items-center gap-2 text-xs px-2 py-1 rounded-lg ${
                                    q.correctAnswer === key
                                      ? 'bg-green-50 text-green-700 font-medium'
                                      : 'text-gray-600'
                                  }`}
                                >
                                  <span className="font-bold">{key}.</span>
                                  <span>{val}</span>
                                  {q.correctAnswer === key && (
                                    <CheckCircle size={12} className="text-green-500 ml-auto" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Show T/F correct answer */}
                          {q.questionType === 'true_false' && q.correctAnswer && (
                            <p className="text-xs text-green-600 mt-1 font-medium">
                              Correct: {q.correctAnswer}
                            </p>
                          )}

                          {/* Show short answer model */}
                          {q.questionType === 'short_answer' && q.correctAnswer && (
                            <p className="text-xs text-gray-500 mt-1">
                              Model answer: {q.correctAnswer}
                            </p>
                          )}

                          {q.explanation && (
                            <p className="text-xs text-gray-400 mt-2 italic">
                              Explanation: {q.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                        <button
                          onClick={() => handleStartEditQuestion(q)}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteQuestionId(q.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
