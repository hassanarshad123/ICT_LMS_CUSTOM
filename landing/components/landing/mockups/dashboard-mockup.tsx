"use client";

import { useState } from "react";

const SIDEBAR_ITEMS = ["Dashboard", "Courses", "Students", "Schedule", "Certificates"] as const;
type Tab = (typeof SIDEBAR_ITEMS)[number];

const URL_PATHS: Record<Tab, string> = {
  Dashboard: "yourschool.zensbot.online/dashboard",
  Courses: "yourschool.zensbot.online/courses",
  Students: "yourschool.zensbot.online/students",
  Schedule: "yourschool.zensbot.online/schedule",
  Certificates: "yourschool.zensbot.online/certificates",
};

function DashboardTab() {
  return (
    <>
      <div className="text-[13px] font-semibold text-zen-dark mb-4">Admin Dashboard</div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Students", value: "298" },
          { label: "Courses", value: "12" },
          { label: "Revenue", value: "$4,820" },
        ].map((s) => (
          <div key={s.label} className="bg-zen-page-bg rounded-lg p-3">
            <div className="text-[10px] text-zen-dark/50">{s.label}</div>
            <div className="text-[15px] font-semibold text-zen-dark mt-0.5">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="text-[11px] font-medium text-zen-dark/50 mb-2">Active Courses</div>
      <div className="space-y-2">
        {[
          { name: "React Fundamentals", students: 128, progress: 85 },
          { name: "Python for Data Science", students: 96, progress: 62 },
          { name: "UI/UX Design Basics", students: 74, progress: 93 },
        ].map((course) => (
          <div key={course.name} className="flex items-center gap-3 text-[11px]">
            <span className="text-zen-dark flex-1 truncate">{course.name}</span>
            <span className="text-zen-dark/40 w-16 text-right">{course.students} students</span>
            <div className="w-16 h-1.5 bg-zen-border/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-zen-deep-blue rounded-full"
                style={{ width: `${course.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function CoursesTab() {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[13px] font-semibold text-zen-dark">Courses</div>
        <div className="text-[10px] bg-zen-deep-blue text-white px-2.5 py-1 rounded-md font-medium">+ New Course</div>
      </div>
      <div className="space-y-2.5">
        {[
          { name: "React Fundamentals", lectures: 24, students: 128, status: "Published", color: "bg-zen-soft-green text-green-800" },
          { name: "Python for Data Science", lectures: 18, students: 96, status: "Published", color: "bg-zen-soft-green text-green-800" },
          { name: "UI/UX Design Basics", lectures: 16, students: 74, status: "Published", color: "bg-zen-soft-green text-green-800" },
          { name: "Advanced Node.js", lectures: 8, students: 0, status: "Draft", color: "bg-zen-gold/30 text-yellow-800" },
        ].map((c) => (
          <div key={c.name} className="flex items-center gap-3 bg-zen-page-bg rounded-lg px-3 py-2.5">
            <div className="w-8 h-8 rounded-md bg-zen-deep-blue/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-zen-deep-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-zen-dark truncate">{c.name}</div>
              <div className="text-[10px] text-zen-dark/40">{c.lectures} lectures &middot; {c.students} students</div>
            </div>
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${c.color}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function StudentsTab() {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[13px] font-semibold text-zen-dark">Students</div>
        <div className="text-[10px] text-zen-dark/40">298 total</div>
      </div>
      <div className="space-y-2">
        {[
          { name: "Sarah Khan", email: "sarah.k@email.com", batch: "Batch A", courses: 3, progress: 78 },
          { name: "Arjun Mehta", email: "arjun.m@email.com", batch: "Batch A", courses: 2, progress: 92 },
          { name: "Priya Sharma", email: "priya.s@email.com", batch: "Batch B", courses: 4, progress: 65 },
          { name: "Ravi Patel", email: "ravi.p@email.com", batch: "Batch B", courses: 2, progress: 45 },
          { name: "Ananya Das", email: "ananya.d@email.com", batch: "Batch A", courses: 3, progress: 88 },
        ].map((s) => (
          <div key={s.email} className="flex items-center gap-3 text-[11px]">
            <div className="w-7 h-7 rounded-full bg-zen-light-purple/50 flex items-center justify-center text-[10px] font-semibold text-zen-purple flex-shrink-0">
              {s.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-zen-dark font-medium truncate">{s.name}</div>
              <div className="text-[10px] text-zen-dark/40">{s.batch} &middot; {s.courses} courses</div>
            </div>
            <div className="w-14 h-1.5 bg-zen-border/40 rounded-full overflow-hidden">
              <div className="h-full bg-zen-purple rounded-full" style={{ width: `${s.progress}%` }} />
            </div>
            <span className="text-[10px] text-zen-dark/40 w-7 text-right">{s.progress}%</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ScheduleTab() {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[13px] font-semibold text-zen-dark">This Week</div>
        <div className="text-[10px] bg-zen-deep-blue text-white px-2.5 py-1 rounded-md font-medium">+ Schedule Class</div>
      </div>
      <div className="space-y-2">
        {[
          { title: "React Hooks Deep Dive", time: "Today, 10:00 AM", batch: "Batch A", live: true },
          { title: "Python: Pandas Workshop", time: "Today, 2:00 PM", batch: "Batch B", live: false },
          { title: "UI/UX: Wireframing Lab", time: "Tomorrow, 11:00 AM", batch: "Batch A", live: false },
          { title: "React: State Management", time: "Wed, 10:00 AM", batch: "Batch A", live: false },
          { title: "Python: Data Viz Project", time: "Thu, 3:00 PM", batch: "Batch B", live: false },
        ].map((cls) => (
          <div key={cls.title} className="flex items-center gap-3 bg-zen-page-bg rounded-lg px-3 py-2.5">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${cls.live ? "bg-red-100" : "bg-zen-deep-blue/10"}`}>
              {cls.live ? (
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse-live" />
              ) : (
                <svg className="w-4 h-4 text-zen-deep-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-zen-dark truncate">{cls.title}</div>
              <div className="text-[10px] text-zen-dark/40">{cls.time} &middot; {cls.batch}</div>
            </div>
            {cls.live ? (
              <span className="text-[9px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">LIVE NOW</span>
            ) : (
              <svg className="w-4 h-4 text-zen-deep-blue/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function CertificatesTab() {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[13px] font-semibold text-zen-dark">Certificates</div>
        <div className="text-[10px] text-zen-dark/40">247 issued</div>
      </div>
      <div className="space-y-2">
        {[
          { student: "Sarah Khan", course: "React Fundamentals", id: "#CERT-2847", date: "Mar 12" },
          { student: "Arjun Mehta", course: "Python for Data Science", id: "#CERT-2846", date: "Mar 11" },
          { student: "Priya Sharma", course: "UI/UX Design Basics", id: "#CERT-2845", date: "Mar 10" },
          { student: "Ravi Patel", course: "React Fundamentals", id: "#CERT-2844", date: "Mar 9" },
          { student: "Ananya Das", course: "Python for Data Science", id: "#CERT-2843", date: "Mar 8" },
        ].map((cert) => (
          <div key={cert.id} className="flex items-center gap-3 bg-zen-page-bg rounded-lg px-3 py-2.5">
            <div className="w-8 h-8 rounded-md bg-zen-gold/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-zen-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.375 3.375 0 0013.125 10.875h-2.25A3.375 3.375 0 007.5 14.25v4.5m6-6V6.75A2.25 2.25 0 0011.25 4.5h-.563a2.25 2.25 0 00-2.25 2.25v3.375" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-zen-dark truncate">{cert.student}</div>
              <div className="text-[10px] text-zen-dark/40">{cert.course}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[10px] font-mono text-zen-purple">{cert.id}</div>
              <div className="text-[9px] text-zen-dark/30">{cert.date}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const TAB_CONTENT: Record<Tab, () => JSX.Element> = {
  Dashboard: DashboardTab,
  Courses: CoursesTab,
  Students: StudentsTab,
  Schedule: ScheduleTab,
  Certificates: CertificatesTab,
};

export function DashboardMockup() {
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");

  const ActiveContent = TAB_CONTENT[activeTab];

  return (
    <div className="bg-white rounded-xl shadow-2xl shadow-zen-dark/10 border border-zen-border/60 overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-zen-page-bg border-b border-zen-border/40">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
          <div className="w-3 h-3 rounded-full bg-green-400/60" />
        </div>
        <div className="flex-1 mx-8">
          <div className="bg-white rounded-md px-3 py-1.5 text-[11px] text-zen-dark/40 text-center border border-zen-border/30">
            {URL_PATHS[activeTab]}
          </div>
        </div>
      </div>

      {/* App content */}
      <div className="flex min-h-[320px]">
        {/* Sidebar */}
        <div className="w-[180px] bg-zen-darkest p-4 hidden sm:block">
          <div className="font-serif text-white text-sm mb-6">Your Academy</div>
          <div className="space-y-1">
            {SIDEBAR_ITEMS.map((label) => (
              <button
                key={label}
                onClick={() => setActiveTab(label)}
                className={`w-full text-left text-[12px] px-3 py-2 rounded-lg transition-colors ${
                  activeTab === label
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 p-5">
          <ActiveContent />
        </div>
      </div>
    </div>
  );
}
