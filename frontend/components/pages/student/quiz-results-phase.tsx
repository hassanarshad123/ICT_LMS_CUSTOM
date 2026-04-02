'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import type { QuizWithQuestions, QuizAttempt, QuizQuestion } from '@/lib/api/quizzes';

type AnswerMap = Record<string, string>;

export interface QuizResultsPhaseProps {
  quiz: QuizWithQuestions;
  sortedQuestions: QuizQuestion[];
  totalPoints: number;
  currentAttempt: QuizAttempt;
  answers: AnswerMap;
  canAttempt: boolean;
  attemptsRemaining: number;
  basePath: string;
  courseId: string;
  onRetry: () => void;
}

export function QuizResultsPhase({
  quiz,
  sortedQuestions,
  totalPoints,
  currentAttempt,
  answers,
  canAttempt,
  attemptsRemaining,
  basePath,
  courseId,
  onRetry,
}: QuizResultsPhaseProps) {
  const attemptAnswers = currentAttempt.answers || [];

  return (
    <>
      {/* Results Header */}
      <div className="bg-primary rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link
          href={`${basePath}/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Course
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-white mb-2">{quiz.title} - Results</h1>
      </div>

      {/* Score Summary */}
      <div className="bg-white rounded-2xl card-shadow p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <div
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold flex-shrink-0 ${
              currentAttempt.passed
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {currentAttempt.percentage != null ? `${Math.round(currentAttempt.percentage)}%` : '--'}
          </div>
          <div className="text-center sm:text-left">
            <h3 className="text-lg font-semibold text-primary mb-1">
              {currentAttempt.passed ? 'Passed!' : 'Not Passed'}
            </h3>
            <p className="text-sm text-gray-500">
              Score: {currentAttempt.score ?? 0} / {currentAttempt.maxScore ?? totalPoints} points
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Pass threshold: {quiz.passPercentage}%
            </p>
            {currentAttempt.status === 'submitted' && (
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                Some answers pending review
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Per-Question Review */}
      <h3 className="text-lg font-semibold text-primary mb-4">Question Review</h3>
      <div className="space-y-3 mb-8">
        {sortedQuestions.map((q, index) => {
          const answer = attemptAnswers.find((a) => a.questionId === q.id);
          const studentAnswer = answer?.answerText || answers[q.id] || '';
          const isCorrect = answer?.isCorrect;
          const isPending = q.questionType === 'short_answer' && isCorrect === undefined;

          return (
            <div key={q.id} className="bg-white rounded-xl card-shadow p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-accent bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isPending ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        Pending Review
                      </span>
                    ) : isCorrect ? (
                      <CheckCircle size={16} className="text-green-500" />
                    ) : (
                      <XCircle size={16} className="text-red-500" />
                    )}
                    <span className="text-xs text-gray-400">
                      {answer?.pointsAwarded ?? 0} / {q.points} pt{q.points !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-sm text-primary font-medium mb-2">{q.questionText}</p>

                  {/* Show options for MCQ */}
                  {q.questionType === 'mcq' && q.options && (
                    <div className="space-y-1 mb-2">
                      {Object.entries(q.options).map(([key, val]) => {
                        const isStudentChoice = studentAnswer === key;
                        const isCorrectOption = q.correctAnswer === key;
                        let bgClass = 'text-gray-600';
                        if (isCorrectOption) bgClass = 'bg-green-50 text-green-700 font-medium';
                        else if (isStudentChoice && !isCorrectOption) bgClass = 'bg-red-50 text-red-700';
                        return (
                          <div key={key} className={`flex items-center gap-2 text-xs px-2 py-1 rounded-lg ${bgClass}`}>
                            <span className="font-bold">{key}.</span>
                            <span>{val}</span>
                            {isStudentChoice && !isCorrectOption && <XCircle size={12} className="ml-auto text-red-400" />}
                            {isCorrectOption && <CheckCircle size={12} className="ml-auto text-green-500" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* T/F review */}
                  {q.questionType === 'true_false' && (
                    <div className="space-y-1 mb-2">
                      {['True', 'False'].map((val) => {
                        const isStudentChoice = studentAnswer === val;
                        const isCorrectOption = q.correctAnswer === val;
                        let bgClass = 'text-gray-600';
                        if (isCorrectOption) bgClass = 'bg-green-50 text-green-700 font-medium';
                        else if (isStudentChoice && !isCorrectOption) bgClass = 'bg-red-50 text-red-700';
                        return (
                          <div key={val} className={`flex items-center gap-2 text-xs px-2 py-1 rounded-lg ${bgClass}`}>
                            <span>{val}</span>
                            {isStudentChoice && !isCorrectOption && <XCircle size={12} className="ml-auto text-red-400" />}
                            {isCorrectOption && <CheckCircle size={12} className="ml-auto text-green-500" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Short answer review */}
                  {q.questionType === 'short_answer' && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500">Your answer:</p>
                      <p className="text-sm text-primary bg-gray-50 rounded-lg px-3 py-2 mt-1">
                        {studentAnswer || '(no answer)'}
                      </p>
                    </div>
                  )}

                  {/* Feedback */}
                  {answer?.feedback && (
                    <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mt-2">
                      Feedback: {answer.feedback}
                    </p>
                  )}

                  {/* Explanation */}
                  {q.explanation && (
                    <p className="text-xs text-gray-400 mt-2 italic">
                      Explanation: {q.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Back / Retry */}
      <div className="flex items-center gap-3">
        <Link
          href={`${basePath}/courses/${courseId}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Course
        </Link>
        {canAttempt && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
          >
            <RotateCcw size={16} />
            Try Again ({attemptsRemaining - 1} left)
          </button>
        )}
      </div>
    </>
  );
}
