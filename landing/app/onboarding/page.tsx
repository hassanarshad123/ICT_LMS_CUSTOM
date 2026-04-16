'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The full signup flow now lives at /register.
 * This page redirects for backward compatibility.
 */
export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/register');
  }, [router]);

  return null;
}
