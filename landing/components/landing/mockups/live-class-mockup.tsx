const ATTENDEES = [
  { name: "SK", color: "bg-zen-deep-blue" },
  { name: "JP", color: "bg-zen-purple" },
  { name: "AR", color: "bg-zen-orange" },
  { name: "LM", color: "bg-zen-soft-green text-zen-dark" },
];

const SCHEDULE = [
  { time: "10:00 AM", title: "React Hooks Deep Dive", live: true },
  { time: "2:00 PM", title: "Database Design", live: false },
  { time: "4:30 PM", title: "Project Review", live: false },
];

export function LiveClassMockup() {
  return (
    <div className="space-y-4">
      {/* Class card */}
      <div className="bg-white rounded-xl border border-zen-border/40 p-5 shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse-live" />
              <span className="text-[11px] font-semibold text-red-500 uppercase tracking-wider">Live Now</span>
            </div>
            <h3 className="text-[15px] font-semibold text-zen-dark">React Hooks Deep Dive</h3>
            <p className="text-[12px] text-zen-dark/50 mt-0.5">Module 4 of 8 . Prof. Sarah Chen</p>
          </div>
          {/* Zoom icon */}
          <div className="w-10 h-10 bg-[#2D8CFF] rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 4h11a3 3 0 013 3v6a3 3 0 01-3 3H4a2 2 0 01-2-2V6a2 2 0 012-2zm16 2l-4 3v4l4 3V6z" />
            </svg>
          </div>
        </div>

        {/* Attendees */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex -space-x-2">
            {ATTENDEES.map((a) => (
              <div
                key={a.name}
                className={`w-7 h-7 rounded-full ${a.color} flex items-center justify-center text-[10px] font-medium text-white border-2 border-white`}
              >
                {a.name}
              </div>
            ))}
          </div>
          <span className="text-[11px] text-zen-dark/50">+24 more attending</span>
        </div>

        <button className="w-full bg-[#2D8CFF] text-white text-[13px] font-medium py-2.5 rounded-lg hover:bg-[#2681ed] transition-colors">
          Join Class
        </button>
      </div>

      {/* Mini schedule */}
      <div className="bg-white rounded-xl border border-zen-border/40 p-4 shadow-lg">
        <div className="text-[11px] font-semibold text-zen-dark/50 uppercase tracking-wider mb-3">
          Today&apos;s Schedule
        </div>
        <div className="space-y-2.5">
          {SCHEDULE.map((item) => (
            <div key={item.title} className="flex items-center gap-3">
              <span className="text-[11px] text-zen-dark/40 w-16 flex-shrink-0">{item.time}</span>
              <div className="flex-1">
                <span className="text-[12px] text-zen-dark">{item.title}</span>
              </div>
              {item.live && (
                <span className="text-[9px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                  LIVE
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
