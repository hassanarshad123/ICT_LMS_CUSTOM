'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { exchangeHandoffToken } from '@/lib/api/public';

export default function AuthCallbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setError('No token provided');
      return;
    }

    const exchange = async () => {
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
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Go to Login
          </Link>
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
