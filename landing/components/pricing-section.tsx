import { Check } from "lucide-react";
import { PRICING_TIERS } from "@/lib/constants";
import { ScrollReveal } from "./scroll-reveal";

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-[1100px] mx-auto">
        <ScrollReveal animation="fade-up">
          <div className="text-center mb-14">
            <h2 className="font-serif text-[32px] sm:text-[44px] text-zen-dark leading-tight mb-3">
              Simple pricing. Start free.
            </h2>
            <p className="text-zen-dark-80">No credit card required.</p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRICING_TIERS.map((tier, i) => (
            <ScrollReveal key={tier.name} animation="fade-up" delay={i * 100}>
              <div
                className={`relative rounded-2xl p-7 h-full flex flex-col ${
                  tier.highlighted
                    ? "bg-zen-dark text-white shadow-2xl shadow-zen-dark/20 ring-1 ring-zen-dark"
                    : "bg-white border border-zen-border/60 shadow-sm hover:shadow-lg transition-shadow"
                }`}
              >
                {tier.badge && tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[11px] font-semibold bg-zen-gold text-zen-dark px-4 py-1 rounded-full">
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-lg font-semibold mb-1 ${tier.highlighted ? "text-white" : "text-zen-dark"}`}>
                    {tier.name}
                  </h3>
                  <p className={`text-sm ${tier.highlighted ? "text-white/60" : "text-zen-dark/50"}`}>
                    {tier.description}
                  </p>
                </div>

                <div className="mb-6">
                  <span className={`text-[40px] font-serif ${tier.highlighted ? "text-white" : "text-zen-dark"}`}>
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className={`text-sm ${tier.highlighted ? "text-white/50" : "text-zen-dark/40"}`}>
                      {tier.period}
                    </span>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          tier.highlighted ? "text-zen-gold" : "text-zen-soft-green"
                        }`}
                      />
                      <span className={`text-sm ${tier.highlighted ? "text-white/80" : "text-zen-dark-80"}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href={tier.href}
                  className={`block text-center text-sm font-medium py-3 rounded-full transition-colors ${
                    tier.highlighted
                      ? "bg-white text-zen-dark hover:bg-white/90"
                      : "bg-zen-dark text-white hover:bg-zen-darkest"
                  }`}
                >
                  {tier.name === "Enterprise" ? "Contact us" : "Get started"}
                </a>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
