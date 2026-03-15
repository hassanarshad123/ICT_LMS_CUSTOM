'use client';

import { ZoomParallax } from '@/components/landing/ui/zoom-parallax';
import { DashboardMockup } from './mockups/dashboard-mockup';
import { BrandingMockup } from './mockups/branding-mockup';
import { LiveClassMockup } from './mockups/live-class-mockup';
import { CertificateMockup } from './mockups/certificate-mockup';
import { VideoQuizMockup } from './mockups/video-quiz-mockup';
import { MultiTenantMockup } from './mockups/multi-tenant-mockup';
import { AiToolsMockup } from './mockups/ai-tools-mockup';

function MockupCard({ children, width = 640 }: { children: React.ReactNode; width?: number }) {
  return (
    <div className="pointer-events-none w-full h-full overflow-hidden rounded-2xl border border-zen-border/40 bg-white shadow-2xl">
      <div style={{ width: `${width}px` }}>
        {children}
      </div>
    </div>
  );
}

export function FeaturesParallax() {
  const items = [
    <MockupCard key="dashboard" width={720}><DashboardMockup /></MockupCard>,
    <MockupCard key="branding" width={560}><BrandingMockup /></MockupCard>,
    <MockupCard key="live-class" width={480}><LiveClassMockup /></MockupCard>,
    <MockupCard key="certificate" width={560}><CertificateMockup /></MockupCard>,
    <MockupCard key="video-quiz" width={480}><VideoQuizMockup /></MockupCard>,
    <MockupCard key="multi-tenant" width={560}><MultiTenantMockup /></MockupCard>,
    <MockupCard key="ai-tools" width={420}><AiToolsMockup /></MockupCard>,
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
