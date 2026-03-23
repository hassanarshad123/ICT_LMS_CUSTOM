'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Palette, Layers, Users, BookOpen, CheckCircle2 } from 'lucide-react';
import { useBasePath } from '@/hooks/use-base-path';
import { updateSettings } from '@/lib/api/admin';
import { useMutation } from '@/hooks/use-api';
import StepBranding from './step-branding';
import StepBatch from './step-batch';
import StepImport from './step-import';
import StepCourse from './step-course';

const STEPS = [
  { label: 'Branding', icon: Palette },
  { label: 'Batch', icon: Layers },
  { label: 'Students', icon: Users },
  { label: 'Course', icon: BookOpen },
] as const;

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const basePath = useBasePath();

  const { execute: doUpdateSettings, loading: completing } = useMutation(
    (settings: Record<string, string>) => updateSettings(settings),
  );

  const completeOnboarding = useCallback(async () => {
    try {
      await doUpdateSettings({ onboarding_completed: 'true' });
      toast.success('Setup complete! Welcome to your dashboard.');
      router.push(basePath);
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete setup');
    }
  }, [doUpdateSettings, router, basePath]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      completeOnboarding();
    }
  }, [step, completeOnboarding]);

  const handleSkipStep = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      completeOnboarding();
    }
  }, [step, completeOnboarding]);

  const handleSkipAll = useCallback(() => {
    completeOnboarding();
  }, [completeOnboarding]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isComplete = i < step;
              return (
                <div key={s.label} className="flex flex-col items-center flex-1">
                  <div className="flex items-center w-full">
                    {i > 0 && (
                      <div
                        className={`flex-1 h-0.5 ${
                          isComplete ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      />
                    )}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isComplete
                          ? 'bg-primary text-white'
                          : isActive
                            ? 'bg-primary text-white ring-4 ring-primary/20'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <Icon size={18} />
                      )}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 ${
                          isComplete ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium ${
                      isActive || isComplete ? 'text-primary' : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 card-shadow">
          {step === 0 && <StepBranding onNext={handleNext} onSkip={handleSkipStep} />}
          {step === 1 && <StepBatch onNext={handleNext} onSkip={handleSkipStep} />}
          {step === 2 && <StepImport onNext={handleNext} onSkip={handleSkipStep} />}
          {step === 3 && <StepCourse onNext={handleNext} onSkip={handleSkipStep} />}
        </div>

        {/* Skip setup link */}
        <div className="text-center mt-6">
          <button
            onClick={handleSkipAll}
            disabled={completing}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-60"
          >
            {completing ? (
              <span className="flex items-center gap-2 justify-center">
                <Loader2 size={14} className="animate-spin" />
                Finishing...
              </span>
            ) : (
              'Skip Setup — go to dashboard'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
