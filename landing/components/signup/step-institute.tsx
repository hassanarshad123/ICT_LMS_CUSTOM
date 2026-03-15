'use client';

import { useState } from 'react';
import { SlugInput } from './slug-input';

interface StepInstituteProps {
  instituteName: string;
  slug: string;
  onInstituteNameChange: (name: string) => void;
  onSlugChange: (slug: string) => void;
  onNext: () => void;
}

export function StepInstitute({
  instituteName,
  slug,
  onInstituteNameChange,
  onSlugChange,
  onNext,
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
        <label className="block text-sm font-medium text-zen-dark mb-1.5">
          Institute Name *
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
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 bg-zen-dark text-white hover:bg-zen-darkest disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue
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
