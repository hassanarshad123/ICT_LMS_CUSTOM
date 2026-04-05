'use client';

import { getInstituteSlug } from '@/lib/utils/subdomain';

// ---------------------------------------------------------------------------
// Global types
// ---------------------------------------------------------------------------

type GtagCommand = 'config' | 'event' | 'set' | 'js';

declare global {
  interface Window {
    gtag: (command: GtagCommand, ...args: any[]) => void;
    dataLayer: any[];
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '';

/** Whether GA is configured and we're in a browser. */
export function isAnalyticsEnabled(): boolean {
  return GA_ID !== '' && typeof window !== 'undefined';
}

export function getGAMeasurementId(): string {
  return GA_ID;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gtag(command: GtagCommand, ...args: any[]) {
  if (!isAnalyticsEnabled()) return;
  window.gtag(command, ...args);
}

/** SHA-256 hash a string (returns hex). Used to anonymise user IDs. */
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

/**
 * Set GA4 user properties after login or session restore.
 * User ID is SHA-256 hashed for privacy (GA4 TOS prohibits PII).
 */
export async function setAnalyticsUser(
  userId: string,
  role: string,
  instituteSlug: string | null,
) {
  if (!isAnalyticsEnabled()) return;

  const hashedId = await sha256(userId);

  gtag('set', { user_id: hashedId });
  gtag('set', 'user_properties', {
    user_role: role,
    user_id_hash: hashedId,
    institute_slug: instituteSlug ?? 'super_admin',
  });
}

/** Clear user properties on logout. */
export function clearAnalyticsUser() {
  if (!isAnalyticsEnabled()) return;

  gtag('set', { user_id: null });
  gtag('set', 'user_properties', {
    user_role: null,
    user_id_hash: null,
    institute_slug: null,
  });
}

// ---------------------------------------------------------------------------
// Page views
// ---------------------------------------------------------------------------

/** Track an SPA page view. Called by RouteTracker on pathname change. */
export function trackPageView(path: string) {
  const slug = getInstituteSlug();
  gtag('event', 'page_view', {
    page_path: path,
    institute_slug: slug ?? 'super_admin',
  });
}

// ---------------------------------------------------------------------------
// Generic event
// ---------------------------------------------------------------------------

/**
 * Track a custom GA4 event. Automatically attaches `institute_slug`.
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, any>,
) {
  const slug = getInstituteSlug();
  gtag('event', eventName, {
    ...params,
    institute_slug: slug ?? 'super_admin',
  });
}

// ---------------------------------------------------------------------------
// Pre-built event helpers
// ---------------------------------------------------------------------------

export function trackLogin() {
  trackEvent('login', { method: 'email' });
}

export function trackLogout() {
  trackEvent('logout');
}

export function trackCourseView(courseId: string, courseTitle: string) {
  trackEvent('course_view', { course_id: courseId, course_title: courseTitle });
}

export function trackLectureStart(lectureId: string, courseId: string) {
  trackEvent('lecture_start', { lecture_id: lectureId, course_id: courseId });
}

export function trackLectureComplete(lectureId: string, courseId: string) {
  trackEvent('lecture_complete', { lecture_id: lectureId, course_id: courseId });
}

export function trackCertificateDownload(certificateId: string, courseId: string) {
  trackEvent('certificate_download', { certificate_id: certificateId, course_id: courseId });
}

export function trackQuizStart(quizId: string, courseId: string) {
  trackEvent('quiz_start', { quiz_id: quizId, course_id: courseId });
}

export function trackQuizComplete(quizId: string, courseId: string, score?: number) {
  trackEvent('quiz_complete', { quiz_id: quizId, course_id: courseId, score });
}

export function trackClassJoin(classId: string) {
  trackEvent('class_join', { class_id: classId });
}
