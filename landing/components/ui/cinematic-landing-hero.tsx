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
    text-shadow:
      0 10px 30px rgba(24,18,41,0.20),
      0 2px 4px rgba(24,18,41,0.10);
  }

  .text-silver-matte {
    background: linear-gradient(180deg, #181229 0%, rgba(24,18,41,0.4) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transform: translateZ(0);
    filter:
      drop-shadow(0px 10px 20px rgba(24,18,41,0.15))
      drop-shadow(0px 2px 4px rgba(24,18,41,0.10));
  }

  .text-card-silver-matte {
    background: linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    transform: translateZ(0);
    filter:
      drop-shadow(0px 12px 24px rgba(0,0,0,0.8))
      drop-shadow(0px 4px 8px rgba(0,0,0,0.6));
  }

  .premium-depth-card {
    background: linear-gradient(145deg, #162C6D 0%, #0A101D 100%);
    box-shadow:
      0 40px 100px -20px rgba(0, 0, 0, 0.9),
      0 20px 40px -20px rgba(0, 0, 0, 0.8),
      inset 0 1px 2px rgba(255, 255, 255, 0.2),
      inset 0 -2px 4px rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.04);
    position: relative;
  }

  .card-sheen {
    position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 50;
    background: radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.06) 0%, transparent 40%);
    mix-blend-mode: screen; transition: opacity 0.3s ease;
  }

  .macbook-bezel {
    background-color: #1a1a1a;
    box-shadow:
      inset 0 0 0 2px #404040,
      inset 0 0 0 4px #111,
      0 40px 80px -15px rgba(0,0,0,0.9),
      0 15px 25px -5px rgba(0,0,0,0.7);
    transform-style: preserve-3d;
  }

  .macbook-base {
    background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%);
    box-shadow: 0 4px 12px rgba(0,0,0,0.6);
  }

  .floating-ui-badge {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.1),
      0 25px 50px -12px rgba(0, 0, 0, 0.8),
      inset 0 1px 1px rgba(255,255,255,0.2),
      inset 0 -1px 1px rgba(0,0,0,0.5);
  }

  .btn-modern-light, .btn-modern-dark {
    transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
  }
  .btn-modern-light {
    background: linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%);
    color: #0F172A;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.1), 0 12px 24px -4px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,1), inset 0 -3px 6px rgba(0,0,0,0.06);
  }
  .btn-modern-light:hover {
    transform: translateY(-3px);
    box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 6px 12px -2px rgba(0,0,0,0.15), 0 20px 32px -6px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,1), inset 0 -3px 6px rgba(0,0,0,0.06);
  }
  .btn-modern-dark {
    background: linear-gradient(180deg, #27272A 0%, #18181B 100%);
    color: #FFFFFF;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.6), 0 12px 24px -4px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.15), inset 0 -3px 6px rgba(0,0,0,0.8);
  }
  .btn-modern-dark:hover {
    transform: translateY(-3px);
    background: linear-gradient(180deg, #3F3F46 0%, #27272A 100%);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.15), 0 6px 12px -2px rgba(0,0,0,0.7), 0 20px 32px -6px rgba(0,0,0,1), inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -3px 6px rgba(0,0,0,0.8);
  }

  .progress-ring {
    transform: rotate(-90deg);
    transform-origin: center;
    stroke-dasharray: 402;
    stroke-dashoffset: 402;
    stroke-linecap: round;
  }

  .widget-depth {
    background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
    box-shadow:
      0 10px 20px rgba(0,0,0,0.3),
      inset 0 1px 1px rgba(255,255,255,0.05),
      inset 0 -1px 1px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.03);
  }
`;

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
          gsap.to(mockupRef.current, { rotationY: xVal * 12, rotationX: -yVal * 12, ease: "power3.out", duration: 1.2 });
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
      gsap.set(".text-track", { autoAlpha: 0, y: 60, scale: 0.85, filter: "blur(20px)", rotationX: -20 });
      gsap.set(".text-days", { autoAlpha: 1, clipPath: "inset(0 100% 0 0)" });
      gsap.set(".main-card", { y: window.innerHeight + 200, autoAlpha: 1 });
      gsap.set([".card-left-text", ".card-right-text", ".mockup-scroll-wrapper", ".floating-badge", ".laptop-widget"], { autoAlpha: 0 });
      gsap.set(".cta-wrapper", { autoAlpha: 0, scale: 0.8, filter: "blur(30px)" });

      const introTl = gsap.timeline({ delay: 0.3 });
      introTl
        .to(".text-track", { duration: 1.8, autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", rotationX: 0, ease: "expo.out" })
        .to(".text-days", { duration: 1.4, clipPath: "inset(0 0% 0 0)", ease: "power4.inOut" }, "-=1.0");

      const scrollTl = gsap.timeline({
        scrollTrigger: { trigger: containerRef.current, start: "top top", end: "+=7000", pin: true, scrub: 1, anticipatePin: 1 },
      });

      scrollTl
        .to([".hero-text-wrapper", ".bg-grid-theme"], { scale: 1.15, filter: "blur(20px)", opacity: 0.2, ease: "power2.inOut", duration: 2 }, 0)
        .to(".main-card", { y: 0, ease: "power3.inOut", duration: 2 }, 0)
        .to(".main-card", { width: "100%", height: "100%", borderRadius: "0px", ease: "power3.inOut", duration: 1.5 })
        .fromTo(".mockup-scroll-wrapper",
          { y: 300, z: -500, rotationX: 50, rotationY: -30, autoAlpha: 0, scale: 0.6 },
          { y: 0, z: 0, rotationX: 0, rotationY: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 2.5 }, "-=0.8"
        )
        .fromTo(".laptop-widget", { y: 40, autoAlpha: 0, scale: 0.95 }, { y: 0, autoAlpha: 1, scale: 1, stagger: 0.15, ease: "back.out(1.2)", duration: 1.5 }, "-=1.5")
        .to(".progress-ring", { strokeDashoffset: 60, duration: 2, ease: "power3.inOut" }, "-=1.2")
        .to(".counter-val", { innerHTML: 50, snap: { innerHTML: 1 }, duration: 2, ease: "expo.out" }, "-=2.0")
        .fromTo(".floating-badge", { y: 100, autoAlpha: 0, scale: 0.7, rotationZ: -10 }, { y: 0, autoAlpha: 1, scale: 1, rotationZ: 0, ease: "back.out(1.5)", duration: 1.5, stagger: 0.2 }, "-=2.0")
        .fromTo(".card-left-text", { x: -50, autoAlpha: 0 }, { x: 0, autoAlpha: 1, ease: "power4.out", duration: 1.5 }, "-=1.5")
        .fromTo(".card-right-text", { x: 50, autoAlpha: 0, scale: 0.8 }, { x: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 1.5 }, "<")
        .to({}, { duration: 2.5 })
        .set(".hero-text-wrapper", { autoAlpha: 0 })
        .set(".cta-wrapper", { autoAlpha: 1 })
        .to({}, { duration: 1.5 })
        .to([".mockup-scroll-wrapper", ".floating-badge", ".card-left-text", ".card-right-text"], {
          scale: 0.9, y: -40, z: -200, autoAlpha: 0, ease: "power3.in", duration: 1.2, stagger: 0.05,
        })
        .to(".main-card", {
          width: isMobile ? "92vw" : "85vw",
          height: isMobile ? "92vh" : "85vh",
          borderRadius: isMobile ? "32px" : "40px",
          ease: "expo.inOut", duration: 1.8
        }, "pullback")
        .to(".cta-wrapper", { scale: 1, filter: "blur(0px)", ease: "expo.inOut", duration: 1.8 }, "pullback")
        .to(".main-card", { y: -window.innerHeight - 300, ease: "power3.in", duration: 1.5 });
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

      {/* CTA section (revealed after card pullback) */}
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

      {/* The deep blue card */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ perspective: "1500px" }}>
        <div
          ref={mainCardRef}
          className="main-card premium-depth-card relative overflow-hidden gsap-reveal flex items-center justify-center pointer-events-auto w-[92vw] md:w-[85vw] h-[92vh] md:h-[85vh] rounded-[32px] md:rounded-[40px]"
        >
          <div className="card-sheen" aria-hidden="true" />

          <div className="relative w-full h-full max-w-7xl mx-auto px-4 lg:px-12 flex flex-col justify-evenly lg:grid lg:grid-cols-3 items-center lg:gap-8 z-10 py-6 lg:py-0">

            {/* Brand name (right on desktop, top on mobile) */}
            <div className="card-right-text gsap-reveal order-1 lg:order-3 flex justify-center lg:justify-end z-20 w-full">
              <h2 className="text-5xl md:text-[5rem] lg:text-[7rem] font-black uppercase tracking-tighter text-card-silver-matte">
                ZEN-LMS
              </h2>
            </div>

            {/* MacBook mockup (center) */}
            <div className="mockup-scroll-wrapper order-2 lg:order-2 relative w-full h-[320px] lg:h-[500px] flex items-center justify-center z-10" style={{ perspective: "1000px" }}>
              <div className="relative w-full h-full flex items-center justify-center transform scale-[0.55] md:scale-75 lg:scale-90">
                <div ref={mockupRef} className="relative will-change-transform" style={{ transformStyle: "preserve-3d" }}>
                  {/* Laptop screen */}
                  <div className="macbook-bezel rounded-t-xl w-[480px] h-[310px] p-[6px]">
                    <div className="w-full h-full bg-[#050914] rounded-t-lg overflow-hidden text-white relative">
                      {/* Browser chrome */}
                      <div className="laptop-widget flex items-center gap-1.5 px-3 py-2 bg-[#0d1117] border-b border-white/5">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-400/60" />
                          <div className="w-2 h-2 rounded-full bg-yellow-400/60" />
                          <div className="w-2 h-2 rounded-full bg-green-400/60" />
                        </div>
                        <div className="flex-1 mx-4">
                          <div className="bg-white/5 rounded px-2 py-0.5 text-[8px] text-white/30 text-center">youracademy.zensbot.online/dashboard</div>
                        </div>
                      </div>
                      {/* Dashboard content */}
                      <div className="flex h-[calc(100%-28px)]">
                        {/* Sidebar */}
                        <div className="laptop-widget w-[100px] bg-[#0a0f1a] p-3 border-r border-white/5 hidden sm:block">
                          <div className="text-[8px] font-bold text-white/80 mb-3">Your Academy</div>
                          <div className="space-y-1">
                            {["Dashboard", "Courses", "Students", "Schedule"].map((item, i) => (
                              <div key={item} className={`text-[7px] px-2 py-1 rounded ${i === 0 ? "bg-white/10 text-white" : "text-white/30"}`}>{item}</div>
                            ))}
                          </div>
                        </div>
                        {/* Main area */}
                        <div className="flex-1 p-3">
                          <div className="laptop-widget grid grid-cols-3 gap-2 mb-3">
                            {[{ l: "Students", v: "298" }, { l: "Courses", v: "12" }, { l: "Revenue", v: "$4.8k" }].map(s => (
                              <div key={s.l} className="widget-depth rounded-lg p-2">
                                <div className="text-[6px] text-white/30">{s.l}</div>
                                <div className="text-[11px] font-bold text-white">{s.v}</div>
                              </div>
                            ))}
                          </div>
                          <div className="laptop-widget space-y-1.5">
                            {["React Fundamentals", "Python Data Science", "UI/UX Design"].map((c, i) => (
                              <div key={c} className="widget-depth rounded-lg px-2 py-1.5 flex items-center gap-2">
                                <div className="w-4 h-4 rounded bg-blue-500/20 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 rounded-sm bg-blue-400" />
                                </div>
                                <div className="flex-1">
                                  <div className="text-[7px] text-white/70">{c}</div>
                                  <div className="w-full h-1 bg-white/5 rounded-full mt-0.5">
                                    <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${85 - i * 15}%` }} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Laptop base */}
                  <div className="macbook-base w-[540px] h-[14px] rounded-b-xl mx-auto relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60px] h-[4px] bg-[#333] rounded-b-lg" />
                  </div>

                  {/* Progress ring overlay */}
                  <div className="laptop-widget absolute -bottom-4 -right-8 lg:-right-16 w-28 h-28 flex items-center justify-center drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]">
                    <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
                      <circle cx="56" cy="56" r="42" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
                      <circle className="progress-ring" cx="56" cy="56" r="42" fill="none" stroke="#3B82F6" strokeWidth="8" style={{ strokeDasharray: 264, strokeDashoffset: 264 }} />
                    </svg>
                    <div className="text-center z-10 flex flex-col items-center">
                      <span className="counter-val text-2xl font-extrabold tracking-tighter text-white">0</span>
                      <span className="text-[6px] text-blue-200/50 uppercase tracking-[0.1em] font-bold mt-0.5">Institutes</span>
                    </div>
                  </div>
                </div>

                {/* Floating badges */}
                <div className="floating-badge absolute flex top-2 lg:top-6 left-0 lg:left-[-60px] floating-ui-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 items-center gap-3 z-30">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-b from-blue-500/20 to-blue-900/10 flex items-center justify-center border border-blue-400/30 shadow-inner">
                    <span className="text-base lg:text-xl drop-shadow-lg" aria-hidden="true">🚀</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">50+ Institutes Active</p>
                    <p className="text-blue-200/50 text-[10px] lg:text-xs font-medium">Growing daily</p>
                  </div>
                </div>

                <div className="floating-badge absolute flex bottom-8 lg:bottom-12 right-0 lg:right-[-60px] floating-ui-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 items-center gap-3 z-30">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-b from-indigo-500/20 to-indigo-900/10 flex items-center justify-center border border-indigo-400/30 shadow-inner">
                    <span className="text-base lg:text-lg drop-shadow-lg" aria-hidden="true">✨</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">AI Quiz Generated</p>
                    <p className="text-blue-200/50 text-[10px] lg:text-xs font-medium">20 questions ready</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card text (left on desktop, bottom on mobile) */}
            <div className="card-left-text gsap-reveal order-3 lg:order-1 flex flex-col justify-center text-center lg:text-left z-20 w-full px-4 lg:px-0">
              <h3 className="text-white text-2xl md:text-3xl lg:text-4xl font-bold mb-0 lg:mb-5 tracking-tight">
                AI-powered learning.
              </h3>
              <p className="hidden md:block text-blue-100/70 text-sm md:text-base lg:text-lg font-normal leading-relaxed mx-auto lg:mx-0 max-w-sm lg:max-w-none">
                <span className="text-white font-semibold">Zensbot LMS</span> generates quizzes from PDFs, builds curricula with AI, and lets students learn with an AI tutor — all inside your branded platform.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
