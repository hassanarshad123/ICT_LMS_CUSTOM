import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { SocialProof } from "@/components/social-proof";
import { AiShowcase } from "@/components/ai-showcase";
import { FeatureSection } from "@/components/feature-section";
import { BrandingMockup } from "@/components/mockups/branding-mockup";
import { LiveClassMockup } from "@/components/mockups/live-class-mockup";
import { CertificateMockup } from "@/components/mockups/certificate-mockup";
import { VideoQuizMockup } from "@/components/mockups/video-quiz-mockup";
import { MultiTenantMockup } from "@/components/mockups/multi-tenant-mockup";
import { PricingSection } from "@/components/pricing-section";
import { FaqSection } from "@/components/faq-section";
import { CtaSection } from "@/components/cta-section";
import { Footer } from "@/components/footer";
import { FAQS } from "@/lib/constants";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-zen-dark focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm"
      >
        Skip to content
      </a>

      <Navbar />
      <main id="main">
        <Hero />
        <SocialProof />
        <AiShowcase />

        <div id="features">
          <FeatureSection
            eyebrow="YOUR BRAND, YOUR RULES"
            headline="Every pixel speaks your brand."
            copy="Upload your logo, pick your colors, choose a theme. Your students see your institute, not ours."
            mockup={<BrandingMockup />}
          />

          <FeatureSection
            eyebrow="LIVE, NOT RECORDED"
            headline="One click to go live. Zero setup."
            copy="Schedule Zoom classes, send automatic reminders, track attendance, auto-archive recordings."
            reversed
            mockup={<LiveClassMockup />}
          />

          <FeatureSection
            eyebrow="CREDENTIALS & CAREERS"
            headline="Certificates that open doors. Jobs that launch careers."
            copy="Auto-generate branded PDF certificates with unique verification codes. Run a job board inside your LMS."
            reversed
            mockup={<CertificateMockup />}
          />

          <FeatureSection
            eyebrow="CONTENT THAT STICKS"
            headline="Upload. Stream. Quiz. Repeat."
            copy="Drag and drop videos with parallel 50MB chunk uploads. Stream through a global CDN with anti-piracy watermarks."
            mockup={<VideoQuizMockup />}
          />

          <FeatureSection
            eyebrow="BUILT FOR SCALE"
            headline="One platform. Unlimited institutes."
            copy="Every institute gets its own subdomain, branding, and data silo. Four user roles. Super admin dashboard for the big picture."
            reversed
            mockup={<MultiTenantMockup />}
          />
        </div>

        <PricingSection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
