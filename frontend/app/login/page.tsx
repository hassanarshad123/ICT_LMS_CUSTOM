'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap, ChevronRight, Loader2, Eye, EyeOff, ShieldAlert, Clock } from 'lucide-react';
import { login } from '@/lib/api/auth';
import { createDeviceRequest, getDeviceRequestStatus } from '@/lib/api/device-request';
import { ApiError } from '@/lib/api/client';
import { useBranding } from '@/lib/branding-context';
import ZensbotBadge from '@/components/shared/zensbot-badge';
import { isSuperAdminDomain } from '@/lib/utils/subdomain';

type LoginView = 'form' | 'request_prompt' | 'waiting' | 'rejected';

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function LoginPage() {
  const router = useRouter();
  const { instituteName, tagline, logoUrl } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Device-limit approval flow state
  const [view, setView] = useState<LoginView>('form');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [pollingToken, setPollingToken] = useState<string | null>(null);
  const [pollElapsed, setPollElapsed] = useState(0);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    if (stored && token) {
      try {
        const user = JSON.parse(stored);
        if (user.role === 'super_admin') {
          router.replace('/sa');
        } else {
          router.replace(`/${user.id}`);
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [router]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  const finishLogin = (
    accessToken: string,
    refreshToken: string,
    user: { id: string; role: string },
  ) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    if (user.role === 'super_admin' || user.role === 'super-admin') {
      router.push('/sa');
    } else {
      router.push(`/${user.id}`);
    }
  };

  const pollOnce = async (id: string, token: string) => {
    try {
      const res = await getDeviceRequestStatus(id, token);
      if (res.status === 'pending') {
        return; // keep polling
      }
      if (res.status === 'approved') {
        stopPolling();
        finishLogin(res.accessToken, res.refreshToken, res.user);
        return;
      }
      if (res.status === 'rejected') {
        stopPolling();
        setRejectionReason(res.reason || null);
        setView('rejected');
        return;
      }
      if (res.status === 'consumed') {
        // Tokens were already delivered elsewhere (shouldn't happen in normal flow)
        stopPolling();
        setError('This request has already been used. Please try logging in again.');
        setView('form');
      }
    } catch (err: any) {
      // Transient errors: keep polling. 404 means the request is gone — abort.
      if (err instanceof ApiError && err.status === 404) {
        stopPolling();
        setError('Request not found. Please try logging in again.');
        setView('form');
      }
    }
  };

  const startPolling = (id: string, token: string) => {
    stopPolling();
    setPollElapsed(0);
    const startedAt = Date.now();

    elapsedTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setPollElapsed(elapsed);
      if (elapsed >= POLL_TIMEOUT_MS) {
        stopPolling();
      }
    }, 1000);

    const tick = async () => {
      await pollOnce(id, token);
      if (Date.now() - startedAt < POLL_TIMEOUT_MS) {
        pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setError('');
    setLoading(true);

    // Clear any stale tokens before attempting login
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    try {
      const res = await login(email, password);

      // If a non-SA user tries to log in on the bare (super admin) domain, reject
      if (res.user.role !== 'super_admin' && isSuperAdminDomain()) {
        setError('Please log in at your institute URL.');
        return;
      }

      finishLogin(res.accessToken, res.refreshToken, res.user);
    } catch (err: any) {
      // Hard device limit — structured 403 asking for approval flow
      if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.data?.code === 'device_limit_requires_approval'
      ) {
        setError('');
        setView('request_prompt');
        return;
      }
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await createDeviceRequest(email, password);
      setRequestId(res.requestId);
      setPollingToken(res.pollingToken);
      setView('waiting');
      startPolling(res.requestId, res.pollingToken);
    } catch (err: any) {
      if (err instanceof ApiError && err.data?.code === 'too_many_requests') {
        setError('Too many requests. Please try again later.');
      } else {
        setError(err.message || 'Could not send request');
      }
    } finally {
      setLoading(false);
    }
  };

  const backToLoginForm = () => {
    stopPolling();
    setView('form');
    setRequestId(null);
    setPollingToken(null);
    setRejectionReason(null);
    setError('');
  };

  const minutesElapsed = Math.floor(pollElapsed / 60000);
  const secondsElapsed = Math.floor((pollElapsed % 60000) / 1000);
  const pollTimedOut = pollElapsed >= POLL_TIMEOUT_MS;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={instituteName} className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain rounded-[20%] mx-auto mb-4" />
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={28} className="text-white" />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">{instituteName}</h1>
          <p className="text-gray-500 mt-2">{tagline}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 md:p-8 card-shadow">
          {view === 'form' && (
            <>
              <h2 className="text-lg font-semibold text-primary mb-6">Login to your account</h2>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary transition-colors bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 bg-primary text-white hover:bg-primary/80 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Login
                  {!loading && <ChevronRight size={16} />}
                </button>
              </form>
            </>
          )}

          {view === 'request_prompt' && (
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                <ShieldAlert size={28} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-primary mb-2">
                Device limit reached
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                You&apos;ve reached the maximum number of devices allowed by your
                institute. Request access and an administrator will review shortly.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm text-left">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={backToLoginForm}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestAccess}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/80 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Request access
                </button>
              </div>
            </div>
          )}

          {view === 'waiting' && (
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                {pollTimedOut ? (
                  <Clock size={28} className="text-blue-600" />
                ) : (
                  <Loader2 size={28} className="text-blue-600 animate-spin" />
                )}
              </div>
              <h2 className="text-lg font-semibold text-primary mb-2">
                {pollTimedOut ? 'Still waiting…' : 'Waiting for approval'}
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                {pollTimedOut
                  ? 'We stopped checking automatically. You can resume polling or go back and try again later.'
                  : 'An administrator has been notified of your request. This page will log you in automatically once approved.'}
              </p>
              <p className="text-xs text-gray-400 mb-6">
                Elapsed: {minutesElapsed}m {secondsElapsed}s
              </p>

              <div className="flex gap-3">
                <button
                  onClick={backToLoginForm}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Back to login
                </button>
                {pollTimedOut && requestId && pollingToken && (
                  <button
                    onClick={() => startPolling(requestId, pollingToken)}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/80"
                  >
                    Resume polling
                  </button>
                )}
              </div>
            </div>
          )}

          {view === 'rejected' && (
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <ShieldAlert size={28} className="text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-primary mb-2">
                Request denied
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Your device request was denied.
                {rejectionReason && (
                  <>
                    <br />
                    <span className="text-gray-500">Reason: {rejectionReason}</span>
                  </>
                )}
              </p>
              <button
                onClick={backToLoginForm}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/80"
              >
                Back to login
              </button>
            </div>
          )}
        </div>

        {/* Developer attribution */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="w-12 h-px bg-gray-300" />
          <ZensbotBadge variant="light" />
        </div>
      </div>
    </div>
  );
}
