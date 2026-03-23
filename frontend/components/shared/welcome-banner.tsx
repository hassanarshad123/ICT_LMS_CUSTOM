'use client';

import Link from 'next/link';
import { Rocket } from 'lucide-react';
import { useBasePath } from '@/hooks/use-base-path';

export default function WelcomeBanner() {
  const basePath = useBasePath();

  return (
    <div className="rounded-2xl p-5 sm:p-8 md:p-10 bg-gradient-to-br from-primary/90 to-primary mb-4 sm:mb-6 md:mb-8 card-shadow">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-accent flex items-center justify-center shrink-0">
          <Rocket size={22} className="text-primary sm:hidden" />
          <Rocket size={28} className="text-primary hidden sm:block" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-primary-foreground mb-1">
            Welcome to your LMS! Let&apos;s get you set up.
          </h2>
          <p className="text-primary-foreground/70 text-sm sm:text-base">
            Create your first batch, add courses, and invite students to get started.
          </p>
        </div>
        <Link
          href={`${basePath}/setup`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-primary font-semibold text-sm hover:bg-accent/90 transition-colors shrink-0"
        >
          <Rocket size={16} />
          Start Setup
        </Link>
      </div>
    </div>
  );
}
