'use client';

interface OnboardingShellProps {
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
  children: React.ReactNode;
}

export function OnboardingShell({ currentStep, totalSteps, stepLabel, children }: OnboardingShellProps) {
  return (
    <div className="min-h-screen bg-zen-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="font-serif text-2xl text-zen-dark">Zensbot</span>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zen-dark/60">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-xs font-medium text-zen-dark/60">{stepLabel}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-zen-purple rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
          {children}
        </div>
      </div>
    </div>
  );
}
