// URL constants
export const SITE_URL = "https://zensbot.site";
export const REGISTER_URL = "/register";
export const LOGIN_URL = "https://zensbot.online/login";
export const CONTACT_EMAIL = "hello@zensbot.com";

export const STATS = [
  { value: "50+", label: "Institutes" },
  { value: "10,000+", label: "Students" },
  { value: "25,000+", label: "Certificates Issued" },
] as const;

export interface PricingTier {
  name: string;
  price: string;
  priceYearly: string;
  period: string;
  yearlyNote?: string;
  description: string;
  highlighted: boolean;
  badge?: string;
  features: string[];
  href: string;
  ctaLabel: string;
}

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    name: "Starter",
    price: "Rs 2,500",
    priceYearly: "Rs 25,000",
    period: "/mo",
    yearlyNote: "Save Rs 5,000/year",
    description: "For freelance tutors and small coaching centers.",
    highlighted: false,
    features: [
      "Up to 50 students",
      "Unlimited courses & batches",
      "3 GB storage, 15 GB video",
      "Zoom integration",
      "White-label branding",
      "Certificates",
      "Email support",
    ],
    href: REGISTER_URL,
    ctaLabel: "Start 14-day free trial",
  },
  {
    name: "Basic",
    price: "Rs 5,000",
    priceYearly: "Rs 50,000",
    period: "/mo",
    yearlyNote: "Save Rs 10,000/year",
    description: "For growing academies with 100–250 students.",
    highlighted: true,
    badge: "Best Value",
    features: [
      "Up to 250 students",
      "Everything in Starter",
      "10 GB storage, 75 GB video",
      "Priority email support",
      "Only Rs 20/student",
    ],
    href: REGISTER_URL,
    ctaLabel: "Start 14-day free trial",
  },
  {
    name: "Pro",
    price: "Rs 15,000",
    priceYearly: "Rs 150,000",
    period: "/mo",
    yearlyNote: "Save Rs 30,000/year",
    description: "For established institutes that need AI and integrations.",
    highlighted: false,
    features: [
      "Up to 1,000 students",
      "Everything in Basic",
      "50 GB storage, 300 GB video",
      "AI quiz generation (coming 2026)",
      "AI tutor for students (coming 2026)",
      "API access + webhooks",
      "Only Rs 15/student",
    ],
    href: REGISTER_URL,
    ctaLabel: "Start 14-day free trial",
  },
  {
    name: "Enterprise",
    price: "From Rs 50,000",
    priceYearly: "From Rs 500,000",
    period: "/mo",
    description: "For universities, multi-branch institutes, and corporate training.",
    highlighted: false,
    features: [
      "Unlimited students",
      "Unlimited storage & video",
      "Custom domain",
      "SLA guarantee",
      "Dedicated support manager",
      "Custom integrations",
      "Multi-branch management",
    ],
    href: `mailto:${CONTACT_EMAIL}`,
    ctaLabel: "Contact us",
  },
];

export const FAQS = [
  {
    question: "What is Zensbot LMS?",
    answer:
      "Zensbot LMS is a white-label learning management system built for institutes, coaching centers, and training companies. You get your own branded platform with custom colors, logo, domain, and certificates. Your students see your brand, not ours.",
  },
  {
    question: "How does white-label branding work?",
    answer:
      "Every institute gets its own subdomain (yourname.zensbot.online) with fully customizable branding. Upload your logo, pick your colors, choose a theme. The entire student experience carries your brand identity.",
  },
  {
    question: "Can I run live classes through the platform?",
    answer:
      "Yes. Zensbot LMS integrates directly with Zoom. Schedule classes, send automatic reminders to students, track attendance in real time, and auto-archive recordings for later viewing.",
  },
  {
    question: "What AI features are available?",
    answer:
      "AI tools include automatic quiz generation from lecture PDFs, AI-assisted course curriculum building, and an AI tutor for student Q&A. Available on the Pro plan and Enterprise. AI features are rolling out through 2026.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes. Every new institute gets a 14-day free trial with up to 15 students and the full Starter feature set — Zoom, white-label branding, unlimited courses, and certificates. No credit card required. After 14 days, pick a plan starting at Rs 2,500/month or your trial institute is paused until you upgrade.",
  },
  {
    question: "How do I pay?",
    answer:
      "We accept bank transfer, JazzCash, and Easypaisa. When you're ready to upgrade, click 'Upgrade' in your admin dashboard, pick your plan and billing cycle (monthly or yearly), and you'll get payment instructions with a unique reference code. Once we verify your payment, your plan is activated. No credit card required, no international fees.",
  },
  {
    question: "How do certificates work?",
    answer:
      "Certificates are auto-generated as branded PDFs with unique verification codes. You customize the design, colors, signatures, and text through the admin panel. Each certificate gets a unique ID that anyone can verify online.",
  },
  {
    question: "Can I use my own custom domain?",
    answer:
      "Yes. Every institute gets a subdomain by default (yourname.zensbot.online), and you can point your own custom domain to it. Your students will see your domain, your branding, your identity — Zensbot stays invisible.",
  },
  {
    question: "How secure is my data?",
    answer:
      "All data is encrypted in transit (TLS 1.3) and at rest. Each institute's data is isolated in separate database scopes. We run on AWS infrastructure with automated backups, and you can export your data anytime.",
  },
  {
    question: "Can I migrate from my existing LMS or spreadsheet?",
    answer:
      "Yes. You can bulk-import students, courses, and materials. Our team can help with data migration from other platforms. Most institutes are fully operational within a day.",
  },
  {
    question: "Do students need to install anything?",
    answer:
      "No. Students access everything through the browser — courses, live classes, quizzes, certificates. There's nothing to install, update, or troubleshoot. Works on desktop, tablet, and mobile.",
  },
] as const;

export interface FooterLink {
  label: string;
  href: string;
}

export const FOOTER_LINKS: Record<string, FooterLink[]> = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "White-Label", href: "#features" },
    { label: "AI Tools", href: "#ai" },
  ],
  Platform: [
    { label: "Live Classes", href: "#features" },
    { label: "Certificates", href: "#features" },
    { label: "Job Board", href: "#features" },
    { label: "Video Hosting", href: "#features" },
  ],
  Resources: [
    { label: "Help Center", href: `mailto:${CONTACT_EMAIL}` },
    { label: "Documentation", href: `mailto:${CONTACT_EMAIL}` },
    { label: "API", href: `mailto:${CONTACT_EMAIL}` },
    { label: "Status", href: `mailto:${CONTACT_EMAIL}` },
  ],
  Legal: [
    { label: "Privacy", href: `${SITE_URL}/privacy-policy` },
    { label: "Terms", href: `${SITE_URL}/terms` },
    { label: "Security", href: `mailto:${CONTACT_EMAIL}` },
  ],
};
