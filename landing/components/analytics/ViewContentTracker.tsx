'use client';

import { useEffect, useRef } from 'react';
import { trackMetaEvent } from '@/lib/meta-pixel';

interface ViewContentTrackerProps {
  contentName: string;
  contentCategory?: string;
  threshold?: number;
}

const FIRED_THIS_SESSION = new Set<string>();

export function ViewContentTracker({
  contentName,
  contentCategory,
  threshold = 0.5,
}: ViewContentTrackerProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (FIRED_THIS_SESSION.has(contentName)) return;

    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !FIRED_THIS_SESSION.has(contentName)) {
            FIRED_THIS_SESSION.add(contentName);
            void trackMetaEvent('ViewContent', {
              content_name: contentName,
              ...(contentCategory ? { content_category: contentCategory } : {}),
            });
            observer.disconnect();
          }
        }
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [contentName, contentCategory, threshold]);

  return <div ref={sentinelRef} aria-hidden className="pointer-events-none h-px w-full" />;
}
