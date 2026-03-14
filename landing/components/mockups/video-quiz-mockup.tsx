export function VideoQuizMockup() {
  return (
    <div className="space-y-4">
      {/* Video player frame */}
      <div className="bg-zen-darkest rounded-xl overflow-hidden shadow-lg">
        {/* Video area */}
        <div className="relative aspect-video bg-gradient-to-br from-zen-dark to-zen-darkest flex items-center justify-center">
          {/* Play button */}
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>

          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.08]">
            <div className="text-white text-[28px] font-medium -rotate-12">
              student@email.com
            </div>
          </div>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
            <div className="flex items-center gap-2 text-[10px] text-white/60">
              <span>12:34</span>
              <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-zen-orange rounded-full w-[45%]" />
              </div>
              <span>27:48</span>
            </div>
          </div>

          {/* CDN badge */}
          <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-[9px] text-white/60 px-2 py-1 rounded-md">
            Global CDN
          </div>
        </div>

        {/* Video info */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[12px] font-medium text-white">Module 4: React Hooks</div>
            <div className="text-[10px] text-white/40">Lecture 2 of 6</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] text-white/40">50MB chunk uploads</div>
          </div>
        </div>
      </div>

      {/* Quiz card */}
      <div className="bg-white rounded-xl border border-zen-border/40 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-zen-dark">Module 4 Quiz</span>
          <span className="text-[10px] text-zen-dark/40">Question 3 of 10</span>
        </div>
        <div className="text-[12px] text-zen-dark mb-3">
          Which hook should you use to persist a value between renders without triggering a re-render?
        </div>
        <div className="space-y-2">
          {["useState", "useRef", "useMemo", "useContext"].map((opt, i) => (
            <div
              key={opt}
              className={`text-[11px] px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                i === 1
                  ? "bg-zen-deep-blue/10 border-zen-deep-blue/30 text-zen-deep-blue font-medium"
                  : "border-zen-border/30 text-zen-dark/60 hover:bg-zen-page-bg"
              }`}
            >
              {opt}
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-3">
          <div className="text-[11px] text-white bg-zen-dark px-4 py-1.5 rounded-lg">
            Next
          </div>
        </div>
      </div>
    </div>
  );
}
