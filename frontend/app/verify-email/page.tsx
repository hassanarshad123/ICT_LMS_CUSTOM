'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

function VerifyEmailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setErrorMsg('No verification token provided');
      return;
    }

    const verify = async () => {
      try {
        const result = await apiClient<{
          detail: string;
          handoffToken: string;
          instituteSlug: string;
        }>('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });

        setStatus('success');

        // Auto-redirect to institute dashboard via handoff
        if (result.handoffToken && result.instituteSlug) {
          const baseUrl = window.location.hostname.includes('localhost')
            ? `http://${result.instituteSlug}.localhost:3000`
            : `https://${result.instituteSlug}.zensbot.online`;

          setTimeout(() => {
            window.location.href = `${baseUrl}/auth-callback?token=${result.handoffToken}`;
          }, 2000);
        }
      } catch (err: unknown) {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Verification link is invalid or expired');
      }
    };

    verify();
  }, [params, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-500">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Email Verified!</h1>
          <p className="text-gray-500 mb-4">
            Your email has been verified. Redirecting you to your dashboard...
          </p>
          <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <XCircle size={32} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Verification Failed</h1>
        <p className="text-gray-500 mb-6">{errorMsg}</p>
        <div className="flex items-center gap-3 justify-center">
          <Link
            href="/check-email"
            className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
          >
            Resend Verification
          </Link>
          <Link href="/login" className="text-sm text-gray-500 hover:text-primary transition-colors">
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
