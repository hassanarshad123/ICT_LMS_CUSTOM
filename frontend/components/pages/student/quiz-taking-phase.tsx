'use client';

import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Loader2,
  Send,
} from 'lucide-react';
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
import type { QuizWithQuestions, QuizQuestion } from '@/lib/api/quizzes';

type AnswerMap = Record<string, string>;

export interface QuizTakingPhaseProps {
  quiz: QuizWithQuestions;
  sortedQuestions: QuizQuestion[];
  currentQuestion: QuizQuestion;
  currentQuestionIndex: number;
  answers: AnswerMap;
  answeredCount: number;
  timeRemaining: number | null;
  submittingAttempt: boolean;
  showSubmitConfirm: boolean;
  onSetCurrentQuestionIndex: (index: number) => void;
  onSetAnswer: (questionId: string, value: string) => void;
  onShowSubmitConfirm: (show: boolean) => void;
  onSubmit: () => void;
  formatTime: (seconds: number) => string;
}

export function QuizTakingPhase({
  quiz,
  sortedQuestions,
  currentQuestion,
  currentQuestionIndex,
  answers,
  answeredCount,
  timeRemaining,
  submittingAttempt,
  showSubmitConfirm,
  onSetCurrentQuestionIndex,
  onSetAnswer,
  onShowSubmitConfirm,
  onSubmit,
  formatTime,
}: QuizTakingPhaseProps) {
  return (
    <>
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
                onClick={() => onSetCurrentQuestionIndex(i)}
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
                    onChange={() => onSetAnswer(currentQuestion.id, key)}
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
                    onChange={() => onSetAnswer(currentQuestion.id, val)}
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
            onChange={(e) => onSetAnswer(currentQuestion.id, e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
            rows={4}
            placeholder="Type your answer here..."
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onSetCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
          disabled={currentQuestionIndex === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={16} />
          Previous
        </button>

        <div className="flex items-center gap-2">
          {currentQuestionIndex < sortedQuestions.length - 1 ? (
            <button
              onClick={() => onSetCurrentQuestionIndex(currentQuestionIndex + 1)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
            >
              Next
              <ArrowRight size={16} />
            </button>
          ) : null}
          <button
            onClick={() => onShowSubmitConfirm(true)}
            disabled={submittingAttempt}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            {submittingAttempt ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Submit Quiz
          </button>
        </div>
      </div>

      {/* Submit Confirmation */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={onShowSubmitConfirm}>
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
                onShowSubmitConfirm(false);
                onSubmit();
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
