import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const API_VERSION = process.env.META_GRAPH_API_VERSION || 'v25.0';
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE;

/**
 * SHA-256 hash helper for PII.
 * Meta requires all user data to be hashed (email, phone, name, etc).
 * Trim + lowercase before hashing.
 */
function hash(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex');
}

interface CapiPayload {
  event: string;
  eventId: string;
  eventSourceUrl: string;
  customData?: Record<string, unknown>;
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    externalId?: string;
  };
}

export async function POST(req: NextRequest) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    // Silently succeed in dev/local when not configured
    return NextResponse.json({ skipped: 'not_configured' }, { status: 200 });
  }

  let body: CapiPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Extract client signals (for match quality)
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  const ip = forwardedFor.split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  const userAgent = req.headers.get('user-agent') || '';

  // Extract Facebook browser/click IDs from cookies for better matching
  const cookieHeader = req.headers.get('cookie') || '';
  const fbp = cookieHeader.match(/_fbp=([^;]+)/)?.[1];
  const fbc = cookieHeader.match(/_fbc=([^;]+)/)?.[1];

  // Build hashed user_data object
  const user_data: Record<string, string> = {
    client_ip_address: ip,
    client_user_agent: userAgent,
  };

  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;
  if (body.userData?.email) user_data.em = hash(body.userData.email);
  if (body.userData?.phone) user_data.ph = hash(body.userData.phone.replace(/\D/g, ''));
  if (body.userData?.firstName) user_data.fn = hash(body.userData.firstName);
  if (body.userData?.lastName) user_data.ln = hash(body.userData.lastName);
  if (body.userData?.externalId) user_data.external_id = hash(body.userData.externalId);

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: body.event,
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.eventId, // MUST match the browser pixel's eventID for deduplication
        event_source_url: body.eventSourceUrl,
        action_source: 'website',
        user_data,
        custom_data: body.customData || {},
      },
    ],
  };

  // Include test_event_code when configured (for Events Manager Test Events panel)
  if (TEST_EVENT_CODE) {
    payload.test_event_code = TEST_EVENT_CODE;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error('[meta-capi] Error from Meta:', result);
      return NextResponse.json({ error: result }, { status: response.status });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[meta-capi] Request failed:', err);
    return NextResponse.json({ error: 'request_failed' }, { status: 500 });
  }
}
