/**
 * Meta Pixel event tracking helper.
 *
 * Fires events to both:
 *   1. The browser pixel (window.fbq) — for immediate client-side tracking
 *   2. The Conversions API via /api/meta-capi — for server-side match quality
 *
 * Both are deduplicated by event_id so Meta counts them as one event.
 *
 * Usage:
 *   import { trackMetaEvent } from '@/lib/meta-pixel';
 *
 *   await trackMetaEvent('Lead', { content_name: 'Signup Form' }, {
 *     email: user.email,
 *     firstName: user.name,
 *   });
 */

export type MetaEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Lead'
  | 'CompleteRegistration'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'Contact';

export interface MetaCustomData {
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
  content_type?: string;
  content_ids?: string[];
  predicted_ltv?: number;
  status?: string;
  [key: string]: unknown;
}

export interface MetaUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  externalId?: string;
}

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

/**
 * Generate a unique event ID for deduplication between pixel + CAPI.
 * Both the browser and the server must send the SAME event_id for the same event.
 */
function generateEventId(): string {
  const rand = Math.random().toString(36).slice(2, 11);
  return `${Date.now()}-${rand}`;
}

/**
 * Fire a Meta Pixel event.
 *
 * Server-side CAPI call is fire-and-forget — failures won't block the user experience.
 */
export async function trackMetaEvent(
  event: MetaEventName,
  customData: MetaCustomData = {},
  userData?: MetaUserData,
): Promise<void> {
  if (typeof window === 'undefined') return;

  const eventId = generateEventId();

  // 1. Browser pixel (immediate)
  if (typeof window.fbq === 'function') {
    window.fbq('track', event, customData, { eventID: eventId });
  }

  // 2. Server-side CAPI (deduplicated via event_id)
  try {
    await fetch('/api/meta-capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        eventId,
        eventSourceUrl: window.location.href,
        customData,
        userData,
      }),
      // Use keepalive so the request completes even during navigation
      keepalive: true,
    });
  } catch (err) {
    // Don't let CAPI failures break the user experience
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('[meta-pixel] CAPI tracking failed:', err);
    }
  }
}
