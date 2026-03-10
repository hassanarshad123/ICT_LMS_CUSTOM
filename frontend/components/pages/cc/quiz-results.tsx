'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi, useMutation } from '@/hooks/use-api';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import {
  getQuiz,
  listAttempts,
  getAttempt,
  gradeAnswer,
} from '@/lib/api/quizzes';
import type { QuizAttempt, QuizAnswer, QuizWithQuestions } from '@/lib/api/quizzes';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Loader2,
  BarChart3,
  Save,
} from 'lucide-react';
import Link from 'next/link';

interface QuizResultsProps {
  quizId: string;
  courseId: string;
}

type StatusFilter = 'all' | 'submitted' | 'graded';

export default function QuizResults({ quizId, courseId }: QuizResultsProps) {
  const basePath = useBasePath();

  const {
    data: quiz,
    loading: quizLoading,
    error: quizError,
    refetch: refetchQuiz,
  } = useApi(() => getQuiz(quizId), [quizId]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const {
    data: attempts,
    total: attemptsTotal,
    page,
    totalPages,
    loading: attemptsLoading,
    error: attemptsError,
    setPage,
    refetch: refetchAttempts,
  } = usePaginatedApi(
    (params) =>
      listAttempts(quizId, {
        ...params,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    15,
    [quizId, statusFilter],
  );

  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [expandedAttemptData, setExpandedAttemptData] = useState<QuizAttempt | null>(null);
  const [loadingAttemptId, setLoadingAttemptId] = useState<string | null>(null);

  // Grading state per answer
  const [gradingState, setGradingState] = useState<
    Record<string, { isCorrect: boolean; pointsAwarded: number; feedback: string }>
  >({});
  const { execute: doGradeAnswer, loading: gradingAnswer } = useMutation(gradeAnswer);

  const loading = quizLoading;

  const handleExpandAttempt = async (attemptId: string) => {
    if (expandedAttemptId === attemptId) {
      setExpandedAttemptId(null);
      setExpandedAttemptData(null);
      return;
    }

    setLoadingAttemptId(attemptId);
    try {
      const data = await getAttempt(attemptId);
      setExpandedAttemptData(data);
      setExpandedAttemptId(attemptId);

      // Initialize grading state for short answers
      const newGradingState: typeof gradingState = {};
      (data.answers || []).forEach((a) => {
        newGradingState[a.id] = {
          isCorrect: a.isCorrect ?? false,
          pointsAwarded: a.pointsAwarded ?? 0,
          feedback: a.feedback || '',
        };
      });
      setGradingState(newGradingState);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingAttemptId(null);
    }
  };

  const handleGradeAnswer = async (answerId: string) => {
    const state = gradingState[answerId];
    if (!state) return;
    try {
      await doGradeAnswer(answerId, {
        isCorrect: state.isCorrect,
        pointsAwarded: state.pointsAwarded,
        feedback: state.feedback.trim() || undefined,
      });
      toast.success('Answer graded');
      // Refresh the attempt data
      if (expandedAttemptId) {
        const updatedAttempt = await getAttempt(expandedAttemptId);
        setExpandedAttemptData(updatedAttempt);
      }
      refetchAttempts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateGradingField = (
    answerId: string,
    field: 'isCorrect' | 'pointsAwarded' | 'feedback',
    value: boolean | number | string,
  ) => {
    setGradingState({
      ...gradingState,
      [answerId]: {
        ...gradingState[answerId],
        [field]: value,
      },
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading variant="detail" />
      </DashboardLayout>
    );
  }

  if (quizError || !quiz) {
    return (
      <DashboardLayout>
        <PageError message={quizError || 'Quiz not found'} onRetry={refetchQuiz} />
      </DashboardLayout>
    );
  }

  const sortedQuestions = [...(quiz.questions || [])].sort(
    (a, b) => a.sequenceOrder - b.sequenceOrder,
  );

  const STATUS_TABS: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'submitted' },
    { label: 'Graded', value: 'graded' },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="bg-primary rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
        <Link
          href={`${basePath}/courses/${courseId}/quizzes/${quizId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Quiz Builder
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-white mb-1">{quiz.title} - Results</h1>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{attemptsTotal} total attempt{attemptsTotal !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === tab.value
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Attempts List */}
      {attemptsLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-20" />
          ))}
        </div>
      ) : attempts.length === 0 ? (
        <EmptyState
          icon={<BarChart3 size={28} className="text-gray-400" />}
          title="No attempts yet"
          description={
            statusFilter === 'all'
              ? 'No students have attempted this quiz yet.'
              : `No ${statusFilter} attempts found.`
          }
        />
      ) : (
        <div className="space-y-3">
          {attempts.map((attempt) => {
            const isExpanded = expandedAttemptId === attempt.id;
            const isLoading = loadingAttemptId === attempt.id;

            return (
              <div key={attempt.id} className="bg-white rounded-xl card-shadow overflow-hidden">
                {/* Attempt Row */}
                <button
                  onClick={() => handleExpandAttempt(attempt.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-accent bg-opacity-30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <User size={18} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm text-primary truncate">
                        {attempt.studentName || attempt.studentEmail || attempt.studentId}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            attempt.status === 'graded'
                              ? attempt.passed
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                              : attempt.status === 'submitted'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {attempt.status === 'graded'
                            ? attempt.passed
                              ? 'Passed'
                              : 'Failed'
                            : attempt.status === 'submitted'
                              ? 'Pending Review'
                              : 'In Progress'}
                        </span>
                        {attempt.score != null && (
                          <span className="text-xs text-gray-400">
                            {attempt.score}/{attempt.maxScore} ({attempt.percentage != null ? Math.round(attempt.percentage) : 0}%)
                          </span>
                        )}
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {attempt.submittedAt
                            ? new Date(attempt.submittedAt).toLocaleDateString()
                            : new Date(attempt.startedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    {isLoading ? (
                      <Loader2 size={16} className="animate-spin text-gray-400" />
                    ) : isExpanded ? (
                      <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Answers */}
                {isExpanded && expandedAttemptData && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                    {sortedQuestions.map((q, index) => {
                      const answer = (expandedAttemptData.answers || []).find(
                        (a) => a.questionId === q.id,
                      );
                      if (!answer) return null;

                      const gradeState = gradingState[answer.id];
                      const isShortAnswer = q.questionType === 'short_answer';
                      const needsGrading = isShortAnswer && answer.isCorrect === undefined;

                      return (
                        <div key={q.id} className="border border-gray-100 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 bg-accent bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-primary">{index + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-primary font-medium mb-1">{q.questionText}</p>
                              <div className="flex items-center gap-2 mb-2">
                                {answer.isCorrect === true && (
                                  <CheckCircle size={14} className="text-green-500" />
                                )}
                                {answer.isCorrect === false && (
                                  <XCircle size={14} className="text-red-500" />
                                )}
                                <span className="text-xs text-gray-400">
                                  {answer.pointsAwarded ?? 0} / {q.points} pts
                                </span>
                              </div>

                              {/* Student answer */}
                              <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2">
                                <p className="text-xs text-gray-500 mb-0.5">Student answer:</p>
                                <p className="text-sm text-primary">{answer.answerText || '(no answer)'}</p>
                              </div>

                              {/* Correct answer (for MCQ/TF) */}
                              {q.correctAnswer && !isShortAnswer && (
                                <p className="text-xs text-green-600 mb-2">
                                  Correct answer: {q.correctAnswer}
                                  {q.questionType === 'mcq' && q.options
                                    ? ` - ${q.options[q.correctAnswer] || ''}`
                                    : ''}
                                </p>
                              )}

                              {/* Grading form for short answers */}
                              {isShortAnswer && gradeState && (
                                <div className="bg-blue-50 rounded-xl p-4 mt-3 space-y-3">
                                  <h5 className="text-xs font-semibold text-blue-700">Grade This Answer</h5>

                                  {/* Model answer reference */}
                                  {q.correctAnswer && (
                                    <div>
                                      <p className="text-xs text-gray-500 mb-0.5">Model answer:</p>
                                      <p className="text-xs text-gray-700 bg-white rounded-lg px-3 py-2">
                                        {q.correctAnswer}
                                      </p>
                                    </div>
                                  )}

                                  {/* Correct/Incorrect toggle */}
                                  <div className="flex items-center gap-3">
                                    <label className="text-xs text-gray-600">Verdict:</label>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => updateGradingField(answer.id, 'isCorrect', true)}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                          gradeState.isCorrect
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                      >
                                        <CheckCircle size={12} />
                                        Correct
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateGradingField(answer.id, 'isCorrect', false)}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                          !gradeState.isCorrect
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                      >
                                        <XCircle size={12} />
                                        Incorrect
                                      </button>
                                    </div>
                                  </div>

                                  {/* Points */}
                                  <div className="flex items-center gap-3">
                                    <label className="text-xs text-gray-600">Points:</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={q.points}
                                      value={gradeState.pointsAwarded}
                                      onChange={(e) =>
                                        updateGradingField(
                                          answer.id,
                                          'pointsAwarded',
                                          Math.min(q.points, Math.max(0, parseInt(e.target.value) || 0)),
                                        )
                                      }
                                      className="w-20 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white"
                                    />
                                    <span className="text-xs text-gray-400">/ {q.points}</span>
                                  </div>

                                  {/* Feedback */}
                                  <div>
                                    <label className="text-xs text-gray-600 block mb-1">Feedback:</label>
                                    <textarea
                                      value={gradeState.feedback}
                                      onChange={(e) => updateGradingField(answer.id, 'feedback', e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white resize-none"
                                      rows={2}
                                      placeholder="Optional feedback for the student..."
                                    />
                                  </div>

                                  <button
                                    onClick={() => handleGradeAnswer(answer.id)}
                                    disabled={gradingAnswer}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-60"
                                  >
                                    {gradingAnswer ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <Save size={12} />
                                    )}
                                    Save Grade
                                  </button>
                                </div>
                              )}

                              {/* Show existing feedback */}
                              {answer.feedback && !needsGrading && (
                                <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mt-2">
                                  Feedback: {answer.feedback}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
