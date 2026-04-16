'use client';

import { ChevronRight } from 'lucide-react';

interface StepAboutProps {
  name: string;
  email: string;
  phone: string;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onNext: () => void;
}

export function StepAbout({ name, email, phone, onNameChange, onEmailChange, onPhoneChange, onNext }: StepAboutProps) {
  const canContinue = name.trim() && email.trim() && phone.trim();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-zen-dark">About You</h2>
        <p className="text-sm text-gray-500 mt-1">We'll use this to set up your admin account.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zen-dark mb-1.5">Full Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="John Doe"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-zen-purple transition-colors bg-gray-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zen-dark mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-zen-purple transition-colors bg-gray-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zen-dark mb-1.5">Phone</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="+923001234567"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-zen-purple transition-colors bg-gray-50"
        />
      </div>

      <button
        onClick={onNext}
        disabled={!canContinue}
        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 bg-zen-dark text-white hover:bg-zen-darkest disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
