'use client';

import { Edit3, Trash2, CheckCircle } from 'lucide-react';
import type { QuizQuestion } from '@/lib/api/quizzes';
import {
  QuestionFormFields,
  QUESTION_TYPE_LABELS,
} from './quiz-question-form';
import type { QuestionFormState } from './quiz-question-form';

export interface QuizQuestionCardProps {
  question: QuizQuestion;
  index: number;
  isEditing: boolean;
  editForm: QuestionFormState;
  onEditFormChange: (form: QuestionFormState) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}

export function QuizQuestionCard({
  question: q,
  index,
  isEditing,
  editForm,
  onEditFormChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: QuizQuestionCardProps) {
  return (
    <div className="bg-white rounded-xl card-shadow overflow-hidden">
      {isEditing ? (
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {QUESTION_TYPE_LABELS[q.questionType]}
            </span>
          </div>
          <QuestionFormFields
            form={editForm}
            onFormChange={onEditFormChange}
            isNew={false}
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={onSaveEdit}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
            >
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-8 h-8 bg-accent bg-opacity-30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {QUESTION_TYPE_LABELS[q.questionType]}
                  </span>
                  <span className="text-xs text-gray-400">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                </div>
                <p className="text-sm text-primary font-medium">{q.questionText}</p>

                {/* Show options for MCQ */}
                {q.questionType === 'mcq' && q.options && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(q.options).map(([key, val]) => (
                      <div
                        key={key}
                        className={`flex items-center gap-2 text-xs px-2 py-1 rounded-lg ${
                          q.correctAnswer === key
                            ? 'bg-green-50 text-green-700 font-medium'
                            : 'text-gray-600'
                        }`}
                      >
                        <span className="font-bold">{key}.</span>
                        <span>{val}</span>
                        {q.correctAnswer === key && (
                          <CheckCircle size={12} className="text-green-500 ml-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Show T/F correct answer */}
                {q.questionType === 'true_false' && q.correctAnswer && (
                  <p className="text-xs text-green-600 mt-1 font-medium">
                    Correct: {q.correctAnswer}
                  </p>
                )}

                {/* Show short answer model */}
                {q.questionType === 'short_answer' && q.correctAnswer && (
                  <p className="text-xs text-gray-500 mt-1">
                    Model answer: {q.correctAnswer}
                  </p>
                )}

                {q.explanation && (
                  <p className="text-xs text-gray-400 mt-2 italic">
                    Explanation: {q.explanation}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-4 flex-shrink-0">
              <button
                onClick={onStartEdit}
                className="p-2 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Edit3 size={14} />
              </button>
              <button
                onClick={onDelete}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
