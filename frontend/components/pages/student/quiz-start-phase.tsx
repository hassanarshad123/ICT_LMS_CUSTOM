'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Target,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import type { QuizWithQuestions, QuizAttempt, QuizQuestion } from '@/lib/api/quizzes';

export interface QuizStartPhaseProps {
  quiz: QuizWithQuestions;
  sortedQuestions: QuizQuestion[];
  totalPoints: number;
  lastAttempt: QuizAttempt | null;
  completedAttempts: QuizAttempt[];
  canAttempt: boolean;
  startingAttempt: boolean;
  basePath: string;
  courseId: string;
  onStartQuiz: () => void;
}

export function QuizStartPhase({
  quiz,
  sortedQuestions,
  totalPoints,
  lastAttempt,
  completedAttempts,
  canAttempt,
  startingAttempt,
  basePath,
  courseId,
  onStartQuiz,
}: QuizStartPhaseProps) {
  return (
    <>
      <div className="bg-primary rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link
          href={`${basePath}/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Course
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-white">{quiz.title}</h1>
        {quiz.description && (
          <p className="text-sm text-gray-300 max-w-2xl mt-2">{quiz.description}</p>
        )}
      </div>

      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl card-shadow p-6">
          <h3 className="text-lg font-semibold text-primary mb-4">Quiz Details</h3>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm">
              <HelpCircle size={16} className="text-gray-400" />
              <span className="text-gray-600">{sortedQuestions.length} questions</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Target size={16} className="text-gray-400" />
              <span className="text-gray-600">{totalPoints} total points</span>
            </div>
            {quiz.timeLimitMinutes && (
              <div className="flex items-center gap-3 text-sm">
                <Clock size={16} className="text-gray-400" />
                <span className="text-gray-600">{quiz.timeLimitMinutes} minutes time limit</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle size={16} className="text-gray-400" />
              <span className="text-gray-600">Pass: {quiz.passPercentage}%</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <RotateCcw size={16} className="text-gray-400" />
              <span className="text-gray-600">
                {completedAttempts.length} of {quiz.maxAttempts} attempts used
              </span>
            </div>
          </div>

          {/* Previous attempt score */}
          {lastAttempt && lastAttempt.status !== 'in_progress' && (
            <div className={`rounded-xl p-4 mb-6 ${lastAttempt.passed ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {lastAttempt.passed ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <AlertTriangle size={16} className="text-yellow-600" />
                )}
                <span className={`text-sm font-medium ${lastAttempt.passed ? 'text-green-700' : 'text-yellow-700'}`}>
                  Last attempt: {lastAttempt.percentage != null ? `${Math.round(lastAttempt.percentage)}%` : '--'}
                </span>
              </div>
              <p className={`text-xs ${lastAttempt.passed ? 'text-green-600' : 'text-yellow-600'}`}>
                Score: {lastAttempt.score ?? 0} / {lastAttempt.maxScore ?? totalPoints}
              </p>
            </div>
          )}

          {canAttempt && (quiz.maxAttempts - completedAttempts.length) === 1 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700">This is your last attempt. Make sure you&apos;re ready before starting.</p>
            </div>
          )}

          {canAttempt ? (
            <button
              onClick={onStartQuiz}
              disabled={startingAttempt}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-60"
            >
              {startingAttempt ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Start Quiz
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-3">
                You have used all {quiz.maxAttempts} attempt{quiz.maxAttempts !== 1 ? 's' : ''}.
              </p>
              <Link
                href={`${basePath}/courses/${courseId}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Back to Course
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
