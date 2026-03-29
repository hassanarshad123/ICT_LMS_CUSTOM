'use client';

import Image from 'next/image';
import { ZoomParallax } from '@/components/landing/ui/zoom-parallax';

const FEATURE_IMAGES = [
  { src: '/features/dashboard.png', alt: 'Admin Dashboard' },
  { src: '/features/branding.svg', alt: 'White-Label Branding' },
  { src: '/features/live-class.svg', alt: 'Live Classes' },
  { src: '/features/certificate.svg', alt: 'Certificates & Jobs' },
  { src: '/features/video-quiz.svg', alt: 'Video & Quizzes' },
  { src: '/features/multi-tenant.svg', alt: 'Multi-Tenant Management' },
  { src: '/features/ai-tools.svg', alt: 'AI Tools' },
];

export function FeaturesParallax() {
  const items = FEATURE_IMAGES.map(({ src, alt }) => (
    <div key={alt} className="relative w-full h-full overflow-hidden rounded-2xl border border-zen-border/40 bg-white shadow-2xl">
      <Image src={src} alt={alt} fill className="object-cover" quality={100} priority unoptimized />
    </div>
  ));

  return (
    <section id="features">
      <ZoomParallax items={items} />
    </section>
  );
}
