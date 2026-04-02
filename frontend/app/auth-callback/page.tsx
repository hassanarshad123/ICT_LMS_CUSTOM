'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { exchangeHandoffToken } from '@/lib/api/public';

function AuthCallbackContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setError('No token provided');
      return;
    }

    // Strip token from URL immediately to prevent leaking in browser history
    window.history.replaceState({}, '', '/auth-callback');

    const exchange = async (attempt = 1): Promise<void> => {
      try {
        const result = await exchangeHandoffToken(token);

        // Store auth data
        localStorage.setItem('access_token', result.accessToken);
        localStorage.setItem('refresh_token', result.refreshToken);
        localStorage.setItem('user', JSON.stringify({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          phone: result.user.phone,
          role: result.user.role,
          status: result.user.status,
          avatarUrl: result.user.avatarUrl,
          batchIds: result.user.batchIds,
          batchNames: result.user.batchNames,
          instituteId: result.user.instituteId,
          instituteSlug: result.user.instituteSlug,
        }));

        // Redirect to dashboard
        router.replace(`/${result.user.id}`);
      } catch (err: unknown) {
        // Retry up to 3 times with 2s delay (network failures, slow backend)
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 2000));
          return exchange(attempt + 1);
        }
        const message = err instanceof Error ? err.message : 'Invalid or expired link';
        setError(message);
      }
    };

    exchange();
  }, [params, router]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Link expired or invalid</h1>
          <p className="text-gray-500 mb-4">{error}</p>
          <div className="flex items-center gap-3 justify-center">
            <button
              onClick={() => { setError(''); window.location.reload(); }}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors"
            >
              Retry
            </button>
            <Link href="/login" className="text-sm font-medium text-gray-500 hover:text-primary transition-colors">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Setting up your LMS...</span>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Setting up your LMS...</span>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
