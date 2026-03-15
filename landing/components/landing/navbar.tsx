"use client";

import { useState, useCallback } from "react";
import { Menu, X, Layers, CreditCard, HelpCircle } from "lucide-react";
import { useActiveSection } from "@/hooks/use-active-section";
import { useLenis } from "@/components/landing/smooth-scroll-provider";
import { LimelightNav, type NavItem } from "@/components/landing/ui/limelight-nav";
import { LOGIN_URL, REGISTER_URL } from "@/lib/landing-constants";

const SECTION_IDS = ["features", "pricing", "faq"] as const;

const NAV_LINKS = [
  { label: "Features", href: "#features", id: "features" },
  { label: "Pricing", href: "#pricing", id: "pricing" },
  { label: "FAQ", href: "#faq", id: "faq" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeSection = useActiveSection();
  const lenis = useLenis();

  const scrollToSection = useCallback(
    (id: string) => {
      if (lenis) {
        lenis.scrollTo(`#${id}`, { offset: -80 });
      } else {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }
    },
    [lenis]
  );

  const navItems: NavItem[] = [
    {
      id: "features",
      icon: <Layers />,
      label: "Features",
      onClick: () => scrollToSection("features"),
    },
    {
      id: "pricing",
      icon: <CreditCard />,
      label: "Pricing",
      onClick: () => scrollToSection("pricing"),
    },
    {
      id: "faq",
      icon: <HelpCircle />,
      label: "FAQ",
      onClick: () => scrollToSection("faq"),
    },
  ];

  // Map active section to index for the spotlight
  const activeIndex = SECTION_IDS.indexOf(
    activeSection as (typeof SECTION_IDS)[number]
  );

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 bg-zen-page-bg/80 backdrop-blur-xl border-b border-zen-border/50"
      role="navigation"
      aria-label="Main"
    >
      <div className="max-w-[1200px] mx-auto flex items-center justify-between h-16 px-6">
        {/* Wordmark */}
        <a href="/" className="font-serif text-[22px] text-zen-dark">
          Zensbot
        </a>

        {/* Center — LimelightNav (desktop only) */}
        <div className="hidden md:inline-flex">
          <LimelightNav
            items={navItems}
            activeIndex={activeIndex >= 0 ? activeIndex : undefined}
          />
        </div>

        {/* Right actions — desktop */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href={LOGIN_URL}
            className="text-sm text-zen-dark-80 hover:text-zen-dark transition-colors"
          >
            Sign in
          </a>
          <a
            href={REGISTER_URL}
            className="text-sm font-medium text-white bg-zen-dark rounded-full px-5 py-2 hover:bg-zen-darkest transition-colors"
          >
            Sign up free
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-zen-dark"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Mobile menu — animated slide */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-zen-page-bg/95 backdrop-blur-xl border-b border-zen-border/50 px-6 pb-6">
          <div className="flex flex-col gap-4 pt-2">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  scrollToSection(link.id);
                }}
                className={`text-sm text-left transition-colors ${
                  activeSection === link.id
                    ? "text-zen-dark font-medium"
                    : "text-zen-dark-80 hover:text-zen-dark"
                }`}
              >
                {link.label}
              </button>
            ))}
            <hr className="border-zen-border/50" />
            <a
              href={LOGIN_URL}
              className="text-sm text-zen-dark-80 hover:text-zen-dark transition-colors"
            >
              Sign in
            </a>
            <a
              href={REGISTER_URL}
              className="text-sm font-medium text-white bg-zen-dark rounded-full px-5 py-2 hover:bg-zen-darkest transition-colors text-center"
            >
              Sign up free
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
