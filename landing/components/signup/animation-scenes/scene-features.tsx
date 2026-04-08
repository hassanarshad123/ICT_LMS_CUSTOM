'use client';

import { motion } from 'framer-motion';

/**
 * Scene 2: "What You Just Built" (15-30 seconds, scene-relative timing)
 *
 * Tangible value. What they actually get with Zensbot.
 * Pure typography + tiny minimalist icon glyphs in the accent color.
 *
 * Beat structure (relative to scene start):
 *  - 0.0s  scene cross-fades in
 *  - 0.5s  "Now you have everything in one place."
 *  - 4.0s  "Video lectures." + play glyph
 *  - 6.5s  "Live Zoom classes." + camera glyph
 *  - 9.0s  "Auto-graded quizzes." + check glyph
 * - 11.5s  "Certificates. Reports. Parent updates."
 * - 14.5s  scene exits
 */

interface Props {
  primaryColor: string;
  accentColor: string;
}

export function SceneFeatures({ primaryColor, accentColor }: Props) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.0 }}
      style={{
        background: `linear-gradient(180deg, ${primaryColor} 0%, ${primaryColor}ee 100%)`,
      }}
    >
      <div className="relative flex flex-col items-center justify-center text-center px-6 w-full max-w-2xl">
        <FeatureLine delay={0.5} hold={3.0} size="medium">
          Now you have everything in one place.
        </FeatureLine>
        <FeatureLine delay={4.0} hold={2.0} size="large" icon="play" iconColor={accentColor}>
          Video lectures.
        </FeatureLine>
        <FeatureLine delay={6.5} hold={2.0} size="large" icon="camera" iconColor={accentColor}>
          Live Zoom classes.
        </FeatureLine>
        <FeatureLine delay={9.0} hold={2.0} size="large" icon="check" iconColor={accentColor}>
          Auto-graded quizzes.
        </FeatureLine>
        <FeatureLine delay={11.5} hold={3.0} size="medium">
          Certificates. Reports. Parent updates.
        </FeatureLine>
      </div>
    </motion.div>
  );
}

function FeatureLine({
  children,
  delay,
  hold,
  size,
  icon,
  iconColor,
}: {
  children: React.ReactNode;
  delay: number;
  hold: number;
  size: 'medium' | 'large';
  icon?: 'play' | 'camera' | 'check';
  iconColor?: string;
}) {
  const fadeIn = 0.6;
  const fadeOut = 0.5;
  const total = fadeIn + hold + fadeOut;
  const fadeInEnd = fadeIn / total;
  const fadeOutStart = (fadeIn + hold) / total;

  const fontClass =
    size === 'large'
      ? 'text-3xl sm:text-5xl md:text-6xl font-serif'
      : 'text-xl sm:text-3xl md:text-4xl font-sans';

  return (
    <motion.div
      className={`absolute flex items-center justify-center gap-4 text-white ${fontClass}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: [16, 0, 0, -8],
      }}
      transition={{
        duration: total,
        delay,
        times: [0, fadeInEnd, fadeOutStart, 1],
        ease: 'easeOut',
      }}
    >
      {icon && iconColor && <Glyph type={icon} color={iconColor} />}
      <span>{children}</span>
    </motion.div>
  );
}

function Glyph({ type, color }: { type: 'play' | 'camera' | 'check'; color: string }) {
  const size = 32;
  const stroke = 2.5;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (type === 'play') {
    return (
      <svg {...common}>
        <polygon points="6 4 20 12 6 20 6 4" fill={color} />
      </svg>
    );
  }
  if (type === 'camera') {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="14" height="12" rx="2" />
        <path d="M17 10l4-2v8l-4-2z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
