import { ScrollReveal } from "./scroll-reveal";

const QUIZ_QUESTIONS = [
  {
    q: "What is the primary purpose of useEffect?",
    opts: ["Side effects", "State management", "Routing", "Styling"],
  },
  {
    q: "When does useCallback re-create the function?",
    opts: ["Dependency change", "Every render", "Never", "On mount"],
  },
];

const CURRICULUM_WEEKS = [
  { week: "Week 1", title: "Python Fundamentals", lectures: 4 },
  { week: "Week 2", title: "NumPy and Arrays", lectures: 3 },
  { week: "Week 3", title: "Pandas DataFrames", lectures: 5 },
  { week: "Week 4", title: "Data Visualization", lectures: 4 },
  { week: "Week 5", title: "Statistical Analysis", lectures: 3 },
  { week: "Week 6", title: "Final Project", lectures: 2 },
];

function QuizGenCard() {
  return (
    <div className="group relative bg-white rounded-2xl border border-zen-border/40 shadow-sm hover:shadow-lg transition-shadow overflow-hidden">
      <div className="bg-gradient-to-br from-zen-purple/5 to-zen-light-purple/20 px-6 pt-6 pb-4">
        <div className="w-10 h-10 rounded-xl bg-zen-purple/10 flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-zen-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="font-serif text-xl text-zen-dark mb-1.5">AI Quiz Generation</h3>
        <p className="text-sm text-zen-dark-80 leading-relaxed">
          Upload a PDF, get 20 questions in seconds.
        </p>
      </div>
      <div className="px-5 py-4 space-y-2.5">
        <div className="flex items-center gap-2 bg-zen-page-bg rounded-lg px-3 py-2">
          <svg className="w-4 h-4 text-zen-purple flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-[11px] text-zen-dark">lecture-module-4.pdf</span>
          <span className="text-[10px] text-zen-dark/40 ml-auto">2.4 MB</span>
        </div>
        <div className="text-[10px] text-zen-dark/50 text-center">20 questions generated</div>
        {QUIZ_QUESTIONS.map((item, i) => (
          <div key={i} className="bg-white rounded-lg border border-zen-border/30 p-2.5">
            <div className="text-[11px] font-medium text-zen-dark mb-1.5">
              {i + 1}. {item.q}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {item.opts.map((opt, j) => (
                <div
                  key={opt}
                  className={`text-[10px] px-2 py-1 rounded border ${
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

function CourseBuilderCard() {
  return (
    <div className="group relative bg-white rounded-2xl border border-zen-border/40 shadow-sm hover:shadow-lg transition-shadow overflow-hidden">
      <div className="bg-gradient-to-br from-zen-deep-blue/5 to-zen-soft-green/20 px-6 pt-6 pb-4">
        <div className="w-10 h-10 rounded-xl bg-zen-deep-blue/10 flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-zen-deep-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="font-serif text-xl text-zen-dark mb-1.5">AI Course Builder</h3>
        <p className="text-sm text-zen-dark-80 leading-relaxed">
          Describe a course, watch the curriculum write itself.
        </p>
      </div>
      <div className="px-5 py-4 space-y-2">
        <div className="bg-zen-page-bg rounded-lg px-3 py-2">
          <div className="text-[10px] text-zen-dark/40 mb-0.5">Prompt</div>
          <div className="text-[11px] text-zen-dark">
            &quot;Create a 6-week Python data science course for beginners&quot;
          </div>
        </div>
        <div className="text-[10px] text-zen-dark/50 text-center">Curriculum generated</div>
        <div className="space-y-1">
          {CURRICULUM_WEEKS.map((w) => (
            <div key={w.week} className="flex items-center gap-2.5 bg-white rounded-lg border border-zen-border/30 px-2.5 py-1.5">
              <span className="text-[10px] font-semibold text-zen-purple w-11">{w.week}</span>
              <span className="text-[11px] text-zen-dark flex-1">{w.title}</span>
              <span className="text-[9px] text-zen-dark/40">{w.lectures} lec</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AiTutorCard() {
  return (
    <div className="group relative bg-white rounded-2xl border border-zen-border/40 shadow-sm hover:shadow-lg transition-shadow overflow-hidden">
      <div className="bg-gradient-to-br from-zen-gold/10 to-zen-soft-pink/20 px-6 pt-6 pb-4">
        <div className="w-10 h-10 rounded-xl bg-zen-gold/15 flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-zen-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h3 className="font-serif text-xl text-zen-dark mb-1.5">AI Tutor</h3>
        <p className="text-sm text-zen-dark-80 leading-relaxed">
          Students ask, AI explains instantly.
        </p>
      </div>
      <div className="px-5 py-4 space-y-2">
        <div className="flex justify-end">
          <div className="bg-zen-deep-blue text-white text-[11px] px-3 py-2 rounded-lg rounded-br-none max-w-[85%]">
            Can you explain the difference between useState and useRef?
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-white border border-zen-border/30 text-[11px] text-zen-dark px-3 py-2 rounded-lg rounded-bl-none max-w-[90%] space-y-1">
            <p>
              <strong>useState</strong> triggers a re-render when the value changes. Use it for data that affects what the user sees.
            </p>
            <p>
              <strong>useRef</strong> holds a mutable value without causing re-renders. Use it for DOM refs or silent tracking.
            </p>
          </div>
        </div>
        <div className="bg-zen-page-bg rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-[11px] text-zen-dark/30 flex-1">Ask a follow-up question...</span>
          <div className="w-5 h-5 bg-zen-purple rounded-md flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AiShowcase() {
  return (
    <section id="ai" className="py-24 px-6">
      <div className="max-w-[1200px] mx-auto">
        <ScrollReveal animation="fade-up">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold tracking-[0.2em] text-zen-purple uppercase mb-4 block">
              AI-POWERED
            </span>
            <h2 className="font-serif text-[32px] sm:text-[44px] md:text-[52px] leading-[1.1] text-zen-dark mb-5">
              Your AI Teaching Assistant
            </h2>
            <p className="text-[16px] sm:text-[17px] text-zen-dark-80 max-w-[560px] mx-auto leading-relaxed">
              Generate quizzes from PDFs, build entire course curricula, and give every student a personal AI tutor — all in seconds.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ScrollReveal animation="fade-up" delay={0}>
            <QuizGenCard />
          </ScrollReveal>
          <ScrollReveal animation="fade-up" delay={150}>
            <CourseBuilderCard />
          </ScrollReveal>
          <ScrollReveal animation="fade-up" delay={300}>
            <AiTutorCard />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
