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
import type { QuizAttempt, QuizQuestion } from '@/lib/api/quizzes';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { QuizStartPhase } from './quiz-start-phase';
import { QuizTakingPhase } from './quiz-taking-phase';
import { QuizResultsPhase } from './quiz-results-phase';

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
  const warned5minRef = useRef(false);
  const warned1minRef = useRef(false);

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
        toast("Time's up! Your quiz has been submitted.");
        handleSubmit();
      }
      return;
    }

    if (timeRemaining === 300 && !warned5minRef.current) {
      warned5minRef.current = true;
      toast.warning('5 minutes remaining');
    }
    if (timeRemaining === 60 && !warned1minRef.current) {
      warned1minRef.current = true;
      toast.warning('1 minute remaining! Submit soon.');
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
      warned5minRef.current = false;
      warned1minRef.current = false;

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

  const handleRetry = () => {
    setPhase('start');
    setCurrentAttempt(null);
    setAnswers({});
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
    return (
      <DashboardLayout>
        <QuizResultsPhase
          quiz={quiz}
          sortedQuestions={sortedQuestions}
          totalPoints={totalPoints}
          currentAttempt={currentAttempt}
          answers={answers}
          canAttempt={canAttempt}
          attemptsRemaining={attemptsRemaining}
          basePath={basePath}
          courseId={courseId}
          onRetry={handleRetry}
        />
      </DashboardLayout>
    );
  }

  /* ─── Taking Phase ───────────────────────────────────────────── */

  if (phase === 'taking' && currentQuestion) {
    return (
      <DashboardLayout>
        <QuizTakingPhase
          quiz={quiz}
          sortedQuestions={sortedQuestions}
          currentQuestion={currentQuestion}
          currentQuestionIndex={currentQuestionIndex}
          answers={answers}
          answeredCount={answeredCount}
          timeRemaining={timeRemaining}
          submittingAttempt={submittingAttempt}
          showSubmitConfirm={showSubmitConfirm}
          onSetCurrentQuestionIndex={setCurrentQuestionIndex}
          onSetAnswer={handleSetAnswer}
          onShowSubmitConfirm={setShowSubmitConfirm}
          onSubmit={handleSubmit}
          formatTime={formatTime}
        />
      </DashboardLayout>
    );
  }

  /* ─── Start Phase ────────────────────────────────────────────── */

  return (
    <DashboardLayout>
      <QuizStartPhase
        quiz={quiz}
        sortedQuestions={sortedQuestions}
        totalPoints={totalPoints}
        lastAttempt={lastAttempt}
        completedAttempts={completedAttempts}
        canAttempt={canAttempt}
        startingAttempt={startingAttempt}
        basePath={basePath}
        courseId={courseId}
        onStartQuiz={handleStartQuiz}
      />
    </DashboardLayout>
  );
}
