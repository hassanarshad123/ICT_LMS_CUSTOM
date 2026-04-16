'use client';

import { Loader2 } from 'lucide-react';

const REFERRAL_OPTIONS = [
  'Google Search',
  'Social Media',
  'Friend or Colleague',
  'Advertisement',
  'Other',
];

interface StepQuestionsProps {
  referralSource: string;
  expectedStudents: number;
  onReferralChange: (v: string) => void;
  onStudentsChange: (v: number) => void;
  onNext: () => void;
  onBack: () => void;
  submitting: boolean;
}

export function StepQuestions({
  referralSource,
  expectedStudents,
  onReferralChange,
  onStudentsChange,
  onNext,
  onBack,
  submitting,
}: StepQuestionsProps) {
  return (
    <div className="space-y-6">
      <div>
        <button onClick={onBack} disabled={submitting} className="text-sm text-zen-purple hover:underline mb-3 inline-block disabled:opacity-40">
          &larr; Back
        </button>
        <h2 className="text-xl font-semibold text-zen-dark">Quick Questions</h2>
        <p className="text-sm text-gray-500 mt-1">Help us serve you better. Feel free to skip.</p>
      </div>

      {/* Referral Source */}
      <div>
        <label className="block text-sm font-medium text-zen-dark mb-2">How did you find us?</label>
        <div className="space-y-2">
          {REFERRAL_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => onReferralChange(option)}
              disabled={submitting}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all text-left ${
                referralSource === option
                  ? 'border-zen-purple bg-zen-purple/5 text-zen-dark font-medium'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              } disabled:opacity-60`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                  referralSource === option
                    ? 'border-zen-purple bg-zen-purple'
                    : 'border-gray-300'
                }`}
              >
                {referralSource === option && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}
              </div>
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Expected Students Slider */}
      <div>
        <label className="block text-sm font-medium text-zen-dark mb-3">Expected number of students</label>
        <div className="text-center mb-4">
          <span className="text-2xl font-semibold text-zen-dark">
            {expectedStudents >= 500 ? '500+' : expectedStudents}
          </span>
          <p className="text-sm text-gray-500">students</p>
        </div>
        <input
          type="range"
          min={10}
          max={500}
          step={10}
          value={expectedStudents}
          onChange={(e) => onStudentsChange(Number(e.target.value))}
          disabled={submitting}
          className="w-full h-2 rounded-full bg-gray-200 appearance-none cursor-pointer accent-zen-purple disabled:opacity-60
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zen-purple [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md
            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-zen-purple [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>10</span>
          <span>500+</span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={onNext}
          disabled={submitting}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 bg-zen-dark text-white hover:bg-zen-darkest disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          {submitting ? 'Creating your LMS...' : 'Create My LMS'}
        </button>
        {!submitting && (
          <button
            onClick={onNext}
            className="w-full text-center text-sm text-gray-500 hover:text-zen-purple transition-colors"
          >
            Skip &amp; Create
          </button>
        )}
      </div>
    </div>
  );
}
