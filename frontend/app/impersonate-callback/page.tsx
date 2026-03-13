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

    let payload: { sub?: string; imp?: string };
    try {
      payload = JSON.parse(atob(token.split('.')[1]));
    } catch {
      router.replace('/login');
      return;
    }

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

    // Fetch real user data so sidebar/nav shows correct info (Fix 6)
    const hydrateAndRedirect = async () => {
      try {
        const meResp = await fetch('/api/v1/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (meResp.ok) {
          const me = await meResp.json();
          localStorage.setItem('user', JSON.stringify({
            id: me.id,
            email: me.email,
            name: me.name,
            phone: me.phone,
            role: me.role,
            status: me.status,
            avatarUrl: me.avatar_url,
            batchIds: me.batch_ids || [],
            batchNames: me.batch_names || [],
            instituteId: me.institute_id,
            instituteSlug: me.institute_slug,
          }));
        } else {
          localStorage.setItem('user', JSON.stringify({
            id: userId, role: '', name: '', email: '',
          }));
        }
      } catch {
        localStorage.setItem('user', JSON.stringify({
          id: userId, role: '', name: '', email: '',
        }));
      }
      router.replace(`/${userId}`);
    };

    hydrateAndRedirect();
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
