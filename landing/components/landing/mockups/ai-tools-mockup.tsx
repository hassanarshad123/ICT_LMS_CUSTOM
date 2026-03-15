"use client";

import { useState } from "react";

const TABS = ["Quiz Gen", "Course Builder", "AI Tutor"] as const;

function QuizGenTab() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 bg-zen-page-bg rounded-lg px-3 py-2">
        <svg className="w-4 h-4 text-zen-purple flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span className="text-[11px] text-zen-dark">lecture-module-4.pdf</span>
        <span className="text-[10px] text-zen-dark/40 ml-auto">2.4 MB</span>
      </div>
      <div className="text-[11px] text-zen-dark/50 text-center">20 questions generated</div>
      <div className="space-y-2">
        {[
          { q: "What is the primary purpose of useEffect?", opts: ["Side effects", "State management", "Routing", "Styling"] },
          { q: "When does useCallback re-create the function?", opts: ["Dependency change", "Every render", "Never", "On mount"] },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-lg border border-zen-border/30 p-3">
            <div className="text-[11px] font-medium text-zen-dark mb-2">
              {i + 1}. {item.q}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {item.opts.map((opt, j) => (
                <div
                  key={opt}
                  className={`text-[10px] px-2 py-1.5 rounded border ${
                    j === 0
                      ? "bg-zen-soft-green/40 border-green-300 text-zen-dark"
                      : "bg-white border-zen-border/30 text-zen-dark/60"
                  }`}
                >
                  {opt}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CourseBuilderTab() {
  return (
    <div className="p-4 space-y-3">
      <div className="bg-zen-page-bg rounded-lg px-3 py-2">
        <div className="text-[10px] text-zen-dark/40 mb-1">Prompt</div>
        <div className="text-[11px] text-zen-dark">
          &quot;Create a 6-week Python data science course for beginners&quot;
        </div>
      </div>
      <div className="text-[11px] text-zen-dark/50 text-center">Curriculum generated</div>
      <div className="space-y-1.5">
        {[
          { week: "Week 1", title: "Python Fundamentals", lectures: 4 },
          { week: "Week 2", title: "NumPy and Arrays", lectures: 3 },
          { week: "Week 3", title: "Pandas DataFrames", lectures: 5 },
          { week: "Week 4", title: "Data Visualization", lectures: 4 },
          { week: "Week 5", title: "Statistical Analysis", lectures: 3 },
          { week: "Week 6", title: "Final Project", lectures: 2 },
        ].map((w) => (
          <div key={w.week} className="flex items-center gap-3 bg-white rounded-lg border border-zen-border/30 px-3 py-2">
            <span className="text-[10px] font-semibold text-zen-purple w-12">{w.week}</span>
            <span className="text-[11px] text-zen-dark flex-1">{w.title}</span>
            <span className="text-[10px] text-zen-dark/40">{w.lectures} lectures</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiTutorTab() {
  return (
    <div className="p-4 space-y-3">
      <div className="space-y-2.5">
        {/* Student question */}
        <div className="flex justify-end">
          <div className="bg-zen-deep-blue text-white text-[11px] px-3 py-2 rounded-lg rounded-br-none max-w-[80%]">
            Can you explain the difference between useState and useRef?
          </div>
        </div>
        {/* AI response */}
        <div className="flex justify-start">
          <div className="bg-white border border-zen-border/30 text-[11px] text-zen-dark px-3 py-2 rounded-lg rounded-bl-none max-w-[85%] space-y-1.5">
            <p>
              <strong>useState</strong> triggers a re-render when the value changes. Use it for data that affects what the user sees.
            </p>
            <p>
              <strong>useRef</strong> holds a mutable value that persists across renders without causing re-renders. Use it for DOM references or values you need to track silently.
            </p>
          </div>
        </div>
        {/* Follow up */}
        <div className="flex justify-end">
          <div className="bg-zen-deep-blue text-white text-[11px] px-3 py-2 rounded-lg rounded-br-none max-w-[80%]">
            When should I use useRef instead of a regular variable?
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-white border border-zen-border/30 text-[11px] text-zen-dark px-3 py-2 rounded-lg rounded-bl-none max-w-[85%]">
            Regular variables reset on every render. useRef keeps its value between renders. Use it when you need persistence without re-rendering.
          </div>
        </div>
      </div>
      <div className="bg-zen-page-bg rounded-lg px-3 py-2 flex items-center gap-2">
        <span className="text-[11px] text-zen-dark/30 flex-1">Ask a follow-up question...</span>
        <div className="w-6 h-6 bg-zen-purple rounded-md flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function AiToolsMockup() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="bg-white rounded-xl border border-zen-border/40 shadow-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-zen-border/30">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`flex-1 text-[12px] font-medium py-3 transition-colors relative ${
              activeTab === i
                ? "text-zen-dark"
                : "text-zen-dark/40 hover:text-zen-dark/60"
            }`}
          >
            {tab}
            {activeTab === i && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zen-purple" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[320px]">
        {activeTab === 0 && <QuizGenTab />}
        {activeTab === 1 && <CourseBuilderTab />}
        {activeTab === 2 && <AiTutorTab />}
      </div>
    </div>
  );
}
