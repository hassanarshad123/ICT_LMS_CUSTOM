import { ScrollReveal } from "./scroll-reveal";

interface FeatureSectionProps {
  id?: string;
  eyebrow: string;
  headline: string;
  copy: string;
  reversed?: boolean;
  badge?: string;
  mockup: React.ReactNode;
}

export function FeatureSection({
  id,
  eyebrow,
  headline,
  copy,
  reversed = false,
  badge,
  mockup,
}: FeatureSectionProps) {
  return (
    <section
      id={id}
      className="min-h-[80vh] lg:min-h-screen flex items-center py-20 px-6 overflow-visible"
    >
      <div className="max-w-[1200px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <div className={reversed ? "lg:order-2" : ""}>
          <ScrollReveal animation={reversed ? "slide-right" : "slide-left"}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-semibold tracking-[0.2em] text-zen-purple uppercase">
                {eyebrow}
              </span>
              {badge && (
                <span className="text-[10px] font-semibold tracking-wider uppercase bg-zen-gold/20 text-zen-dark px-2.5 py-1 rounded-full">
                  {badge}
                </span>
              )}
            </div>
            <h2 className="font-serif text-[32px] sm:text-[44px] leading-[1.1] text-zen-dark mb-5">
              {headline}
            </h2>
            <p className="text-[16px] sm:text-[17px] leading-relaxed text-zen-dark-80 max-w-[480px]">
              {copy}
            </p>
          </ScrollReveal>
        </div>
        <div className={reversed ? "lg:order-1" : ""}>
          <ScrollReveal animation={reversed ? "slide-left" : "slide-right"} delay={150}>
            {mockup}
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
