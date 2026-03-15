"use client";

import { useState } from "react";

const THEMES = [
  { name: "Ocean", primary: "#2f2f91", secondary: "#d4c4ee", accent: "#f5c543", bg: "#f0f4ff" },
  { name: "Forest", primary: "#1a5c3a", secondary: "#c5e2ca", accent: "#f5c543", bg: "#f0f7f2" },
  { name: "Sunset", primary: "#b33d1a", secondary: "#f8dfdd", accent: "#fe6621", bg: "#fef5f2" },
  { name: "Royal", primary: "#5b2d8e", secondary: "#d4c4ee", accent: "#8a6aa4", bg: "#f5f0fa" },
  { name: "Slate", primary: "#334155", secondary: "#e2e8f0", accent: "#64748b", bg: "#f8fafc" },
  { name: "Midnight", primary: "#181229", secondary: "#f3f0ed", accent: "#f5c543", bg: "#fcfaf9" },
];

export function BrandingMockup() {
  const [active, setActive] = useState(0);
  const theme = THEMES[active];

  return (
    <div className="space-y-5">
      {/* Mini LMS preview */}
      <div
        className="rounded-xl border border-zen-border/40 overflow-hidden shadow-lg transition-colors duration-500"
        style={{ backgroundColor: theme.bg }}
      >
        {/* Mini navbar */}
        <div
          className="flex items-center justify-between px-4 py-3 transition-colors duration-500"
          style={{ backgroundColor: theme.primary }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md transition-colors duration-500"
              style={{ backgroundColor: theme.accent }}
            />
            <span className="text-white text-[12px] font-medium">Your Academy</span>
          </div>
          <div className="flex gap-3">
            <div className="text-white/60 text-[11px]">Courses</div>
            <div className="text-white/60 text-[11px]">Students</div>
            <div className="text-white/60 text-[11px]">Schedule</div>
          </div>
        </div>

        {/* Mini content */}
        <div className="p-5">
          <div className="text-[13px] font-semibold mb-3" style={{ color: theme.primary }}>
            Welcome back, Admin
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {["Active Students", "This Month", "Completion"].map((label) => (
              <div
                key={label}
                className="rounded-lg p-3 transition-colors duration-500"
                style={{ backgroundColor: theme.secondary }}
              >
                <div className="text-[9px] opacity-60">{label}</div>
                <div className="text-[14px] font-semibold mt-0.5" style={{ color: theme.primary }}>
                  {label === "Active Students" ? "142" : label === "This Month" ? "+23" : "87%"}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <div
              className="text-[11px] text-white px-3 py-1.5 rounded-md transition-colors duration-500"
              style={{ backgroundColor: theme.primary }}
            >
              View Courses
            </div>
            <div
              className="text-[11px] px-3 py-1.5 rounded-md border transition-colors duration-500"
              style={{ borderColor: theme.primary, color: theme.primary }}
            >
              Add Student
            </div>
          </div>
        </div>
      </div>

      {/* Theme swatches */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {THEMES.map((t, i) => (
          <button
            key={t.name}
            onClick={() => setActive(i)}
            className={`group flex flex-col items-center gap-1.5 transition-all ${
              active === i ? "scale-110" : "opacity-60 hover:opacity-100"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                active === i ? "border-zen-dark shadow-md" : "border-transparent"
              }`}
              style={{ backgroundColor: t.primary }}
            />
            <span className="text-[10px] text-zen-dark/60">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
