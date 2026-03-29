'use client';

import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { ZoomParallax } from '@/components/landing/ui/zoom-parallax';
import { DashboardMockup } from './mockups/dashboard-mockup';
import { BrandingMockup } from './mockups/branding-mockup';
import { LiveClassMockup } from './mockups/live-class-mockup';
import { CertificateMockup } from './mockups/certificate-mockup';
import { VideoQuizMockup } from './mockups/video-quiz-mockup';
import { MultiTenantMockup } from './mockups/multi-tenant-mockup';
import { AiToolsMockup } from './mockups/ai-tools-mockup';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function ScaledMockupCard({ children, designWidth = 640 }: { children: React.ReactNode; designWidth?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [measured, setMeasured] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const measure = () => {
      const containerW = container.clientWidth;
      const containerH = container.clientHeight;
      const contentH = content.scrollHeight;
      if (containerW === 0 || containerH === 0) return;
      const s = Math.min(containerW / designWidth, containerH / contentH, 1);
      setScaleFactor(s);
      setMeasured(true);
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [designWidth]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none w-full h-full overflow-hidden rounded-2xl border border-zen-border/40 bg-white shadow-2xl"
    >
      <div
        ref={contentRef}
        style={{
          width: `${designWidth}px`,
          transform: `scale(${scaleFactor})`,
          transformOrigin: 'top center',
          opacity: measured ? 1 : 0,
          transition: 'opacity 0.15s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function FeaturesParallax() {
  const items = [
    <ScaledMockupCard key="dashboard" designWidth={720}><DashboardMockup /></ScaledMockupCard>,
    <ScaledMockupCard key="branding" designWidth={560}><BrandingMockup /></ScaledMockupCard>,
    <ScaledMockupCard key="live-class" designWidth={480}><LiveClassMockup /></ScaledMockupCard>,
    <ScaledMockupCard key="certificate" designWidth={560}><CertificateMockup /></ScaledMockupCard>,
    <ScaledMockupCard key="video-quiz" designWidth={480}><VideoQuizMockup /></ScaledMockupCard>,
    <ScaledMockupCard key="multi-tenant" designWidth={560}><MultiTenantMockup /></ScaledMockupCard>,
    <ScaledMockupCard key="ai-tools" designWidth={420}><AiToolsMockup /></ScaledMockupCard>,
  ];

  return (
    <section id="features">
      <div className="text-center py-24 px-6">
        <span className="text-xs font-semibold tracking-[0.2em] text-zen-purple uppercase mb-4 block">
          FEATURES
        </span>
        <h2 className="font-serif text-[32px] sm:text-[44px] md:text-[52px] leading-[1.1] text-zen-dark mb-5">
          Everything you need to run<br />your institute.
        </h2>
        <p className="text-[16px] sm:text-[17px] text-zen-dark-80 max-w-[560px] mx-auto leading-relaxed">
          Scroll to explore the platform. Every screen you see is real.
        </p>
      </div>
      <ZoomParallax items={items} />
    </section>
  );
}
