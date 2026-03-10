'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getBranding, BrandingData } from '@/lib/api/branding';
import { hexToHsl } from '@/lib/utils/color-convert';

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
  presetTheme: null,
};

const BrandingContext = createContext<BrandingContextType>({
  ...defaults,
  loading: true,
  refetch: async () => {},
});

function applyBrandingToDOM(branding: BrandingData) {
  const root = document.documentElement;

  // Set CSS variables (HSL format without commas, matching globals.css)
  root.style.setProperty('--primary', hexToHsl(branding.primaryColor));
  root.style.setProperty('--primary-foreground', '0 0% 98%');
  root.style.setProperty('--accent', hexToHsl(branding.accentColor));
  root.style.setProperty('--background', hexToHsl(branding.backgroundColor));
  root.style.setProperty('--foreground', hexToHsl(branding.primaryColor));
  root.style.setProperty('--ring', hexToHsl(branding.primaryColor));
  root.style.setProperty('--accent-foreground', hexToHsl(branding.primaryColor));

  // Update page title
  document.title = `${branding.instituteName} - ${branding.tagline}`;

  // Update favicon dynamically
  if (branding.logoUrl || branding.faviconUrl) {
    const faviconUrl = branding.faviconUrl || branding.logoUrl;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl!;
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingData>(defaults);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    try {
      const data = await getBranding();
      setBranding(data);
      applyBrandingToDOM(data);
    } catch {
      // Graceful fallback — CSS defaults from globals.css will be used
      applyBrandingToDOM(defaults);
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
