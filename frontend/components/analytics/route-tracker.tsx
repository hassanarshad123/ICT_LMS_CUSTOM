'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView, isAnalyticsEnabled } from '@/lib/analytics';

/**
 * Tracks SPA page views on every `pathname` change.
 * Renders nothing — purely a side-effect component.
 */
export default function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isAnalyticsEnabled()) return;
    trackPageView(pathname);
  }, [pathname]);

  return null;
}
