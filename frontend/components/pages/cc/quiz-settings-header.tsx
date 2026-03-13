'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Edit3,
  Save,
  Eye,
  EyeOff,
  Clock,
  Target,
  RotateCcw,
  HelpCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import type { QuizWithQuestions } from '@/lib/api/quizzes';

export interface SettingsFormState {
  title: string;
  description: string;
  timeLimitMinutes: string | number;
  passPercentage: number;
  maxAttempts: number;
}

export interface QuizSettingsHeaderProps {
  quiz: QuizWithQuestions;
  basePath: string;
  courseId: string;
  editingSettings: boolean;
  settingsForm: SettingsFormState;
  updatingQuiz: boolean;
  sortedQuestionsCount: number;
  totalPoints: number;
  onEditSettings: () => void;
  onCancelEditSettings: () => void;
  onSaveSettings: () => void;
  onTogglePublish: () => void;
  onSettingsFormChange: (form: SettingsFormState) => void;
}

export function QuizSettingsHeader({
  quiz,
  basePath,
  courseId,
  editingSettings,
  settingsForm,
  updatingQuiz,
  sortedQuestionsCount,
  totalPoints,
  onEditSettings,
  onCancelEditSettings,
  onSaveSettings,
  onTogglePublish,
  onSettingsFormChange,
}: QuizSettingsHeaderProps) {
  return (
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
            onChange={(e) => onSettingsFormChange({ ...settingsForm, title: e.target.value })}
            className="w-full px-4 py-3 rounded-xl text-sm bg-white/10 text-white border border-white/20 focus:outline-none focus:border-white/50 placeholder-gray-400"
            placeholder="Quiz title"
          />
          <input
            type="text"
            value={settingsForm.description}
            onChange={(e) => onSettingsFormChange({ ...settingsForm, description: e.target.value })}
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
                  onSettingsFormChange({
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
                  onSettingsFormChange({ ...settingsForm, passPercentage: parseInt(e.target.value) || 0 })
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
                  onSettingsFormChange({ ...settingsForm, maxAttempts: parseInt(e.target.value) || 1 })
                }
                className="w-20 px-3 py-2 rounded-lg text-sm bg-white/10 text-white border border-white/20 focus:outline-none focus:border-white/50"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={onSaveSettings}
              disabled={updatingQuiz}
              className="flex items-center gap-2 px-4 py-2 bg-white text-primary text-sm font-medium rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-60"
            >
              {updatingQuiz ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
            <button
              onClick={onCancelEditSettings}
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
                onClick={onEditSettings}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Edit settings"
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={onTogglePublish}
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
              {sortedQuestionsCount} questions
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
  );
}
