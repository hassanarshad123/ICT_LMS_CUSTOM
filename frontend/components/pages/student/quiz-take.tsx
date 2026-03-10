'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  getQuiz,
  startAttempt,
  submitAttempt,
  listMyAttempts,
} from '@/lib/api/quizzes';
import type { QuizWithQuestions, QuizAttempt, QuizQuestion } from '@/lib/api/quizzes';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Target,
  HelpCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Send,
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

interface QuizTakeProps {
  quizId: string;
  courseId: string;
}

type AnswerMap = Record<string, string>;

type QuizPhase = 'start' | 'taking' | 'results';

export default function QuizTake({ quizId, courseId }: QuizTakeProps) {
  const basePath = useBasePath();

  const {
    data: quiz,
    loading: quizLoading,
    error: quizError,
    refetch: refetchQuiz,
  } = useApi(() => getQuiz(quizId), [quizId]);

  const {
    data: myAttemptsData,
    loading: attemptsLoading,
    refetch: refetchAttempts,
  } = useApi(() => listMyAttempts({ course_id: courseId }), [courseId]);

  const { execute: doStartAttempt, loading: startingAttempt } = useMutation(startAttempt);
  const { execute: doSubmitAttempt, loading: submittingAttempt } = useMutation(submitAttempt);

  const [phase, setPhase] = useState<QuizPhase>('start');
  const [currentAttempt, setCurrentAttempt] = useState<QuizAttempt | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitRef = useRef(false);

  const loading = quizLoading || attemptsLoading;

  // Attempts for this quiz
  const quizAttempts = (myAttemptsData?.data || []).filter((a) => a.quizId === quizId);
  const lastAttempt = quizAttempts.length > 0 ? quizAttempts[0] : null;
  const completedAttempts = quizAttempts.filter((a) => a.status !== 'in_progress');

  // Timer effect
  useEffect(() => {
    if (phase !== 'taking' || timeRemaining === null) return;

    if (timeRemaining <= 0) {
      if (!autoSubmitRef.current) {
        autoSubmitRef.current = true;
        handleSubmit();
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      setTimeRemaining((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeRemaining]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const sortedQuestions: QuizQuestion[] = quiz
    ? [...(quiz.questions || [])].sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    : [];

  const totalPoints = sortedQuestions.reduce((sum, q) => sum + q.points, 0);

  const handleStartQuiz = async () => {
    try {
      const attempt = await doStartAttempt(quizId);
      setCurrentAttempt(attempt);
      setAnswers({});
      setCurrentQuestionIndex(0);
      autoSubmitRef.current = false;

      if (quiz?.timeLimitMinutes) {
        setTimeRemaining(quiz.timeLimitMinutes * 60);
      }
      setPhase('taking');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!currentAttempt) return;

    try {
      const answerPayload = sortedQuestions.map((q) => ({
        questionId: q.id,
        answerText: answers[q.id] || '',
      }));

      const result = await doSubmitAttempt(currentAttempt.id, answerPayload);
      setCurrentAttempt(result);
      setPhase('results');
      setTimeRemaining(null);
      if (timerRef.current) clearTimeout(timerRef.current);
      refetchAttempts();
      toast.success('Quiz submitted successfully');
    } catch (err: any) {
      toast.error(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAttempt, answers, sortedQuestions]);

  const handleSetAnswer = (questionId: string, value: string) => {
    setAnswers({ ...answers, [questionId]: value });
  };

  const answeredCount = sortedQuestions.filter((q) => answers[q.id]?.trim()).length;
  const currentQuestion = sortedQuestions[currentQuestionIndex] || null;

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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

  const attemptsRemaining = quiz.maxAttempts - completedAttempts.length;
  const canAttempt = attemptsRemaining > 0;

  /* ─── Results Phase ──────────────────────────────────────────── */

  if (phase === 'results' && currentAttempt) {
    const attemptAnswers = currentAttempt.answers || [];
    return (
      <DashboardLayout>
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
        <div className="bg-white rounded-2xl card-shadow p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold ${
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
              onClick={() => {
                setPhase('start');
                setCurrentAttempt(null);
                setAnswers({});
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
            >
              <RotateCcw size={16} />
              Try Again ({attemptsRemaining - 1} left)
            </button>
          )}
        </div>
      </DashboardLayout>
    );
  }

  /* ─── Taking Phase ───────────────────────────────────────────── */

  if (phase === 'taking' && currentQuestion) {
    return (
      <DashboardLayout>
        {/* Top bar with timer and progress */}
        <div className="bg-primary rounded-2xl p-4 sm:p-5 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-semibold text-white truncate mr-4">{quiz.title}</h2>
            <div className="flex items-center gap-4 flex-shrink-0">
              {timeRemaining !== null && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                    timeRemaining <= 60
                      ? 'bg-red-500/20 text-red-300'
                      : timeRemaining <= 300
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-white/10 text-white'
                  }`}
                >
                  <Clock size={14} />
                  {formatTime(timeRemaining)}
                </div>
              )}
              <span className="text-xs text-gray-300">
                {answeredCount}/{sortedQuestions.length} answered
              </span>
            </div>
          </div>
        </div>

        {/* Question number grid */}
        <div className="bg-white rounded-2xl card-shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {sortedQuestions.map((q, i) => {
              const isAnswered = !!answers[q.id]?.trim();
              const isCurrent = i === currentQuestionIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(i)}
                  className={`w-9 h-9 rounded-lg text-xs font-bold transition-colors ${
                    isCurrent
                      ? 'bg-primary text-white'
                      : isAnswered
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Question */}
        <div className="bg-white rounded-2xl card-shadow p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent bg-opacity-30 text-primary">
              Question {currentQuestionIndex + 1} of {sortedQuestions.length}
            </span>
            <span className="text-xs text-gray-400">{currentQuestion.points} pt{currentQuestion.points !== 1 ? 's' : ''}</span>
          </div>

          <p className="text-base text-primary font-medium mb-6">{currentQuestion.questionText}</p>

          {/* MCQ Options */}
          {currentQuestion.questionType === 'mcq' && currentQuestion.options && (
            <div className="space-y-3">
              {Object.entries(currentQuestion.options).map(([key, val]) => {
                const isSelected = answers[currentQuestion.id] === key;
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${currentQuestion.id}`}
                      checked={isSelected}
                      onChange={() => handleSetAnswer(currentQuestion.id, key)}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-bold text-primary w-5">{key}</span>
                    <span className="text-sm text-gray-700">{val}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* True/False */}
          {currentQuestion.questionType === 'true_false' && (
            <div className="space-y-3">
              {['True', 'False'].map((val) => {
                const isSelected = answers[currentQuestion.id] === val;
                return (
                  <label
                    key={val}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${currentQuestion.id}`}
                      checked={isSelected}
                      onChange={() => handleSetAnswer(currentQuestion.id, val)}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700">{val}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Short Answer */}
          {currentQuestion.questionType === 'short_answer' && (
            <textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleSetAnswer(currentQuestion.id, e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
              rows={4}
              placeholder="Type your answer here..."
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={16} />
            Previous
          </button>

          <div className="flex items-center gap-2">
            {currentQuestionIndex < sortedQuestions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
              >
                Next
                <ArrowRight size={16} />
              </button>
            ) : null}
            <button
              onClick={() => setShowSubmitConfirm(true)}
              disabled={submittingAttempt}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {submittingAttempt ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Submit Quiz
            </button>
          </div>
        </div>

        {/* Submit Confirmation */}
        <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit Quiz?</AlertDialogTitle>
              <AlertDialogDescription>
                You have answered {answeredCount} of {sortedQuestions.length} questions.
                {answeredCount < sortedQuestions.length && (
                  <span className="block mt-2 text-yellow-600 font-medium">
                    Warning: {sortedQuestions.length - answeredCount} question{sortedQuestions.length - answeredCount !== 1 ? 's are' : ' is'} unanswered.
                  </span>
                )}
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continue Quiz</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowSubmitConfirm(false);
                  handleSubmit();
                }}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Submit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardLayout>
    );
  }

  /* ─── Start Phase ────────────────────────────────────────────── */

  return (
    <DashboardLayout>
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

          {canAttempt ? (
            <button
              onClick={handleStartQuiz}
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
    </DashboardLayout>
  );
}
