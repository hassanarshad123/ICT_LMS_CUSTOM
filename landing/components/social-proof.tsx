import { Building2, Users, Award } from "lucide-react";
import { STATS } from "@/lib/constants";
import { ScrollReveal } from "./scroll-reveal";

const ICONS = [Building2, Users, Award];

export function SocialProof() {
  return (
    <section className="py-16 px-6 bg-zen-bg border-y border-zen-border/40">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-20">
          {STATS.map((stat, i) => {
            const Icon = ICONS[i];
            return (
              <ScrollReveal key={stat.label} animation="fade-up" delay={i * 100}>
                <div className="text-center">
                  <Icon className="w-5 h-5 text-zen-purple/60 mx-auto mb-2" />
                  <div className="font-serif text-[40px] sm:text-[52px] text-zen-dark leading-none">
                    {stat.value}
                  </div>
                  <div className="text-sm text-zen-dark-80 mt-1">{stat.label}</div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
