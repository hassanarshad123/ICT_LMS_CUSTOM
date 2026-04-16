'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { signup, createHandoffToken } from '@/lib/api/public';
import { uploadLogo, updateBranding } from '@/lib/api/branding';
import { trackMetaEvent } from '@/lib/meta-pixel';
import { SHOW_ONBOARDING_ANIMATION } from '@/lib/feature-flags';
import { LOGIN_URL } from '@/lib/landing-constants';
import { OnboardingAnimation } from './onboarding-animation';
import { ErrorBoundary } from '@/components/shared/error-boundary';

import { StepAbout } from './step-about';
import { StepPassword } from './step-password';
import { StepInstitute } from './step-institute';
import { StepTheme } from './step-theme';
import { StepCustomize } from './step-customize';
import { StepQuestions } from './step-questions';
import { LmsPreview } from './lms-preview';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

// Cloudflare Turnstile site key. Prefer env var so it can be rotated
// without a code change; fall back to the current production key.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAC1pfHbt2LQkZdD-';
const TURNSTILE_ENABLED = Boolean(TURNSTILE_SITE_KEY) && TURNSTILE_SITE_KEY !== 'SKIP';

const TOTAL_STEPS = 7;
const STEP_LABELS = [
  'About You',
  'Secure Your Account',
  'Your Institute',
  'Pick a Look',
  'Make It Yours',
  'Quick Questions',
  'Creating Your LMS',
];

// Slide-up-from-bottom animation variants
const stepVariants = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2, ease: 'easeIn' as const } },
};

