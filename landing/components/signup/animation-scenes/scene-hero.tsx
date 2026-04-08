'use client';

import { motion } from 'framer-motion';

/**
 * Scene 1: "Why You're Here" (0-15 seconds)
 *
 * Honors the user. Recognizes the weight of what they're starting.
 * Pure typography on the user's primary color background, with soft
 * particles drifting upward in the accent color.
 *
 * Beat structure:
 *  - 0.0s  scene cross-fades in
 *  - 2.0s  "{firstName}." appears
 *  - 5.5s  cross-fades to "You chose to teach."
 *  - 9.0s  cross-fades to "You chose to change lives."
 * - 12.5s  text holds, particles continue
 * - 15.0s  scene exits (handled by parent AnimatePresence)
 */

interface Props {
  firstName: string;
  primaryColor: string;
  accentColor: string;
}

export function SceneHero({ firstName, accentColor }: Props) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2 }}
    >
      {/* Soft glow center */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '60vmin',
          height: '60vmin',
          background: `radial-gradient(circle, ${accentColor}33 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1, 1.05, 1], opacity: [0, 0.9, 0.9, 0.9] }}
        transition={{
          duration: 14,
          times: [0, 0.15, 0.5, 1],
          ease: 'easeOut',
        }}
      />

      {/* Particles */}
      <Particles accentColor={accentColor} />

      {/* Text stack */}
      <div className="relative flex flex-col items-center justify-center text-center px-6">
        <Caption delay={2.0} hold={3.5} size="huge">
          {firstName}.
        </Caption>
        <Caption delay={5.5} hold={3.5} size="large">
          You chose to teach.
        </Caption>
        <Caption delay={9.0} hold={3.5} size="large">
          You chose to change lives.
        </Caption>
      </div>
    </motion.div>
  );
}

/**
 * A single text caption that fades in at `delay` seconds, holds for `hold`
 * seconds, then fades out. All captions stack at the same screen position
 * via absolute positioning so they cross-fade in place.
 */
function Caption({
  children,
  delay,
  hold,
  size,
}: {
  children: React.ReactNode;
  delay: number;
  hold: number;
  size: 'huge' | 'large';
}) {
  const fadeIn = 0.8;
  const fadeOut = 0.6;
  const total = fadeIn + hold + fadeOut;
  const fadeInEnd = fadeIn / total;
  const fadeOutStart = (fadeIn + hold) / total;

  const fontClass =
    size === 'huge'
      ? 'text-5xl sm:text-7xl md:text-8xl'
      : 'text-3xl sm:text-5xl md:text-6xl';

  return (
    <motion.div
      className={`absolute font-serif text-white ${fontClass}`}
      style={{ textShadow: '0 2px 30px rgba(0,0,0,0.3)' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: [20, 0, 0, -10],
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

/**
 * Lightweight particle drift effect. Uses CSS-driven divs (no canvas) so it
 * stays performant on entry-level Android devices.
 */
function Particles({ accentColor }: { accentColor: string }) {
  // 12 particles is enough to feel alive without thrashing low-end GPUs
  const particles = Array.from({ length: 12 });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((_, i) => {
        const left = (i * 8.3 + 5) % 100;
        const delay = (i * 1.1) % 6;
        const duration = 8 + (i % 4);
        const size = 4 + (i % 3) * 2;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              bottom: '-10px',
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: accentColor,
              boxShadow: `0 0 ${size * 2}px ${accentColor}`,
            }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: '-110vh', opacity: [0, 0.7, 0.7, 0] }}
            transition={{
              duration,
              delay,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        );
      })}
    </div>
  );
}
