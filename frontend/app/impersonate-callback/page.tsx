'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function ImpersonateCallbackContent() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Phase 4: the URL carries a single-use handover id, NOT the JWT.
    // We still defensively strip the URL in case anything else ever
    // lands here with a token query param.
    const handoverId = params.get('hid');
    const legacyToken = params.get('token');  // legacy path — reject cleanly
    window.history.replaceState({}, '', '/impersonate-callback');

    if (legacyToken && !handoverId) {
      // Old SA frontends could still hit this; once Phase 4 is deployed
      // everywhere the legacy branch is dead. Refuse — safer than
      // honoring a token that leaked via URL.
      router.replace('/login');
      return;
    }
    if (!handoverId) {
      router.replace('/login');
      return;
    }

    const redeemAndHydrate = async () => {
      // Redeem the handover id for the JWT via POST body.
      let token: string;
      try {
        const resp = await fetch(
          `/api/v1/auth/impersonation-handover/${encodeURIComponent(handoverId)}`,
          { method: 'POST' },
        );
        if (!resp.ok) {
          router.replace('/login');
          return;
        }
        const body = await resp.json();
        token = body.access_token;
      } catch {
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
      if (!payload || typeof payload.sub !== 'string' || !payload.imp) {
        router.replace('/login');
        return;
      }
      const userId = payload.sub;
      const impersonatorId = payload.imp;

      localStorage.setItem('access_token', token);
      localStorage.removeItem('refresh_token');
      localStorage.setItem('is_impersonating', 'true');
      localStorage.setItem('impersonator_id', impersonatorId);

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

    redeemAndHydrate();
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

export default function ImpersonateCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Setting up impersonation...</span>
        </div>
      </div>
    }>
      <ImpersonateCallbackContent />
    </Suspense>
  );
}
