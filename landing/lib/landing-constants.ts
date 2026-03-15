// URL constants
export const SITE_URL = "https://zensbot.site";
export const REGISTER_URL = "/register";
export const LOGIN_URL = "https://ict.zensbot.site/login";
export const CONTACT_EMAIL = "hello@zensbot.com";

export const STATS = [
  { value: "50+", label: "Institutes" },
  { value: "10,000+", label: "Students" },
  { value: "25,000+", label: "Certificates Issued" },
] as const;

export interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  highlighted: boolean;
  badge?: string;
  features: string[];
  href: string;
}

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    description: "For small institutes getting started.",
    highlighted: false,
    features: [
      "Up to 50 students",
      "5 courses",
      "5 GB storage",
      "Basic branding",
      "Email support",
    ],
    href: REGISTER_URL,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/mo",
    description: "For growing institutes that need more.",
    highlighted: true,
    badge: "Most Popular",
    features: [
      "Up to 500 students",
      "Unlimited courses",
      "50 GB storage",
      "Full white-label branding",
      "Zoom integration",
      "AI-powered tools",
      "Priority support",
    ],
    href: REGISTER_URL,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For organizations at scale.",
    highlighted: false,
    features: [
      "Unlimited students",
      "Unlimited courses",
      "Unlimited storage",
      "Dedicated subdomain",
      "SLA guarantee",
      "Dedicated support manager",
      "Custom integrations",
    ],
    href: `mailto:${CONTACT_EMAIL}`,
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
      "Every institute gets its own subdomain (yourname.ict.zensbot.site) with fully customizable branding. Upload your logo, pick your colors, choose a theme. The entire student experience carries your brand identity.",
  },
  {
    question: "Can I run live classes through the platform?",
    answer:
      "Yes. Zensbot LMS integrates directly with Zoom. Schedule classes, send automatic reminders to students, track attendance in real time, and auto-archive recordings for later viewing.",
  },
  {
    question: "What AI features are available?",
    answer:
      "AI tools include automatic quiz generation from lecture PDFs, AI-assisted course curriculum building, and an AI tutor for student Q&A. Available on the Pro plan and above.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. The free plan supports up to 50 students, 5 courses, and 5 GB of storage. No credit card required. You can upgrade anytime as your institute grows.",
  },
  {
    question: "How do certificates work?",
    answer:
      "Certificates are auto-generated as branded PDFs with unique verification codes. You customize the design, colors, signatures, and text through the admin panel. Each certificate gets a unique ID that anyone can verify online.",
  },
  {
    question: "Can I use my own custom domain?",
    answer:
      "Yes. Every institute gets a subdomain by default (yourname.zensbot.site), and you can point your own custom domain to it. Your students will see your domain, your branding, your identity — Zensbot stays invisible.",
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
