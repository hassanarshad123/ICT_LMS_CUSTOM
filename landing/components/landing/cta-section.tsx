import { Check } from "lucide-react";
import { REGISTER_URL } from "@/lib/landing-constants";
import { ScrollReveal } from "./scroll-reveal";

export function CtaSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-[800px] mx-auto">
        <ScrollReveal animation="fade-up">
          <div className="bg-gradient-to-br from-zen-bg to-zen-soft-pink/40 rounded-3xl p-10 sm:p-14 text-center">
            <h2 className="font-serif text-[32px] sm:text-[44px] text-zen-dark leading-tight mb-5">
              Launch your branded LMS today.
            </h2>
            <p className="text-zen-dark-80 mb-8 max-w-[480px] mx-auto">
              Join 50+ institutes already running their learning platforms on Zensbot.
            </p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <a
                href={REGISTER_URL}
                className="bg-zen-dark text-white text-sm font-medium px-8 py-3 rounded-full hover:bg-zen-darkest transition-colors"
              >
                Start Free — No Card Required
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zen-dark/60">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-zen-soft-green" />
                Free forever
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-zen-soft-green" />
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-zen-soft-green" />
                Setup in 5 min
              </span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
