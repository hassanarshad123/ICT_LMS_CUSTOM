'use client';

import type { Quiz } from '@/lib/api/quizzes';
import {
  Plus,
  Trash2,
  Edit3,
  Loader2,
  HelpCircle,
  BarChart3,
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

export interface QuizFormState {
  title: string;
  description: string;
}

export interface CourseQuizzesSectionProps {
  basePath: string;
  courseId: string;
  quizzes: Quiz[];
  quizzesLoading: boolean;
  showQuizForm: boolean;
  quizForm: QuizFormState;
  deleteQuizId: string | null;
  creatingQuiz: boolean;
  onSetShowQuizForm: (show: boolean) => void;
  onSetQuizForm: (form: QuizFormState) => void;
  onSetDeleteQuizId: (id: string | null) => void;
  onAddQuiz: (e: React.FormEvent) => void;
  onDeleteQuiz: (quizId: string) => void;
}

export function CourseQuizzesSection({
  basePath,
  courseId,
  quizzes,
  quizzesLoading,
  showQuizForm,
  quizForm,
  deleteQuizId,
  creatingQuiz,
  onSetShowQuizForm,
  onSetQuizForm,
  onSetDeleteQuizId,
  onAddQuiz,
  onDeleteQuiz,
}: CourseQuizzesSectionProps) {
  return (
    <>
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary">Quizzes</h3>
          {!showQuizForm && (
            <button
              onClick={() => onSetShowQuizForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
            >
              <Plus size={14} />
              Add Quiz
            </button>
          )}
        </div>

        {showQuizForm && (
          <div className="bg-white rounded-2xl p-6 card-shadow mb-4">
            <h4 className="text-sm font-semibold text-primary mb-4">New Quiz</h4>
            <form onSubmit={onAddQuiz} className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                <input
                  type="text"
                  value={quizForm.title}
                  onChange={(e) => onSetQuizForm({ ...quizForm, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                  placeholder="Quiz title"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={quizForm.description}
                  onChange={(e) => onSetQuizForm({ ...quizForm, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                  placeholder="Quiz description (optional)"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creatingQuiz}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-60"
                >
                  {creatingQuiz && <Loader2 size={16} className="animate-spin" />}
                  Create Quiz
                </button>
                <button
                  type="button"
                  onClick={() => { onSetShowQuizForm(false); onSetQuizForm({ title: '', description: '' }); }}
                  className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {quizzesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-16" />
            ))}
          </div>
        ) : quizzes.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 card-shadow text-center">
            <HelpCircle size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No quizzes yet. Add your first quiz.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.map((q) => (
              <div key={q.id} className="bg-white rounded-xl card-shadow overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 bg-accent bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <HelpCircle size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm text-primary truncate">{q.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{q.questionCount} question{q.questionCount !== 1 ? 's' : ''}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          q.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {q.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                    <Link
                      href={`${basePath}/courses/${courseId}/quizzes/${q.id}/results`}
                      className="p-2 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
                      title="View Results"
                    >
                      <BarChart3 size={14} />
                    </Link>
                    <Link
                      href={`${basePath}/courses/${courseId}/quizzes/${q.id}`}
                      className="p-2 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
                      title="Edit Quiz"
                    >
                      <Edit3 size={14} />
                    </Link>
                    <button
                      onClick={() => onSetDeleteQuizId(q.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteQuizId} onOpenChange={(open) => !open && onSetDeleteQuizId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this quiz? All questions and student attempts will be lost. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteQuizId && onDeleteQuiz(deleteQuizId)} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