export function SignupFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: About You
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2: Password
  const [password, setPassword] = useState('');

  // Step 3: Institute
  const [instituteName, setInstituteName] = useState('');
  const [slug, setSlug] = useState('');

  // Step 4: Theme
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#1A1A1A');
  const [accentColor, setAccentColor] = useState('#C5D86D');
  const [backgroundColor, setBackgroundColor] = useState('#F0F0F0');

  // Step 5: Customize
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [tagline, setTagline] = useState('');

  // Step 6: Questions
  const [referralSource, setReferralSource] = useState('');
  const [expectedStudents, setExpectedStudents] = useState(50);

  // Honeypot
  const [website] = useState('');

  // Turnstile CAPTCHA
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Step 7: Setup state
  const [subdomainReady, setSubdomainReady] = useState(false);
  const [redirectContext, setRedirectContext] = useState<{
    accessToken: string;
    targetBase: string;
    isLocal: boolean;
    appPort: string;
  } | null>(null);

  // ── Turnstile ──────────────────────────────────────────────

  const renderTurnstile = useCallback(() => {
    if (!TURNSTILE_ENABLED) return;
    if (!turnstileRef.current || !window.turnstile || widgetIdRef.current) return;
    try {
      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(null),
        'error-callback': (errorCode: string) => {
          // eslint-disable-next-line no-console
          console.error('[Turnstile] widget error:', errorCode);
          setTurnstileToken(null);
          toast.error(`CAPTCHA failed to load (error ${errorCode}). Please refresh.`);
        },
        theme: 'light',
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Turnstile] render threw:', e);
      toast.error('CAPTCHA failed to initialize. Please refresh the page.');
    }
  }, []);

  // Render Turnstile on step 5 (questions step, the last interactive step).
  // Wait for BOTH the Cloudflare script AND the DOM ref to be available —
  // the ref mounts outside AnimatePresence but may still lag by a tick.
  useEffect(() => {
    if (step !== 5 || !TURNSTILE_ENABLED) return;
    const interval = setInterval(() => {
      if (window.turnstile && turnstileRef.current) {
        renderTurnstile();
        clearInterval(interval);
      }
    }, 200);
    return () => {
      clearInterval(interval);
      // Reset widget ID so a fresh widget renders if user navigates back
      widgetIdRef.current = null;
    };
  }, [step, renderTurnstile]);

  // ── Validation helpers ─────────────────────────────────────

  const validateStep1 = (): string | null => {
    if (!name.trim() || !email.trim() || !phone.trim()) return 'Please fill in all fields';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address';
    const normalizedPhone = phone.replace(/[\s\-()]/g, '');
    if (!/^\+?[1-9]\d{1,14}$/.test(normalizedPhone)) return 'Phone must be in international format (e.g. +923001234567)';
    return null;
  };

  // ── Step navigation ────────────────────────────────────────

  const goNext = () => {
    // Validate step 1 on Continue
    if (step === 0) {
      const error = validateStep1();
      if (error) {
        toast.error(error);
        return;
      }
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleThemeSelect = (key: string, colors: { primary: string; accent: string; background: string }) => {
    setSelectedTheme(key);
    setPrimaryColor(colors.primary);
    setAccentColor(colors.accent);
    setBackgroundColor(colors.background);
  };

  const handleLogoChange = (file: File | null, preview: string | null) => {
    setLogoFile(file);
    setLogoPreview(preview);
  };

  // ── Meta Pixel tracking ────────────────────────────────────

  useEffect(() => {
    void trackMetaEvent('ViewContent', {
      content_name: `Signup — ${STEP_LABELS[step] || 'Unknown'}`,
      content_category: 'Signup Funnel',
      content_type: 'signup_step',
    });
  }, [step]);

  // ── Final submission ───────────────────────────────────────

  const performRedirect = useCallback(
    async (ctx: { accessToken: string; targetBase: string; isLocal: boolean; appPort: string }) => {
      try {
        const handoff = await createHandoffToken(ctx.accessToken);
        window.location.href = `${ctx.targetBase}/auth-callback?token=${handoff.handoffToken}`;
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        toast.success('Account created! Please log in at your institute URL.');
        window.location.href = `${ctx.targetBase}/login`;
      }
    },
    [],
  );

  const handleSubmit = async () => {
    if (TURNSTILE_ENABLED && !turnstileToken) {
      toast.error('Please complete the CAPTCHA verification');
      return;
    }

    setSubmitting(true);
    setStep(6); // Move to "Creating Your LMS" step

    try {
      const normalizedPhone = phone.replace(/[\s\-()]/g, '');

      // 1. Create institute + user
      const signupRes = await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: normalizedPhone,
        instituteName,
        instituteSlug: slug,
        website: website || undefined,
        cfTurnstileToken: turnstileToken || undefined,
      });

      const { accessToken, institute } = signupRes;
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', signupRes.refreshToken);

      // Fire Meta conversion event
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
          email: email.trim(),
          firstName: name.trim().split(' ')[0],
          lastName: name.trim().split(' ').slice(1).join(' ') || undefined,
          phone: normalizedPhone,
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

      // 3. Save branding
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

      // 4. Build target subdomain URL
      const hostname = window.location.hostname;
      const isLocal = ['localhost', '127.0.0.1'].includes(hostname) || hostname.includes('.localhost');
      const appPort = process.env.NEXT_PUBLIC_APP_PORT || '3000';
      const targetDomain = isLocal
        ? `${institute.slug}.localhost:${appPort}`
        : `${institute.slug}.zensbot.online`;
      const protocol = window.location.protocol;
      const targetBase = `${protocol}//${targetDomain}`;

      setRedirectContext({ accessToken, targetBase, isLocal, appPort });

      // 5. Poll for subdomain readiness
      const maxWaitMs = 120_000;
      const pollInterval = 3_000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        try {
          await fetch(`${targetBase}/login`, { mode: 'no-cors', cache: 'no-store' });
          break;
        } catch {
          await new Promise((r) => setTimeout(r, pollInterval));
        }
      }

      const pollingTimedOut = Date.now() - startTime >= maxWaitMs;
      setSubdomainReady(true);
      if (pollingTimedOut) {
        toast.warning("Your LMS is being set up. If the page doesn't load immediately, wait a moment and refresh.");
      }

      // 6. Redirect (unless animation handles it)
      if (!SHOW_ONBOARDING_ANIMATION) {
        await performRedirect({ accessToken, targetBase, isLocal, appPort });
      }
    } catch (err: unknown) {
      setSubmitting(false);
      setStep(5); // Go back to questions step

      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken(null);
      }

      let message: string;
      if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
        message = 'Connection failed — please check your internet and try again.';
      } else if (err instanceof Error && /timed?\s*out/i.test(err.message)) {
        message = 'The server is taking too long to respond. Please try again.';
      } else if (err instanceof Error && err.message) {
        message = err.message;
      } else {
        message = 'Something went wrong. Please try again or contact support.';
      }
      toast.error(message);
    }
  };

  // ── Whether to show the live preview panel ─────────────────

  const showPreview = step >= 3 && step <= 4;
  const firstName = name.trim().split(' ')[0] || 'Friend';

  // ── Progress bar ───────────────────────────────────────────

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zen-bg flex flex-col">
      {/* Thin top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
        <div
          className="h-full bg-zen-purple transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main layout */}
      <div className="flex-1 flex items-center justify-center p-4 pt-6">
        <div className={`w-full ${showPreview ? 'max-w-4xl' : 'max-w-lg'}`}>
          {/* Header */}
          <div className="text-center mb-6">
            <span className="font-serif text-2xl text-zen-dark">Zensbot</span>
          </div>

          {/* Content area — split on desktop when preview is visible */}
          <div className={`${showPreview ? 'flex flex-col lg:flex-row gap-6' : ''}`}>
            {/* Form card */}
            <div className={`${showPreview ? 'lg:flex-1' : ''}`}>
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {step === 0 && (
                      <StepAbout
                        name={name}
                        email={email}
                        phone={phone}
                        onNameChange={setName}
                        onEmailChange={setEmail}
                        onPhoneChange={setPhone}
                        onNext={goNext}
                      />
                    )}
                    {step === 1 && (
                      <StepPassword
                        password={password}
                        onPasswordChange={setPassword}
                        onNext={goNext}
                        onBack={goBack}
                      />
                    )}
                    {step === 2 && (
                      <StepInstitute
                        instituteName={instituteName}
                        slug={slug}
                        onInstituteNameChange={setInstituteName}
                        onSlugChange={setSlug}
                        onNext={goNext}
                        onBack={goBack}
                      />
                    )}
                    {step === 3 && (
                      <StepTheme
                        selectedTheme={selectedTheme}
                        onThemeSelect={handleThemeSelect}
                        onNext={goNext}
                        onBack={goBack}
                      />
                    )}
                    {step === 4 && (
                      <StepCustomize
                        logoFile={logoFile}
                        logoPreview={logoPreview}
                        tagline={tagline}
                        onLogoChange={handleLogoChange}
                        onTaglineChange={setTagline}
                        onNext={goNext}
                        onBack={goBack}
                      />
                    )}
                    {step === 5 && (
                      <StepQuestions
                        referralSource={referralSource}
                        expectedStudents={expectedStudents}
                        onReferralChange={setReferralSource}
                        onStudentsChange={setExpectedStudents}
                        onNext={handleSubmit}
                        onBack={goBack}
                        submitting={submitting}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Turnstile CAPTCHA — rendered OUTSIDE AnimatePresence so
                    the DOM element is mounted immediately when step === 5,
                    not delayed by framer-motion's exit animation. */}
                {step === 5 && TURNSTILE_ENABLED && (
                  <div className="mt-4 flex justify-center">
                    <div ref={turnstileRef} />
                  </div>
                )}

                {/* Step 7: Creating Your LMS */}
                {step === 6 && !SHOW_ONBOARDING_ANIMATION && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="h-10 w-10 border-4 border-gray-200 border-t-zen-purple rounded-full animate-spin" />
                    <h2 className="text-lg font-semibold text-gray-800">Creating your LMS...</h2>
                    <p className="text-sm text-gray-500 text-center max-w-xs">
                      We&apos;re setting everything up. This usually takes a few seconds.
                    </p>
                  </div>
                )}
                {step === 6 && SHOW_ONBOARDING_ANIMATION && (
                  <ErrorBoundary
                    context="onboarding-animation"
                    fallback={
                      <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <div className="h-10 w-10 border-4 border-gray-200 border-t-zen-purple rounded-full animate-spin" />
                        <h2 className="text-lg font-semibold text-gray-800">Creating your LMS...</h2>
                        <p className="text-sm text-gray-500 text-center max-w-xs">
                          We&apos;re setting everything up. This usually takes a few seconds.
                        </p>
                      </div>
                    }
                  >
                    <OnboardingAnimation
                      firstName={firstName}
                      instituteName={instituteName || 'your new institute'}
                      primaryColor={primaryColor}
                      accentColor={accentColor}
                      backgroundColor={backgroundColor}
                      tagline={tagline}
                      logoPreview={logoPreview}
                      slug={slug}
                      isReadyToRedirect={subdomainReady}
                      onComplete={() => {
                        if (redirectContext) {
                          void performRedirect(redirectContext);
                        }
                      }}
                    />
                  </ErrorBoundary>
                )}
              </div>
            </div>

            {/* Live preview panel — visible on steps 3-4 */}
            {showPreview && (
              <div className="lg:w-80 shrink-0">
                <div className="lg:sticky lg:top-8">
                  <LmsPreview
                    instituteName={instituteName}
                    primaryColor={primaryColor}
                    accentColor={accentColor}
                    backgroundColor={backgroundColor}
                    logoPreview={logoPreview}
                    tagline={tagline}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sign in link */}
          {step < 6 && (
            <p className="text-center text-sm text-gray-500 mt-4">
              Already have an account?{' '}
              <a href={LOGIN_URL} className="text-zen-purple font-medium hover:underline">
                Sign in
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
