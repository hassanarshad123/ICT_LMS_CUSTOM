"use client";

import { useState } from "react";
import { TestimonialsColumn, type Testimonial } from "@/components/landing/ui/testimonials-column";
import { ScrollReveal } from "./scroll-reveal";

const testimonials: Testimonial[] = [
  {
    text: "White-label branding completely transformed how our students see us. They think we built the entire platform ourselves. That credibility is priceless for our academy.",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "Farhan Ahmed",
    role: "Academy Director, Karachi",
  },
  {
    text: "I manage 300+ students and I'm not a technical person at all. The dashboard is so intuitive that I had everything running within a day. No developer needed.",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Sana Malik",
    role: "Course Creator, Lahore",
  },
  {
    text: "The Zoom integration alone saved us 5 hours a week. Schedule a class, students get reminders automatically, attendance is tracked, and recordings are archived. All in one place.",
    image: "https://randomuser.me/api/portraits/men/75.jpg",
    name: "Bilal Hussain",
    role: "Training Manager, Islamabad",
  },
  {
    text: "We were managing 200 students across 6 WhatsApp groups. It was chaos. Moving to Zensbot gave us proper enrollment, progress tracking, and certificates. Night and day difference.",
    image: "https://randomuser.me/api/portraits/women/68.jpg",
    name: "Ayesha Khan",
    role: "Institute Owner, Faisalabad",
  },
  {
    text: "Video piracy was killing our business. Students would screenshot and share paid content. The anti-piracy watermarks and signed URLs solved that problem completely.",
    image: "https://randomuser.me/api/portraits/men/22.jpg",
    name: "Usman Raza",
    role: "Online Tutor, Rawalpindi",
  },
  {
    text: "Our HR department needed branded certificates for corporate training programs. The QR verification and custom design options made our certificates look professional and verifiable.",
    image: "https://randomuser.me/api/portraits/women/26.jpg",
    name: "Fatima Sheikh",
    role: "HR Director, Multan",
  },
  {
    text: "I run 5 sub-institutes under one umbrella. The multi-tenant setup gives each one its own branding and student base, but I can manage everything from a single super admin dashboard.",
    image: "https://randomuser.me/api/portraits/men/46.jpg",
    name: "Hamza Siddiqui",
    role: "EdTech Founder, Peshawar",
  },
  {
    text: "As a freelance educator, I couldn't afford Rs. 14,000/month for an international LMS. Zensbot's Starter plan at Rs. 2,500/month gave me everything I needed for my 30 students — branded portal, Zoom, certificates. Game changer.",
    image: "https://randomuser.me/api/portraits/women/56.jpg",
    name: "Zainab Noor",
    role: "Freelance Educator, Lahore",
  },
  {
    text: "The AI quiz generation is unreal. I upload my lecture PDF and get 20 quality questions in seconds. It used to take me an entire evening to write quizzes manually.",
    image: "https://randomuser.me/api/portraits/men/64.jpg",
    name: "Ahmed Qureshi",
    role: "Coaching Center Owner, Karachi",
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);

export function TestimonialsSection() {
  const [paused, setPaused] = useState(false);

  return (
    <section className="py-24 px-6">
      <div className="max-w-[1200px] mx-auto">
        <ScrollReveal animation="fade-up">
          <div className="flex flex-col items-center justify-center max-w-[540px] mx-auto mb-12">
            <div className="border border-zen-border/60 text-zen-purple text-xs font-semibold tracking-[0.2em] uppercase py-1.5 px-4 rounded-full mb-5">
              Testimonials
            </div>
            <h2 className="font-serif text-[32px] sm:text-[44px] md:text-[52px] leading-[1.1] text-zen-dark text-center tracking-tight">
              Trusted by institutes across Pakistan
            </h2>
            <p className="text-center mt-5 text-[16px] sm:text-[17px] text-zen-dark-80 leading-relaxed">
              See what academy owners, course creators, and training managers have to say.
            </p>
          </div>
        </ScrollReveal>

        <div
          className="flex justify-center gap-6 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <TestimonialsColumn testimonials={firstColumn} duration={15} paused={paused} />
          <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={19} paused={paused} />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} paused={paused} />
        </div>
      </div>
    </section>
  );
}
