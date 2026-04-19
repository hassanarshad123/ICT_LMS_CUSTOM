'use client';

import { motion, AnimatePresence } from 'framer-motion';

/**
 * Real-time progress bar shown across all onboarding animation scenes.
 *
 * Purely presentational — the parent (OnboardingAnimation) owns the progress
 * value, label, and timing logic. The bar's colors come from the user's own
 * brand, so it auto-matches whatever theme they picked during signup.
 */

export interface ProgressBarProps {
  progress: number;      // 0-100
  label: string;         // e.g. "Provisioning your domain…"
  primaryColor: string;
  accentColor: string;
  reducedMotion?: boolean;
}

export function ProgressBar({
  progress,
  label,
  primaryColor,
  accentColor,
  reducedMotion = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const displayPct = Math.round(clamped);

  // Adapt bar track contrast for very light primary backgrounds.
  const isLightBg = hexLuminance(primaryColor) > 0.8;
  const trackClass = isLightBg ? 'bg-black/15' : 'bg-white/20';
  const labelColor = isLightBg ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)';

  return (
    <div
      className="absolute bottom-0 inset-x-0 z-10 px-4 pb-6 sm:px-8 sm:pb-10 pointer-events-none"
      role="progressbar"
      aria-valuenow={displayPct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-baseline mb-2">
          <div className="relative h-5 sm:h-6 flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.span
                key={label}
                className="absolute inset-0 truncate text-sm sm:text-base font-medium"
                style={{ color: labelColor, maxWidth: '100%' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </div>
          <span
            className="ml-4 font-mono text-sm sm:text-base tabular-nums shrink-0"
            style={{ color: accentColor }}
          >
            {displayPct}%
          </span>
        </div>

        <div
          className={`relative h-2 sm:h-2.5 rounded-full overflow-hidden ${trackClass}`}
          style={{
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
          }}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${accentColor} 0%, ${lightenHex(accentColor, 0.1)} 100%)`,
              boxShadow: `0 0 12px ${accentColor}66`,
            }}
            animate={{ width: `${clamped}%` }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.6, ease: 'easeOut' }
            }
          />

          {!reducedMotion && clamped > 2 && (
            <motion.div
              className="absolute inset-y-0 w-[20%] pointer-events-none"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${lightenHex(accentColor, 0.35)}99 50%, transparent 100%)`,
                mixBlendMode: 'screen',
              }}
              initial={{ left: '-25%' }}
              animate={{ left: `${Math.max(0, clamped - 5)}%` }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
                repeatType: 'loop',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function hexLuminance(hex: string): number {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(cleaned.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function lightenHex(hex: string, amount: number): string {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return hex;
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(cleaned.slice(i, i + 2), 16);
    const next = Math.round(v + (255 - v) * amount);
    return Math.max(0, Math.min(255, next))
      .toString(16)
      .padStart(2, '0');
  });
  return `#${channels.join('')}`;
}
