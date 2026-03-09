'use client';

import { BrandingProvider } from '@/lib/branding-context';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BrandingProvider>
      {children}
    </BrandingProvider>
  );
}
