'use client';

import { reportClientError } from '@/lib/api/monitoring';

let errorCount = 0;
let resetTime = Date.now();
const MAX_ERRORS_PER_MINUTE = 10;

// Store last captured error for feedback context
let lastCapturedError: { message: string; stack?: string; timestamp: number } | null = null;

/**
 * Get the most recent captured error (if within last 5 minutes).
 */
export function getLastCapturedError() {
  if (lastCapturedError && Date.now() - lastCapturedError.timestamp < 300000) {
    return lastCapturedError;
  }
  return null;
}

function shouldReport(): boolean {
  const now = Date.now();
  if (now - resetTime > 60000) {
    errorCount = 0;
    resetTime = now;
  }
  if (errorCount >= MAX_ERRORS_PER_MINUTE) return false;
  errorCount++;
  return true;
}

/**
 * Report an error to the backend monitoring system.
 * Rate-limited to 10 errors/minute. Silently fails.
 */
export function reportError(
  message: string,
  opts?: { stack?: string; component?: string; extra?: Record<string, any> },
) {
  if (!shouldReport()) return;

  lastCapturedError = { message, stack: opts?.stack, timestamp: Date.now() };

  reportClientError({
    message,
    stack: opts?.stack,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    component: opts?.component,
    extra: opts?.extra,
  });
}

/**
 * Initialize global error handlers. Call once in the app root.
 */
export function initErrorReporter() {
  if (typeof window === 'undefined') return;

  // Catch unhandled JS errors
  window.addEventListener('error', (event) => {
    reportError(event.message || 'Unhandled error', {
      stack: event.error?.stack,
      extra: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || String(event.reason) || 'Unhandled promise rejection';
    reportError(message, {
      stack: event.reason?.stack,
    });
  });
}
