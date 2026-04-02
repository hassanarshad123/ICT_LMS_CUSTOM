'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

function CheckEmailContent() {
  const params = useSearchParams();
  const emailFromUrl = params.get('email') || '';
  const [email, setEmail] = useState(emailFromUrl);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Get email from sessionStorage if not in URL
  useEffect(() => {
    if (!email) {
      const stored = sessionStorage.getItem('signup_email');
      if (stored) setEmail(stored);
    }
  }, [email]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setResending(true);
    try {
      await apiClient('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setResent(true);
      setCooldown(60);
    } catch {
      // Don't show error — prevents email enumeration
    } finally {
      setResending(false);
    }
  };

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 5)) + c)
    : '';

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Mail size={36} className="text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-gray-500 mb-2">
          We sent a verification link to
        </p>
        <p className="text-primary font-medium mb-6">
          {maskedEmail || 'your email address'}
        </p>

        <p className="text-sm text-gray-400 mb-8">
          Click the link in the email to verify your account.
          You can use your LMS for the next 24 hours while you verify.
        </p>

        {/* Resend section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <p className="text-sm text-gray-600 mb-4">Didn't receive the email?</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-50"
            >
              {resending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : resent ? (
                <CheckCircle2 size={16} />
              ) : null}
              {cooldown > 0 ? `Resend in ${cooldown}s` : resent ? 'Email Sent!' : 'Resend Email'}
            </button>
            <p className="text-xs text-gray-400">
              Check your spam folder. The verification link expires in 24 hours.
            </p>
          </div>
        </div>

        {/* Login link */}
        <p className="text-sm text-gray-400">
          Already verified?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <CheckEmailContent />
    </Suspense>
  );
}
