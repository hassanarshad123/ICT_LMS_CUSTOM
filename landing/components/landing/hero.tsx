"use client";

import { REGISTER_URL } from "@/lib/landing-constants";
import { useLenis } from "@/components/landing/smooth-scroll-provider";
import { ContainerScroll } from "@/components/landing/ui/container-scroll-animation";
import { DashboardMockup } from "./mockups/dashboard-mockup";

export function Hero() {
  const lenis = useLenis();

  const handleFeaturesClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (lenis) {
      lenis.scrollTo("#features", { offset: -80 });
    } else {
      document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative">
      <div className="overflow-x-clip">
        <ContainerScroll
          titleComponent={
            <>
              <p className="text-lg sm:text-xl text-zen-dark-80 mb-4">
                Everything your institute needs
              </p>
              <h1 className="font-serif text-4xl md:text-[6rem] font-bold leading-none text-zen-dark mb-6">
                The LMS that runs itself.
              </h1>
              <p className="text-base sm:text-lg text-zen-dark-80 max-w-[540px] mx-auto mb-8 leading-relaxed">
                AI quizzes. Branded certs. Live classes.
                <br className="hidden sm:block" />
                Your brand. Your rules.
              </p>
              <div className="flex items-center justify-center gap-4 mb-6">
                <a
                  href={REGISTER_URL}
                  className="bg-zen-dark text-white text-sm font-medium px-7 py-3 rounded-full hover:bg-zen-darkest transition-colors"
                >
                  Start Free — No Card Required
                </a>
                <a
                  href="#features"
                  onClick={handleFeaturesClick}
                  className="border border-zen-border text-zen-dark text-sm font-medium px-7 py-3 rounded-full hover:bg-white/60 transition-colors"
                >
                  See it in action
                </a>
              </div>
              <p className="text-sm text-zen-dark/40 flex items-center justify-center gap-1.5">
                <svg
                  className="w-4 h-4 text-zen-soft-green"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Trusted by 50+ institutes and 10,000+ students
              </p>
            </>
          }
        >
          <DashboardMockup />
        </ContainerScroll>
      </div>
    </section>
  );
}
