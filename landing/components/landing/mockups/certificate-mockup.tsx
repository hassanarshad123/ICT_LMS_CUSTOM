export function CertificateMockup() {
  return (
    <div className="space-y-4">
      {/* Certificate preview */}
      <div className="bg-white rounded-xl border-2 border-zen-gold/30 p-6 shadow-lg relative overflow-hidden">
        {/* Decorative border */}
        <div className="absolute inset-2 border border-zen-gold/20 rounded-lg pointer-events-none" />

        <div className="text-center relative">
          <div className="text-[10px] tracking-[0.3em] text-zen-gold uppercase font-semibold mb-2">
            Certificate of Completion
          </div>
          <div className="font-serif text-[20px] text-zen-dark leading-tight mb-1">
            React Fundamentals
          </div>
          <div className="text-[11px] text-zen-dark/50 mb-4">Awarded to</div>
          <div className="font-serif text-[16px] text-zen-deep-blue mb-4">
            Priya Sharma
          </div>
          <div className="text-[10px] text-zen-dark/40 leading-relaxed max-w-[300px] mx-auto mb-5">
            For successfully completing the 8-week React Fundamentals course
            with a grade of 94%.
          </div>

          {/* Signatures */}
          <div className="flex items-end justify-between px-4">
            <div className="text-center">
              <div className="font-serif text-[13px] text-zen-dark/60 italic mb-1">Sarah Chen</div>
              <div className="w-20 border-t border-zen-dark/20" />
              <div className="text-[9px] text-zen-dark/40 mt-1">Instructor</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-zen-dark/30 font-mono">CERT-2024-002847</div>
            </div>
            <div className="text-center">
              <div className="font-serif text-[13px] text-zen-dark/60 italic mb-1">Raj Patel</div>
              <div className="w-20 border-t border-zen-dark/20" />
              <div className="text-[9px] text-zen-dark/40 mt-1">Director</div>
            </div>
          </div>
        </div>
      </div>

      {/* Job posting card */}
      <div className="bg-white rounded-xl border border-zen-border/40 p-4 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-zen-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-[11px] font-semibold text-zen-dark/50 uppercase tracking-wider">Job Board</span>
        </div>
        <div className="space-y-2.5">
          {[
            { title: "Junior React Developer", company: "TechCorp", type: "Full-time", tag: "bg-zen-soft-green" },
            { title: "UI/UX Design Intern", company: "DesignLab", type: "Internship", tag: "bg-zen-light-purple" },
          ].map((job) => (
            <div key={job.title} className="flex items-center gap-3 p-2.5 rounded-lg bg-zen-page-bg">
              <div className={`w-8 h-8 ${job.tag} rounded-lg flex items-center justify-center text-[10px] font-bold text-zen-dark/60`}>
                {job.company[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-zen-dark truncate">{job.title}</div>
                <div className="text-[10px] text-zen-dark/40">{job.company} . {job.type}</div>
              </div>
              <div className="text-[10px] text-zen-deep-blue font-medium flex-shrink-0">Apply</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
