"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const INJECTED_STYLES = `
  .gsap-reveal { visibility: hidden; }

  .film-grain {
    position: absolute; inset: 0; width: 100%; height: 100%;
    pointer-events: none; z-index: 50; opacity: 0.05; mix-blend-mode: overlay;
    background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)"/></svg>');
  }

  .bg-grid-theme {
    background-size: 60px 60px;
    background-image:
      linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px);
    mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  }

  .text-3d-matte {
    color: #181229;
    text-shadow: 0 10px 30px rgba(24,18,41,0.20), 0 2px 4px rgba(24,18,41,0.10);
  }

  .text-silver-matte {
    background: linear-gradient(180deg, #181229 0%, rgba(24,18,41,0.4) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; transform: translateZ(0);
    filter: drop-shadow(0px 10px 20px rgba(24,18,41,0.15)) drop-shadow(0px 2px 4px rgba(24,18,41,0.10));
  }

  .text-card-silver-matte {
    background: linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; transform: translateZ(0);
    filter: drop-shadow(0px 8px 16px rgba(0,0,0,0.6)) drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
  }

  .premium-depth-card {
    background: linear-gradient(145deg, #162C6D 0%, #0A101D 100%);
    box-shadow: 0 40px 100px -20px rgba(0,0,0,0.9), 0 20px 40px -20px rgba(0,0,0,0.8),
      inset 0 1px 2px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.8);
    border: 1px solid rgba(255,255,255,0.04); position: relative;
  }

  .card-sheen {
    position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 50;
    background: radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.06) 0%, transparent 40%);
    mix-blend-mode: screen; transition: opacity 0.3s ease;
  }

  .macbook-bezel {
    background-color: #1a1a1a;
    box-shadow: inset 0 0 0 2px #404040, inset 0 0 0 4px #111,
      0 40px 80px -15px rgba(0,0,0,0.9), 0 15px 25px -5px rgba(0,0,0,0.7);
    transform-style: preserve-3d;
  }

  .macbook-base {
    background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%);
    box-shadow: 0 4px 12px rgba(0,0,0,0.6);
  }

  .floating-ui-badge {
    background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 100%);
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 25px 50px -12px rgba(0,0,0,0.8),
      inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 1px rgba(0,0,0,0.5);
  }

  .btn-modern-light, .btn-modern-dark { transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1); }
  .btn-modern-light {
    background: linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%); color: #0F172A;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.1), 0 12px 24px -4px rgba(0,0,0,0.3),
      inset 0 1px 1px rgba(255,255,255,1), inset 0 -3px 6px rgba(0,0,0,0.06);
  }
  .btn-modern-light:hover {
    transform: translateY(-3px);
    box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 6px 12px -2px rgba(0,0,0,0.15), 0 20px 32px -6px rgba(0,0,0,0.4),
      inset 0 1px 1px rgba(255,255,255,1), inset 0 -3px 6px rgba(0,0,0,0.06);
  }
  .btn-modern-dark {
    background: linear-gradient(180deg, #27272A 0%, #18181B 100%); color: #FFFFFF;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.6), 0 12px 24px -4px rgba(0,0,0,0.9),
      inset 0 1px 1px rgba(255,255,255,0.15), inset 0 -3px 6px rgba(0,0,0,0.8);
  }
  .btn-modern-dark:hover {
    transform: translateY(-3px);
    background: linear-gradient(180deg, #3F3F46 0%, #27272A 100%);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.15), 0 6px 12px -2px rgba(0,0,0,0.7), 0 20px 32px -6px rgba(0,0,0,1),
      inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -3px 6px rgba(0,0,0,0.8);
  }

  .progress-ring {
    transform: rotate(-90deg); transform-origin: center;
    stroke-dasharray: 264; stroke-dashoffset: 264; stroke-linecap: round;
  }

  .widget-depth {
    background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
    box-shadow: 0 10px 20px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05), inset 0 -1px 1px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.03);
  }
