'use client';

import Script from 'next/script';
import { getGAMeasurementId } from '@/lib/analytics';

const GA_ID = getGAMeasurementId();

/**
 * Loads the Google Analytics 4 gtag.js script.
 * Renders nothing when no measurement ID is configured.
 *
 * `send_page_view: false` — page views are tracked manually by RouteTracker
 * so that SPA navigations are captured correctly.
 */
export default function GAScript() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
