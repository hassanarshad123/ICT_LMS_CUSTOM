"use client";

import { useScrollReveal } from "@/hooks/use-scroll-reveal";

type Animation = "fade-up" | "fade-in" | "slide-left" | "slide-right" | "scale-up";

interface ScrollRevealProps {
  children: React.ReactNode;
  animation?: Animation;
  delay?: number;
  className?: string;
}

export function ScrollReveal({
  children,
  animation = "fade-up",
  delay = 0,
  className = "",
}: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal();

  const animClass = animation === "fade-up" ? "" : animation;

  return (
    <div
      ref={ref}
      className={`${isVisible ? "scroll-visible" : "scroll-hidden"} ${animClass} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
