'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/lib/auth-context';
import { UploadProvider } from '@/lib/upload-context';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { ImpersonationBanner } from '@/components/shared/impersonation-banner';
import { ContentProtection } from '@/components/shared/content-protection';
import { TourProvider } from '@/components/shared/tour-provider';
import FeedbackButton from '@/components/shared/feedback-button';
import EmailVerifyBanner from '@/components/shared/email-verify-banner';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    if (!stored || !token) {
      router.push('/login');
      return;
    }
    try {
      const user = JSON.parse(stored);
      if (user.role === 'super_admin') {
        router.push('/sa');
        return;
      }
      if (user.id !== userId) {
        router.push('/login');
        return;
      }
      setAuthorized(true);
    } catch {
      router.push('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!authorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AuthProvider>
      <UploadProvider>
        <TourProvider>
          <ImpersonationBanner />
          <EmailVerifyBanner />
          <ContentProtection>
            <ErrorBoundary>
              {children}
              <FeedbackButton />
            </ErrorBoundary>
          </ContentProtection>
        </TourProvider>
      </UploadProvider>
    </AuthProvider>
  );
}
