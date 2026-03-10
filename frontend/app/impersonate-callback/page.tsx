'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ImpersonateCallbackPage() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      // Decode JWT payload to get sub (user_id) and imp (impersonator_id)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userId = payload.sub;
      const impersonatorId = payload.imp;

      if (!userId || !impersonatorId) {
        router.replace('/login');
        return;
      }

      // Store impersonation token (no refresh token for impersonation)
      localStorage.setItem('access_token', token);
      localStorage.removeItem('refresh_token');
      localStorage.setItem('is_impersonating', 'true');
      localStorage.setItem('impersonator_id', impersonatorId);

      // We need to fetch user data so the app works correctly
      // Store a minimal user object — the app will hydrate from /auth/me
      localStorage.setItem('user', JSON.stringify({
        id: userId,
        role: '',
        name: '',
        email: '',
      }));

      router.replace(`/${userId}`);
    } catch {
      router.replace('/login');
    }
  }, [params, router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Setting up impersonation...</span>
      </div>
    </div>
  );
}
