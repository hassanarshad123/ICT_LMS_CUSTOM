/**
 * Shared fetch utilities for the signup flow.
 *
 * - `fetchWithTimeout` wraps native `fetch` with an AbortController-based
 *   timeout so requests never hang indefinitely.
 * - `extractErrorMessage` flattens FastAPI error responses into user-friendly
 *   strings.
 */

export interface FetchWithTimeoutInit extends RequestInit {
  /** Timeout in milliseconds. Defaults to 30 000 (30 s). */
  timeoutMs?: number;
}

/**
 * `fetch` with an automatic timeout. If the caller also passes an
 * `AbortSignal` (e.g. for cancellation), both signals are respected —
 * whichever fires first wins.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: FetchWithTimeoutInit,
): Promise<Response> {
  const { timeoutMs = 30_000, signal: callerSignal, ...rest } = init ?? {};

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Combine caller's signal (if any) with our timeout signal.
  // We can't use AbortSignal.any() (not available in all TS targets),
  // so we link them manually: when the caller aborts, we abort ours too.
  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timer);
      timeoutController.abort();
    } else {
      callerSignal.addEventListener('abort', () => timeoutController.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, { ...rest, signal: timeoutController.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // Distinguish caller-initiated abort from timeout.
      if (callerSignal?.aborted) throw err; // re-throw caller's abort as-is
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Flattens a FastAPI error response into a human-readable string.
 *
 * FastAPI 422 returns `detail` as an array of Pydantic error objects:
 *   [{ loc: ["body","password"], msg: "...", type: "..." }, ...]
 * FastAPI HTTPException 4xx/5xx returns `detail` as a plain string.
 * This helper handles both shapes so toast.error() never shows "[object Object]".
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;
  const detail = (err as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const flattened = detail
      .map((e) => {
        if (!e || typeof e !== 'object') return null;
        const loc = Array.isArray((e as { loc?: unknown }).loc)
          ? ((e as { loc: unknown[] }).loc)
              .filter((p) => p !== 'body')
              .map((p) => String(p))
              .join('.')
          : '';
        const msg = (e as { msg?: string }).msg || '';
        if (!msg) return null;
        return loc ? `${loc}: ${msg}` : msg;
      })
      .filter((s): s is string => Boolean(s))
      .join('; ');
    return flattened || fallback;
  }
  return fallback;
}
