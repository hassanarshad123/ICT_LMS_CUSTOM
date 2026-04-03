'use client';

import {
  Clock,
  HelpCircle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import type { Quiz, QuizAttempt } from '@/lib/api/quizzes';

/* ─── Types ──────────────────────────────────────────────────────── */

export interface CourseQuizzesSectionProps {
  publishedQuizzes: Quiz[];
  myAttempts: QuizAttempt[];
  quizzesLoading: boolean;
  myAttemptsLoading: boolean;
  courseId: string;
  basePath: string;
  accessExpired?: boolean;
}

/* ─── Component ──────────────────────────────────────────────────── */

export function CourseQuizzesSection({
  publishedQuizzes,
  myAttempts,
  quizzesLoading,
  myAttemptsLoading,
  courseId,
  basePath,
  accessExpired,
}: CourseQuizzesSectionProps) {
  return (
    <div className="bg-white rounded-2xl card-shadow p-6 mt-8">
      <div className="flex items-center gap-3 mb-4">
        <HelpCircle size={20} className="text-primary" />
        <h3 className="text-lg font-semibold text-primary">Quizzes</h3>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          {publishedQuizzes.length}
        </span>
      </div>
      {quizzesLoading || myAttemptsLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-20" />
          ))}
        </div>
      ) : publishedQuizzes.length === 0 ? (
        <div className="text-center py-8">
          <HelpCircle size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No quizzes available for this course yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {publishedQuizzes.map((quiz) => {
            const quizAttempts = myAttempts.filter((a) => a.quizId === quiz.id && a.status !== 'in_progress');
            const lastAttempt = quizAttempts.length > 0 ? quizAttempts[0] : null;
            const attemptsRemaining = quiz.maxAttempts - quizAttempts.length;
            const canAttempt = attemptsRemaining > 0;

            return (
              <div key={quiz.id} className="border border-gray-100 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 bg-accent bg-opacity-30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <HelpCircle size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-primary truncate">{quiz.title}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{quiz.questionCount} question{quiz.questionCount !== 1 ? 's' : ''}</span>
                    {quiz.timeLimitMinutes && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-1"><Clock size={10} />{quiz.timeLimitMinutes} min</span>
                      </>
                    )}
                    <span className="text-gray-300">|</span>
                    <span>Pass: {quiz.passPercentage}%</span>
                  </div>
                  {/* Attempt status */}
                  <div className="mt-1.5">
                    {lastAttempt ? (
                      <div className="flex items-center gap-2">
                        {lastAttempt.passed ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle size={12} />
                            Passed ({lastAttempt.percentage != null ? Math.round(lastAttempt.percentage) : 0}%)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                            <XCircle size={12} />
                            {lastAttempt.percentage != null ? `${Math.round(lastAttempt.percentage)}%` : 'Not passed'}
                          </span>
                        )}
                        {lastAttempt.status === 'submitted' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            Pending Review
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          ({quizAttempts.length}/{quiz.maxAttempts} attempts)
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Not attempted</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 w-full sm:w-auto">
                  {accessExpired ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-400 text-xs font-medium rounded-lg cursor-not-allowed">
                      <Lock size={12} />
                      Access Expired
                    </span>
                  ) : canAttempt ? (
                    <Link
                      href={`${basePath}/courses/${courseId}/quizzes/${quiz.id}/take`}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/80 transition-colors w-full sm:w-auto"
                    >
                      {lastAttempt ? 'Retry' : 'Take Quiz'}
                      <ArrowRight size={12} />
                    </Link>
                  ) : lastAttempt ? (
                    <Link
                      href={`${basePath}/courses/${courseId}/quizzes/${quiz.id}/take`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      View Results
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