`;

/* ── Screen UIs rendered inside the laptop ── */

function ScreenDashboard() {
  return (
    <div className="flex h-full">
      <div className="w-[110px] bg-[#0a0f1a] p-3 border-r border-white/5 hidden sm:block">
        <div className="text-[9px] font-bold text-white/80 mb-4">Your Academy</div>
        <div className="space-y-1.5">
          {["Dashboard", "Courses", "Students", "Schedule", "Certificates"].map((item, i) => (
            <div key={item} className={`text-[8px] px-2 py-1.5 rounded-md ${i === 0 ? "bg-white/10 text-white font-medium" : "text-white/30"}`}>{item}</div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="text-[10px] font-semibold text-white/80 mb-3">Admin Dashboard</div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[{ l: "Students", v: "298", c: "text-blue-400" }, { l: "Courses", v: "12", c: "text-emerald-400" }, { l: "Revenue", v: "$4,820", c: "text-amber-400" }].map(s => (
            <div key={s.l} className="widget-depth rounded-lg p-2.5">
              <div className="text-[7px] text-white/30 mb-1">{s.l}</div>
              <div className={`text-[13px] font-bold ${s.c}`}>{s.v}</div>
            </div>
          ))}
        </div>
        <div className="text-[8px] text-white/40 mb-2 font-medium">Active Courses</div>
        <div className="space-y-2">
          {[{ n: "React Fundamentals", s: 128, p: 85 }, { n: "Python Data Science", s: 96, p: 62 }, { n: "UI/UX Design", s: 74, p: 93 }].map(c => (
            <div key={c.n} className="widget-depth rounded-lg px-3 py-2 flex items-center gap-3">
              <div className="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-sm bg-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[8px] text-white/70 truncate">{c.n}</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-white/5 rounded-full"><div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${c.p}%` }} /></div>
                  <span className="text-[7px] text-white/30">{c.s}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenBranding() {
  const themes = [
    { name: "Ocean", primary: "#2f2f91", accent: "#f5c543" },
    { name: "Forest", primary: "#1a5c3a", accent: "#f5c543" },
    { name: "Sunset", primary: "#b33d1a", accent: "#fe6621" },
    { name: "Midnight", primary: "#181229", accent: "#f5c543" },
  ];
  return (
    <div className="flex h-full">
      <div className="w-[110px] bg-[#0a0f1a] p-3 border-r border-white/5 hidden sm:block">
        <div className="text-[9px] font-bold text-white/80 mb-4">Your Academy</div>
        <div className="space-y-1.5">
          {["Dashboard", "Branding", "Settings"].map((item, i) => (
            <div key={item} className={`text-[8px] px-2 py-1.5 rounded-md ${i === 1 ? "bg-white/10 text-white font-medium" : "text-white/30"}`}>{item}</div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="text-[10px] font-semibold text-white/80 mb-3">Brand Settings</div>
        <div className="widget-depth rounded-lg p-3 mb-3">
          <div className="text-[8px] text-white/40 mb-2">Preset Themes</div>
          <div className="flex gap-2">
            {themes.map((t, i) => (
              <div key={t.name} className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full border-2 ${i === 0 ? "border-blue-400" : "border-transparent"}`} style={{ background: t.primary }} />
                <span className="text-[6px] text-white/30">{t.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="widget-depth rounded-lg p-3 mb-3">
          <div className="text-[8px] text-white/40 mb-2">Logo & Identity</div>
          <div className="border border-dashed border-white/10 rounded-lg p-3 flex items-center justify-center">
            <span className="text-[8px] text-white/20">Drop your logo here</span>
          </div>
        </div>
        <div className="widget-depth rounded-lg p-3">
          <div className="text-[8px] text-white/40 mb-2">Live Preview</div>
          <div className="rounded-md overflow-hidden">
            <div className="h-4 flex items-center px-2" style={{ background: themes[0].primary }}>
              <span className="text-[6px] text-white/80 font-bold">Your Academy</span>
            </div>
            <div className="bg-white/5 p-2">
              <div className="h-1.5 w-16 bg-white/10 rounded mb-1" />
              <div className="h-1 w-10 bg-white/5 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenLiveClass() {
  return (
    <div className="flex h-full">
      <div className="w-[110px] bg-[#0a0f1a] p-3 border-r border-white/5 hidden sm:block">
        <div className="text-[9px] font-bold text-white/80 mb-4">Your Academy</div>
        <div className="space-y-1.5">
          {["Dashboard", "Courses", "Live Classes", "Schedule"].map((item, i) => (
            <div key={item} className={`text-[8px] px-2 py-1.5 rounded-md ${i === 2 ? "bg-white/10 text-white font-medium" : "text-white/30"}`}>{item}</div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-semibold text-white/80">Live Classes</div>
          <div className="flex items-center gap-1.5 bg-red-500/20 px-2 py-0.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[7px] text-red-400 font-bold">LIVE NOW</span>
          </div>
        </div>
        <div className="widget-depth rounded-lg p-3 mb-3">
          <div className="text-[9px] font-semibold text-white mb-1">React Hooks Deep Dive</div>
          <div className="text-[7px] text-white/40 mb-3">Module 4 of 8 · Prof. Sarah Chen</div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex -space-x-1.5">
              {["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500"].map((c, i) => (
                <div key={i} className={`w-5 h-5 rounded-full ${c} border border-[#0a0f1a] text-[5px] font-bold text-white flex items-center justify-center`}>
                  {["SK", "JP", "AR", "LM"][i]}
                </div>
              ))}
              <div className="h-5 flex items-center ml-2"><span className="text-[7px] text-white/30">+24 more</span></div>
            </div>
          </div>
          <button className="w-full py-1.5 rounded-md bg-[#2D8CFF] text-[8px] font-bold text-white">Join Class</button>
        </div>
        <div className="text-[8px] text-white/40 mb-2">Today&apos;s Schedule</div>
        <div className="space-y-1.5">
          {[{ t: "2:00 PM", n: "Database Design" }, { t: "4:30 PM", n: "Project Review" }].map(c => (
            <div key={c.n} className="widget-depth rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-[7px] text-white/30 w-12 flex-shrink-0">{c.t}</span>
              <span className="text-[8px] text-white/60">{c.n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Browser Chrome Wrapper ── */
function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0d1117] border-b border-white/5">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
        </div>
        <div className="flex-1 mx-6">
          <div className="bg-white/5 rounded-md px-3 py-1 text-[9px] text-white/30 text-center">{url}</div>
        </div>
      </div>
      <div className="h-[calc(100%-32px)]">{children}</div>
    </>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */

export function CinematicHero({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);

  // Mouse interaction for 3D tilt + card sheen
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (window.scrollY > window.innerHeight * 2) return;
      cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(() => {
        if (mainCardRef.current && mockupRef.current) {
          const rect = mainCardRef.current.getBoundingClientRect();
          mainCardRef.current.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
          mainCardRef.current.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
          const xVal = (e.clientX / window.innerWidth - 0.5) * 2;
          const yVal = (e.clientY / window.innerHeight - 0.5) * 2;
          gsap.to(mockupRef.current, { rotationY: xVal * 8, rotationX: -yVal * 8, ease: "power3.out", duration: 1.2 });
        }
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => { window.removeEventListener("mousemove", handleMouseMove); cancelAnimationFrame(requestRef.current); };
  }, []);

  // GSAP scroll timeline
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const ctx = gsap.context(() => {
      // Initial states
      gsap.set(".text-track", { autoAlpha: 0, y: 60, scale: 0.85, filter: "blur(20px)", rotationX: -20 });
      gsap.set(".text-days", { autoAlpha: 1, clipPath: "inset(0 100% 0 0)" });
      gsap.set(".main-card", { y: window.innerHeight + 200, autoAlpha: 1 });
      gsap.set([".card-header-text", ".mockup-scroll-wrapper", ".floating-badge", ".laptop-el", ".screen-captions"], { autoAlpha: 0 });
      gsap.set(".cta-wrapper", { autoAlpha: 0, scale: 0.8, filter: "blur(30px)" });
      gsap.set([".caption-branding", ".caption-live"], { autoAlpha: 0 });

      // Intro animation
      const introTl = gsap.timeline({ delay: 0.3 });
      introTl
        .to(".text-track", { duration: 1.8, autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", rotationX: 0, ease: "expo.out" })
        .to(".text-days", { duration: 1.4, clipPath: "inset(0 0% 0 0)", ease: "power4.inOut" }, "-=1.0");

      // Navbar element for show/hide
      const navbar = document.querySelector("nav");

      // Scroll timeline
      const scrollTl = gsap.timeline({
        scrollTrigger: { trigger: containerRef.current, start: "top top", end: "+=8000", pin: true, scrub: 1, anticipatePin: 1 },
      });

      scrollTl
        // Phase 1-2: Hero text blurs, card flies up
        .to([".hero-text-wrapper", ".bg-grid-theme"], { scale: 1.15, filter: "blur(20px)", opacity: 0.2, ease: "power2.inOut", duration: 2 }, 0)
        .to(".main-card", { y: 0, ease: "power3.inOut", duration: 2 }, 0)

        // Hide navbar as card expands
        .to(navbar, { y: -80, autoAlpha: 0, ease: "power2.in", duration: 0.8 }, 0.5)

        // Phase 3: Card expands fullscreen
        .to(".main-card", { width: "100%", height: "100%", borderRadius: "0px", ease: "power3.inOut", duration: 1.5 })

        // Phase 4: Header text + laptop appear
        .fromTo(".card-header-text", { y: -30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, ease: "power4.out", duration: 1.5 }, "-=0.5")
        .fromTo(".mockup-scroll-wrapper",
          { y: 200, z: -300, rotationX: 30, autoAlpha: 0, scale: 0.8 },
          { y: 0, z: 0, rotationX: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 2.5 }, "-=1.0"
        )
        .fromTo(".laptop-el", { y: 30, autoAlpha: 0, scale: 0.95 }, { y: 0, autoAlpha: 1, scale: 1, stagger: 0.1, ease: "back.out(1.2)", duration: 1.2 }, "-=1.5")
        .fromTo(".screen-captions", { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, ease: "power3.out", duration: 1 }, "-=1.0")

        // Badge + ring animate in
        .to(".progress-ring", { strokeDashoffset: 60, duration: 2, ease: "power3.inOut" }, "-=1.0")
        .to(".counter-val", { innerHTML: 50, snap: { innerHTML: 1 }, duration: 2, ease: "expo.out" }, "-=2.0")
        .fromTo(".floating-badge", { y: 60, autoAlpha: 0, scale: 0.8 }, { y: 0, autoAlpha: 1, scale: 1, ease: "back.out(1.5)", duration: 1.5 }, "-=1.5")

        // Pause on dashboard
        .to({}, { duration: 0.8 })

        // Phase 5a: Swipe to Branding (2x faster)
        .to(".screen-strip", { xPercent: -33.33, ease: "power2.inOut", duration: 0.8 })
        .to(".caption-dashboard", { autoAlpha: 0.3, duration: 0.3 }, "<")
        .to(".caption-branding", { autoAlpha: 1, duration: 0.3 }, "<0.2")
        .to({}, { duration: 0.5 })

        // Phase 5b: Swipe to Live Class (2x faster)
        .to(".screen-strip", { xPercent: -66.66, ease: "power2.inOut", duration: 0.8 })
        .to(".caption-branding", { autoAlpha: 0.3, duration: 0.3 }, "<")
        .to(".caption-live", { autoAlpha: 1, duration: 0.3 }, "<0.2")
        .to({}, { duration: 0.8 })

        // Phase 6: Everything fades, CTA appears
        .set(".hero-text-wrapper", { autoAlpha: 0 })
        .set(".cta-wrapper", { autoAlpha: 1 })
        .to({}, { duration: 1 })
        .to([".mockup-scroll-wrapper", ".floating-badge", ".card-header-text", ".screen-captions"], {
          scale: 0.9, y: -40, z: -200, autoAlpha: 0, ease: "power3.in", duration: 1.2, stagger: 0.05,
        })

        // Phase 7: Card shrinks + CTA visible
        .to(".main-card", {
          width: isMobile ? "92vw" : "85vw", height: isMobile ? "92vh" : "85vh",
          borderRadius: isMobile ? "32px" : "40px", ease: "expo.inOut", duration: 1.8
        }, "pullback")
        .to(".cta-wrapper", { scale: 1, filter: "blur(0px)", ease: "expo.inOut", duration: 1.8 }, "pullback")

        // Card flies away + navbar reappears
        .to(".main-card", { y: -window.innerHeight - 300, ease: "power3.in", duration: 1.5 })
        .to(navbar, { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.8 }, "-=0.5");
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-screen h-screen overflow-hidden flex items-center justify-center bg-[#f3f0ed] font-sans antialiased", className)}
      style={{ perspective: "1500px" }}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />
      <div className="film-grain" aria-hidden="true" />
      <div className="bg-grid-theme absolute inset-0 z-0 pointer-events-none opacity-50" aria-hidden="true" />

      {/* Hero taglines */}
      <div className="hero-text-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-screen px-4 will-change-transform">
        <h1 className="text-track gsap-reveal text-3d-matte text-5xl md:text-7xl lg:text-[6rem] font-bold tracking-tight mb-2">
          World-class LMS,
        </h1>
        <h1 className="text-days gsap-reveal text-silver-matte text-5xl md:text-7xl lg:text-[6rem] font-extrabold tracking-tighter">
          built for Pakistan.
        </h1>
      </div>

      {/* CTA section */}
      <div className="cta-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-screen px-4 gsap-reveal pointer-events-auto will-change-transform">
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight text-silver-matte">
          Start teaching today.
        </h2>
        <p className="text-[#181229]/60 text-lg md:text-xl mb-10 max-w-xl mx-auto font-light leading-relaxed">
          Launch your branded LMS in 5 minutes. Free forever for up to 50 students.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <a href="/register" className="btn-modern-light flex items-center justify-center gap-2 px-8 py-4 rounded-[1.25rem] text-lg font-semibold">
            Start Free — No Card Required
          </a>
          <a href="#pricing" onClick={(e) => { e.preventDefault(); document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }); }} className="btn-modern-dark flex items-center justify-center gap-2 px-8 py-4 rounded-[1.25rem] text-lg font-semibold">
            See Pricing
          </a>
        </div>
        <p className="text-[#181229]/30 text-xs mb-3 uppercase tracking-widest font-medium">Also available on</p>
        <div className="flex gap-4 items-center">
          <a href="#" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/5 hover:bg-black/10 transition-colors">
            <svg className="w-5 h-5 text-[#181229]/60" fill="currentColor" viewBox="0 0 384 512"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
            <span className="text-sm font-medium text-[#181229]/60">App Store</span>
          </a>
          <a href="#" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/5 hover:bg-black/10 transition-colors">
            <svg className="w-5 h-5 text-[#181229]/60" fill="currentColor" viewBox="0 0 512 512"><path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/></svg>
            <span className="text-sm font-medium text-[#181229]/60">Google Play</span>
          </a>
        </div>
      </div>

      {/* Deep blue card */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ perspective: "1500px" }}>
        <div
          ref={mainCardRef}
          className="main-card premium-depth-card relative overflow-hidden gsap-reveal flex items-center justify-center pointer-events-auto w-[92vw] md:w-[85vw] h-[92vh] md:h-[85vh] rounded-[32px] md:rounded-[40px]"
        >
          <div className="card-sheen" aria-hidden="true" />

          {/* Centered stack layout */}
          <div className="relative w-full h-full max-w-6xl mx-auto px-6 lg:px-16 flex flex-col items-center justify-center gap-4 lg:gap-6 z-10 py-8">

            {/* Header text (above laptop) */}
            <div className="card-header-text gsap-reveal text-center">
              <h2 className="text-2xl md:text-4xl lg:text-5xl font-black uppercase tracking-tight text-card-silver-matte mb-2">
                ZEN-LMS
              </h2>
              <p className="text-blue-100/50 text-xs md:text-sm lg:text-base font-normal leading-relaxed max-w-lg mx-auto">
                <span className="text-white/80 font-semibold">AI-powered learning.</span>{" "}
                Generate quizzes from PDFs, build curricula with AI, and let students learn with an AI tutor — all inside your branded platform.
              </p>
            </div>

            {/* MacBook mockup — LARGE, centered */}
            <div className="mockup-scroll-wrapper relative w-full flex-1 min-h-0 flex items-center justify-center z-10" style={{ perspective: "1000px" }}>
              <div className="relative flex items-center justify-center transform scale-[0.6] sm:scale-[0.7] md:scale-[0.85] lg:scale-100">
                <div ref={mockupRef} className="relative will-change-transform" style={{ transformStyle: "preserve-3d" }}>
                  {/* Laptop screen */}
                  <div className="macbook-bezel rounded-t-xl w-[680px] h-[440px] p-[6px]">
                    <div className="w-full h-full bg-[#050914] rounded-t-lg overflow-hidden text-white relative">
                      <BrowserChrome url="youracademy.zensbot.online">
                        {/* Horizontal screen strip — 3 screens side by side */}
                        <div className="overflow-hidden w-full h-full">
                          <div className="screen-strip flex w-[300%] h-full">
                            <div className="w-1/3 h-full"><ScreenDashboard /></div>
                            <div className="w-1/3 h-full"><ScreenBranding /></div>
                            <div className="w-1/3 h-full"><ScreenLiveClass /></div>
                          </div>
                        </div>
                      </BrowserChrome>
                    </div>
                  </div>
                  {/* Laptop base */}
                  <div className="macbook-base w-[750px] h-[16px] rounded-b-xl mx-auto relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70px] h-[5px] bg-[#333] rounded-b-lg" />
                  </div>

                  {/* Progress ring — bottom-right */}
                  <div className="laptop-el absolute -bottom-6 -right-10 lg:-right-16 w-24 h-24 lg:w-28 lg:h-28 flex items-center justify-center drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]">
                    <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
                      <circle cx="50%" cy="50%" r="36" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="7" />
                      <circle className="progress-ring" cx="50%" cy="50%" r="36" fill="none" stroke="#3B82F6" strokeWidth="7" />
                    </svg>
                    <div className="text-center z-10 flex flex-col items-center">
                      <span className="counter-val text-xl lg:text-2xl font-extrabold tracking-tighter text-white">0</span>
                      <span className="text-[6px] text-blue-200/50 uppercase tracking-[0.1em] font-bold mt-0.5">Institutes</span>
                    </div>
                  </div>
                </div>

                {/* Single floating badge — top-right */}
                <div className="floating-badge absolute flex top-0 lg:top-4 right-[-10px] lg:right-[-80px] floating-ui-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 items-center gap-3 z-30">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-b from-blue-500/20 to-blue-900/10 flex items-center justify-center border border-blue-400/30 shadow-inner">
                    <span className="text-base lg:text-xl drop-shadow-lg" aria-hidden="true">🚀</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">50+ Institutes Active</p>
                    <p className="text-blue-200/50 text-[10px] lg:text-xs font-medium">Growing daily</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Screen captions */}
            <div className="screen-captions gsap-reveal flex gap-6 md:gap-10 items-center justify-center">
              <span className="caption-dashboard text-white/80 text-[10px] md:text-xs font-medium tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" /> Your Dashboard
              </span>
              <span className="caption-branding text-white/30 text-[10px] md:text-xs font-medium tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" /> Your Brand
              </span>
              <span className="caption-live text-white/30 text-[10px] md:text-xs font-medium tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> Live Classes
              </span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
