import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getBranding } from '@/lib/api/branding';
import type { BrandingData } from '@/lib/types/branding';

interface BrandingContextType extends BrandingData {
  loading: boolean;
  refetch: () => Promise<void>;
}

const defaults: BrandingData = {
  primaryColor: '#1A1A1A',
  accentColor: '#C5D86D',
  backgroundColor: '#F0F0F0',
  instituteName: 'ICT Institute',
  tagline: 'Learning Management System',
  logoUrl: null,
  faviconUrl: null,
};

const BrandingContext = createContext<BrandingContextType>({
  ...defaults,
  loading: true,
  refetch: async () => {},
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingData>(defaults);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    try {
      const data = await getBranding();
      setBranding(data);
    } catch {
      // Graceful fallback — use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  return (
    <BrandingContext.Provider value={{ ...branding, loading, refetch: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
