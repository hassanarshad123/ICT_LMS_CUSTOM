'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { OnboardingShell } from '@/components/signup/onboarding-shell';
import { StepInstitute } from '@/components/signup/step-institute';
import { StepBranding } from '@/components/signup/step-branding';
import { signup, createHandoffToken } from '@/lib/api/public';
import { uploadLogo, updateBranding } from '@/lib/api/branding';
import { trackMetaEvent } from '@/lib/meta-pixel';
import { SHOW_ONBOARDING_ANIMATION } from '@/lib/feature-flags';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY = '0x4AAAAAAC1pfHbt2LQkZdD-';

const STEPS = ['Institute Details', 'Branding', 'Setting Up'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Institute step state
  const [instituteName, setInstituteName] = useState('');
  const [slug, setSlug] = useState('');

  // Branding step state
  const [primaryColor, setPrimaryColor] = useState('#1A1A1A');
  const [accentColor, setAccentColor] = useState('#C5D86D');
  const [backgroundColor, setBackgroundColor] = useState('#F0F0F0');
  const [tagline, setTagline] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Turnstile CAPTCHA
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const renderTurnstile = useCallback(() => {
    if (!turnstileRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => setTurnstileToken(token),
      'expired-callback': () => setTurnstileToken(null),
      'error-callback': () => setTurnstileToken(null),
      theme: 'light',
    });
  }, []);

  useEffect(() => {
    if (step === 1) {
      // Wait for Turnstile script to load then render
      const interval = setInterval(() => {
        if (window.turnstile) {
          renderTurnstile();
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [step, renderTurnstile]);

  // Ensure user data exists from /register
  useEffect(() => {
    const stored = sessionStorage.getItem('signup_user');
    if (!stored) {
      router.replace('/register');
    }
  }, [router]);

  // Fire Meta Pixel ViewContent per onboarding step
  useEffect(() => {
    const stepNames = ['Institute Details', 'Branding', 'Setting Up'];
    void trackMetaEvent('ViewContent', {
      content_name: `Onboarding — ${stepNames[step] || 'Unknown'}`,
      content_category: 'Signup Funnel',
      content_type: 'onboarding_step',
    });
  }, [step]);

  const handleLogoChange = (file: File | null, preview: string | null) => {
    setLogoFile(file);
    setLogoPreview(preview);
  };

  const handleFinalSubmit = async () => {
    const storedUser = sessionStorage.getItem('signup_user');
    if (!storedUser) {
      router.replace('/register');
      return;
    }

    if (!turnstileToken) {
      toast.error('Please complete the CAPTCHA verification');
      return;
    }

    setSubmitting(true);
    try {
      const userData = JSON.parse(storedUser);

      // 1. Create institute + user
      const signupRes = await signup({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        phone: userData.phone,
        instituteName,
        instituteSlug: slug,
        website: userData.website,
        cfTurnstileToken: turnstileToken,
      });

      const { accessToken, institute } = signupRes;

      // Store tokens temporarily for branding API calls
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', signupRes.refreshToken);

      // THE CONVERSION EVENT — fire Meta Pixel CompleteRegistration.
      // This is what Meta campaigns optimize for.
      void trackMetaEvent(
        'CompleteRegistration',
        {
          content_name: 'LMS Created',
          content_category: 'Free Signup',
          status: 'completed',
          currency: 'PKR',
          value: 0,
          institute_slug: institute.slug,
          institute_name: instituteName,
        },
        {
          email: userData.email,
          firstName: (userData.name || '').split(' ')[0],
          lastName: (userData.name || '').split(' ').slice(1).join(' ') || undefined,
          phone: userData.phone,
          externalId: signupRes.user?.id ? String(signupRes.user.id) : institute.slug,
        },
      );

      // 2. Upload logo if selected
      if (logoFile) {
        try {
          await uploadLogo(logoFile);
        } catch {
          toast.warning('Logo upload failed. You can add it later in Branding settings.');
        }
      }

      // 3. Save branding if customized
      const brandingChanged =
        primaryColor !== '#1A1A1A' ||
        accentColor !== '#C5D86D' ||
        backgroundColor !== '#F0F0F0' ||
        tagline;

      if (brandingChanged) {
        try {
          await updateBranding({
            primaryColor,
            accentColor,
            backgroundColor,
            instituteName,
            tagline: tagline || 'Learning Management System',
          });
        } catch {
          toast.warning('Branding save failed. You can customize it later in settings.');
        }
      }

      // 4. Build target subdomain URL
      const isLocal = window.location.hostname === 'localhost' ||
                      window.location.hostname.includes('.localhost');
      const appPort = process.env.NEXT_PUBLIC_APP_PORT || '3000';
      const targetDomain = isLocal
        ? `${institute.slug}.localhost:${appPort}`
        : `${institute.slug}.zensbot.online`;
      const protocol = window.location.protocol;
      const targetBase = `${protocol}//${targetDomain}`;

      // 5. Wait for subdomain to be reachable (SSL provisioning can take 30-60s)
      setStep(2); // Show "Setting up your LMS" screen
      const maxWaitMs = 120_000; // 2 minutes max
      const pollInterval = 3_000; // check every 3s
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        try {
          await fetch(`${targetBase}/login`, { mode: 'no-cors', cache: 'no-store' });
          break; // reachable
        } catch {
          await new Promise((r) => setTimeout(r, pollInterval));
        }
      }

      // 6. Create handoff token and redirect
      try {
        const handoff = await createHandoffToken(accessToken);
        sessionStorage.removeItem('signup_user');
        window.location.href = `${targetBase}/auth-callback?token=${handoff.handoffToken}`;
      } catch {
        // Fallback: if handoff fails, redirect to app login
        sessionStorage.removeItem('signup_user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        toast.success('Account created! Please log in at your institute URL.');
        const loginUrl = isLocal
          ? `http://localhost:${appPort}/login`
          : 'https://zensbot.online/login';
        window.location.href = loginUrl;
      }
    } catch (err: unknown) {
      setSubmitting(false);
      // Reset Turnstile so user can retry
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken(null);
      }
      const message = err instanceof Error ? err.message : 'Signup failed. Please try again.';
      toast.error(message);
    }
  };

  return (
    <OnboardingShell
      currentStep={step + 1}
      totalSteps={STEPS.length}
      stepLabel={STEPS[step]}
    >
      {step === 0 && (
        <StepInstitute
          instituteName={instituteName}
          slug={slug}
          onInstituteNameChange={setInstituteName}
          onSlugChange={setSlug}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <>
          <button
            onClick={() => setStep(0)}
            className="text-sm text-zen-purple hover:underline mb-4 inline-block"
          >
            &larr; Back to institute details
          </button>
          <StepBranding
            primaryColor={primaryColor}
            accentColor={accentColor}
            backgroundColor={backgroundColor}
            tagline={tagline}
            logoFile={logoFile}
            logoPreview={logoPreview}
            onPrimaryChange={setPrimaryColor}
            onAccentChange={setAccentColor}
            onBackgroundChange={setBackgroundColor}
            onTaglineChange={setTagline}
            onLogoChange={handleLogoChange}
            onSubmit={handleFinalSubmit}
            submitting={submitting}
          />
          <div className="mt-4 flex justify-center">
            <div ref={turnstileRef} />
          </div>
        </>
      )}
      {step === 2 && !SHOW_ONBOARDING_ANIMATION && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-10 w-10 border-4 border-gray-200 border-t-zen-purple rounded-full animate-spin" />
          <h2 className="text-lg font-semibold text-gray-800">Setting up your LMS...</h2>
          <p className="text-sm text-gray-500 text-center max-w-xs">
            We&apos;re preparing your institute. This usually takes a few seconds.
          </p>
        </div>
      )}
      {step === 2 && SHOW_ONBOARDING_ANIMATION && (
        // Phase 2 will replace this placeholder with the personalized
        // <OnboardingAnimation /> component. Flag is OFF by default in prod,
        // so this branch only renders when the Vercel env var is flipped on.
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-10 w-10 border-4 border-gray-200 border-t-zen-purple rounded-full animate-spin" />
          <h2 className="text-lg font-semibold text-gray-800">
            [Phase 2 placeholder] Animation will render here
          </h2>
          <p className="text-sm text-gray-500 text-center max-w-xs">
            Setting up your LMS...
          </p>
        </div>
      )}
    </OnboardingShell>
  );
}
