"use client";

import React, { useEffect, useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";

export interface Testimonial {
  text: string;
  image: string;
  name: string;
  role: string;
}

export function TestimonialsColumn({
  className,
  testimonials,
  duration = 10,
  paused = false,
}: {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
  paused?: boolean;
}) {
  const controls = useAnimationControls();
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion.current = mql.matches;

    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
      if (e.matches) {
        controls.stop();
      } else if (!paused) {
        controls.start({
          translateY: "-50%",
          transition: {
            duration,
            repeat: Infinity,
            ease: "linear",
            repeatType: "loop",
          },
        });
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [controls, duration, paused]);

  useEffect(() => {
    if (prefersReducedMotion.current) return;

    if (paused) {
      controls.stop();
    } else {
      controls.start({
        translateY: "-50%",
        transition: {
          duration,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        },
      });
    }
  }, [paused, controls, duration]);

  // Initial start
  useEffect(() => {
    if (prefersReducedMotion.current) return;

    controls.start({
      translateY: "-50%",
      transition: {
        duration,
        repeat: Infinity,
        ease: "linear",
        repeatType: "loop",
      },
    });
  }, [controls, duration]);

  return (
    <div className={className}>
      <motion.div
        animate={controls}
        className="flex flex-col gap-6 pb-6"
      >
        {[...new Array(2)].map((_, index) => (
          <React.Fragment key={index}>
            {testimonials.map(({ text, image, name, role }, i) => (
              <div
                className="p-8 rounded-2xl border border-zen-border/40 bg-white shadow-lg shadow-zen-purple/10 max-w-xs w-full"
                key={i}
              >
                <p className="text-[15px] leading-relaxed text-zen-dark">{text}</p>
                <div className="flex items-center gap-3 mt-5">
                  <img
                    width={40}
                    height={40}
                    src={image}
                    alt={name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="flex flex-col">
                    <div className="font-serif text-[15px] text-zen-dark leading-5">
                      {name}
                    </div>
                    <div className="text-[13px] text-zen-dark/60 leading-5">
                      {role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
}
