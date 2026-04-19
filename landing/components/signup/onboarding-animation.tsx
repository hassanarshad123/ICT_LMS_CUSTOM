'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { SceneHero } from './animation-scenes/scene-hero';
import { SceneFeatures } from './animation-scenes/scene-features';
import { ScenePakistan } from './animation-scenes/scene-pakistan';
import { SceneWelcome } from './animation-scenes/scene-welcome';
import { ProgressBar } from './animation-scenes/progress-bar';

/**
 * Personalized "Hero's Welcome" animation shown during the subdomain
 * provisioning wait (replaces the generic "Setting up your LMS..." spinner).
 *
 * Plays 4 scenes of 15 seconds each = 60 second total runtime. Uses the
 * user's own brand colors, name, institute name, tagline, and logo (all
 * collected in the prior onboarding steps and passed in as props).
 *
 * Edge cases handled:
 * - If `isReadyToRedirect` becomes true before scene 4 completes: scene 4
 *   plays its full 15s, then runs the 3-2-1 countdown and calls onComplete.
 * - If `isReadyToRedirect` is still false when scene 4's content ends at
 *   the 12-second mark, scene 4 holds with a soft breathing pulse on the
 *   "Your LMS is ready" line until ready, then runs the countdown.
 * - If the polling loop times out at 2 minutes (handled by parent), the
 *   parent will navigate away regardless.
 */

export interface OnboardingAnimationProps {
  firstName: string;
  instituteName: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  tagline: string;
  logoPreview: string | null;
  slug: string;
  isReadyToRedirect: boolean;
  onComplete: () => void;
}

const SCENE_DURATION_MS = 15_000;
const TOTAL_DURATION_MS = SCENE_DURATION_MS * 4;
const PROGRESS_CEILING_BEFORE_READY = 95;

export function OnboardingAnimation(props: OnboardingAnimationProps) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [skippedEarly, setSkippedEarly] = useState(false);
  const completeCalledRef = useRef(false);
  const startedAtRef = useRef<number>(0);
  const reducedMotion = useReducedMotion();

  // Schedule scene transitions. Each scene is exactly SCENE_DURATION_MS long
  // except the last one, which manages its own end via the onCountdownComplete
  // callback so it can wait for isReadyToRedirect.
  //
  // Early-ready: if the subdomain becomes reachable while the user is still
  // on Scene 1/2/3, let the current scene finish its beat, then skip straight
  // to Scene 4 (SceneWelcome) in fast-forward mode so the countdown fires
  // immediately instead of making the user wait for the full 60s narrative.
  useEffect(() => {
    if (sceneIndex >= 3) return;
    const t = setTimeout(() => {
      if (props.isReadyToRedirect && sceneIndex < 3) {
        setSkippedEarly(true);
        setSceneIndex(3);
      } else {
        setSceneIndex((i) => i + 1);
      }
    }, SCENE_DURATION_MS);
    return () => clearTimeout(t);
  }, [sceneIndex, props.isReadyToRedirect]);

  // rAF-driven progress. Fills 0→95% linearly over the 60s narrative; the
  // last 5% only closes when the parent signals `isReadyToRedirect`, which
  // is the real "your LMS is reachable" signal. The lerp keeps the jump
  // from `timeProgress` to 100 smooth instead of snapping.
  useEffect(() => {
    if (startedAtRef.current === 0) {
      startedAtRef.current = performance.now();
    }
    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - startedAtRef.current;
      const timeProgress = Math.min(
        PROGRESS_CEILING_BEFORE_READY,
        (elapsed / TOTAL_DURATION_MS) * PROGRESS_CEILING_BEFORE_READY,
      );
      const target = props.isReadyToRedirect ? 100 : timeProgress;
      setProgress((prev) => {
        if (reducedMotion) return target;
        const delta = target - prev;
        return Math.abs(delta) < 0.15 ? target : prev + delta * 0.12;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [props.isReadyToRedirect, reducedMotion]);

  const handleCountdownComplete = () => {
    if (completeCalledRef.current) return;
    completeCalledRef.current = true;
    props.onComplete();
  };

  // Step labels mirror each scene's narrative so the bar feels connected
  // to what the user is seeing. Once the subdomain is reachable and the
  // bar has almost filled, we surface the personalised almost-there line.
  const label = useMemo(() => {
    if (props.isReadyToRedirect && progress >= 99) {
      return `Almost there, ${props.firstName}…`;
    }
    switch (sceneIndex) {
      case 0:
        return 'Creating your institute…';
      case 1:
        return 'Setting up your classrooms…';
      case 2:
        return 'Configuring your region…';
      case 3:
        return props.isReadyToRedirect
          ? `Welcome home, ${props.firstName}.`
          : 'Provisioning your subdomain…';
      default:
        return 'Building your LMS…';
    }
  }, [sceneIndex, props.isReadyToRedirect, props.firstName, progress]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: props.primaryColor }}
      aria-live="polite"
      aria-label="Setting up your learning management system"
    >
      <AnimatePresence mode="wait">
        {sceneIndex === 0 && (
          <SceneHero
            key="hero"
            firstName={props.firstName}
            primaryColor={props.primaryColor}
            accentColor={props.accentColor}
          />
        )}
        {sceneIndex === 1 && (
          <SceneFeatures
            key="features"
            primaryColor={props.primaryColor}
            accentColor={props.accentColor}
          />
        )}
        {sceneIndex === 2 && (
          <ScenePakistan
            key="pakistan"
            primaryColor={props.primaryColor}
            accentColor={props.accentColor}
          />
        )}
        {sceneIndex === 3 && (
          <SceneWelcome
            key="welcome"
            firstName={props.firstName}
            instituteName={props.instituteName}
            tagline={props.tagline}
            logoPreview={props.logoPreview}
            backgroundColor={props.backgroundColor}
            primaryColor={props.primaryColor}
            accentColor={props.accentColor}
            isReadyToRedirect={props.isReadyToRedirect}
            fastForward={skippedEarly}
            onCountdownComplete={handleCountdownComplete}
          />
        )}
      </AnimatePresence>

      <ProgressBar
        progress={progress}
        label={label}
        primaryColor={props.primaryColor}
        accentColor={props.accentColor}
        reducedMotion={Boolean(reducedMotion)}
      />
    </div>
  );
}
