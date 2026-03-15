"use client";

import { useEffect, useRef, useState } from "react";

const SECTION_IDS = ["features", "pricing", "faq"];

export function useActiveSection() {
  const [active, setActive] = useState("");
  const visibleSections = useRef<Map<string, IntersectionObserverEntry>>(new Map());

  useEffect(() => {
    const pickClosestToTop = () => {
      let best = "";
      let bestDistance = Infinity;

      visibleSections.current.forEach((entry, id) => {
        if (entry.isIntersecting) {
          const distance = Math.abs(entry.boundingClientRect.top);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = id;
          }
        }
      });

      return best;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSections.current.set(entry.target.id, entry);
          } else {
            visibleSections.current.delete(entry.target.id);
          }
        }

        const closest = pickClosestToTop();
        setActive(closest);
      },
      { rootMargin: "-80px 0px -40% 0px", threshold: [0, 0.25] }
    );

    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    const handleScroll = () => {
      if (window.scrollY < 100) {
        visibleSections.current.clear();
        setActive("");
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return active;
}
