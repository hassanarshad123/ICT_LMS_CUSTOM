import { apiClient } from './client';

/* ─── Interfaces ─────────────────────────────────────────────────── */

export interface Quiz {
  id: string;
  courseId: string;
  moduleId?: string;
  title: string;
  description?: string;
  timeLimitMinutes?: number;
  passPercentage: number;
  maxAttempts: number;
  isPublished: boolean;
  sequenceOrder: number;
  questionCount: number;
  createdBy: string;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  questionType: 'mcq' | 'true_false' | 'short_answer';
  questionText: string;
  options?: Record<string, string>;
  correctAnswer?: string;
  points: number;
  sequenceOrder: number;
  explanation?: string;
}

export interface QuizWithQuestions extends Quiz {
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  status: 'in_progress' | 'submitted' | 'graded';
  score?: number;
  maxScore?: number;
  percentage?: number;
  passed?: boolean;
  startedAt: string;
  submittedAt?: string;
  gradedAt?: string;
  answers?: QuizAnswer[];
}

export interface QuizAnswer {
  id: string;
  questionId: string;
  answerText?: string;
  isCorrect?: boolean;
  pointsAwarded?: number;
  feedback?: string;
}

export interface PaginatedQuizzes {
  data: Quiz[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface PaginatedAttempts {
  data: QuizAttempt[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/* ─── Quiz CRUD ──────────────────────────────────────────────────── */

export async function listQuizzes(params: {
  course_id: string;
  module_id?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedQuizzes> {
  return apiClient('/quizzes', {
    params: params as Record<string, string | number | undefined>,
  });
}

export async function getQuiz(quizId: string): Promise<QuizWithQuestions> {
  return apiClient(`/quizzes/${quizId}`);
}

export async function createQuiz(data: {
  courseId: string;
  moduleId?: string;
  title: string;
  description?: string;
  timeLimitMinutes?: number;
  passPercentage?: number;
  maxAttempts?: number;
}): Promise<Quiz> {
  return apiClient('/quizzes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateQuiz(
  quizId: string,
  data: Partial<{
    title: string;
    description: string;
    timeLimitMinutes: number | null;
    passPercentage: number;
    maxAttempts: number;
    isPublished: boolean;
    sequenceOrder: number;
  }>,
): Promise<Quiz> {
  return apiClient(`/quizzes/${quizId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteQuiz(quizId: string): Promise<void> {
  return apiClient(`/quizzes/${quizId}`, { method: 'DELETE' });
}

/* ─── Question CRUD ──────────────────────────────────────────────── */

export async function createQuestion(data: {
  quizId: string;
  questionType: 'mcq' | 'true_false' | 'short_answer';
  questionText: string;
  options?: Record<string, string>;
  correctAnswer?: string;
  points?: number;
  explanation?: string;
}): Promise<QuizQuestion> {
  const { quizId, ...rest } = data;
  return apiClient(`/quizzes/${quizId}/questions`, {
    method: 'POST',
    body: JSON.stringify(rest),
  });
}

export async function updateQuestion(
  questionId: string,
  data: Partial<{
    questionText: string;
    options: Record<string, string>;
    correctAnswer: string;
    points: number;
    explanation: string;
    sequenceOrder: number;
  }>,
): Promise<QuizQuestion> {
  return apiClient(`/quizzes/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteQuestion(questionId: string): Promise<void> {
  return apiClient(`/quizzes/questions/${questionId}`, { method: 'DELETE' });
}

/* ─── Attempts ───────────────────────────────────────────────────── */

export async function startAttempt(quizId: string): Promise<QuizAttempt> {
  return apiClient(`/quizzes/${quizId}/attempts`, { method: 'POST' });
}

export async function submitAttempt(
  attemptId: string,
  answers: Array<{ questionId: string; answerText: string }>,
): Promise<QuizAttempt> {
  return apiClient(`/quizzes/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

export async function getAttempt(attemptId: string): Promise<QuizAttempt> {
  return apiClient(`/quizzes/attempts/${attemptId}`);
}

export async function listAttempts(
  quizId: string,
  params?: { page?: number; per_page?: number; status?: string },
): Promise<PaginatedAttempts> {
  return apiClient(`/quizzes/${quizId}/attempts`, {
    params: params as Record<string, string | number | undefined>,
  });
}

export async function listMyAttempts(params?: {
  course_id?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedAttempts> {
  return apiClient('/quizzes/my-attempts', {
    params: params as Record<string, string | number | undefined>,
  });
}

/* ─── Grading ────────────────────────────────────────────────────── */

export async function gradeAnswer(
  answerId: string,
  data: { isCorrect: boolean; pointsAwarded: number; feedback?: string },
): Promise<QuizAnswer> {
  return apiClient(`/quizzes/answers/${answerId}/grade`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function listPendingGrading(params?: {
  page?: number;
  per_page?: number;
}): Promise<PaginatedAttempts> {
  return apiClient('/quizzes/pending-grading', {
    params: params as Record<string, string | number | undefined>,
  });
}
