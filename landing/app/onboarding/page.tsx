'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { OnboardingShell } from '@/components/signup/onboarding-shell';
import { StepInstitute } from '@/components/signup/step-institute';
import { StepBranding } from '@/components/signup/step-branding';
import { signup, createHandoffToken } from '@/lib/api/public';
import { uploadLogo, updateBranding } from '@/lib/api/branding';
import { trackMetaEvent } from '@/lib/meta-pixel';
import { SHOW_ONBOARDING_ANIMATION } from '@/lib/feature-flags';
import { OnboardingAnimation } from '@/components/signup/onboarding-animation';
import { ErrorBoundary } from '@/components/shared/error-boundary';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

// Cloudflare Turnstile site key — loaded from env so we can rotate it
// without a code change. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY in .env.local
// (and in Vercel) with the real site key from
// https://dash.cloudflare.com/?to=/:account/turnstile.
//
// Dev bypass: if the env var is empty or explicitly set to 'SKIP', the
// CAPTCHA widget is not rendered and the submit check is skipped. This
// keeps local development unblocked when no real key is configured. The
// backend independently skips verification when CF_TURNSTILE_SECRET_KEY
// is empty, so the two bypass paths must be used together.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const TURNSTILE_ENABLED = Boolean(TURNSTILE_SITE_KEY) && TURNSTILE_SITE_KEY !== 'SKIP';

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

  // Setup-step state — used by the personalized onboarding animation.
  // subdomainReady flips true when the polling loop reaches the new
  // subdomain. redirectContext holds the data the animation's onComplete
  // callback needs to perform the final navigation.
  const [subdomainReady, setSubdomainReady] = useState(false);
  const [redirectContext, setRedirectContext] = useState<{
    accessToken: string;
    targetBase: string;
    isLocal: boolean;
    appPort: string;
  } | null>(null);
  const firstName = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const stored = sessionStorage.getItem('signup_user');
    if (!stored) return '';
    try {
      const parsed = JSON.parse(stored);
      return ((parsed.name as string) || '').split(' ')[0] || '';
    } catch {
      return '';
    }
  }, []);

  const renderTurnstile = useCallback(() => {
    if (!TURNSTILE_ENABLED) return;
    if (!turnstileRef.current || !window.turnstile || widgetIdRef.current) return;
    try {
      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(null),
        'error-callback': (errorCode: string) => {
          // Surface Cloudflare error codes so silent loops are visible.
          // Common codes: 110200 (invalid site key), 300030 (challenge
          // rejected), 600010 (unknown client error). Full list:
          // https://developers.cloudflare.com/turnstile/reference/client-side-errors/
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

  useEffect(() => {
    if (step !== 1 || !TURNSTILE_ENABLED) return;
    // Wait for Turnstile script to load then render
    const interval = setInterval(() => {
      if (window.turnstile) {
        renderTurnstile();
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
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

  /**
   * Performs the final navigation to the user's newly-provisioned LMS
   * subdomain. Used both by the legacy spinner path (called inline after
   * polling completes) and by the animation's onComplete callback (called
   * after the 3-2-1 countdown).
   *
   * Idempotent: safe to call multiple times — only the first call wins
   * because window.location.href is a one-shot navigation.
   */
  const performRedirect = useCallback(
    async (ctx: { accessToken: string; targetBase: string; isLocal: boolean; appPort: string }) => {
      try {
        const handoff = await createHandoffToken(ctx.accessToken);
        sessionStorage.removeItem('signup_user');
        window.location.href = `${ctx.targetBase}/auth-callback?token=${handoff.handoffToken}`;
      } catch {
        // Fallback: if handoff fails, redirect to institute login directly
        sessionStorage.removeItem('signup_user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        toast.success('Account created! Please log in at your institute URL.');
        window.location.href = `${ctx.targetBase}/login`;
      }
    },
    [],
  );

  const handleFinalSubmit = async () => {
    const storedUser = sessionStorage.getItem('signup_user');
    if (!storedUser) {
      router.replace('/register');
      return;
    }

    if (TURNSTILE_ENABLED && !turnstileToken) {
      toast.error('Please complete the CAPTCHA verification');
      return;
    }

    setSubmitting(true);
    try {
      let userData: { name: string; email: string; password: string; phone?: string; website?: string };
      try {
        userData = JSON.parse(storedUser);
      } catch {
        sessionStorage.removeItem('signup_user');
        toast.error('Your session data was corrupted. Please fill in your details again.');
        router.replace('/register');
        setSubmitting(false);
        return;
      }

      // 1. Create institute + user
      const signupRes = await signup({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        phone: userData.phone,
        instituteName,
        instituteSlug: slug,
        website: userData.website,
        cfTurnstileToken: turnstileToken || undefined,
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
      const hostname = window.location.hostname;
      const isLocal = ['localhost', '127.0.0.1'].includes(hostname) ||
                      hostname.includes('.localhost');
      const appPort = process.env.NEXT_PUBLIC_APP_PORT || '3000';
      const targetDomain = isLocal
        ? `${institute.slug}.localhost:${appPort}`
        : `${institute.slug}.zensbot.online`;
      const protocol = window.location.protocol;
      const targetBase = `${protocol}//${targetDomain}`;

      // Capture context the animation's onComplete callback (or the
      // legacy spinner path) needs to perform the final redirect.
      setRedirectContext({ accessToken, targetBase, isLocal, appPort });

      // 5. Show step 2 (animation OR spinner) and start polling for the
      // newly-provisioned subdomain. SSL provisioning can take 30-90s.
      setStep(2);
      setSubmitting(false);
      const maxWaitMs = 120_000; // 2 minutes max
      const pollInterval = 3_000; // check every 3s
      const startTime = Date.now();

      let pollingTimedOut = false;
      while (Date.now() - startTime < maxWaitMs) {
        try {
          await fetch(`${targetBase}/login`, { mode: 'no-cors', cache: 'no-store' });
          break; // reachable
        } catch {
          await new Promise((r) => setTimeout(r, pollInterval));
        }
      }
      if (Date.now() - startTime >= maxWaitMs) {
        pollingTimedOut = true;
      }
      setSubdomainReady(true);
      if (pollingTimedOut) {
        toast.warning('Your LMS is being set up. If the page doesn\'t load immediately, wait a moment and refresh.');
      }

      // 6. If the animation is OFF, redirect immediately (legacy behavior).
      // If the animation is ON, do nothing here — the animation's onComplete
      // callback will fire performRedirect() after its 3-2-1 countdown.
      if (!SHOW_ONBOARDING_ANIMATION) {
        await performRedirect({ accessToken, targetBase, isLocal, appPort });
      }
    } catch (err: unknown) {
      setSubmitting(false);
      // Reset Turnstile so user can retry
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
          {TURNSTILE_ENABLED && (
            <div className="mt-4 flex justify-center">
              <div ref={turnstileRef} />
            </div>
          )}
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
        // Personalized "Hero's Welcome" animation. Plays for ~60 seconds
        // while the new subdomain provisions in the background. Wrapped in
        // an error boundary that falls back to the original spinner if
        // anything in the animation crashes (Sentry captures the error).
        <ErrorBoundary
          context="onboarding-animation"
          fallback={
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="h-10 w-10 border-4 border-gray-200 border-t-zen-purple rounded-full animate-spin" />
              <h2 className="text-lg font-semibold text-gray-800">Setting up your LMS...</h2>
              <p className="text-sm text-gray-500 text-center max-w-xs">
                We&apos;re preparing your institute. This usually takes a few seconds.
              </p>
            </div>
          }
        >
          <OnboardingAnimation
            firstName={firstName || 'Friend'}
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
    </OnboardingShell>
  );
}
