"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PRICING_TIERS } from "@/lib/landing-constants";
import { ScrollReveal } from "./scroll-reveal";

type BillingCycle = "monthly" | "yearly";

export function PricingSection() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-[1200px] mx-auto">
        <ScrollReveal animation="fade-up">
          <div className="text-center mb-10">
            <h2 className="font-serif text-[32px] sm:text-[44px] text-zen-dark leading-tight mb-3">
              Pricing built for Pakistan.
            </h2>
            <p className="text-zen-dark-80">14-day free trial. No credit card required.</p>
          </div>
        </ScrollReveal>

        <ScrollReveal animation="fade-up" delay={100}>
          <div className="flex justify-center mb-12">
            <div className="inline-flex items-center bg-zen-border/30 border border-zen-border/60 rounded-full p-1">
              <button
                onClick={() => setCycle("monthly")}
                className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${
                  cycle === "monthly"
                    ? "bg-zen-dark text-white shadow-sm"
                    : "text-zen-dark-80 hover:text-zen-dark"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setCycle("yearly")}
                className={`px-5 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-2 ${
                  cycle === "yearly"
                    ? "bg-zen-dark text-white shadow-sm"
                    : "text-zen-dark-80 hover:text-zen-dark"
                }`}
              >
                Yearly
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  cycle === "yearly" ? "bg-zen-gold text-zen-dark" : "bg-zen-gold/20 text-zen-dark"
                }`}>
                  2 months free
                </span>
              </button>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PRICING_TIERS.map((tier, i) => {
            const displayPrice = cycle === "yearly" ? tier.priceYearly : tier.price;
            const displayPeriod = cycle === "yearly" ? "/year" : tier.period;
            return (
              <ScrollReveal key={tier.name} animation="fade-up" delay={i * 80}>
                <div
                  className={`relative rounded-2xl p-6 h-full flex flex-col ${
                    tier.highlighted
                      ? "bg-zen-dark text-white shadow-2xl shadow-zen-dark/20 ring-1 ring-zen-dark"
                      : "bg-white border border-zen-border/60 shadow-sm hover:shadow-lg transition-shadow"
                  }`}
                >
                  {tier.badge && tier.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-[11px] font-semibold bg-zen-gold text-zen-dark px-4 py-1 rounded-full whitespace-nowrap">
                        {tier.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-5">
                    <h3 className={`text-lg font-semibold mb-1 ${tier.highlighted ? "text-white" : "text-zen-dark"}`}>
                      {tier.name}
                    </h3>
                    <p className={`text-xs ${tier.highlighted ? "text-white/60" : "text-zen-dark/50"}`}>
                      {tier.description}
                    </p>
                  </div>

                  <div className="mb-5">
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className={`text-[32px] font-serif leading-none ${tier.highlighted ? "text-white" : "text-zen-dark"}`}>
                        {displayPrice}
                      </span>
                      {tier.period && (
                        <span className={`text-xs ${tier.highlighted ? "text-white/50" : "text-zen-dark/40"}`}>
                          {displayPeriod}
                        </span>
                      )}
                    </div>
                    {cycle === "yearly" && tier.yearlyNote && (
                      <div className={`text-[11px] mt-1 font-medium ${tier.highlighted ? "text-zen-gold" : "text-zen-soft-green"}`}>
                        {tier.yearlyNote}
                      </div>
                    )}
                    {cycle === "monthly" && tier.name === "Enterprise" && (
                      <div className={`text-[11px] mt-1 ${tier.highlighted ? "text-white/50" : "text-zen-dark/40"}`}>
                        Custom pricing
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            tier.highlighted ? "text-zen-gold" : "text-zen-soft-green"
                          }`}
                        />
                        <span className={`text-xs ${tier.highlighted ? "text-white/80" : "text-zen-dark-80"}`}>
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
                    {tier.ctaLabel}
                  </a>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal animation="fade-up" delay={400}>
          <div className="text-center mt-10 text-xs text-zen-dark/50">
            Pay by bank transfer, JazzCash, or Easypaisa. All prices in PKR.
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
