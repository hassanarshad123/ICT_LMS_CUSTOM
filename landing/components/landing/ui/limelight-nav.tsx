"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  cloneElement,
} from "react";

type NavItem = {
  id: string;
  icon: React.ReactElement;
  label?: string;
  onClick?: () => void;
};

type LimelightNavProps = {
  items: NavItem[];
  activeIndex?: number;
  onTabChange?: (index: number) => void;
  className?: string;
};

export function LimelightNav({
  items,
  activeIndex: controlledIndex,
  onTabChange,
  className,
}: LimelightNavProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const activeIndex = controlledIndex ?? internalIndex;

  const [isReady, setIsReady] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const navItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const limelightRef = useRef<HTMLDivElement | null>(null);

  const updateSpotlight = useCallback(() => {
    if (items.length === 0) return;

    const limelight = limelightRef.current;
    const activeItem = navItemRefs.current[activeIndex];

    if (limelight && activeItem) {
      const newLeft =
        activeItem.offsetLeft +
        activeItem.offsetWidth / 2 -
        limelight.offsetWidth / 2;
      limelight.style.left = `${newLeft}px`;
    }
  }, [activeIndex, items.length]);

  // Position spotlight on layout (before paint) — no transition yet
  useLayoutEffect(() => {
    updateSpotlight();
  }, [updateSpotlight]);

  // Enable transitions after initial paint
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setIsReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Recalculate spotlight on container resize (e.g., font load, layout shift)
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const ro = new ResizeObserver(() => {
      updateSpotlight();
    });

    ro.observe(nav);
    return () => ro.disconnect();
  }, [updateSpotlight]);

  if (items.length === 0) return null;

  const handleClick = (index: number, itemOnClick?: () => void) => {
    setInternalIndex(index);
    onTabChange?.(index);
    itemOnClick?.();
  };

  return (
    <div
      ref={navRef}
      className={`relative inline-flex items-center h-12 rounded-full bg-zen-page-bg/60 backdrop-blur-xl border border-zen-border/50 px-1 overflow-visible ${className ?? ""}`}
      role="navigation"
    >
      {items.map(({ id, icon, label, onClick }, index) => (
        <button
          key={id}
          ref={(el) => {
            navItemRefs.current[index] = el;
          }}
          type="button"
          className="relative z-20 flex h-full cursor-pointer items-center justify-center px-5"
          onClick={() => handleClick(index, onClick)}
          aria-label={label}
        >
          {cloneElement(icon, {
            className: `w-5 h-5 text-zen-dark transition-opacity duration-150 ease-in-out ${
              activeIndex === index ? "opacity-100" : "opacity-40"
            } ${icon.props.className || ""}`,
          })}
        </button>
      ))}

      {/* Spotlight bar */}
      <div
        ref={limelightRef}
        className="absolute top-0 z-10 w-10 h-[4px] rounded-full bg-zen-purple"
        style={{
          left: -999,
          boxShadow: "0 50px 15px #8a6aa4",
          transition: isReady ? "left 400ms ease-in-out" : "none",
        }}
      >
        {/* Glow cone */}
        <div
          className="absolute left-[-30%] top-[4px] w-[160%] h-12 pointer-events-none"
          style={{
            clipPath: "polygon(5% 100%, 25% 0, 75% 0, 95% 100%)",
            background:
              "linear-gradient(to bottom, rgba(138, 106, 164, 0.3), transparent)",
          }}
        />
      </div>
    </div>
  );
}

export type { NavItem };
