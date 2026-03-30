'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { PageLoading, PageError } from '@/components/shared/page-states';
import {
  LayoutDashboard, Users, UserCog, BookOpen, Activity,
  TrendingUp, TrendingDown, Minus, AlertTriangle, Clock,
  ChevronDown,
} from 'lucide-react';
import {
  getInsightsOverview, getInsightsStudents, getInsightsStaff,
  getInsightsCourses, getInsightsEngagement,
  type OverviewData, type StudentsData, type StaffData,
  type CoursesData, type EngagementData, type KpiCard,
} from '@/lib/api/admin';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from 'recharts';

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'students', label: 'Students', icon: Users },
  { key: 'staff', label: 'Staff', icon: UserCog },
  { key: 'courses', label: 'Courses', icon: BookOpen },
  { key: 'engagement', label: 'Engagement', icon: Activity },
] as const;

const PERIODS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 0, label: 'All time' },
];

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function formatTimeSince(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ── KPI Card Component ──────────────────────────────────────────

function KpiCardComponent({ label, kpi, format = 'number' }: { label: string; kpi: KpiCard; format?: 'number' | 'percent' }) {
  const val = format === 'percent' ? `${kpi.value}%` : kpi.value.toLocaleString();
  const change = kpi.changePct;
  const isUp = change !== null && change > 0;
  const isDown = change !== null && change < 0;

  return (
    <div className="bg-white rounded-2xl p-5 card-shadow">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold text-primary">{val}</p>
        {change !== null && (
          <div className={`flex items-center gap-1 text-xs font-medium ${isUp ? 'text-green-600' : isDown ? 'text-red-500' : 'text-gray-400'}`}>
            {isUp ? <TrendingUp size={14} /> : isDown ? <TrendingDown size={14} /> : <Minus size={14} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ── Overview Tab ────────────────────────────────────────────────

function OverviewTab({ data }: { data: OverviewData }) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCardComponent label="Active Students" kpi={data.activeStudents} />
        <KpiCardComponent label="Active Batches" kpi={data.activeBatches} />
        <KpiCardComponent label="Lecture Completion" kpi={data.lectureCompletion} format="percent" />
        <KpiCardComponent label="Quiz Pass Rate" kpi={data.quizPassRate} format="percent" />
        <KpiCardComponent label="Classes Conducted" kpi={data.classesConducted} />
        <KpiCardComponent label="Certificates Issued" kpi={data.certificatesIssued} />
        <KpiCardComponent label="Avg Attendance" kpi={data.avgAttendance} format="percent" />
        <KpiCardComponent label="Content Created" kpi={data.contentCreated} />
      </div>

      {data.alerts.length > 0 && (
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" /> Attention Required
          </h3>
          <div className="space-y-2">
            {data.alerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-xl">
                <span className="text-sm text-amber-800">{a.label}</span>
                <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{a.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Students Tab ────────────────────────────────────────────────

function StudentsTab({ data }: { data: StudentsData }) {
  const statusData = Object.entries(data.studentsByStatus).map(([k, v]) => ({ name: k, value: v }));
  const completionData = Object.entries(data.completionDistribution).map(([k, v]) => ({ range: k, count: v }));
  const quizData = Object.entries(data.quizScoreDistribution).map(([k, v]) => ({ range: k, count: v }));
  const riskColors: Record<string, string> = { high: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700' };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student status pie */}
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Student Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Enrollment trend */}
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Enrollment Trend (Weekly)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.enrollmentTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Completion distribution */}
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Lecture Completion Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={completionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quiz score distribution */}
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Quiz Score Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={quizData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* At-risk students table */}
      {data.atRiskStudents.length > 0 && (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">At-Risk Students ({data.atRiskStudents.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Batch</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Watch %</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Quiz Avg</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.atRiskStudents.map((s) => (
                  <tr key={s.studentId} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm">
                      <p className="font-medium text-primary">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.email}</p>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{s.batchName}</td>
                    <td className="px-6 py-3 text-sm font-medium">{s.watchPct}%</td>
                    <td className="px-6 py-3 text-sm font-medium">{s.quizAvg !== null ? `${s.quizAvg}%` : '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskColors[s.riskLevel] || 'bg-gray-100 text-gray-600'}`}>
                        {s.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Staff Tab ───────────────────────────────────────────────────

function StaffTab({ data }: { data: StaffData }) {
  return (
    <div className="space-y-6">
      {/* Teachers */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Teacher Performance</h3>
          {data.idleTeachers > 0 && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{data.idleTeachers} idle</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Batches</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Classes</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Attendance</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Students</th>
              </tr>
            </thead>
            <tbody>
              {data.teachers.map((t) => (
                <tr key={t.teacherId} className={`border-b border-gray-50 hover:bg-gray-50 ${t.isIdle ? 'bg-red-50/50' : ''}`}>
                  <td className="px-6 py-3 text-sm font-medium text-primary">
                    {t.name}
                    {t.isIdle && <span className="ml-2 text-[10px] text-red-500 font-medium">IDLE</span>}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{t.batchesAssigned}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{t.classesConducted}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{t.avgAttendanceRate !== null ? `${t.avgAttendanceRate}%` : '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{t.studentsManaged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Course Creators */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Course Creator Activity</h3>
          {data.idleCreators > 0 && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{data.idleCreators} idle</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Courses</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Lectures</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Materials</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Quizzes</th>
              </tr>
            </thead>
            <tbody>
              {data.creators.map((c) => (
                <tr key={c.creatorId} className={`border-b border-gray-50 hover:bg-gray-50 ${c.isIdle ? 'bg-red-50/50' : ''}`}>
                  <td className="px-6 py-3 text-sm font-medium text-primary">
                    {c.name}
                    {c.isIdle && <span className="ml-2 text-[10px] text-red-500 font-medium">IDLE</span>}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.coursesCreated}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.lecturesUploaded}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.materialsAdded}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.quizzesCreated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Courses Tab ─────────────────────────────────────────────────

function CoursesTab({ data }: { data: CoursesData }) {
  const pipeline = data.certificatePipeline;
  const funnelData = [
    { stage: 'Eligible', count: pipeline.eligible },
    { stage: 'Requested', count: pipeline.requested },
    { stage: 'Approved', count: pipeline.approved },
    { stage: 'Issued', count: pipeline.issued },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quiz pass/fail donut */}
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Overall Quiz Results</h3>
          <div className="flex items-center justify-center gap-8">
            <ResponsiveContainer width={150} height={150}>
              <PieChart>
                <Pie data={[{ name: 'Pass', value: data.quizPassRate }, { name: 'Fail', value: data.quizFailRate }]} dataKey="value" innerRadius={40} outerRadius={65}>
                  <Cell fill="hsl(var(--primary))" />
                  <Cell fill="#ef4444" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(var(--primary))' }} />
                <span className="text-sm text-gray-600">Pass: {data.quizPassRate}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-gray-600">Fail: {data.quizFailRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Certificate pipeline */}
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Certificate Pipeline</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={funnelData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={70} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quiz trend */}
      {data.quizTrend.length > 0 && (
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Quiz Attempts Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.quizTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="attempts" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Course performance table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Course Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Course</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Lectures</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Watch %</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Quiz Pass Rate</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Cert Requests</th>
              </tr>
            </thead>
            <tbody>
              {data.coursePerformance.map((c) => (
                <tr key={c.courseId} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-primary">{c.title}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.lectureCount}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.avgWatchPct !== null ? `${c.avgWatchPct}%` : '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.quizPassRate !== null ? `${c.quizPassRate}%` : '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.certRequests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hardest quizzes */}
      {data.hardestQuizzes.length > 0 && (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Hardest Quizzes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Quiz</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Course</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Score</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Pass Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.hardestQuizzes.map((q) => (
                  <tr key={q.quizId} className="border-b border-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-primary">{q.title}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{q.courseTitle}</td>
                    <td className="px-6 py-3 text-sm text-red-600 font-medium">{q.avgScore}%</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{q.passRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Engagement Tab ──────────────────────────────────────────────

function EngagementTab({ data }: { data: EngagementData }) {
  return (
    <div className="space-y-6">
      {/* Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 card-shadow text-center">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Lecture Completion</p>
          <p className="text-4xl font-bold text-primary">{data.overallLectureCompletion}%</p>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(data.overallLectureCompletion, 100)}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 card-shadow text-center">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Zoom Attendance</p>
          <p className="text-4xl font-bold text-primary">{data.overallAttendanceRate !== null ? `${data.overallAttendanceRate}%` : '—'}</p>
          {data.overallAttendanceRate !== null && (
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(data.overallAttendanceRate, 100)}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* Engagement by batch */}
      {data.engagementByBatch.length > 0 && (
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Engagement by Batch</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.engagementByBatch}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="batchName" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="watchCompletion" name="Watch %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="attendanceRate" name="Attendance %" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most watched */}
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-green-700">Most Watched Lectures</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {data.mostWatched.map((l) => (
              <div key={l.lectureId} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">{l.title}</p>
                  <p className="text-xs text-gray-500">{l.courseTitle}</p>
                </div>
                <span className="text-sm font-semibold text-green-600">{l.avgWatchPct}%</span>
              </div>
            ))}
            {data.mostWatched.length === 0 && <p className="px-6 py-4 text-sm text-gray-400">No data yet</p>}
          </div>
        </div>

        {/* Least watched */}
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-red-700">Least Watched Lectures</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {data.leastWatched.map((l) => (
              <div key={l.lectureId} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">{l.title}</p>
                  <p className="text-xs text-gray-500">{l.courseTitle}</p>
                </div>
                <span className="text-sm font-semibold text-red-600">{l.avgWatchPct}%</span>
              </div>
            ))}
            {data.leastWatched.length === 0 && <p className="px-6 py-4 text-sm text-gray-400">No data yet</p>}
          </div>
        </div>
      </div>

      {/* Low attendance classes */}
      {data.lowAttendanceClasses.length > 0 && (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-red-700">Low Attendance Classes (&lt;60%)</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {data.lowAttendanceClasses.map((c: any) => (
              <div key={c.classId} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">{c.title}</p>
                  <p className="text-xs text-gray-500">{c.batchName} &middot; {c.date}</p>
                </div>
                <span className="text-sm font-semibold text-red-600">{c.attendanceRate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Insights Page ──────────────────────────────────────────

export default function InsightsPage() {
  const { name } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [period, setPeriod] = useState(30);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Tab data states
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [studentsData, setStudentsData] = useState<StudentsData | null>(null);
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [coursesData, setCoursesData] = useState<CoursesData | null>(null);
  const [engagementData, setEngagementData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTabData = useCallback(async (tab: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      switch (tab) {
        case 'overview': {
          const d = await getInsightsOverview(p);
          setOverviewData(d);
          setLastUpdated(d.lastUpdated);
          break;
        }
        case 'students': {
          const d = await getInsightsStudents(p);
          setStudentsData(d);
          setLastUpdated(d.lastUpdated);
          break;
        }
        case 'staff': {
          const d = await getInsightsStaff(p);
          setStaffData(d);
          setLastUpdated(d.lastUpdated);
          break;
        }
        case 'courses': {
          const d = await getInsightsCourses(p);
          setCoursesData(d);
          setLastUpdated(d.lastUpdated);
          break;
        }
        case 'engagement': {
          const d = await getInsightsEngagement(p);
          setEngagementData(d);
          setLastUpdated(d.lastUpdated);
          break;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on tab change or period change
  useEffect(() => {
    fetchTabData(activeTab, period);
  }, [activeTab, period, fetchTabData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchTabData(activeTab, period), 60000);
    return () => clearInterval(interval);
  }, [activeTab, period, fetchTabData]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Insights" subtitle="Your institute's command center" />

      {/* Toolbar: Tabs + Period selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === key
                  ? 'bg-white text-primary card-shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Period selector + last updated */}
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={12} /> Updated {formatTimeSince(lastUpdated)}
            </span>
          )}
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-primary"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <PageLoading variant="cards" />
      ) : error ? (
        <PageError message={error} onRetry={() => fetchTabData(activeTab, period)} />
      ) : (
        <>
          {activeTab === 'overview' && overviewData && <OverviewTab data={overviewData} />}
          {activeTab === 'students' && studentsData && <StudentsTab data={studentsData} />}
          {activeTab === 'staff' && staffData && <StaffTab data={staffData} />}
          {activeTab === 'courses' && coursesData && <CoursesTab data={coursesData} />}
          {activeTab === 'engagement' && engagementData && <EngagementTab data={engagementData} />}
        </>
      )}
    </DashboardLayout>
  );
}
