"use client";

import { Check } from "lucide-react";
import { REGISTER_URL, WHATSAPP_URL } from "@/lib/landing-constants";
import { trackMetaEvent } from "@/lib/meta-pixel";
import { ScrollReveal } from "./scroll-reveal";

export function CtaSection() {
  const handleWhatsAppClick = () => {
    void trackMetaEvent("Contact", {
      content_name: "WhatsApp Sales",
      content_category: "cta-section",
    });
  };

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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6">
              <a
                href={REGISTER_URL}
                className="bg-zen-dark text-white text-sm font-medium px-8 py-3 rounded-full hover:bg-zen-darkest transition-colors"
              >
                Start Free — No Card Required
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleWhatsAppClick}
                className="inline-flex items-center gap-2 bg-white text-zen-dark text-sm font-medium px-8 py-3 rounded-full border border-zen-border hover:border-zen-dark/40 hover:shadow-sm transition-all"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.057 2.25c-5.432 0-9.84 4.408-9.84 9.841 0 1.738.453 3.374 1.248 4.797l-1.322 4.831 4.95-1.299a9.808 9.808 0 004.964 1.352c5.433 0 9.84-4.408 9.84-9.841 0-2.63-1.024-5.1-2.883-6.959a9.771 9.771 0 00-6.957-2.722z" />
                </svg>
                Chat on WhatsApp
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
