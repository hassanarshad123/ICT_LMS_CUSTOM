'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { SlugInput } from './slug-input';

interface StepInstituteProps {
  instituteName: string;
  slug: string;
  onInstituteNameChange: (name: string) => void;
  onSlugChange: (slug: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepInstitute({
  instituteName,
  slug,
  onInstituteNameChange,
  onSlugChange,
  onNext,
  onBack,
}: StepInstituteProps) {
  const [slugAvailable, setSlugAvailable] = useState(false);

  const handleNameChange = (name: string) => {
    onInstituteNameChange(name);
    // Auto-generate slug from name if slug is empty or was auto-generated
    if (!slug || slug === generateSlug(instituteName)) {
      onSlugChange(generateSlug(name));
    }
  };

  const canContinue = instituteName.trim().length > 0 && slug.length >= 3 && slugAvailable;

  return (
    <div className="space-y-5">
      <div>
        <button onClick={onBack} className="text-sm text-zen-purple hover:underline mb-3 inline-block">
          &larr; Back
        </button>
        <h2 className="text-xl font-semibold text-zen-dark">Your Institute</h2>
        <p className="text-sm text-gray-500 mt-1">Name your institute and choose its web address.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zen-dark mb-1.5">
          Institute Name
        </label>
        <input
          type="text"
          value={instituteName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Acme Academy"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-zen-purple transition-colors bg-gray-50"
        />
      </div>

      <SlugInput
        value={slug}
        onChange={onSlugChange}
        onAvailabilityChange={setSlugAvailable}
      />

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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}
