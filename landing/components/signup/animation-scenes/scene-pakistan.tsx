'use client';

import { motion } from 'framer-motion';

/**
 * Scene 3: "Made for You, Made for Pakistan" (30-45 seconds, scene-relative)
 *
 * Local pride. Trust. "This was built knowing your reality."
 * No flag, no map, no clichés — just clean text that respects the audience.
 *
 * Beat structure (relative to scene start):
 *  - 0.0s   scene cross-fades in
 *  - 0.5s   "Built in Pakistan."
 *  - 3.5s   "For Pakistan."
 *  - 6.5s   "PKR pricing."
 * - 10.0s   "Works on any connection. Any device."
 * - 13.5s   transition pulse — background brightens toward Scene 4
 * - 14.5s   scene exits
 */

interface Props {
  primaryColor: string;
  accentColor: string;
}

export function ScenePakistan({ primaryColor, accentColor }: Props) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.0 }}
    >
      {/* Subtle background gradient that intensifies as scene progresses */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.4, 0.4, 0.7] }}
        transition={{ duration: 14, times: [0, 0.1, 0.85, 1], ease: 'easeOut' }}
        style={{
          background: `radial-gradient(ellipse at center, ${accentColor}22 0%, transparent 60%)`,
        }}
      />

      <div className="relative flex flex-col items-center justify-center text-center px-6">
        <Caption delay={0.5} hold={2.5} size="huge">
          Built in Pakistan.
        </Caption>
        <Caption delay={3.5} hold={2.5} size="huge">
          For Pakistan.
        </Caption>
        <Caption delay={6.5} hold={3.0} size="large">
          PKR pricing.
        </Caption>
        <Caption delay={10.0} hold={3.5} size="medium">
          Works on any connection. Any device.
        </Caption>
      </div>
    </motion.div>
  );
}

function Caption({
  children,
  delay,
  hold,
  size,
}: {
  children: React.ReactNode;
  delay: number;
  hold: number;
  size: 'huge' | 'large' | 'medium';
}) {
  const fadeIn = 0.7;
  const fadeOut = 0.5;
  const total = fadeIn + hold + fadeOut;
  const fadeInEnd = fadeIn / total;
  const fadeOutStart = (fadeIn + hold) / total;

  const fontClass = {
    huge: 'text-5xl sm:text-7xl md:text-8xl font-serif',
    large: 'text-3xl sm:text-5xl md:text-6xl font-serif',
    medium: 'text-xl sm:text-3xl md:text-4xl font-sans',
  }[size];

  return (
    <motion.div
      className={`absolute text-white ${fontClass}`}
      style={{ textShadow: '0 2px 30px rgba(0,0,0,0.3)' }}
      initial={{ opacity: 0, y: 18 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: [18, 0, 0, -10],
      }}
      transition={{
        duration: total,
        delay,
        times: [0, fadeInEnd, fadeOutStart, 1],
        ease: 'easeOut',
      }}
    >
      {children}
    </motion.div>
  );
}
