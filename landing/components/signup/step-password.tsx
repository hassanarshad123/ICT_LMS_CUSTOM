'use client';

import { useState, useMemo } from 'react';
import { Eye, EyeOff, ChevronRight, Check, X } from 'lucide-react';

interface StepPasswordProps {
  password: string;
  onPasswordChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const REQUIREMENTS = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
  { label: 'One special character (!@#$%)', test: (p: string) => /[!@#$%^&*()_+\-=[\]{}|;:,.<>?/~`]/.test(p) },
];

const STRENGTH_CONFIG = [
  { label: '', color: '' },
  { label: 'Weak', color: 'bg-red-400', text: 'text-red-500' },
  { label: 'Fair', color: 'bg-amber-400', text: 'text-amber-500' },
  { label: 'Good', color: 'bg-lime-500', text: 'text-lime-600' },
  { label: 'Strong', color: 'bg-green-500', text: 'text-green-600' },
];

export function StepPassword({ password, onPasswordChange, onNext, onBack }: StepPasswordProps) {
  const [showPassword, setShowPassword] = useState(false);

  const checks = useMemo(() => REQUIREMENTS.map((r) => r.test(password)), [password]);
  const score = useMemo(() => checks.filter(Boolean).length, [checks]);
  const allMet = score === 4;
  const config = STRENGTH_CONFIG[score];

  return (
    <div className="space-y-5">
      <div>
        <button onClick={onBack} className="text-sm text-zen-purple hover:underline mb-3 inline-block">
          &larr; Back
        </button>
        <h2 className="text-xl font-semibold text-zen-dark">Secure Your Account</h2>
        <p className="text-sm text-gray-500 mt-1">Choose a strong password for your admin login.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zen-dark mb-1.5">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Create a strong password"
            className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-zen-purple transition-colors bg-gray-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Strength meter */}
      {password.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= score ? config.color : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
          </div>

          {/* Requirements checklist */}
          <div className="space-y-1.5">
            {REQUIREMENTS.map((req, i) => (
              <div key={req.label} className="flex items-center gap-2 text-xs">
                {checks[i] ? (
                  <Check size={14} className="text-green-500 shrink-0" />
                ) : (
                  <X size={14} className="text-gray-300 shrink-0" />
                )}
                <span className={checks[i] ? 'text-green-600' : 'text-gray-400'}>
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!allMet}
        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 bg-zen-dark text-white hover:bg-zen-darkest disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
