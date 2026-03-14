"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { FAQS } from "@/lib/constants";
import { ScrollReveal } from "./scroll-reveal";

export function FaqSection() {
  return (
    <section id="faq" className="py-20 px-6 bg-zen-bg">
      <div className="max-w-[680px] mx-auto">
        <ScrollReveal animation="fade-up">
          <h2 className="font-serif text-[32px] sm:text-[40px] text-center text-zen-dark mb-4 leading-tight">
            Frequently asked questions
          </h2>
          <p className="text-center text-zen-dark-80 mb-12">
            Everything you need to know about Zensbot LMS.
          </p>
        </ScrollReveal>

        <ScrollReveal animation="fade-up" delay={100}>
          <Accordion.Root type="single" collapsible className="space-y-3">
            {FAQS.map((faq, i) => (
              <Accordion.Item
                key={i}
                value={`faq-${i}`}
                className="bg-white rounded-xl border border-zen-border/50 overflow-hidden"
              >
                <Accordion.Trigger className="w-full flex items-center justify-between px-6 py-5 text-left group">
                  <span className="text-[15px] font-medium text-zen-dark pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown className="w-4 h-4 text-zen-dark/40 flex-shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Accordion.Trigger>
                <Accordion.Content className="accordion-content overflow-hidden">
                  <div className="px-6 pb-5">
                    <p className="text-sm text-zen-dark-80 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </ScrollReveal>
      </div>
    </section>
  );
}
