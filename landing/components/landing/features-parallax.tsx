'use client';

import { ZoomParallax } from '@/components/landing/ui/zoom-parallax';

const FEATURE_IMAGES = [
  { src: '/features/dashboard.svg', alt: 'Admin Dashboard' },
  { src: '/features/branding.svg', alt: 'White-Label Branding' },
  { src: '/features/live-class.svg', alt: 'Live Classes' },
  { src: '/features/certificate.svg', alt: 'Certificates & Jobs' },
  { src: '/features/video-quiz.svg', alt: 'Video & Quizzes' },
  { src: '/features/multi-tenant.svg', alt: 'Multi-Tenant Management' },
  { src: '/features/ai-tools.svg', alt: 'AI Tools' },
];

export function FeaturesParallax() {
  const items = FEATURE_IMAGES.map(({ src, alt }) => (
    <div key={alt} className="w-full h-full overflow-hidden rounded-2xl border border-zen-border/40 bg-white shadow-2xl">
      <img src={src} alt={alt} className="w-full h-full object-cover" />
    </div>
  ));

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
