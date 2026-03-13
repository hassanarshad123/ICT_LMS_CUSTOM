'use client';

import { Loader2 } from 'lucide-react';

export type QuestionType = 'mcq' | 'true_false' | 'short_answer';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple Choice',
  true_false: 'True / False',
  short_answer: 'Short Answer',
};

export const DEFAULT_OPTIONS: Record<string, string> = {
  A: '',
  B: '',
  C: '',
  D: '',
};

export interface QuestionFormState {
  questionType: QuestionType;
  questionText: string;
  options: Record<string, string>;
  correctAnswer: string;
  points: number;
  explanation: string;
}

export const EMPTY_QUESTION_FORM: QuestionFormState = {
  questionType: 'mcq',
  questionText: '',
  options: { ...DEFAULT_OPTIONS },
  correctAnswer: '',
  points: 1,
  explanation: '',
};

export interface QuizQuestionFormProps {
  form: QuestionFormState;
  onFormChange: (form: QuestionFormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isNew: boolean;
  loading?: boolean;
  /** Label for the submit button, e.g. "Add Question" or "Save" */
  submitLabel?: string;
}

export function QuizQuestionForm({
  form,
  onFormChange,
  onSubmit,
  onCancel,
  isNew,
  loading = false,
  submitLabel = 'Add Question',
}: QuizQuestionFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <QuestionFormFields
        form={form}
        onFormChange={onFormChange}
        isNew={isNew}
      />
      <div className="flex gap-3 mt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-60"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ─── Shared form fields (used by both new question and edit inline) ─── */

export interface QuestionFormFieldsProps {
  form: QuestionFormState;
  onFormChange: (form: QuestionFormState) => void;
  isNew: boolean;
}

export function QuestionFormFields({
  form,
  onFormChange,
  isNew,
}: QuestionFormFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Question type selector (only for new) */}
      {isNew && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Question Type</label>
          <div className="flex gap-2">
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onFormChange({ ...form, questionType: type, correctAnswer: '', options: { ...DEFAULT_OPTIONS } })}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  form.questionType === type
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {QUESTION_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Question text */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Question</label>
        <textarea
          value={form.questionText}
          onChange={(e) => onFormChange({ ...form, questionText: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
          rows={3}
          placeholder="Enter your question..."
          required
        />
      </div>

      {/* MCQ options */}
      {form.questionType === 'mcq' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Options</label>
          <div className="space-y-2">
            {['A', 'B', 'C', 'D'].map((key) => (
              <div key={key} className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={isNew ? 'correct-new' : `correct-edit-${form.questionText}`}
                    checked={form.correctAnswer === key}
                    onChange={() => onFormChange({ ...form, correctAnswer: key })}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-bold text-primary w-5">{key}</span>
                </label>
                <input
                  type="text"
                  value={form.options[key] || ''}
                  onChange={(e) =>
                    onFormChange({
                      ...form,
                      options: { ...form.options, [key]: e.target.value },
                    })
                  }
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                  placeholder={`Option ${key}`}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Select the radio button next to the correct answer.</p>
        </div>
      )}

      {/* True / False */}
      {form.questionType === 'true_false' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Correct Answer</label>
          <div className="flex gap-3">
            {['True', 'False'].map((val) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={isNew ? 'tf-new' : `tf-edit-${form.questionText}`}
                  checked={form.correctAnswer === val}
                  onChange={() => onFormChange({ ...form, correctAnswer: val })}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm text-primary">{val}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Short answer reference */}
      {form.questionType === 'short_answer' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Model Answer (for grading reference)</label>
          <textarea
            value={form.correctAnswer}
            onChange={(e) => onFormChange({ ...form, correctAnswer: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
            rows={2}
            placeholder="Enter the model answer..."
          />
        </div>
      )}

      {/* Points */}
      <div className="flex gap-4">
        <div className="w-32">
          <label className="block text-xs font-medium text-gray-600 mb-1">Points</label>
          <input
            type="number"
            min={1}
            value={form.points}
            onChange={(e) => onFormChange({ ...form, points: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
          />
        </div>
      </div>

      {/* Explanation */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Explanation (shown after submission)</label>
        <textarea
          value={form.explanation}
          onChange={(e) => onFormChange({ ...form, explanation: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
          rows={2}
          placeholder="Explain the correct answer..."
        />
      </div>
    </div>
  );
}
