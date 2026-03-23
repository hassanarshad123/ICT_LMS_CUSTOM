'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrandingProvider } from '@/lib/branding-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        {children}
      </BrandingProvider>
    </QueryClientProvider>
  );
}
