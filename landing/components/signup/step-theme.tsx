'use client';

import { ChevronRight } from 'lucide-react';

const THEMES: Record<string, { primary: string; accent: string; background: string; label: string }> = {
  midnight: { primary: '#1A1A2E', accent: '#E94560', background: '#F5F5F5', label: 'Midnight' },
  ocean: { primary: '#0A2647', accent: '#2C74B3', background: '#F0F7FF', label: 'Ocean' },
  forest: { primary: '#1B4332', accent: '#52B788', background: '#F0FFF4', label: 'Forest' },
  sunset: { primary: '#6B2737', accent: '#F4845F', background: '#FFF5F2', label: 'Sunset' },
  royal: { primary: '#2D1B69', accent: '#7B68EE', background: '#F5F3FF', label: 'Royal' },
  earth: { primary: '#3D2B1F', accent: '#C5A55A', background: '#FFFBF0', label: 'Earth' },
};

interface StepThemeProps {
  selectedTheme: string | null;
  onThemeSelect: (themeKey: string, colors: { primary: string; accent: string; background: string }) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepTheme({ selectedTheme, onThemeSelect, onNext, onBack }: StepThemeProps) {
  return (
    <div className="space-y-5">
      <div>
        <button onClick={onBack} className="text-sm text-zen-purple hover:underline mb-3 inline-block">
          &larr; Back
        </button>
        <h2 className="text-xl font-semibold text-zen-dark">Pick a Look</h2>
        <p className="text-sm text-gray-500 mt-1">Choose a color theme for your LMS. You can customize it later.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Object.entries(THEMES).map(([key, theme]) => (
          <button
            key={key}
            onClick={() => onThemeSelect(key, { primary: theme.primary, accent: theme.accent, background: theme.background })}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              selectedTheme === key
                ? 'border-zen-purple bg-zen-purple/5 ring-1 ring-zen-purple/20'
                : 'border-gray-100 hover:border-gray-300'
            }`}
          >
            <div className="w-full h-8 rounded-lg mb-2" style={{ backgroundColor: theme.primary }} />
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: theme.accent }} />
              <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: theme.background }} />
            </div>
            <p className="text-sm font-medium text-gray-700">{theme.label}</p>
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={!selectedTheme}
        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 bg-zen-dark text-white hover:bg-zen-darkest disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
