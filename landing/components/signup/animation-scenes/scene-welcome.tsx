'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Scene 4: "Welcome Home" (45-60 seconds, scene-relative)
 *
 * Emotional payoff. Full brand takeover with the user's logo, institute
 * name, tagline, and personal closing. Ends with a 3-2-1 countdown that
 * triggers redirect to their newly-provisioned LMS subdomain.
 *
 * Beat structure (relative to scene start):
 *  - 0.0s   scene cross-fades in to user's backgroundColor
 *  - 0.5s   logo materializes in center
 *  - 2.5s   "Welcome to {instituteName}." appears below logo
 *  - 6.0s   "{tagline}" appears below institute name
 *  - 9.0s   replaces tagline with "Your LMS is ready, {firstName}."
 * - 12.0s   IF isReadyToRedirect: start 3-2-1 countdown
 *           ELSE: hold "Your LMS is ready" with breathing pulse, watch for ready
 * - 15.0s   countdown hits 0, calls onCountdownComplete
 *
 * Edge case: if subdomain not ready by 12s, the scene holds indefinitely
 * on the "Your LMS is ready" line with a soft pulse on the logo until
 * isReadyToRedirect flips true. Then countdown fires and completes.
 */

interface Props {
  firstName: string;
  instituteName: string;
  tagline: string;
  logoPreview: string | null;
  backgroundColor: string;
  primaryColor: string;
  accentColor: string;
  isReadyToRedirect: boolean;
  fastForward?: boolean;
  onCountdownComplete: () => void;
}

type Phase =
  | 'intro' // logo + welcome (0-9s)
  | 'almost-ready' // "Your LMS is ready" message (9-12s, then either countdown or pulse)
  | 'countdown'; // 3-2-1 (final 3s before redirect)

const PHASE_INTRO_END_MS = 9_000;
const PHASE_ALMOST_READY_AT_MS = 12_000;

export function SceneWelcome(props: Props) {
  const [phase, setPhase] = useState<Phase>(props.fastForward ? 'almost-ready' : 'intro');
  const [countdownNumber, setCountdownNumber] = useState(3);
  const completedRef = useRef(false);

  // Phase transitions: intro → almost-ready at 12s (skipped in fast-forward)
  useEffect(() => {
    if (props.fastForward) return;
    const t = setTimeout(() => setPhase('almost-ready'), PHASE_ALMOST_READY_AT_MS);
    return () => clearTimeout(t);
  }, [props.fastForward]);

  // When in almost-ready phase AND subdomain is ready, start countdown
  useEffect(() => {
    if (phase !== 'almost-ready') return;
    if (!props.isReadyToRedirect) return;
    setPhase('countdown');
  }, [phase, props.isReadyToRedirect]);

  // Countdown ticker: 3 → 2 → 1 → done
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdownNumber === 0) {
      if (!completedRef.current) {
        completedRef.current = true;
        props.onCountdownComplete();
      }
      return;
    }
    const t = setTimeout(() => setCountdownNumber((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdownNumber, props]);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.0 }}
      style={{ backgroundColor: props.backgroundColor }}
    >
      {/* Logo */}
      <Logo
        logoPreview={props.logoPreview}
        instituteName={props.instituteName}
        primaryColor={props.primaryColor}
        accentColor={props.accentColor}
        pulse={phase === 'almost-ready'}
      />

      {/* Institute name (appears at 2.5s, holds entire scene) */}
      <motion.h1
        className="mt-8 text-center font-serif text-3xl sm:text-5xl md:text-6xl"
        style={{ color: props.primaryColor }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 2.5, ease: 'easeOut' }}
      >
        Welcome to {props.instituteName}.
      </motion.h1>

      {/* Tagline / "Your LMS is ready" — cross-fades between phases */}
      <div className="relative mt-4 h-12 w-full flex items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === 'intro' && (
            <motion.p
              key="tagline"
              className="absolute inset-x-0 text-center text-lg sm:text-2xl md:text-3xl italic font-serif"
              style={{ color: `${props.primaryColor}cc` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, delay: phase === 'intro' ? 6.0 : 0 }}
            >
              {props.tagline || 'Your future starts here.'}
            </motion.p>
          )}
          {(phase === 'almost-ready' || phase === 'countdown') && (
            <motion.p
              key="ready"
              className="absolute inset-x-0 text-center text-lg sm:text-2xl md:text-3xl font-sans"
              style={{ color: props.primaryColor }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              Your LMS is ready, {props.firstName}.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Countdown */}
      <div className="mt-12 h-16 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === 'countdown' && countdownNumber > 0 && (
            <motion.div
              key={countdownNumber}
              className="font-serif text-6xl sm:text-7xl"
              style={{ color: props.accentColor }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {countdownNumber}
            </motion.div>
          )}
        </AnimatePresence>

        {/* "Taking you in..." caption sits next to countdown */}
        {phase === 'countdown' && (
          <motion.span
            className="ml-6 text-base sm:text-lg font-sans"
            style={{ color: `${props.primaryColor}aa` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            Taking you in…
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Renders the user's uploaded logo if available, otherwise a stylized
 * letter mark using the first character of the institute name. Pulses
 * gently when the parent scene is in the "almost-ready" hold state.
 */
function Logo({
  logoPreview,
  instituteName,
  primaryColor,
  accentColor,
  pulse,
}: {
  logoPreview: string | null;
  instituteName: string;
  primaryColor: string;
  accentColor: string;
  pulse: boolean;
}) {
  const baseAnimate = pulse
    ? { opacity: 1, scale: [1, 1.03, 1] }
    : { opacity: 1, scale: 1 };
  const baseTransition = pulse
    ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' as const }
    : { duration: 1.0, delay: 0.5, ease: 'easeOut' as const };

  if (logoPreview) {
    return (
      <motion.img
        src={logoPreview}
        alt={`${instituteName} logo`}
        className="h-28 w-28 sm:h-36 sm:w-36 object-contain rounded-2xl"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={baseAnimate}
        transition={baseTransition}
      />
    );
  }

  const initial = (instituteName?.trim()?.[0] || 'Z').toUpperCase();
  return (
    <motion.div
      className="flex h-28 w-28 sm:h-36 sm:w-36 items-center justify-center rounded-2xl font-serif text-5xl sm:text-6xl"
      style={{
        backgroundColor: primaryColor,
        color: accentColor,
      }}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={baseAnimate}
      transition={baseTransition}
    >
      {initial}
    </motion.div>
  );
}
