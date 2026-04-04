'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getBranding, BrandingData } from '@/lib/api/branding';
import { hexToHsl } from '@/lib/utils/color-convert';
import { getInstituteSlug } from '@/lib/utils/subdomain';

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
  watermarkEnabled: true,
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

const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

function getCacheKey(): string {
  return `branding_${getInstituteSlug() || 'default'}`;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingData>(defaults);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    const cacheKey = getCacheKey();
    let loadedFromCache = false;

    // Try to load from localStorage first
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        setBranding(data);
        applyBrandingToDOM(data);
        setLoading(false);
        loadedFromCache = true;
        // If cache is fresh enough, skip API call
        if (Date.now() - timestamp < CACHE_MAX_AGE_MS) return;
      }
    } catch {
      // Corrupt cache, continue to API
    }

    // Fetch from API (background refresh if cache was used)
    try {
      const slug = getInstituteSlug();
      const data = await getBranding(slug);
      setBranding(data);
      applyBrandingToDOM(data);
      localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (err) {
      if (loadedFromCache) {
        // Already showing cached data, just warn
        console.warn('Failed to refresh branding from API, using cached data:', err);
      } else {
        // No cache and API failed — apply defaults
        console.warn('Failed to fetch branding, using defaults:', err);
        setBranding(defaults);
        applyBrandingToDOM(defaults);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    // Force-fetch from API, ignoring cache (used when admin saves branding)
    try {
      const slug = getInstituteSlug();
      const data = await getBranding(slug);
      setBranding(data);
      applyBrandingToDOM(data);
      const cacheKey = getCacheKey();
      localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (err) {
      console.warn('Failed to refetch branding:', err);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  return (
    <BrandingContext.Provider value={{ ...branding, loading, refetch }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
