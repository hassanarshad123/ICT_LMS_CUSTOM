'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SceneHero } from './animation-scenes/scene-hero';
import { SceneFeatures } from './animation-scenes/scene-features';
import { ScenePakistan } from './animation-scenes/scene-pakistan';
import { SceneWelcome } from './animation-scenes/scene-welcome';

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

export function OnboardingAnimation(props: OnboardingAnimationProps) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const completeCalledRef = useRef(false);

  // Schedule scene transitions. Each scene is exactly SCENE_DURATION_MS long
  // except the last one, which manages its own end via the onCountdownComplete
  // callback so it can wait for isReadyToRedirect.
  useEffect(() => {
    if (sceneIndex >= 3) return;
    const t = setTimeout(() => {
      setSceneIndex((i) => i + 1);
    }, SCENE_DURATION_MS);
    return () => clearTimeout(t);
  }, [sceneIndex]);

  const handleCountdownComplete = () => {
    if (completeCalledRef.current) return;
    completeCalledRef.current = true;
    props.onComplete();
  };

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
            onCountdownComplete={handleCountdownComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
